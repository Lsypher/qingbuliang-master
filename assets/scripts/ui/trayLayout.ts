/**
 * 配料盘的版面计算：只做纯算术，**不 import 引擎**（与 startPageLayout.ts 同一约束）。
 *
 * 这里只收"算错了不会报错、只会静默地把最外侧两列挤出屏幕"的那部分计算。
 * 可见宽度由调用方（IngredientTray）从引擎量出来之后当参数传进来，引擎只负责提供这个数——
 * 于是这些边界情况不必开编辑器就能测掉（见 tests/trayLayout.test.ts）。
 */

import { ALL_INGREDIENTS } from '../config/ingredients';
import { SCREEN_WIDTH } from '../config/layout';

/** 配料盘格子排布：4 列 × 3 行正好填满 12 格；列距名义取 4 × 180 = 720 以对齐设计宽度（SCREEN_WIDTH），实际由 trayLayout() 扣掉两侧留白后再取小，宽屏下约为 172 */
export const COLUMN_COUNT = 4;
export const COLUMN_SPACING = 180;
export const ROW_SPACING = 118;
export const SLOT_WIDTH = 160;
export const SLOT_HEIGHT = 96;
/** 相邻格子之间至少要留的间隙（设计像素）：窄屏收窄列距时靠它保证格子不贴在一起 */
export const COLUMN_GAP = 10;
/** 配料盘左右两侧留白（设计像素） */
export const TRAY_SIDE_MARGIN = 16;
/** 格子收窄的下限（设计像素）：再窄就认不出图标与中文标签了，宁可让屏幕边缘裁一点 */
export const MIN_SLOT_WIDTH = 110;
/** 行数由配料总数推出，别在改配料表时忘了同步这里 */
export const ROW_COUNT = Math.ceil(ALL_INGREDIENTS.length / COLUMN_COUNT);

/**
 * 当前屏幕下的配料盘排版。
 *
 * 设计宽度是 720，但比 9:16 更窄的现代全面屏手机在 FitHeight 下只能看到约 590 设计像素宽，
 * 四列固定 180 间距会把最外侧两列挤出屏幕（图标与中文标签都被切掉）。所以按实际可见宽度收窄：
 * 宽屏（可见宽度 ≥720）与设计完全一致，窄屏四列均分可用宽度、格子同步缩小。
 * 下限只是防止极端窄窗口把格子压到认不出，正常机型（可见宽 570~720）都用不到它。
 *
 * 量不出可见宽度（NaN / Infinity）时退到设计宽度：与 startPageLayout 同策略，宁可按宽屏算，
 * 也不把 NaN 一路传到节点坐标上。
 */
export function trayLayout(visibleWidth: number): { spacing: number; slotWidth: number } {
  const width = Number.isFinite(visibleWidth) ? visibleWidth : SCREEN_WIDTH;
  const usable = Math.max(width - TRAY_SIDE_MARGIN * 2, COLUMN_COUNT * MIN_SLOT_WIDTH);
  const spacing = Math.min(COLUMN_SPACING, usable / COLUMN_COUNT);
  return { spacing, slotWidth: Math.min(SLOT_WIDTH, spacing - COLUMN_GAP) };
}
