/**
 * 开始页的版面计算：只做纯算术，**不 import 引擎**。
 *
 * 这里只收"算错了不会报错、只会静默地偏一点或溢出屏幕"的那部分计算。
 * 可见宽度由调用方（StartView）从引擎量出来之后当参数传进来，引擎只负责提供这个数——
 * 于是这些边界情况不必开编辑器就能测掉（见 tests/startPageLayout.test.ts）。
 */

/** 标题艺术字的设计尺寸（设计像素）：不按 720 满宽设计，理由见 fitTitleWidth */
export const TITLE_DESIGN_WIDTH = 560;
export const TITLE_DESIGN_HEIGHT = 160;

/** 标题两侧留白（设计像素）：窄屏缩小时左右各留出这么多，字才不会顶到屏幕边 */
export const TITLE_SIDE_MARGIN = 60;

/** 留白最多吃掉可见宽度的这个比例：屏幕窄到留白放不下时，留白先让位（见 fitTitleWidth） */
const TITLE_MAX_MARGIN_RATIO = 1 / 4;

/**
 * 标题在给定可见宽度下应当显示的宽度（设计像素）。
 *
 * 适配事实：FitHeight 下"设计宽 720"并不是每个屏幕都看得见——比 9:16 更窄的全面屏
 * 只看得见约 550~590 设计像素宽。所以：
 *
 * - 宽屏（可见宽度 ≥ 设计宽 560）：保持设计宽度，既不放大也不缩小（不虚胖、不模糊）；
 * - 窄屏（可见宽度 < 设计宽）：收窄到"可见宽度 − 两侧各 60"，只缩不放。
 *
 * 一处理论上的死角在这里被补掉：可见宽度窄到 240 以下时，"两侧各 60"要吃掉比屏幕还多的宽度，
 * 硬套公式只会算出 0 甚至负数——标题等于被藏起来（还把画布拖到极窄时能看见这种情形）。
 * 与其把标题收没，不如让留白先让位：留白最多占可见宽度的 1/4，标题因此始终有地方站。
 * 这条退化只在 240 以下生效，240 及以上与"两侧各 60"逐像素一致。
 *
 * 量不出可见宽度（NaN / Infinity）时按宽屏处理：宁可大一点，也不要显示成看不见。
 */
export function fitTitleWidth(visibleWidth: number): number {
  if (!Number.isFinite(visibleWidth) || visibleWidth >= TITLE_DESIGN_WIDTH) return TITLE_DESIGN_WIDTH;
  const margin = Math.min(TITLE_SIDE_MARGIN, visibleWidth * TITLE_MAX_MARGIN_RATIO);
  return Math.max(0, visibleWidth - margin * 2);
}

/**
 * 与之配套的**等比缩放系数**：宽高同乘它，高宽比因此恒等于设计尺寸，且永远 ≤ 1（只缩不放）。
 *
 * 单独给出这个系数，是为了让调用方直接 `node.setScale(scale)` 就完成等比缩放，
 * 不必自己再除一遍设计宽度（漏除就会变形）。
 */
export function fitTitleScale(visibleWidth: number): number {
  return fitTitleWidth(visibleWidth) / TITLE_DESIGN_WIDTH;
}
