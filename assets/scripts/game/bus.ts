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

/** 界面页：开始页 / 单局 / 结算页 */
export type ScenePage = 'start' | 'game' | 'result';

export const bus = new EventTarget();
