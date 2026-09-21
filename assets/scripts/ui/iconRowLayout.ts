/**
 * 图标行的横向算位：把 n 个等宽图标按"整体居中"排开。只做纯算术，**不 import 引擎**。
 *
 * 与 startPageLayout.layoutBestScoreRow 同一性质——居中排布要随元素个数重算，位置写死就会在数量一变时
 * 偏掉（碗里/订单卡里几项是运行时才知道的）。元素个数由调用方（ingredientIcon.renderIconRow）给出，
 * 建节点与摆放都留在调用方，这里只产出每格中心的 x 坐标。
 */

/**
 * 把 `count` 个图标按"整体居中、两两间距 `gap`"排开，返回每格中心的 x 坐标（相对行中心）。
 * `count <= 0` 返回空数组。
 */
export function iconRowLayout(count: number, iconSize: number, gap: number): number[] {
  const step = iconSize + gap;
  const startX = -((count - 1) / 2) * step;
  const positions: number[] = [];
  for (let index = 0; index < count; index++) positions.push(startX + index * step);
  return positions;
}
