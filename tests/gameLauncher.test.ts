/**
 * 开局时序的测试。
 *
 * 过场亮起与"延迟一帧"都由测试注入，所以"过场期间连点只开一局""交接后才解锁"这些时序分支
 * 不必开编辑器去试。只断言外部行为：什么条件下 enter 跑了几次、过场亮了几次。
 */

import { describe, expect, it, vi } from 'vitest';
import { GameLauncher } from '../assets/scripts/game/GameLauncher';
import type { GameLauncherDeps } from '../assets/scripts/game/GameLauncher';
import type { PreloadTask } from '../assets/scripts/ui/uiFactory';

/** 可控的假依赖：记录过场亮了几次、放行回调，以及被延迟的解锁函数 */
class FakeDeps implements GameLauncherDeps {
  transitionAvailable = true;
  beginCount = 0;
  private onReleased: (() => void) | null = null;
  private deferred: Array<() => void> = [];

  hasTransition(): boolean {
    return this.transitionAvailable;
  }

  beginTransition(onReleased: () => void): void {
    this.beginCount++;
    this.onReleased = onReleased;
  }

  defer(fn: () => void): void {
    this.deferred.push(fn);
  }

  /** 触发过场放行 */
  release(): void {
    this.onReleased?.();
  }

  /** 执行被延迟的解锁（相当于引擎跑过一帧） */
  runDeferred(): void {
    const pending = this.deferred;
    this.deferred = [];
    for (const fn of pending) fn();
  }
}

const NO_PRELOADS: PreloadTask[] = [];

describe('开局时序', () => {
  it('有过场：先亮过场，交接前 enter 不跑', () => {
    const deps = new FakeDeps();
    const launcher = new GameLauncher(deps);
    const enter = vi.fn();

    launcher.launch(enter, NO_PRELOADS);
    expect(deps.beginCount).toBe(1);
    expect(enter).not.toHaveBeenCalled();

    deps.release();
    expect(enter).toHaveBeenCalledTimes(1);
  });

  it('过场期间连点只开一局：解锁前重复 launch 一律忽略', () => {
    const deps = new FakeDeps();
    const launcher = new GameLauncher(deps);
    const enter = vi.fn();

    launcher.launch(enter, NO_PRELOADS);
    launcher.launch(enter, NO_PRELOADS); // 过场还亮着，这一次必须被吞掉
    expect(deps.beginCount).toBe(1);

    deps.release();
    expect(enter).toHaveBeenCalledTimes(1);
  });

  it('交接后延迟一帧才解锁：解锁前仍挡住新的开局', () => {
    const deps = new FakeDeps();
    const launcher = new GameLauncher(deps);
    const enter = vi.fn();

    launcher.launch(enter, NO_PRELOADS);
    deps.release();
    // 已交接、但解锁还没跑：这一两帧内的连点仍应被挡
    launcher.launch(enter, NO_PRELOADS);
    expect(deps.beginCount).toBe(1);

    deps.runDeferred();
    launcher.launch(enter, NO_PRELOADS);
    expect(deps.beginCount).toBe(2);
  });

  it('过场没装配上：直接 enter，且同样延迟一帧解锁', () => {
    const deps = new FakeDeps();
    deps.transitionAvailable = false;
    const launcher = new GameLauncher(deps);
    const enter = vi.fn();

    launcher.launch(enter, NO_PRELOADS);
    expect(deps.beginCount).toBe(0);
    expect(enter).toHaveBeenCalledTimes(1);
    // 解锁前仍被挡
    launcher.launch(enter, NO_PRELOADS);
    expect(enter).toHaveBeenCalledTimes(1);
    // 解锁后放行
    deps.runDeferred();
    launcher.launch(enter, NO_PRELOADS);
    expect(enter).toHaveBeenCalledTimes(2);
  });
});
