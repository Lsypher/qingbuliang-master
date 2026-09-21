/**
 * 图标行居中算位的测试。
 *
 * 算位不依赖引擎（个数、尺寸、间隙都是入参），所以"排得正不正"不必开编辑器去看。
 * 只断言外部行为：给一组入参，产出的每格中心 x；测试名用中文写成一句需求。
 */

import { describe, expect, it } from 'vitest';
import { iconRowLayout } from '../assets/scripts/ui/iconRowLayout';

const ICON_SIZE = 52;
const GAP = 12;

describe('图标行居中算位', () => {
  it('空行与负数个数都返回空数组', () => {
    expect(iconRowLayout(0, ICON_SIZE, GAP)).toEqual([]);
    expect(iconRowLayout(-3, ICON_SIZE, GAP)).toEqual([]);
  });

  it('单个图标落在行中心', () => {
    expect(iconRowLayout(1, ICON_SIZE, GAP)).toEqual([0]);
  });

  it('相邻两格的中心距恒等于"图标宽 + 间隙"', () => {
    const positions = iconRowLayout(6, ICON_SIZE, GAP);
    for (let index = 1; index < positions.length; index++) {
      expect(positions[index] - positions[index - 1]).toBeCloseTo(ICON_SIZE + GAP);
    }
  });

  it('整体居中：首尾到行中心等距，数量变化也不偏', () => {
    for (const count of [1, 2, 3, 4, 5, 6, 7]) {
      const positions = iconRowLayout(count, ICON_SIZE, GAP);
      expect(positions.length).toBe(count);
      expect(positions[0]).toBeCloseTo(-positions[count - 1]);
    }
  });

  it('间隙为 0 时图标紧挨着排，仍然居中', () => {
    expect(iconRowLayout(3, ICON_SIZE, 0)).toEqual([-ICON_SIZE, 0, ICON_SIZE]);
  });
});
