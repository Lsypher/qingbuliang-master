/**
 * 准备过场扫动相位的测试。
 *
 * `sweepPhase` 是纯函数（只做算术、不碰引擎），把过场经过时间映射成 0→1→0 的归一化相位，
 * 喂给绘制层决定扫动段停在轨道的哪一端。只断言外部行为：给一个经过时间，返回哪一端的相位；
 * 不断言它内部用什么算式。测试名用中文写成一句需求，读起来就是验收标准。
 */

import { describe, expect, it } from 'vitest';
import { PREPARE_SWEEP_PERIOD_MS, sweepPhase } from '../assets/scripts/config/prepareTransition';

/** 真实周期来自 config 层，测试也用同一份，不另抄一个数 */
const PERIOD = PREPARE_SWEEP_PERIOD_MS;

describe('准备过场的扫动相位', () => {
  it('相位在 [0,1] 内循环，不会跑出去', () => {
    for (const elapsedMs of [0, PERIOD / 4, PERIOD / 2, PERIOD, PERIOD * 2.5, PERIOD * 100 + 1]) {
      const phase = sweepPhase(elapsedMs, PERIOD);
      expect(phase).toBeGreaterThanOrEqual(0);
      expect(phase).toBeLessThanOrEqual(1);
    }
  });

  it('起点（经过 0）落在左端（相位 0）', () => {
    expect(sweepPhase(0, PERIOD)).toBe(0);
  });

  it('半周期时走到右端（相位 1）', () => {
    expect(sweepPhase(PERIOD / 2, PERIOD)).toBeCloseTo(1, 5);
  });

  it('一个完整周期后回到左端（相位 0），与起点一致', () => {
    expect(sweepPhase(PERIOD, PERIOD)).toBeCloseTo(0, 5);
  });

  it('左右对称：前半段上行、后半段下行，且关于半周期镜像', () => {
    // 偏离半周期相同距离的上下行两点，相位应相等（左右往返对称）
    const offset = PERIOD / 4;
    expect(sweepPhase(PERIOD / 2 - offset, PERIOD)).toBeCloseTo(sweepPhase(PERIOD / 2 + offset, PERIOD), 5);
  });

  it('重入过场（elapsedMs 归零）相位一致：连进多次观感一致', () => {
    // 第一次与第二次进入都从 0 开始，相位必须相同，否则会出现"第二局扫动段位置不同"的串味
    expect(sweepPhase(0, PERIOD)).toBe(sweepPhase(PERIOD, PERIOD));
    expect(sweepPhase(123, PERIOD)).toBe(sweepPhase(PERIOD + 123, PERIOD));
  });
});
