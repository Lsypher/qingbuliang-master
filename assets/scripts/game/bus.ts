import { EventTarget } from 'cc';
import type { SessionEvent, SessionState } from '../core/session';

/**
 * 全局事件总线：表现层与适配层之间唯一的通道。
 * 规则不放这里——核心负责判定，适配层负责翻译，视图只订阅渲染。
 */
export const BusEvent = {
  /** 状态刷新：核心每次推进或接受输入后广播，视图据此重绘 */
  Render: 'qingbuliang:render',
  /** 玩家点了某格配料（视图 → 适配层） */
  DropIngredient: 'qingbuliang:drop',
  /** 拖动中的配料到了哪里（视图 → 适配层），坐标为 UI 世界坐标 */
  DragMoved: 'qingbuliang:drag-moved',
  /** 拖动松手（视图 → 适配层）；落不落得进碗由适配层判定，配料盘不认识碗 */
  DragEnded: 'qingbuliang:drag-ended',
  /** 拖动被系统打断（来电、手势冲突等），只做恢复，不判落点（视图 → 适配层） */
  DragCanceled: 'qingbuliang:drag-canceled',
  /** 拖动落点是否在碗区内（适配层 → 表现层），碗据此高亮/熄灭 */
  DragOverBowl: 'qingbuliang:drag-over-bowl',
  /**
   * 切到哪一页了（组合根 → 视图）。
   * "当前是哪一页"只由切页那一处产生；跟着页面走的表现（背景换图与压暗）订阅它，
   * 不再各自拼一份页面状态。
   */
  PageShown: 'qingbuliang:page-shown',
} as const;

/** 渲染载荷：本次状态 + 本次产生的事件（事件留给动画用，03 切片先不消费） */
export interface RenderPayload {
  state: SessionState;
  events: SessionEvent[];
}

/** 拖动位置载荷：UI 世界坐标（画布中心为原点），与节点 worldPosition 同系 */
export interface DragPointPayload {
  x: number;
  y: number;
}

/** 拖动松手载荷：哪格配料 + 松手位置 */
export interface DragEndPayload extends DragPointPayload {
  ingredientId: string;
}

/** 碗高亮载荷：拖动落点当前是否落在碗区内 */
export interface DragOverBowlPayload {
  overBowl: boolean;
}

/** 界面页：开始页 / 单局 / 结算页 */
export type ScenePage = 'start' | 'game' | 'result';

export const bus = new EventTarget();
