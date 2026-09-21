/**
 * 开局时序：把"过场期间只开一局 + 交接后延迟一帧才解锁"这段时序规则从组合根搬出来。
 *
 * **不 import 引擎**：延迟一帧由调用方注入（真实实现是组件上的 scheduleOnce），过场的亮起也通过
 * 注入的 beginTransition 触发；于是"过场期间连点只开一局"这类时序分支不必开编辑器就能测
 * （见 tests/gameLauncher.test.ts）。
 *
 * 只做编排，不碰节点：切页与开一局是调用方传进来的 `enter`；预载任务的收集（纯接线）留在组合根。
 */

import type { PreloadTask } from '../ui/uiFactory';

/** 开局器要用的三样外部能力，都由组合根注入 */
export interface GameLauncherDeps {
  /** 过场层装配上了没有：没装配上就退回"直接进入"，不能把玩家挡在开始页 */
  hasTransition(): boolean;
  /** 亮起过场并跑预载任务；放行那一帧调用 onReleased */
  beginTransition(onReleased: () => void, preloads: readonly PreloadTask[]): void;
  /** 延迟一帧执行：真实实现是组件上的 scheduleOnce(fn, 0)（见 GameRoot） */
  defer(fn: () => void): void;
}

/**
 * 开局器：请求开一局时挡住重复请求，跑完过场、交接，再延迟一帧解锁。
 *
 * 它与过场层的整屏吃触摸**分工不同、不重复**：那个挡"空间上的点击穿透"，
 * 这里挡"时间上的重复开局"（过场期间、以及交接完的那一两帧内落在已隐藏按钮上的连点）。
 */
export class GameLauncher {
  /** "正在进入"：过场期间、以及交接完那一帧内，重复请求一律忽略 */
  private entering = false;

  constructor(private readonly deps: GameLauncherDeps) {}

  /**
   * 请求开一局：正在进入时直接忽略。
   * 有过场 → 交给它跑预载、放行时再调 `enter`；没过场 → 直接 `enter`（兜底，不能把玩家挡在开始页）。
   * 两条路都在 `enter` 之后延迟一帧解锁，挡掉交接后那一两帧的连点。
   */
  launch(enter: () => void, preloads: readonly PreloadTask[]): void {
    if (this.entering) return;
    this.entering = true;
    if (this.deps.hasTransition()) {
      this.deps.beginTransition(() => this.handOff(enter), preloads);
    } else {
      this.handOff(enter);
    }
  }

  /** 交接：先 `enter`，再延迟一帧解锁（跨帧解锁是"挡掉已隐藏按钮上的连点"的关键） */
  private handOff(enter: () => void): void {
    enter();
    this.deps.defer(() => {
      this.entering = false;
    });
  }
}
