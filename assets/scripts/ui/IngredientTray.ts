import { _decorator, Button, Component, EventTouch, Node, SpriteFrame, UITransform, Vec3, view } from 'cc';
import { ALL_INGREDIENTS } from '../config/ingredients';
import { BusEvent, bus } from '../game/bus';
import { createIngredientIcon, loadIngredientFrame } from './ingredientIcon';
import { createLabel, createUiNode, paintPanel, PreloadTask, UI_COLOR, visibleWidth } from './uiFactory';

const { ccclass } = _decorator;

/** 配料盘格子排布：4 列 × 3 行正好填满 12 格 */
const COLUMN_COUNT = 4;
const COLUMN_SPACING = 180;
const ROW_SPACING = 118;
const SLOT_WIDTH = 160;
const SLOT_HEIGHT = 96;
/** 相邻格子之间至少要留的间隙（设计像素）：窄屏收窄列距时靠它保证格子不贴在一起 */
const COLUMN_GAP = 10;
/** 配料盘左右两侧留白（设计像素） */
const TRAY_SIDE_MARGIN = 16;
/** 格子收窄的下限（设计像素）：再窄就认不出图标与中文标签了，宁可让屏幕边缘裁一点 */
const MIN_SLOT_WIDTH = 110;
/** 行数由配料总数推出，别在改配料表时忘了同步这里 */
const ROW_COUNT = Math.ceil(ALL_INGREDIENTS.length / COLUMN_COUNT);

/**
 * 当前屏幕下的配料盘排版。
 *
 * 设计宽度是 720，但比 9:16 更窄的现代全面屏手机在 FitHeight 下只能看到约 590 设计像素宽，
 * 四列固定 180 间距会把最外侧两列挤出屏幕（图标与中文标签都被切掉）。所以按实际可见宽度收窄：
 * 宽屏（可见宽度 ≥720）与设计完全一致，窄屏四列均分可用宽度、格子同步缩小。
 * 下限只是防止极端窄窗口把格子压到认不出，正常机型（可见宽 570~720）都用不到它。
 */
function trayLayout(): { spacing: number; slotWidth: number } {
  const usable = Math.max(visibleWidth() - TRAY_SIDE_MARGIN * 2, COLUMN_COUNT * MIN_SLOT_WIDTH);
  const spacing = Math.min(COLUMN_SPACING, usable / COLUMN_COUNT);
  return { spacing, slotWidth: Math.min(SLOT_WIDTH, spacing - COLUMN_GAP) };
}

/** 手指挪动超过这个距离才算"拖动"，否则当作点按（Button 的 click 路径） */
const DRAG_THRESHOLD_PX = 8;
/** 跟手幽灵的尺寸：比格子小一号，跟着手指走又不挡太多视线 */
const GHOST_WIDTH = 120;
const GHOST_HEIGHT = 64;

/** 一次进行中的拖动：哪格配料、哪个手指、走没走出"点按"范围 */
interface ActiveDrag {
  ingredientId: string;
  touchId: number;
  /** 幽灵的世界坐标起点，用于判断位移是否超过点按阈值 */
  startX: number;
  startY: number;
  moved: boolean;
  ghost: Node;
}

/**
 * 配料盘：把 12 格配料摆出来，负责"玩家用哪种手势选中了哪一格"。
 * 它不知道规则也不认识碗——点按只发一条事件；拖动只上报"拖着谁、松手在哪"，
 * 落点算不算进碗由适配层判定，放不放得进碗里由核心决定。
 */
@ccclass('IngredientTray')
export class IngredientTray extends Component {
  private slotNodes = new Map<string, Node>();
  /** 全盘同时只认一根手指的拖动，第二根手指的按下直接忽略 */
  private activeDrag: ActiveDrag | null = null;
  /**
   * 过场期间预载到的图标帧缓存：id → 帧（失败为 null）。
   * 配料盘建格子时同步取用，首帧就位、不逐格冒出；缓存随组件实例长存，
   * 重开时图标已在资源层命中缓存、这里也还是热的，不会重复读盘。
   */
  private iconCache = new Map<string, SpriteFrame | null>();

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
    const { spacing, slotWidth } = trayLayout();
    ALL_INGREDIENTS.forEach((ingredient, index) => {
      const column = index % COLUMN_COUNT;
      const row = Math.floor(index / COLUMN_COUNT);
      const x = (column - (COLUMN_COUNT - 1) / 2) * spacing;
      // 三行以托盘中心为基准上下对称排开：正着数第三行会探出面板、掉到屏幕外
      const y = ((ROW_COUNT - 1) / 2 - row) * ROW_SPACING;

      const slot = createUiNode(this.node, `Slot_${ingredient.id}`, slotWidth, SLOT_HEIGHT, y, x);
      paintPanel(slot, UI_COLOR.panel, UI_COLOR.panelBorder);

      // 图标在上、中文短标签在下：图标是主识别通道，标签兜底（含撞脸项区分）
      // 图标上移，避免和大字号标签在格子内重叠
      // 预载已到手的图标同步贴上：首帧就位，不出现逐格冒出的过程；未预载/预载失败回退异步加载或只留标签
      const slotIcon = createIngredientIcon(slot, ingredient.id, 52, 'Icon', this.iconCache.get(ingredient.id));
      slotIcon.setPosition(0, 16, 0);
      // 汤底与小料用不同字色区分，避免一眼看混两类
      const labelColor = ingredient.category === 'base' ? UI_COLOR.textAccent : UI_COLOR.textPrimary;
      createLabel(slot, 'Name', ingredient.name, -28, 18, labelColor, slotWidth - 8);

      const button = slot.addComponent(Button);
      button.transition = Button.Transition.NONE;
      const ingredientId = ingredient.id;
      slot.on(Button.EventType.CLICK, () => this.onSlotClicked(ingredientId), this);

      // 拖拽手势与点按并存：挪动超过阈值按拖动走，否则仍交给 Button 的 click
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
   * 交出 12 项预载任务（过场期间由过场层跑），一项对应一格配料图标。
   *
   * 谁拥有资源谁交任务：加载路径留在配料盘自己这一层，过场只数"已决几项"、不区分成败
   * （缺图各有各的兜底，不在这里再判一次）。每项**有结果**（成功或失败）时调用 `done`——
   * 失败也计入已决并放行，缺的那格沿用既有兜底（只显示中文标签），不阻塞进局。
   *
   * 帧加载到手就进 `iconCache`：过场结束、配料盘建格子时同步贴上，首帧就位、不逐格冒出。
   * 本方法在过场开始前被组合根调用，那时本组件 `onLoad` 还没跑（单局页还隐藏），
   * 所以这里不依赖任何由 `onLoad` 建立的字段。
   */
  preloadIcons(): PreloadTask[] {
    return ALL_INGREDIENTS.map((ingredient) => (done) => {
      loadIngredientFrame(ingredient.id, (frame) => {
        // 成功入库帧、失败入库 null：建格子时统一从这里取，失败那格自然只留标签
        this.iconCache.set(ingredient.id, frame);
        done();
      });
    });
  }

  private onSlotClicked(ingredientId: string): void {
    // 拖动途中松手也会触发 Button 的 click（手指落点可能还在格子里），
    // 这类 click 已经由拖动路径处理过，不能再报一次，否则同一份配料进两次碗。
    // 这依赖注册顺序：Button 在 addComponent 时先注册监听，click 总是先于本组件的 TOUCH_END 触发
    if (this.activeDrag?.moved) return;
    // 只上报"玩家点了谁"，判定权在核心
    bus.emit(BusEvent.DropIngredient, ingredientId);
  }

  private onSlotTouchStart(ingredientId: string, event: EventTouch): void {
    // 已经有一根手指在拖了：后续手指一律不接
    if (this.activeDrag) return;

    const ghost = this.createGhost(ingredientId);
    if (!ghost) return;
    // 幽灵世界坐标就是拖动位置的基准，后续每帧用触点增量推进，全程不需要再做坐标换算
    const world = ghost.worldPosition;
    this.activeDrag = {
      ingredientId,
      touchId: event.getID(),
      startX: world.x,
      startY: world.y,
      moved: false,
      ghost,
    };
  }

  private onSlotTouchMove(event: EventTouch): void {
    const drag = this.activeDrag;
    // 触摸事件只会派回"按下时抓住它的节点"，但仍要核对触点 id，防多指串扰
    if (!drag || event.getID() !== drag.touchId) return;

    // 用 UI 坐标系的位移增量挪幽灵：增量与坐标原点无关，跟手且无需换算
    const delta = event.getUIDelta();
    drag.ghost.setPosition(drag.ghost.position.x + delta.x, drag.ghost.position.y + delta.y, 0);

    const world = drag.ghost.worldPosition;
    const distance = Math.hypot(world.x - drag.startX, world.y - drag.startY);
    if (!drag.moved && distance > DRAG_THRESHOLD_PX) {
      // 一旦越过阈值就按拖动算：Button 的 click 会在松手时被拦下
      drag.moved = true;
    }
    if (drag.moved) {
      bus.emit(BusEvent.DragMoved, { x: world.x, y: world.y });
    }
  }

  /**
   * 松手收尾：TOUCH_END 与 TOUCH_CANCEL 走同一条路。
   * 引擎的触摸是"认领"模型——move/end/cancel 都派回 TOUCH_START 认领事件的格子；
   * 关键在抬起那一刻引擎会对格子再做一次命中测试：手指还在格子上才派 END，
   * 拖出格子后松手派的是 CANCEL。而"拖出去松手"正是拖拽的常态，不是异常，
   * 所以两条路都必须做落点判定，否则拖到碗上松手永远无效（点按不受影响）。
   */
  private onSlotTouchFinished(event: EventTouch): void {
    const drag = this.activeDrag;
    if (!drag || event.getID() !== drag.touchId) return;

    if (drag.moved) {
      // 松手落点交给适配层判定；碗里收不收由核心说了算
      const world = drag.ghost.worldPosition;
      bus.emit(BusEvent.DragEnded, { ingredientId: drag.ingredientId, x: world.x, y: world.y });
    }
    // 没挪动过的就是点按：Button 的 click 路径已经在别处上报，这里只管收尾
    this.endDrag();
  }

  /** 收尾：熄掉高亮、拆掉幽灵、归还"同一时间一次拖动"的名额 */
  private endDrag(): void {
    if (!this.activeDrag) return;
    this.activeDrag.ghost.destroy();
    this.activeDrag = null;
  }

  /** 非正常收尾（组件销毁/页面失活）：按"拖动被打断"处理 */
  private abandonDrag(): void {
    if (!this.activeDrag) return;
    bus.emit(BusEvent.DragCanceled);
    this.endDrag();
  }

  /** 造一个跟着手指走的幽灵：画成小面板 + 配料名，挂在单局页顶层 */
  private createGhost(ingredientId: string): Node | null {
    const slot = this.slotNodes.get(ingredientId);
    const parent = this.node.parent;
    if (!slot || !parent) return null;

    const ingredient = ALL_INGREDIENTS.find((item) => item.id === ingredientId);
    const ghost = createUiNode(parent, 'DragGhost', GHOST_WIDTH, GHOST_HEIGHT);
    // 描边用强调色，跟托盘里的静态格子区分开，一眼能看出"手里拿着东西"
    paintPanel(ghost, UI_COLOR.panel, UI_COLOR.textAccent);
    // 跟手幽灵也带上图标 + 名称，和托盘里的格子保持同一套视觉语言
    const ghostIcon = createIngredientIcon(ghost, ingredientId, 36, 'Icon');
    ghostIcon.setPosition(0, 12, 0);
    createLabel(ghost, 'Name', ingredient ? ingredient.name : ingredientId, -16, 18, UI_COLOR.textPrimary, GHOST_WIDTH - 12);

    // 起手落在源格子中心：取格子世界坐标，换算成幽灵父节点的局部坐标
    const transform = parent.getComponent(UITransform);
    const slotWorld = slot.worldPosition;
    if (transform) {
      const local = transform.convertToNodeSpaceAR(new Vec3(slotWorld.x, slotWorld.y, 0));
      ghost.setPosition(local.x, local.y, 0);
    } else {
      ghost.setPosition(slotWorld.x, slotWorld.y, 0);
    }
    return ghost;
  }
}
