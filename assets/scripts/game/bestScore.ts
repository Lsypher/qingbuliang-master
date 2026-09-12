import { sys } from 'cc';

/**
 * 最高分：本机历史单局中的最高分。单键存一个整数，跨浏览器刷新保活。
 *
 * 这一层只做"读出来、比一比、写回去"，不碰任何玩法规则；
 * 本地存储可能被隐私模式或浏览器设置禁用，读写都兜住异常，不能因为存不下就让单局崩掉。
 */
const BEST_SCORE_KEY = 'qingbuliang.bestScore';

/** 存储不可用时的内存兜底：至少让这一局玩得下去 */
let memoryFallback = 0;

/** 一次记录的结论：记完之后的最高分，以及这一局有没有把纪录往前推 */
export interface ScoreRecord {
  best: number;
  /** 本局分数严格超过历史最高分才为真——平纪录不算破纪录 */
  improved: boolean;
}

/** 读历史最高分；没存过、存坏了或存储不可用一律按 0 处理 */
export function readBestScore(): number {
  try {
    const raw = sys.localStorage.getItem(BEST_SCORE_KEY);
    const parsed = raw === null ? 0 : Number.parseInt(raw, 10);
    const stored = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    // 写盘失败时本局成绩只留在内存里，取两者更高的那个，
    // 否则"刚刚破的纪录"会从开始页上消失
    return Math.max(stored, memoryFallback);
  } catch (error) {
    console.warn('[bestScore] 读本地存储失败，改用内存值', error);
    return memoryFallback;
  }
}

/**
 * 记录一局成绩，返回记录之后的最高分与"是否破了纪录"（只增不减）。
 * 没打破纪录就不写盘，省掉一次没必要的写。
 */
export function recordScore(score: number): ScoreRecord {
  const previous = readBestScore();
  if (score <= previous) return { best: previous, improved: false };

  memoryFallback = score;
  try {
    sys.localStorage.setItem(BEST_SCORE_KEY, String(score));
  } catch (error) {
    console.warn('[bestScore] 写本地存储失败，本次最高分只留在内存里', error);
  }
  return { best: score, improved: true };
}
