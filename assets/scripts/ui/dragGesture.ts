/**
 * 拖拽手势（Drag Gesture）：把"这一次触碰算点按还是算拖动、拖动到哪儿了、什么时候结束"
 * 收成一个**不 import 引擎**的状态机（与 game/dropZone.ts 同一约束）。
 *
 * 只做判定、不碰节点：跟手幽灵的建与拆留在配料盘那边（它是引擎对象），这里只交结论。
 * 于是这条规则里的全部分支——起点、阈值、一次只认一根手指、松手给出落点——都能被 vitest 直接覆盖；
 * 抽出之前它们散在 `IngredientTray` 的三个触摸回调里，只能靠手动拖一遍。
 *
 * 与调用方的约定：**位置一律喂世界坐标**（配料盘喂的是跟手幽灵的 `worldPosition`），
 * 状态机自己存起点、算距离，阈值判定因此不依赖任何引擎的坐标换算。
 *
 * 与"引擎的触摸取消"不是一回事：触点自己结束（`TOUCH_END` 与拖出格子后松手派发的 `TOUCH_CANCEL`）
 * 都走 `finish`，那是拖拽的常态；`interrupt` 只给外部原因（页面被藏起、视口变化重排、组件销毁）。
 */

/**
 * 手指挪动超过这个距离（设计像素）才算"拖动"，否则按点按处理。
 *
 * 量级：手抖与有意的拖动之间的分界。调小会把点按误判成拖动（配料"点不动"），
 * 调大会让短距离拖动也被当成点按（配料直接飞进碗、不给落点判定）。
 * 判定用的是距**起点**的直线距离（不是逐帧位移），所以来回抖动不会累积越界。
 */
export const DRAG_THRESHOLD_PX = 8;

/** 移动的结论：`dragging` 为 false 表示还在"可能是点按"的范围内 */
export interface DragGestureMove {
  dragging: boolean;
  x: number;
  y: number;
}

/** 抬手的结论：`dragged` 决定这次是"点按"还是"拖动结束"，落点交给适配层判落区 */
export interface DragGestureEnd {
  dragged: boolean;
  x: number;
  y: number;
}

export interface DragGesture {
  /**
   * 触点落下，认领这一段手势。**已经有手势在跑时返回 false 且什么都不改**——
   * "一次只认一根手指"就靠它，调用方不必自己再记一个标志。
   */
  start(touchId: number, x: number, y: number): boolean;
  /** 触点移动；不是本手势认领的那个触点返回 null。`dragging` 一旦为真就不再回落 */
  move(touchId: number, x: number, y: number): DragGestureMove | null;
  /** 触点自己结束（`TOUCH_END` 与 `TOUCH_CANCEL` 都走这里）；不是本手势的触点返回 null */
  finish(touchId: number): DragGestureEnd | null;
  /** 外部打断：这段手势作废，调用方据此发一次"拖动被打断"。没有手势在进行时是空操作 */
  interrupt(): void;
}

/**
 * 造一个手势状态机：一次服务一段手势，`start` 到 `finish`（或 `interrupt`）之间有效，结束即复位，
 * 所以同一个实例可以在整个生命周期里反复用（配料盘只造一个）。
 */
export function createDragGesture(): DragGesture {
  /** null = 当前没有手势；非 null 就是这段手势认领的触点 id */
  let touchId: number | null = null;
  let startX = 0;
  let startY = 0;
  /** 最近一次移动到的位置：抬手时要把它作为落点交出去 */
  let x = 0;
  let y = 0;
  let dragging = false;

  const reset = (): void => {
    touchId = null;
    dragging = false;
  };

  return {
    start(nextTouchId, nextX, nextY): boolean {
      if (touchId !== null) return false;
      touchId = nextTouchId;
      startX = nextX;
      startY = nextY;
      x = nextX;
      y = nextY;
      dragging = false;
      return true;
    },

    move(id, nextX, nextY): DragGestureMove | null {
      if (id !== touchId) return null;
      x = nextX;
      y = nextY;
      // 只判一次"越过没有"，越过后不再回落：拉回起点也仍是拖动中，
      // 否则拖出去再拖回来会在半路变回点按，抬手时把配料直接放进碗
      if (!dragging && Math.hypot(x - startX, y - startY) > DRAG_THRESHOLD_PX) dragging = true;
      return { dragging, x, y };
    },

    finish(id): DragGestureEnd | null {
      if (id !== touchId) return null;
      const ended: DragGestureEnd = { dragged: dragging, x, y };
      reset();
      return ended;
    },

    interrupt(): void {
      reset();
    },
  };
}
