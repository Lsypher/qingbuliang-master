/**
 * 开始页纯计算的测试。
 *
 * 这些函数不依赖引擎（尺寸都由调用方当参数传进来），所以边界情况不必开编辑器就能测掉。
 * 只断言外部行为：给一组尺寸，产出什么位置；不碰内部字段。
 * 测试名用中文写成一句需求，读起来就是验收标准。
 *
 * 标题的缩放不在本文件里：标题已经烤进封面图，不再有运行时版面计算
 * （见 docs/adr/0004-start-page-cover-art.md）。
 */

import { describe, expect, it } from 'vitest';
import { BEST_SCORE_ICON_GAP, BEST_SCORE_ICON_SIZE, layoutBestScoreRow } from '../assets/scripts/ui/startPageLayout';

/** 34 号字体下"最高分：N"的实测文字宽量级（1 位约 130，逐档变宽到 260）：位数一变就必须重算居中，这几档用来覆盖它 */
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
