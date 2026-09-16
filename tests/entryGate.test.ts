/**
 * 准备过场放行判据的测试。
 *
 * 判据不依赖引擎（时间与已决数都是入参），所以"到没到点"不必开编辑器去试时序。
 * 只断言外部行为：给一组入参，返回"等待"还是"放行"；不断言它内部用什么算式。
 * 测试名用中文写成一句需求，读起来就是验收标准。
 */

import { describe, expect, it } from 'vitest';
import { PREPARE_MIN_SHOW_MS, PREPARE_TIMEOUT_MS } from '../assets/scripts/config/prepareTransition';
import { decideEntry } from '../assets/scripts/core/entryGate';

/** 真实的那组上限：最短展示与硬超时都来自 config 层，测试也用同一份，不另抄一套数 */
const LIMITS = { minShowMs: PREPARE_MIN_SHOW_MS, timeoutMs: PREPARE_TIMEOUT_MS };

/**
 * 01 号票的处境：还没有要预载的东西，已决数 = 总数 = 0，
 * 于是"预载已完成"恒成立，判据退化成"只看时间"。
 */
const NOTHING_SETTLED = 0;
const NOTHING_TO_PRELOAD = 0;

describe('准备过场的放行判据', () => {
  it('节拍是 spec 定下的那组数：最短展示不少于 1200ms，硬超时在它之后', () => {
    expect(PREPARE_MIN_SHOW_MS).toBeGreaterThanOrEqual(1200);
    expect(PREPARE_TIMEOUT_MS).toBeGreaterThan(PREPARE_MIN_SHOW_MS);
  });

  it('未到最短展示时长 → 等待', () => {
    for (const elapsedMs of [0, 1, PREPARE_MIN_SHOW_MS - 1]) {
      expect(decideEntry(elapsedMs, NOTHING_SETTLED, NOTHING_TO_PRELOAD, LIMITS)).toBe('wait');
    }
  });

  it('已过最短展示时长、又还没到硬超时 → 放行', () => {
    // 上界取"硬超时 − 1"：这样这一条的放行只能来自"最短展示已过"，不会误踩超时那条兜底
    for (const elapsedMs of [PREPARE_MIN_SHOW_MS, PREPARE_MIN_SHOW_MS + 1, PREPARE_TIMEOUT_MS - 1]) {
      expect(decideEntry(elapsedMs, NOTHING_SETTLED, NOTHING_TO_PRELOAD, LIMITS)).toBe('go');
    }
  });
});
