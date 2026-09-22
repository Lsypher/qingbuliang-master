/**
 * 落区模块的测试。
 *
 * 判定不依赖引擎：世界坐标 → 落区局部坐标的换算由假锚点提供，所以"松手点算不算进碗"、
 * 缺锚点怎么兜底、告警发几次，都不必开编辑器去试手势。
 * 只断言外部行为：给世界坐标与一个锚点，看判定结果与告警条数。测试名用中文写成一句需求。
 *
 * 落区几何用模块里那一份真实的（BOWL_DROP_ZONE），不另抄一套数——尺寸一改，这里跟着改。
 */

import { describe, expect, it } from 'vitest';
import type { BowlDropZone, DropAnchor, DropZonePoint } from '../assets/scripts/game/dropZone';
import { BOWL_DROP_ZONE, createBowlDropZone } from '../assets/scripts/game/dropZone';

const HALF_WIDTH = BOWL_DROP_ZONE.visualWidth / 2;
const HALF_HEIGHT = BOWL_DROP_ZONE.visualHeight / 2;
/** 恰好压在容差外沿、仍算进落区的那一格 */
const STILL_IN = BOWL_DROP_ZONE.tolerance;

/**
 * 假锚点：直接给出"世界坐标 → 以落区中心为原点的局部坐标"的映射。
 * 默认是恒等映射（世界坐标即局部坐标），几何断言因此能写成熟悉的坐标数；
 * 要模拟"落点在别处"换 `localOf`，要模拟缺锚点 / 锚点不合格换另两个字段。
 */
function createFakeAnchor(
  options: {
    localOf?: (worldX: number, worldY: number) => DropZonePoint | null;
    center?: DropZonePoint | null;
    anchorPoint?: DropZonePoint | null;
  } = {},
): DropAnchor {
  const {
    localOf = (worldX, worldY) => ({ x: worldX, y: worldY }),
    center = { x: 0, y: 0 },
    anchorPoint = { x: 0.5, y: 0.5 },
  } = options;
  return { toLocal: localOf, center: () => center, anchorPoint: () => anchorPoint };
}

/** 缺碗区的锚点：三个方法一律说不出来 */
function createMissingAnchor(): DropAnchor {
  return { toLocal: () => null, center: () => null, anchorPoint: () => null };
}

/** 造一个落区并把告警收进数组，用来断言"只发一次" */
function createZone(anchor: DropAnchor): { zone: BowlDropZone; warnings: string[] } {
  const warnings: string[] = [];
  return { zone: createBowlDropZone({ anchor, warn: (message) => warnings.push(message) }), warnings };
}

describe('落区判定', () => {
  const { zone } = createZone(createFakeAnchor());

  it('落区中心算在落区里', () => {
    expect(zone.contains(0, 0)).toBe(true);
  });

  it('落在本体边界之内、以及正落在边界上，都算在落区里', () => {
    for (const x of [-HALF_WIDTH, 0, HALF_WIDTH]) {
      expect(zone.contains(x, 0)).toBe(true);
    }
    for (const y of [-HALF_HEIGHT, 0, HALF_HEIGHT]) {
      expect(zone.contains(0, y)).toBe(true);
    }
    expect(zone.contains(HALF_WIDTH, HALF_HEIGHT)).toBe(true);
  });

  it('越出本体但在容差内仍算在落区里', () => {
    expect(zone.contains(HALF_WIDTH + STILL_IN, 0)).toBe(true);
    expect(zone.contains(0, HALF_HEIGHT + STILL_IN)).toBe(true);
    expect(zone.contains(HALF_WIDTH + STILL_IN, HALF_HEIGHT + STILL_IN)).toBe(true);
  });

  it('越出容差就不算在落区里', () => {
    expect(zone.contains(HALF_WIDTH + STILL_IN + 1, 0)).toBe(false);
    expect(zone.contains(0, HALF_HEIGHT + STILL_IN + 1)).toBe(false);
    // 单项越界即否：x 还在容差内、y 超了也要判否（两个方向都要管住）
    expect(zone.contains(HALF_WIDTH, HALF_HEIGHT + STILL_IN + 1)).toBe(false);
    expect(zone.contains(HALF_WIDTH + STILL_IN + 1, HALF_HEIGHT)).toBe(false);
  });

  it('判定对正负对称：同绝对值、异号的落点结论一致', () => {
    for (const value of [0, HALF_WIDTH - 1, HALF_WIDTH, HALF_WIDTH + STILL_IN, HALF_WIDTH + STILL_IN + 1]) {
      expect(zone.contains(value, 0)).toBe(zone.contains(-value, 0));
    }
  });

  it('判的是锚点换算后的局部坐标，不是世界坐标本身', () => {
    // 落点整体平移 1000：世界坐标离原点很远，换算后却正落在中心
    const shifted = createZone(createFakeAnchor({ localOf: (worldX, worldY) => ({ x: worldX - 1000, y: worldY }) })).zone;
    expect(shifted.contains(1000, 0)).toBe(true);
    expect(shifted.contains(0, 0)).toBe(false);
  });
});

describe('落区中心（点按错放的锚点）', () => {
  it('把锚点给出的中心原样交出', () => {
    const { zone } = createZone(createFakeAnchor({ center: { x: 30, y: -40 } }));
    expect(zone.center()).toEqual({ x: 30, y: -40 });
  });

  it('取不到锚点时说不出中心，由调用方兜底', () => {
    const { zone } = createZone(createMissingAnchor());
    expect(zone.center()).toBeNull();
  });
});

describe('缺锚点与锚点不合格的兜底', () => {
  it('缺锚点时一律判在落区外', () => {
    const { zone } = createZone(createMissingAnchor());
    expect(zone.contains(0, 0)).toBe(false);
    expect(zone.contains(HALF_WIDTH, HALF_HEIGHT)).toBe(false);
  });

  it('缺锚点只告警一次：判定再多也不重复喊', () => {
    const { zone, warnings } = createZone(createMissingAnchor());
    expect(warnings).toHaveLength(1);
    for (let index = 0; index < 20; index++) zone.contains(index, 0);
    expect(warnings).toHaveLength(1);
  });

  it('碗区锚点不是 (0.5, 0.5) 时照判，并只告警一次', () => {
    const { zone, warnings } = createZone(createFakeAnchor({ anchorPoint: { x: 0, y: 0 } }));
    expect(warnings).toHaveLength(1);
    expect(zone.contains(0, 0)).toBe(true);
    zone.contains(HALF_WIDTH + STILL_IN + 1, 0);
    expect(warnings).toHaveLength(1);
  });

  it('锚点合格、判定走路上一句话都不喊', () => {
    const { zone, warnings } = createZone(createFakeAnchor());
    zone.contains(0, 0);
    zone.contains(HALF_WIDTH + STILL_IN + 1, 0);
    expect(warnings).toHaveLength(0);
  });

  it('构造时还拿得到锚点、之后拿不到：判在落区外，也不补发告警', () => {
    // 自检那一刻碗区还在，判定时已经没了（运行时装配 / 换场景）：兜底该沉默地生效
    let reachable = true;
    const anchor: DropAnchor = {
      toLocal: (worldX, worldY) => (reachable ? { x: worldX, y: worldY } : null),
      center: () => ({ x: 0, y: 0 }),
      anchorPoint: () => ({ x: 0.5, y: 0.5 }),
    };
    const { zone, warnings } = createZone(anchor);
    expect(warnings).toHaveLength(0);

    reachable = false;
    expect(zone.contains(0, 0)).toBe(false);
    expect(warnings).toHaveLength(0);
  });
});
