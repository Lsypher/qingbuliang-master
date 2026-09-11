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
  /** 一局开始（适配层 → 视图）：背景这类纯表现跟着换一次 */
  RoundStarted: 'qingbuliang:round-started',
} as const;

/** 渲染载荷：本次状态 + 本次产生的事件（事件留给动画用，03 切片先不消费） */
export interface RenderPayload {
  state: SessionState;
  events: SessionEvent[];
}

export const bus = new EventTarget();
