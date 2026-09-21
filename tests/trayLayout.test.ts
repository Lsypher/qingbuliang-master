/**
 * 配料盘纯计算的测试。
 *
 * 这些函数不依赖引擎（可见宽度由调用方当参数传进来），所以边界情况不必开编辑器就能测掉。
 * 只断言外部行为：给一个可见宽度，产出什么列距/格子宽；不碰内部字段。
 * 测试名用中文写成一句需求，读起来就是验收标准。
 */

import { describe, expect, it } from 'vitest';
import { SCREEN_WIDTH } from '../assets/scripts/config/layout';
import {
  COLUMN_COUNT,
  COLUMN_GAP,
  COLUMN_SPACING,
  MIN_SLOT_WIDTH,
  SLOT_WIDTH,
  TRAY_SIDE_MARGIN,
  trayLayout,
} from '../assets/scripts/ui/trayLayout';

/** 设计分辨率下看得见的那一档（720×1280、FitHeight 的 9:16 屏） */
const DESIGN_VISIBLE_WIDTH = 720;
/** 比 9:16 更窄、已经装不下四列名义列距的全面屏 */
const NARROW_PHONE_VISIBLE_WIDTHS = [590, 570, 560, 500, 480];
/** 可用宽度已被格子下限占满的极端窄屏：再窄也不再缩格子 */
const FLOOR_VISIBLE_WIDTHS = [TRAY_SIDE_MARGIN + COLUMN_COUNT * MIN_SLOT_WIDTH - 1, 440, 320, 0];

describe('配料盘按可见宽度排布', () => {
  it('名义列距 × 列数对齐设计宽度', () => {
    // 锁住 COLUMN_SPACING 的注释：180 × 4 = 720 = SCREEN_WIDTH，改任意一个都要同步另一个
    expect(COLUMN_SPACING * COLUMN_COUNT).toBe(SCREEN_WIDTH);
  });

  it('宽屏（放得下四列名义列距）时列距取名义值、格子保持设计尺寸', () => {
    for (const visible of [SCREEN_WIDTH + COLUMN_COUNT * TRAY_SIDE_MARGIN, 800, 1000, 1440]) {
      const { spacing, slotWidth } = trayLayout(visible);
      expect(spacing).toBe(COLUMN_SPACING);
      expect(slotWidth).toBe(SLOT_WIDTH);
    }
  });

  it('设计宽度下格子仍是设计尺寸，列距略小于名义值（扣掉两侧留白后取小）', () => {
    const { spacing, slotWidth } = trayLayout(DESIGN_VISIBLE_WIDTH);
    expect(spacing).toBe((DESIGN_VISIBLE_WIDTH - TRAY_SIDE_MARGIN * 2) / COLUMN_COUNT);
    expect(slotWidth).toBe(SLOT_WIDTH);
  });

  it('窄屏时四列均分可用宽度：列距 = (可见宽度 − 两侧留白) / 4', () => {
    for (const visible of NARROW_PHONE_VISIBLE_WIDTHS) {
      const { spacing } = trayLayout(visible);
      expect(spacing).toBe((visible - TRAY_SIDE_MARGIN * 2) / COLUMN_COUNT);
    }
  });

  it('极端窄屏把列距钳在格子下限，格子不再继续缩', () => {
    for (const visible of FLOOR_VISIBLE_WIDTHS) {
      const { spacing, slotWidth } = trayLayout(visible);
      expect(spacing).toBe(MIN_SLOT_WIDTH);
      expect(slotWidth).toBe(Math.min(SLOT_WIDTH, MIN_SLOT_WIDTH - COLUMN_GAP));
    }
  });

  it('格子宽度始终为正、且不超过列距（不会和邻格叠在一起）', () => {
    for (const visible of [0, 100, 320, ...NARROW_PHONE_VISIBLE_WIDTHS, DESIGN_VISIBLE_WIDTH, 1440]) {
      const { spacing, slotWidth } = trayLayout(visible);
      expect(slotWidth).toBeGreaterThan(0);
      expect(slotWidth).toBeLessThanOrEqual(spacing);
    }
  });

  it('可见宽度量不出来时退到设计宽度：输出仍是有限确定值', () => {
    for (const visible of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      const { spacing, slotWidth } = trayLayout(visible);
      expect(Number.isFinite(spacing)).toBe(true);
      expect(Number.isFinite(slotWidth)).toBe(true);
      expect(spacing).toBeGreaterThan(0);
      expect(slotWidth).toBeGreaterThan(0);
    }
    // NaN / Infinity 都按设计宽度处理，结果应与设计宽度那一档一致
    expect(trayLayout(Number.NaN)).toEqual(trayLayout(DESIGN_VISIBLE_WIDTH));
  });
});
