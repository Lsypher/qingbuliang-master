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
   * 错放反馈（适配层 → 表现层）：核心判定为错放后，把"哪份配料、落点在世界坐标哪"
   * 交给表现层做弹回 / 红闪 / 飘字。重复放入走的是 `rejected` 核心事件，不触发这里，
   * 所以本事件只对应真正的错放。
   */
  Misdrop: 'qingbuliang:misdrop',
  /**
   * 切到哪一页了（组合根 → 视图）。
   * "当前是哪一页"只由切页那一处产生；跟着页面走的表现（背景换图与压暗）订阅它，
   * 不再各自拼一份页面状态。
   */
  PageShown: 'qingbuliang:page-shown',
} as const;

/** 渲染载荷：本次状态 + 本次新产生的事件（视图只订阅渲染、不自行推规则，见文件头） */
export interface RenderPayload {
  state: SessionState;
  events: SessionEvent[];
}

/** 拖动位置载荷：UI 世界坐标（画布中心为原点），与节点 worldPosition 同系 */
export interface DragPointPayload {
  x: number;
  y: number;
}

/** 松手载荷：哪份配料、松手点在世界坐标哪里（世界坐标留给错放反馈做起点） */
export interface DragEndPayload extends DragPointPayload {
  ingredientId: string;
}

/** 悬停载荷：拖动中的落点算不算在落区内（落点判定见 game/dropZone.ts），碗据它亮/熄高亮框 */
export interface DragOverBowlPayload {
  overBowl: boolean;
}

/** 错放反馈载荷：点按无手指位置，落点取碗中心 */
export interface MisdropPayload {
  ingredientId: string;
  x: number;
  y: number;
}

/** 界面页：开始页 / 单局页 / 结算页（用词以 CONTEXT.md 词表为准） */
export type ScenePage = 'start' | 'game' | 'result';

/**
 * 事件 → 载荷的类型表：`BusComponent.listen` 靠它约束回调参数，于是"这条事件带什么"只有这一处说明，
 * 调用点不必自己再标一遍泛型。**新增事件时这里要跟着加一行**，否则 `listen` 认不出它。
 */
export interface BusPayloadMap {
  [BusEvent.Render]: RenderPayload;
  [BusEvent.DropIngredient]: string;
  [BusEvent.DragMoved]: DragPointPayload;
  [BusEvent.DragEnded]: DragEndPayload;
  /** 拖动被打断只做恢复，没有载荷 */
  [BusEvent.DragCanceled]: void;
  [BusEvent.DragOverBowl]: DragOverBowlPayload;
  [BusEvent.Misdrop]: MisdropPayload;
  [BusEvent.PageShown]: ScenePage;
}

export const bus = new EventTarget();
