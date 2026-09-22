/**
 * 落区（Drop Zone）：松手点落没落在碗的落区里，以及落区在屏幕上的位置与大小。
 *
 * 只做纯算术，**不 import 引擎**（与 core/entryGate.ts 同一约束）：找碗区节点、世界坐标换算这些
 * 要摸引擎的事，经 `DropAnchor` 接缝从外面传进来。于是判定、缺锚点兜底与"只告警一次"的闩锁
 * 全落在这一层，能被 vitest 直接覆盖——原先这三样散在 GameSession 的私有方法里，测试够不着。
 *
 * 落区是"以碗区节点原点为中心的矩形"；**看得见的高亮框画的是本体那一圈，判定再外扩容差一圈**。
 * 两者尺寸都取 `BOWL_DROP_ZONE`，所以"看得见"与"判得出"的差别（只差一个容差）在结构上是显式的、
 * 不靠注释维持；容差只进判定，调它不会改变玩家看到的框（见 ui/BowlView.ts 与 CONTEXT.md 的落区词条）。
 */

/** 二维点：单位与坐标系由调用场景决定（世界坐标或落区局部坐标，皆为设计像素） */
export interface DropZonePoint {
  x: number;
  y: number;
}

/** 落区几何（设计像素）：看得见的那一圈 + 判定的额外宽容 */
interface DropZoneGeometry {
  /** 高亮框（落区本体）的宽 */
  visualWidth: number;
  /** 高亮框（落区本体）的高 */
  visualHeight: number;
  /**
   * 容差：判定比本体每边多放这么多，小屏上碗边难瞄准、宁可判宽一点。
   * **只进判定、不进高亮框**——调它只改变松手的有效范围，不改变看到的那圈框。
   */
  tolerance: number;
}

/**
 * 碗的落区几何：本仓库唯一一份。
 * 以碗区节点中心为准的矩形，比三段布局里的碗区面板小一圈，底边不会探进配料盘顶行，
 * 顶边不会贴上订单卡；改这三个数都要连三段布局一起看。
 */
export const BOWL_DROP_ZONE: DropZoneGeometry = {
  visualWidth: 600,
  visualHeight: 380,
  tolerance: 40,
};

/**
 * 锚点接缝：落区在引擎里挂在哪、怎么换算。
 *
 * **取不到碗区节点或它的 UITransform 时，三个方法都返回 null**——"缺锚点怎么办"是落区的兜底策略，
 * 不在这层判，由 `createBowlDropZone` 统一处理（一律按"不在落区里"+ 只告警一次）。
 *
 * 生产实现只有一个（GameSession 里那个包 UITransform 的小适配器）；测试塞假实现。
 * 两个实现才让这条接缝成立：而"缺锚点""锚点不在中心"这些在引擎里造不出来的情况，
 * 也正靠假实现才断言得了。
 */
export interface DropAnchor {
  /** 世界坐标 → 以落区中心（即碗区节点原点）为原点的局部坐标 */
  toLocal(worldX: number, worldY: number): DropZonePoint | null;
  /** 落区中心的世界坐标：点按没有手指位置时，错放反馈锚在这里 */
  center(): DropZonePoint | null;
  /**
   * 碗区节点的归一化锚点。判定以**节点原点**为基准，所以它必须是 (0.5, 0.5)——
   * 在编辑器里把锚点挪开，落区会整体平移，而高亮框跟着节点走、看不出错位，故构造时自检一次。
   */
  anchorPoint(): DropZonePoint | null;
}

/** 对落区的提问 */
export interface BowlDropZone {
  /** 松手点的世界坐标是否落在落区（本体 + 容差）里；取不到锚点一律 false */
  contains(worldX: number, worldY: number): boolean;
  /** 落区中心的世界坐标；取不到锚点返回 null，兜底位置由调用方决定 */
  center(): DropZonePoint | null;
}

/** 归一化锚点与 (0.5, 0.5) 的最大允许偏差：只吸收编辑器里的浮点误差，不放过真的挪动 */
const ANCHOR_EPSILON = 0.001;

/** 落区局部坐标（相对落区中心）是否落在"本体外扩容差"之内 */
function isWithinDropZone(localX: number, localY: number, geometry: DropZoneGeometry): boolean {
  return (
    Math.abs(localX) <= geometry.visualWidth / 2 + geometry.tolerance &&
    Math.abs(localY) <= geometry.visualHeight / 2 + geometry.tolerance
  );
}

/**
 * 造一个落区。每局新建一个（见 GameSession.startRound）：锚点解析与告警的闩锁因此天然跟着每局重来，
 * 不需要额外的复位方法，也不会漏掉某个字段。
 *
 * 两种情况在**构造期**告警一次，之后判定照做、不再重复喊（每帧来一次会把控制台刷满）：
 * ① 取不到碗区节点或它的 UITransform——拖动落点将永远判定在碗外；
 * ② 碗区锚点不在 (0.5, 0.5)——落区会偏离碗区中心。
 */
export function createBowlDropZone(deps: {
  anchor: DropAnchor;
  /** 告警出口：本模块只决定"发不发、发什么"，往哪里写由调用方给（测试据此数告警次数） */
  warn: (message: string) => void;
}): BowlDropZone {
  const { anchor, warn } = deps;
  const geometry = BOWL_DROP_ZONE;

  const anchorPoint = anchor.anchorPoint();
  if (!anchorPoint) {
    warn('[dropZone] 找不到碗区或其 UITransform，拖动落点永远判定为碗外');
  } else if (
    Math.abs(anchorPoint.x - 0.5) > ANCHOR_EPSILON ||
    Math.abs(anchorPoint.y - 0.5) > ANCHOR_EPSILON
  ) {
    warn(`[dropZone] 碗区锚点是 (${anchorPoint.x}, ${anchorPoint.y})，不是 (0.5, 0.5)：落区会偏离碗区中心`);
  }

  return {
    contains(worldX: number, worldY: number): boolean {
      const local = anchor.toLocal(worldX, worldY);
      // 构造时还拿得到锚点、之后拿不到（节点被删或被换掉）也走这条路：按"不在落区里"处理，不再补告警
      if (!local) return false;
      return isWithinDropZone(local.x, local.y, geometry);
    },
    center(): DropZonePoint | null {
      return anchor.center();
    },
  };
}
