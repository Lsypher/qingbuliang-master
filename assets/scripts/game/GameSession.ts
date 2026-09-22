import { _decorator, Node, UITransform, Vec3 } from 'cc';
import type { Session, SessionEvent } from '../core/session';
import { createSession } from '../core/session';
import type { DragEndPayload, DragPointPayload } from './bus';
import { BusEvent, bus } from './bus';
import { BusComponent } from './busComponent';
import type { BowlDropZone, DropAnchor, DropZonePoint } from './dropZone';
import { createBowlDropZone } from './dropZone';

const { ccclass } = _decorator;

/**
 * 适配层：把 Cocos 的时间与输入翻译成核心调用，再把核心的事件广播给表现层。
 * 这里不写任何规则判断——错放扣几秒、这一单值多少分，全部由 core 决定。
 *
 * 拖拽的几何判定（松手点在不在碗区、带多少容差）不在这层：它整块收在 game/dropZone.ts 的落区模块里。
 * 本组件只交出松手点的世界坐标，并提供一个"碗区挂在哪"的锚点实现（见本文件末尾的 resolveBowlAnchor）——
 * 配料盘只认识手势不认识碗，碗只认识高亮事件不认识手指。
 */
@ccclass('GameSession')
export class GameSession extends BusComponent {
  private session: Session | null = null;
  /**
   * 本局落区：每局新建（见 startRound），于是锚点解析与"只告警一次"的闩锁都跟着每局重来，
   * 不需要复位方法；`BowlArea` 将来改为运行时装配也自然成立。
   */
  private dropZone: BowlDropZone | null = null;

  /** 开一局新单局（进入单局页或重开时调用） */
  startRound(): void {
    this.session = createSession();
    this.dropZone = createBowlDropZone({
      anchor: resolveBowlAnchor(this.node),
      warn: (message) => console.warn(message),
    });
    this.publish([]);
  }

  protected onViewLoad(): void {
    // 这四条是"视图 → 适配层"的输入事件。Render 不在这里：本组件不渲染，基类不会替它订阅
    this.listen(BusEvent.DropIngredient, this.onIngredientClicked);
    this.listen(BusEvent.DragMoved, this.onDragMoved);
    this.listen(BusEvent.DragEnded, this.onDragEnded);
    this.listen(BusEvent.DragCanceled, this.onDragCanceled);
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
  private applyDrop(ingredientId: string, point: DropZonePoint | null): void {
    if (!this.session) return;
    // 点按没有世界坐标，错放反馈就落在碗区中心，飘字与弹回才有合理起点
    if (point === null) point = this.dropZone?.center() ?? { x: 0, y: 0 };

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

  /** 松手点（含边缘容差）是否落在落区里：几何、容差与缺锚点兜底都在落区模块，这里只交出世界坐标 */
  private isOverBowl(point: DragPointPayload): boolean {
    return this.dropZone?.contains(point.x, point.y) ?? false;
  }

  private publish(events: SessionEvent[]): void {
    if (!this.session) return;
    bus.emit(BusEvent.Render, { state: this.session.state, events });
  }
}

/**
 * 碗区锚点的 Cocos 实现：把 `BowlArea` 节点包成落区模块要的那三件事。
 *
 * 这是"落区模块不 import 引擎"的代价——全仓库唯一为此摸引擎的一小块，所以这里只做翻译：
 * 缺节点与锚点不合格怎么兜底、要不要告警，一概不在这层判，都在 dropZone 模块里。
 *
 * 节点变换只解析一次并留在闭包里。落区实例每局新建、本适配器也跟着每局新建一份，
 * 所以"每局重新解析"天然成立；场景骨架不变的话，一个单局里只会解析一次。
 */
function resolveBowlAnchor(host: Node): DropAnchor {
  /** undefined = 还没解析过；null = 解析过但没找到 */
  let transform: UITransform | null | undefined;

  const resolve = (): UITransform | null => {
    if (transform === undefined) {
      transform = host.getChildByName('BowlArea')?.getComponent(UITransform) ?? null;
    }
    return transform;
  };

  return {
    toLocal: (worldX, worldY) => {
      const target = resolve();
      if (!target) return null;
      // 换算要用引擎的变换，所以留在这一侧；模块那边只收局部坐标做纯算术
      const local = target.convertToNodeSpaceAR(new Vec3(worldX, worldY, 0));
      return { x: local.x, y: local.y };
    },
    center: () => {
      const target = resolve();
      return target ? { x: target.node.worldPosition.x, y: target.node.worldPosition.y } : null;
    },
    anchorPoint: () => {
      const target = resolve();
      // 判定以节点原点为基准，所以这里交的是归一化锚点，不是世界坐标
      return target ? { x: target.anchorX, y: target.anchorY } : null;
    },
  };
}
