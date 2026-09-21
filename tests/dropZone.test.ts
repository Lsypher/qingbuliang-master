/**
 * 拖动落区判定的测试。
 *
 * 判定不依赖引擎（落区局部坐标是入参），所以"松手点算不算进碗"不必开编辑器去试手势。
 * 只断言外部行为：给一组落区局部坐标，返回"在落区里"还是"不在"。测试名用中文写成一句需求。
 */

import { describe, expect, it } from 'vitest';
import { BOWL_DROP_ZONE_HEIGHT, BOWL_DROP_ZONE_WIDTH, DROP_ZONE_TOLERANCE_PX } from '../assets/scripts/config/layout';
import { isWithinDropZone } from '../assets/scripts/game/dropZone';
import type { DropZone } from '../assets/scripts/game/dropZone';

/** 真实的那组落区尺寸：与看得见的高亮框同源，测试也用同一份，不另抄一套数 */
const ZONE: DropZone = {
  width: BOWL_DROP_ZONE_WIDTH,
  height: BOWL_DROP_ZONE_HEIGHT,
  tolerance: DROP_ZONE_TOLERANCE_PX,
};
const HALF_WIDTH = ZONE.width / 2;
const HALF_HEIGHT = ZONE.height / 2;
/** 恰好压在容差外沿、仍算进碗的那一格 */
const STILL_IN = ZONE.tolerance;

describe('拖动落区判定', () => {
  it('落区中心算在碗里', () => {
    expect(isWithinDropZone(0, 0, ZONE)).toBe(true);
  });

  it('落在落区边界之内、以及正落在边界上，都算在碗里', () => {
    for (const x of [-HALF_WIDTH, 0, HALF_WIDTH]) {
      expect(isWithinDropZone(x, 0, ZONE)).toBe(true);
    }
    for (const y of [-HALF_HEIGHT, 0, HALF_HEIGHT]) {
      expect(isWithinDropZone(0, y, ZONE)).toBe(true);
    }
    expect(isWithinDropZone(HALF_WIDTH, HALF_HEIGHT, ZONE)).toBe(true);
  });

  it('越出边界但在容差内仍算在碗里', () => {
    expect(isWithinDropZone(HALF_WIDTH + STILL_IN, 0, ZONE)).toBe(true);
    expect(isWithinDropZone(0, HALF_HEIGHT + STILL_IN, ZONE)).toBe(true);
    expect(isWithinDropZone(HALF_WIDTH + STILL_IN, HALF_HEIGHT + STILL_IN, ZONE)).toBe(true);
  });

  it('越出容差就不算在碗里', () => {
    expect(isWithinDropZone(HALF_WIDTH + STILL_IN + 1, 0, ZONE)).toBe(false);
    expect(isWithinDropZone(0, HALF_HEIGHT + STILL_IN + 1, ZONE)).toBe(false);
    // 单项越界即否：x 还在容差内、y 超了也要判否（两个方向都要管住）
    expect(isWithinDropZone(HALF_WIDTH, HALF_HEIGHT + STILL_IN + 1, ZONE)).toBe(false);
    expect(isWithinDropZone(HALF_WIDTH + STILL_IN + 1, HALF_HEIGHT, ZONE)).toBe(false);
  });

  it('判定对正负对称：同绝对值、异号的落点结论一致', () => {
    for (const value of [0, HALF_WIDTH - 1, HALF_WIDTH, HALF_WIDTH + STILL_IN, HALF_WIDTH + STILL_IN + 1]) {
      expect(isWithinDropZone(value, 0, ZONE)).toBe(isWithinDropZone(-value, 0, ZONE));
    }
  });
});
