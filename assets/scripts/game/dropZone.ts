/**
 * 拖动落区判定：松手点落没落在碗的落区里。只做纯算术，**不 import 引擎**（与 core/entryGate.ts 同一约束）。
 *
 * 这属于适配层的"输入翻译"——把手指的世界坐标翻译成"算不算落在碗上"。取碗区变换、把世界坐标转成
 * 落区局部坐标这两步留给 GameSession；这里只判局部坐标在不在矩形内。
 *
 * 落区尺寸与容差由 config 层传入（照 entryGate 的 limits 做法，不写死一个数）：判定与看得见的高亮框
 * 因此永远取自同一份 config/layout，不会各写一套。
 */

/** 拖动落区：以碗区中心为基准的矩形（宽高为设计像素，中心对称），四周再外扩容差 */
export interface DropZone {
  /** 落区宽（设计像素） */
  width: number;
  /** 落区高（设计像素） */
  height: number;
  /** 容差（设计像素）：松手点越出边界这么多以内仍算放进碗里，小屏上碗边难瞄准，宁可宽容 */
  tolerance: number;
}

/** 松手点的落区局部坐标（相对碗区中心）是否落在"落区外扩容差"内 */
export function isWithinDropZone(localX: number, localY: number, zone: DropZone): boolean {
  return (
    Math.abs(localX) <= zone.width / 2 + zone.tolerance &&
    Math.abs(localY) <= zone.height / 2 + zone.tolerance
  );
}
