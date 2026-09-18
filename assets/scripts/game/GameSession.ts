import { _decorator, Component, UITransform, Vec3 } from 'cc';
import { BOWL_DROP_ZONE_HEIGHT, BOWL_DROP_ZONE_WIDTH, DROP_ZONE_TOLERANCE_PX } from '../config/layout';
import type { Session, SessionEvent } from '../core/session';
import { createSession } from '../core/session';
import type { DragEndPayload, DragPointPayload } from './bus';
import { BusEvent, bus } from './bus';

const { ccclass } = _decorator;

/**
 * 适配层：把 Cocos 的时间与输入翻译成核心调用，再把核心的事件广播给表现层。
 * 这里不写任何规则判断——错放扣几秒、这一单值多少分，全部由 core 决定。
 *
 * 拖拽的几何判定（松手点在不在碗区、带多少容差）属于"输入翻译"，也在这层做：
 * 配料盘只认识手势不认识碗，碗只认识高亮事件不认识手指。
 */
@ccclass('GameSession')
export class GameSession extends Component {
  private session: Session | null = null;
  /** 碗区的变换，第一次用到时再取（场景骨架不变的话整个单局只会取一次） */
  private bowlTransform: UITransform | null = null;
  /** 碗区节点缺失是否已告警：缺节点时每帧都会来取，只提醒一次免得刷屏 */
  private bowlMissing = false;

  /** 开一局新单局（进入单局页或重开时调用） */
  startRound(): void {
    this.session = createSession();
    this.publish([]);
  }

  protected onLoad(): void {
    bus.on(BusEvent.DropIngredient, this.onIngredientClicked, this);
    bus.on(BusEvent.DragMoved, this.onDragMoved, this);
    bus.on(BusEvent.DragEnded, this.onDragEnded, this);
    bus.on(BusEvent.DragCanceled, this.onDragCanceled, this);
  }

  protected onDestroy(): void {
    bus.off(BusEvent.DropIngredient, this.onIngredientClicked, this);
    bus.off(BusEvent.DragMoved, this.onDragMoved, this);
    bus.off(BusEvent.DragEnded, this.onDragEnded, this);
    bus.off(BusEvent.DragCanceled, this.onDragCanceled, this);
  }

  protected update(deltaTime: number): void {
    if (!this.session) return;
    // 每帧都广播：视图自己做"值没变就不重绘"的短路，避免漏帧导致界面与状态不一致
    this.publish(this.session.advance(deltaTime * 1000));
  }

  /** 玩家点按了一格配料：点按没有手指位置，错放反馈锚在碗中心（玩家意图是把它放进碗） */
  private onIngredientClicked(ingredientId: string): void {
    this.applyDrop(ingredientId, null);
  }

  /** 玩家的一次放入请求（点按与拖动落点殊途同归到这里） */
  private applyDrop(ingredientId: string, point: { x: number; y: number } | null): void {
    if (!this.session) return;
    // 点按没有世界坐标，错放反馈就落在碗区中心，飘字与弹回才有合理起点
    if (point === null) {
      const bowl = this.resolveBowlTransform();
      point = bowl ? { x: bowl.node.worldPosition.x, y: bowl.node.worldPosition.y } : { x: 0, y: 0 };
    }

    const events = this.session.drop(ingredientId);
    this.publish(events);

    // 错放：把"哪份配料 + 松手在哪"交给表现层做弹回 / 红闪 / 飘字；重复放入不进这里
    const misdrop = events.find((event) => event.type === 'misdrop');
    if (misdrop && misdrop.type === 'misdrop') {
      bus.emit(BusEvent.Misdrop, { ingredientId: misdrop.ingredientId, x: point.x, y: point.y });
    }
  }

  /** 拖动途中：把"当前落点在不在碗里"翻译成高亮事件，碗自己决定怎么画 */
  private onDragMoved(point: DragPointPayload): void {
    bus.emit(BusEvent.DragOverBowl, { overBowl: this.isOverBowl(point) });
  }

  /** 松手：先熄高亮，落在碗区里就当作一次放入请求交给核心（落点世界坐标留给错放反馈） */
  private onDragEnded(payload: DragEndPayload): void {
    const overBowl = this.isOverBowl(payload);
    bus.emit(BusEvent.DragOverBowl, { overBowl: false });
    if (overBowl) this.applyDrop(payload.ingredientId, { x: payload.x, y: payload.y });
  }

  /** 拖动被打断：只熄高亮，不做任何判定 */
  private onDragCanceled(): void {
    bus.emit(BusEvent.DragOverBowl, { overBowl: false });
  }

  /** 松手点（含边缘容差）是否落在落区里：落区以碗区节点为中心，尺寸来自配置 */
  private isOverBowl(point: DragPointPayload): boolean {
    const transform = this.resolveBowlTransform();
    if (!transform) return false;
    // 世界坐标 → 碗区局部坐标：落点落在落区矩形（外扩容差）内即算入碗
    const local = transform.convertToNodeSpaceAR(new Vec3(point.x, point.y, 0));
    return (
      Math.abs(local.x) <= BOWL_DROP_ZONE_WIDTH / 2 + DROP_ZONE_TOLERANCE_PX &&
      Math.abs(local.y) <= BOWL_DROP_ZONE_HEIGHT / 2 + DROP_ZONE_TOLERANCE_PX
    );
  }

  /** 场景骨架里的碗区节点；找不到时警告一次并按"永远不在碗上"处理 */
  private resolveBowlTransform(): UITransform | null {
    if (this.bowlTransform) return this.bowlTransform;
    if (this.bowlMissing) return null;
    const node = this.node.getChildByName('BowlArea');
    this.bowlTransform = node?.getComponent(UITransform) ?? null;
    if (!this.bowlTransform) {
      this.bowlMissing = true;
      console.warn('[GameSession] 找不到 BowlArea 或其 UITransform，拖动落点永远判定为碗外');
    }
    return this.bowlTransform;
  }

  private publish(events: SessionEvent[]): void {
    if (!this.session) return;
    bus.emit(BusEvent.Render, { state: this.session.state, events });
  }
}
