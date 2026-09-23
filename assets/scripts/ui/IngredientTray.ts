import { _decorator, Component, EventTouch, Node, UITransform, Vec3, view } from 'cc';
import { ALL_INGREDIENTS } from '../config/ingredients';
import { BusEvent, bus } from '../game/bus';
import { createDragGesture } from './dragGesture';
import { createIngredientGhost } from './ingredientGhost';
import { createIngredientIcon } from './ingredientIcon';
import { COLUMN_COUNT, ROW_COUNT, ROW_SPACING, SLOT_HEIGHT, trayLayout } from './trayLayout';
import { createLabel, createUiNode, paintRoundPanel, UI_COLOR, visibleWidth } from './uiFactory';

const { ccclass } = _decorator;

/**
 * 格子圆角半径（设计像素）：取格子高度的两成上下，四角圆润、没有尖角，与整屏"轻松友好"的调性一致。
 * 再大就会把 160×96 的格子收成胶囊形，图标与中文名的横向余量也跟着变窄。
 */
const SLOT_RADIUS = 20;

/**
 * 配料盘：把 12 格配料摆出来，负责"玩家用哪种手势选中了哪一格"。
 * 它不知道规则也不认识碗——点按只发一条事件；拖动只上报"拖着谁、松手在哪"，
 * 落点算不算进碗由适配层判定，放不放得进碗里由核心决定。
 *
 * "这一次触碰算点按还是算拖动"整块判定收在 `ui/dragGesture.ts`（不 import 引擎、有单测）；
 * 本组件只负责跟手幽灵的建与拆，并把状态机给出的结论翻译成总线事件。
 */
@ccclass('IngredientTray')
export class IngredientTray extends Component {
  private slotNodes = new Map<string, Node>();
  /** 手势判定（阈值、一次只认一根手指、点按与拖动的分界）都在它里面 */
  private readonly gesture = createDragGesture();
  /** 这一段手势对应的可视物：跟手的幽灵 + 它代表哪一格（与状态机同生同灭） */
  private active: { ingredientId: string; ghost: Node } | null = null;

  protected onLoad(): void {
    this.buildSlots();
    // 可视区变了（手机转屏、浏览器工具栏收起、桌面窗口缩放）要按新的可见宽度重排：
    // 格子尺寸是按可见宽度算的，只算一次的话，视口一变最外侧两列又会被裁出屏幕
    view.on('canvas-resize', this.rebuildSlots, this);
  }

  protected onDestroy(): void {
    view.off('canvas-resize', this.rebuildSlots, this);
    // 组件被拆时拖动还悬着的话，先把高亮熄掉、幽灵收掉，别把状态漏到下一局
    this.abandonDrag();
    this.clearSlots();
  }

  protected onDisable(): void {
    // 单局页在拖动中途被藏起来（时间到切结算页等）：触摸事件不会再回来收尾，这里兜底复位
    this.abandonDrag();
  }

  private buildSlots(): void {
    const { spacing, slotWidth } = trayLayout(visibleWidth());
    ALL_INGREDIENTS.forEach((ingredient, index) => {
      const column = index % COLUMN_COUNT;
      const row = Math.floor(index / COLUMN_COUNT);
      const x = (column - (COLUMN_COUNT - 1) / 2) * spacing;
      // 三行以配料盘中心为基准上下对称排开：正着数第三行会探出面板、掉到屏幕外
      const y = ((ROW_COUNT - 1) / 2 - row) * ROW_SPACING;

      const slot = createUiNode(this.node, `Slot_${ingredient.id}`, slotWidth, SLOT_HEIGHT, y, x);
      // 奶白圆角格子：不描边——浅底压在随机背景图上，一圈描边反而会把"柔和"割出硬边（见 UI_COLOR.traySlot）
      paintRoundPanel(slot, UI_COLOR.traySlot, SLOT_RADIUS);

      // 图标在上、中文短标签在下：图标是主识别通道，标签兜底（含撞脸项区分）；
      // 图标位置略上移，给下方标签留出格子内的高度，两者不重叠
      const slotIcon = createIngredientIcon(slot, ingredient.id, 52, 'Icon');
      slotIcon.setPosition(0, 16, 0);
      // 汤底与小料用不同字色区分，避免一眼看混两类；奶白底上改用两支深色（原来那对浅色会糊没）
      const labelColor = ingredient.category === 'base' ? UI_COLOR.traySlotLabelBase : UI_COLOR.traySlotLabel;
      createLabel(slot, 'Name', ingredient.name, -28, 18, labelColor, slotWidth - 8);

      const ingredientId = ingredient.id;
      // 点按不另挂 Button：越过阈值算拖动、没越过算点按，两类手势都由下面这四个 TOUCH_* 判（判定在 dragGesture 里）。
      // 少一个 Button 不只是少一个组件——它当年只为拿一次 click，却带来"click 与 TOUCH_END 谁先到"这条时序依赖。
      slot.on(Node.EventType.TOUCH_START, (event: EventTouch) => this.onSlotTouchStart(ingredientId, event), this);
      slot.on(Node.EventType.TOUCH_MOVE, (event: EventTouch) => this.onSlotTouchMove(event), this);
      slot.on(Node.EventType.TOUCH_END, (event: EventTouch) => this.onSlotTouchFinished(event), this);
      slot.on(Node.EventType.TOUCH_CANCEL, (event: EventTouch) => this.onSlotTouchFinished(event), this);

      this.slotNodes.set(ingredientId, slot);
    });
  }

  /** 按当前可见宽度重排：拆掉旧格子再重建；正在拖动就先按"被打断"收尾，别让幽灵跟着旧格子走 */
  private rebuildSlots(): void {
    this.abandonDrag();
    this.clearSlots();
    this.buildSlots();
  }

  private clearSlots(): void {
    for (const slot of this.slotNodes.values()) slot.destroy();
    this.slotNodes.clear();
  }

  /**
   * 触点落下：先建跟手幽灵，再把这一段手势交给状态机认领。
   *
   * 幽灵在**落下那一刻**就建（而不是越过阈值才建）：跟手的起点就是它，手指一动玩家就该看到手里有东西；
   * 代价是点按也会建一份、同一帧再拆掉，看不见也不影响。
   */
  private onSlotTouchStart(ingredientId: string, event: EventTouch): void {
    const ghost = this.createGhost(ingredientId);
    if (!ghost) return;

    // 幽灵世界坐标就是拖动位置的基准，后续每帧用触点增量推进，全程不需要再做坐标换算
    const world = ghost.worldPosition;
    // 已经有一根手指在拖时这次触碰不接（"一次只认一根手指"的判定在状态机里），刚建的幽灵就地拆掉
    if (!this.gesture.start(event.getID(), world.x, world.y)) {
      ghost.destroy();
      return;
    }
    this.active = { ingredientId, ghost };
  }

  private onSlotTouchMove(event: EventTouch): void {
    const drag = this.active;
    if (!drag) return;

    // 用 UI 坐标系的位移增量算出挪到哪儿（增量与坐标原点无关，跟手且无需换算）
    const delta = event.getUIDelta();
    const before = drag.ghost.worldPosition;
    const next = { x: before.x + delta.x, y: before.y + delta.y };
    // **先问状态机"这个触点算不算本手势的"，算才动幽灵**：触摸事件会派回各自 TOUCH_START 认领的那个格子，
    // 所以第二根手指按下另一格时，它的每一次移动都会到这里来；先挪再判的话，跟手的幽灵会被另一根手指拽走
    const moved = this.gesture.move(event.getID(), next.x, next.y);
    if (!moved) return;

    drag.ghost.setPosition(drag.ghost.position.x + delta.x, drag.ghost.position.y + delta.y, 0);
    if (moved.dragging) bus.emit(BusEvent.DragMoved, { x: moved.x, y: moved.y });
  }

  /**
   * 松手收尾：TOUCH_END 与 TOUCH_CANCEL 走同一条路。
   * 引擎的触摸是"认领"模型——move/end/cancel 都派回 TOUCH_START 认领事件的格子；
   * 关键在抬起那一刻引擎会对格子再做一次命中测试：手指还在格子上才派 END，
   * 拖出格子后松手派的是 CANCEL。而"拖出去松手"正是拖拽的常态，不是异常，
   * 所以两条路都得走完判定，否则拖到碗上松手永远无效（点按不受影响）。
   *
   * 是"点按"还是"拖动结束"由状态机给（分界就是那个阈值），两条路各发一条事件。
   */
  private onSlotTouchFinished(event: EventTouch): void {
    const drag = this.active;
    if (!drag) return;
    const ended = this.gesture.finish(event.getID());
    // null = 不是本手势认领的那个触点
    if (!ended) return;

    if (ended.dragged) {
      // 松手落点交给适配层判定；碗里收不收由核心说了算
      bus.emit(BusEvent.DragEnded, { ingredientId: drag.ingredientId, x: ended.x, y: ended.y });
    } else {
      // 没挪动过的就是点按：直接请核心放入，不经过落点判定
      bus.emit(BusEvent.DropIngredient, drag.ingredientId);
    }
    this.endDrag();
  }

  /** 收尾：拆掉跟手幽灵、清掉这一段手势的可视状态 */
  private endDrag(): void {
    this.active?.ghost.destroy();
    this.active = null;
  }

  /** 非正常收尾（组件销毁 / 页面失活 / 视口变化重排）：按"拖动被打断"处理并告诉适配层 */
  private abandonDrag(): void {
    if (!this.active) return;
    this.gesture.interrupt();
    bus.emit(BusEvent.DragCanceled);
    this.endDrag();
  }

  /** 造一个跟着手指走的幽灵：长什么样由 ui/ingredientGhost.ts 一处说了算，这里只算"起手落在源格子中心" */
  private createGhost(ingredientId: string): Node | null {
    const slot = this.slotNodes.get(ingredientId);
    const parent = this.node.parent;
    if (!slot || !parent) return null;

    // 取格子世界坐标，换算成幽灵父节点的局部坐标
    const slotWorld = slot.worldPosition;
    const transform = parent.getComponent(UITransform);
    const local = transform ? transform.convertToNodeSpaceAR(new Vec3(slotWorld.x, slotWorld.y, 0)) : slotWorld;

    return createIngredientGhost(parent, {
      ingredientId,
      name: 'DragGhost',
      // 描边用强调色：跟配料盘里的静态格子区分开，一眼看出"手里拿着东西"
      border: UI_COLOR.textAccent,
      at: { x: local.x, y: local.y },
    });
  }
}
