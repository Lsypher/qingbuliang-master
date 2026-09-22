/**
 * 各视图的渲染签名：把"什么算需要重绘"收成一处纯函数，**不 import 引擎**。
 *
 * 视图每帧都收到全量状态（见 GameSession.update），不短路就会每帧重排文本、重建图标。
 * 比较交给 `SignatureGuard`（见 ui/redrawGuard.ts），"拿什么去比"由这里给：
 * 每个函数的入参就是它所在视图**真正依赖**的那几个状态字段——多一个少一个，在函数签名上就看得出来。
 * 签名漏掉一个会影响显示的字段，症状是界面不刷新，所以每个字段都单独有断言（见 tests/renderSignatures.test.ts）。
 *
 * 分隔符约定：配料 id 是本仓库自定的英文短名，不含 `,` 与 `|`。改 id 的命名规则要连这里一起看，
 * 否则 `a,b` 与 `a` + `b` 两种内容会撞成同一个签名。
 */

import type { Order, SessionState } from '../core/session';

/**
 * 碗（BowlView）：碗里按放入顺序排的配料。
 * 顺序也算数——顺序变了图标要重排，所以取数组原样、不排序。
 */
export function bowlSignature(bowlIds: readonly string[]): string {
  return bowlIds.join(',');
}

/**
 * 订单卡（OrderCard）：顾客要的那一碗 + 碗里已经放进去的。
 * 汤底、小料与已放内容都进签名：任一项变了，图标行与"已放几项"都得重画。
 */
export function orderCardSignature(order: Order, bowlIds: readonly string[]): string {
  return [order.baseId, order.toppingIds.join(','), bowlIds.join(',')].join('|');
}

/**
 * 顶部信息条的统计行（HudView）：分数 / 完成订单 / 连击。
 * **只有这三个数**——倒计时不进签名（它按整秒等值与比例阈值各自判断，语义不同），
 * 更不含 `remainingMs` 这种每帧都变的字段，否则守卫形同虚设。
 */
export function hudStatsSignature(stats: Pick<SessionState, 'score' | 'servedOrders' | 'comboCount'>): string {
  return `${stats.score}|${stats.servedOrders}|${stats.comboCount}`;
}
