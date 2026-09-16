/**
 * 准备过场的放行判据：什么时候可以从过场进单局页。
 *
 * 本文件禁止 import 引擎（与 core/session.ts 同一约束），所以它能被 vitest 直接测试——
 * "到没到点"是一个真带时序分支的判断，正是单测该锁的东西，写进组合根就等于放弃对它的一切验证。
 *
 * 判据只认两件事：过了多久、预载**已决**多少。已决数不区分成功与失败——
 * 加载失败与加载成功对"能不能进单局页"没有任何区别（缺图有既有的兜底，不在这层再判一次）。
 */

/** 放行判据的两个上限：最短展示与硬超时。数值从 config 层传入，这里不写死一个数 */
export interface EntryLimits {
  /** 最短展示时长（毫秒）：从过场出现那一刻起算 */
  minShowMs: number;
  /** 硬超时（毫秒）：从过场出现到必须放行的总时长上限 */
  timeoutMs: number;
}

/** 判据的结论：还在等 / 可以放行 */
export type EntryVerdict = 'wait' | 'go';

/**
 * 到点了没有。
 *
 * 放行 ⟸（预载已全部有结果 且 已过最短展示时长）或 已过硬超时。
 *
 * 超时那条**不看预载状态**，而且是先判的那条：预载再慢、再有几项永远不回调，
 * 到点也必须放行，否则玩家会被永久困在一片过场里。
 */
export function decideEntry(elapsedMs: number, settled: number, total: number, limits: EntryLimits): EntryVerdict {
  if (elapsedMs >= limits.timeoutMs) return 'go';
  return settled >= total && elapsedMs >= limits.minShowMs ? 'go' : 'wait';
}
