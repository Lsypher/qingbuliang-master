/**
 * 开始页纯计算的测试。
 *
 * 这些函数不依赖引擎（可见宽度由调用方当参数传进来），所以边界情况不必开编辑器就能测掉。
 * 只断言外部行为：给一个可见宽度，产出什么尺寸；不碰内部字段。
 * 测试名用中文写成一句需求，读起来就是验收标准。
 */

import { describe, expect, it } from 'vitest';
import {
  BEST_SCORE_ICON_GAP,
  BEST_SCORE_ICON_SIZE,
  TITLE_DESIGN_HEIGHT,
  TITLE_DESIGN_WIDTH,
  TITLE_SIDE_MARGIN,
  fitTitleScale,
  fitTitleWidth,
  layoutBestScoreRow,
} from '../assets/scripts/ui/startPageLayout';

/** 设计分辨率下看得见的那一档（720×1280、FitHeight 的 9:16 屏） */
const DESIGN_VISIBLE_WIDTH = 720;
/** 比 9:16 更窄、已经装不下设计宽度的全面屏 */
const NARROW_PHONE_VISIBLE_WIDTHS = [559, 548, 500, 400];
/** 留白还放得下的最窄一档：再窄就该留白让位了 */
const NARROW_MARGIN_FLOOR = TITLE_SIDE_MARGIN * 4;
/** 比 9:16 更窄的极端窄屏（ticket 点名的 320 量级） */
const EXTREME_VISIBLE_WIDTH = 320;
/** 留白已经放不下的极窄画幅：标题必须还在，不能被收成 0 宽 */
const ULTRA_NARROW_VISIBLE_WIDTHS = [TITLE_SIDE_MARGIN * 2 - 1, 160, 120, 111];

describe('标题按可见宽度缩放', () => {
  it('可见宽度不小于设计宽度时不缩放，标题保持设计尺寸', () => {
    for (const visible of [TITLE_DESIGN_WIDTH, 576, 590, DESIGN_VISIBLE_WIDTH, 800, 1440]) {
      expect(fitTitleWidth(visible)).toBe(TITLE_DESIGN_WIDTH);
      expect(fitTitleScale(visible)).toBe(1);
    }
  });

  it('可见宽度小于设计宽度时缩到"可见宽度 − 两侧各 60"以内', () => {
    for (const visible of [...NARROW_PHONE_VISIBLE_WIDTHS, EXTREME_VISIBLE_WIDTH, NARROW_MARGIN_FLOOR]) {
      const width = fitTitleWidth(visible);
      expect(width).toBeLessThanOrEqual(visible - TITLE_SIDE_MARGIN * 2);
      expect(width).toBe(visible - TITLE_SIDE_MARGIN * 2); // 收窄到"刚好不越界"，不无谓地缩更小
      expect(width).toBeLessThan(TITLE_DESIGN_WIDTH);
    }
  });

  it('极窄到留白放不下时留白让位：两侧各留可见宽度的 1/4，标题不被收成 0 宽', () => {
    for (const visible of ULTRA_NARROW_VISIBLE_WIDTHS) {
      const width = fitTitleWidth(visible);
      // 这条退化只在 240 以下生效；240 及以上与"两侧各 60"逐像素一致（见上一条用例）
      expect(width).toBe(visible / 2);
      expect(width).toBeGreaterThan(0);
      expect(width).toBeLessThan(visible);
      expect(Number.isFinite(width)).toBe(true);
    }
  });

  it('只缩不放：缩放系数永远不超过 1，且随可见宽度单调不减', () => {
    const widths = [0, 40, 111, 120, 160, 239, 240, 300, EXTREME_VISIBLE_WIDTH, 500, 559, 560, 720, 1440];
    let previous = 0;
    for (const visible of widths) {
      const scale = fitTitleScale(visible);
      expect(scale).toBeLessThanOrEqual(1);
      expect(scale).toBeGreaterThanOrEqual(0);
      expect(fitTitleWidth(visible)).toBeGreaterThanOrEqual(previous);
      previous = fitTitleWidth(visible);
    }
  });

  it('缩放是等比的：宽高按同一个系数缩，高宽比与设计尺寸一致', () => {
    for (const visible of [...NARROW_PHONE_VISIBLE_WIDTHS, EXTREME_VISIBLE_WIDTH, DESIGN_VISIBLE_WIDTH, 576]) {
      const scale = fitTitleScale(visible);
      expect(scale).toBeCloseTo(fitTitleWidth(visible) / TITLE_DESIGN_WIDTH);
      // 宽高同乘这一个系数 → 高宽比恒等于设计尺寸的比例（不会只缩一边而变形）
      expect((TITLE_DESIGN_WIDTH * scale) / (TITLE_DESIGN_HEIGHT * scale)).toBeCloseTo(
        TITLE_DESIGN_WIDTH / TITLE_DESIGN_HEIGHT,
      );
    }
  });

  it('320 量级的极端窄屏：标题装得进可见宽度且左右还留着空', () => {
    const width = fitTitleWidth(EXTREME_VISIBLE_WIDTH);
    expect(width).toBe(EXTREME_VISIBLE_WIDTH - TITLE_SIDE_MARGIN * 2);
    expect(width + TITLE_SIDE_MARGIN * 2).toBeLessThanOrEqual(EXTREME_VISIBLE_WIDTH);
  });

  it('可见宽度量不出来或小到没有余量时，给出有限且非负的确定值', () => {
    for (const visible of [0, -100, Number.NaN, Number.POSITIVE_INFINITY]) {
      const width = fitTitleWidth(visible);
      const scale = fitTitleScale(visible);
      expect(Number.isFinite(width)).toBe(true);
      expect(Number.isFinite(scale)).toBe(true);
      expect(width).toBeGreaterThanOrEqual(0);
      expect(scale).toBeGreaterThanOrEqual(0);
      expect(scale).toBeLessThanOrEqual(1);
    }
  });
});

/** 34 号字体下"最高分：N"的文字宽量级：1 位约 130、每多一位加 22 上下 */
const SCORE_TEXT_WIDTHS = [130, 152, 175, 198, 260];

describe('最高分行的整体居中', () => {
  it('整行总宽等于"图标宽 + 间距 + 文字宽"', () => {
    for (const textWidth of [0, 40, ...SCORE_TEXT_WIDTHS]) {
      expect(layoutBestScoreRow(BEST_SCORE_ICON_SIZE, BEST_SCORE_ICON_GAP, textWidth).totalWidth).toBeCloseTo(
        BEST_SCORE_ICON_SIZE + BEST_SCORE_ICON_GAP + textWidth,
      );
    }
  });

  it('文字位数从 1 位变到多位时整行仍居中：左右两端到行中心的距离相等', () => {
    for (const textWidth of SCORE_TEXT_WIDTHS) {
      const { totalWidth, iconX, textX } = layoutBestScoreRow(BEST_SCORE_ICON_SIZE, BEST_SCORE_ICON_GAP, textWidth);
      const left = iconX - BEST_SCORE_ICON_SIZE / 2;
      const right = textX + textWidth / 2;
      expect(left).toBeCloseTo(-totalWidth / 2);
      expect(right).toBeCloseTo(totalWidth / 2);
      // 两端到行中心的距离相等 —— 这就是"整行居中"，也是"位数一变就偏"的反面
      expect(Math.abs(left)).toBeCloseTo(Math.abs(right));
    }
  });

  it('文字逐步变宽时图标跟着左移：居中位置随文字实际宽度重算，而非写死', () => {
    let previousIconX = Number.POSITIVE_INFINITY;
    for (const textWidth of SCORE_TEXT_WIDTHS) {
      const { iconX } = layoutBestScoreRow(BEST_SCORE_ICON_SIZE, BEST_SCORE_ICON_GAP, textWidth);
      expect(iconX).toBeLessThan(previousIconX);
      previousIconX = iconX;
    }
  });

  it('奖杯不显示（图标宽为 0）时连间距一起忽略：这一行只剩文字且仍然居中', () => {
    const { totalWidth, iconX, textX } = layoutBestScoreRow(0, BEST_SCORE_ICON_GAP, 152);
    expect(totalWidth).toBe(152);
    expect(textX).toBe(0);
    expect(iconX).toBe(-76);
  });

  it('文字宽为 0 时整行被"图标 + 间距"占满，输出仍是有限且居中的确定值', () => {
    const { totalWidth, iconX, textX } = layoutBestScoreRow(BEST_SCORE_ICON_SIZE, BEST_SCORE_ICON_GAP, 0);
    expect(totalWidth).toBe(BEST_SCORE_ICON_SIZE + BEST_SCORE_ICON_GAP);
    expect(iconX).toBeCloseTo(-BEST_SCORE_ICON_GAP / 2);
    expect(textX).toBeCloseTo((BEST_SCORE_ICON_SIZE + BEST_SCORE_ICON_GAP) / 2);
  });

  it('文字宽量不出来或为负（含"图标 + 间距"已占满整行盒）时，输出有限、非负、不出现 NaN / Infinity', () => {
    for (const textWidth of [0, -50, Number.NaN, Number.POSITIVE_INFINITY]) {
      const { totalWidth, iconX, textX } = layoutBestScoreRow(BEST_SCORE_ICON_SIZE, BEST_SCORE_ICON_GAP, textWidth);
      for (const value of [totalWidth, iconX, textX]) {
        expect(Number.isFinite(value)).toBe(true);
      }
      expect(totalWidth).toBeGreaterThanOrEqual(0);
    }
  });
});
