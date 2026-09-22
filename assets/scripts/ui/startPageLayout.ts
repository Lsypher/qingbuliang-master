/**
 * 开始页的版面计算：只做纯算术，**不 import 引擎**。
 *
 * 这里只收"算错了不会报错、只会静默地偏一点或溢出屏幕"的那部分计算。
 * 可见宽度由调用方（StartView）从引擎量出来之后当参数传进来，引擎只负责提供这个数——
 * 于是这些边界情况不必开编辑器就能测掉（见 tests/startPageLayout.test.ts）。
 *
 * 封面图上的标题与副标题不在这里：它们的版面已经烤进图里，不参与任何运行时计算
 * （见 docs/adr/0004-start-page-cover-art.md）。本模块现在只剩最高分那一行。
 */

/** 最高分行的奖杯图标设计尺寸（设计像素、正方形）：场景里 `BestScore/Icon` 节点的尺寸与它一致 */
export const BEST_SCORE_ICON_SIZE = 44;

/** 奖杯与文字之间的间距（设计像素）：它属于"整行怎么排"，所以与排布算式放在一起 */
export const BEST_SCORE_ICON_GAP = 10;

/**
 * 最高分行的排布结果。
 *
 * `totalWidth` 是整行宽度；`iconX` / `textX` 是图标与文字**各自的中心相对行中心**的横向偏移
 * （行中心就是行容器的中心）。两个元素都以中心为锚点，调用方直接 `setPosition(x, 0)` 即可。
 */
export interface BestScoreRowLayout {
  totalWidth: number;
  iconX: number;
  textX: number;
}

/** 把缺失 / 量不出来的尺寸收敛成有限非负数：算不出宽度时按 0 处理，免得 NaN 一路传到节点坐标上 */
function toSize(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

/**
 * 最高分那一行（奖杯 + 间距 + 文字）的整体居中排布。
 *
 * 为什么要有算式、而不是把两个元素的位置写死：最高分的位数会从 1 位变到多位，文字宽跟着变，
 * "整行居中"因此每次都得按实际总宽重算——位置写死就会在位数一变时偏掉。
 *
 * 公式：总宽 = 图标宽 + 间距 + 文字宽；左端对齐 `-总宽/2`、右端对齐 `+总宽/2`，于是
 * 图标中心落在 `-(间距 + 文字宽)/2`、文字中心落在 `+(图标宽 + 间距)/2`，两端到行中心的距离恒相等。
 *
 * 奖杯不显示时（图标宽传 0，图缺失或未交付）**连间距一起忽略**：间距是"图标与文字之间"的距离，
 * 没有图标就没有这个"之间"——这一行于是只剩文字，仍然居中。
 *
 * 文字宽为 0（空串）或量不出来（NaN / Infinity）时，输出的是有限确定值，不会把 NaN / Infinity 传给节点。
 */
export function layoutBestScoreRow(iconWidth: number, gap: number, textWidth: number): BestScoreRowLayout {
  const icon = toSize(iconWidth);
  const text = toSize(textWidth);
  // 图标不显示时间距没有"之间"可言，一并归零
  const space = icon > 0 ? toSize(gap) : 0;
  return {
    totalWidth: icon + space + text,
    iconX: -(space + text) / 2,
    textX: (icon + space) / 2,
  };
}
