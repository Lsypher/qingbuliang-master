/**
 * 本局背景抽定 / 预载的测试。
 *
 * 加载入口与随机源都由测试注入，所以"哪个结果算数、什么时候能取到帧"这些时序分支不必开编辑器去试。
 * 只断言外部行为：prepare 之后 takeFrame 拿到什么；测试名用中文写成一句需求。
 */

import type { SpriteFrame } from 'cc';
import { describe, expect, it } from 'vitest';
import type { RandomSource } from '../assets/scripts/core/random';
import { RoundBackground } from '../assets/scripts/ui/RoundBackground';
import type { FrameLoader } from '../assets/scripts/ui/RoundBackground';

/** 假的帧：只需能区分是哪一张，不依赖引擎 */
function fakeFrame(tag: string): SpriteFrame {
  return { tag } as unknown as SpriteFrame;
}

/** 固定/序列随机源：让"抽到哪张"可预期（pickOne 取 floor(random() × 池子长度)） */
function sequenceRandom(values: number[]): RandomSource {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

/** 可控的帧加载：把每次请求挂起，由测试决定何时、以什么结果回调 */
class FakeLoader {
  private readonly pending: Array<{ onLoad: (frame: SpriteFrame | null, error?: unknown) => void }> = [];

  readonly load: FrameLoader = (_path, onLoad) => {
    this.pending.push({ onLoad });
  };

  /** 已发起的请求数量 */
  count(): number {
    return this.pending.length;
  }

  /** 让第 index 笔（按发起顺序）请求以 frame 结果回调 */
  settle(index: number, frame: SpriteFrame | null): void {
    const item = this.pending[index];
    if (!item) throw new Error(`没有第 ${index} 笔待决加载`);
    item.onLoad(frame);
  }
}

/** 池子够大，用不同随机值就能抽到不同张，用于验证"晚回不覆盖新局" */
const FIRST = () => 0;
const DIFFERENT_PICKS = sequenceRandom([0, 0.9]);

describe('本局背景的抽定与预载', () => {
  it('预载成功：任务跑完后能取到该帧', () => {
    const loader = new FakeLoader();
    const round = new RoundBackground(loader.load, FIRST);
    const frame = fakeFrame('A');

    let doneCount = 0;
    round.prepare()(() => doneCount++);
    loader.settle(0, frame);

    expect(doneCount).toBe(1);
    expect(round.takeFrame()).toBe(frame);
  });

  it('取走即清：同一帧不会应用两次', () => {
    const loader = new FakeLoader();
    const round = new RoundBackground(loader.load, FIRST);

    round.prepare()(() => {});
    loader.settle(0, fakeFrame('A'));

    expect(round.takeFrame()).not.toBeNull();
    expect(round.takeFrame()).toBeNull();
  });

  it('预载失败：仍报"有结果"，但取不到帧（由调用方沿用旧图）', () => {
    const loader = new FakeLoader();
    const round = new RoundBackground(loader.load, FIRST);

    let doneCount = 0;
    round.prepare()(() => doneCount++);
    loader.settle(0, null);

    expect(doneCount).toBe(1);
    expect(round.takeFrame()).toBeNull();
  });

  it('上一局晚回的加载不覆盖新局：只认本局抽到的那一张', () => {
    const loader = new FakeLoader();
    const round = new RoundBackground(loader.load, DIFFERENT_PICKS);
    const frameA = fakeFrame('A');
    const frameB = fakeFrame('B');

    // 第一局发起预载，但一直不回调
    round.prepare()(() => {});
    expect(loader.count()).toBe(1);
    // 新的一局重新抽定（抽到另一张）并预载
    round.prepare()(() => {});
    expect(loader.count()).toBe(2);
    loader.settle(1, frameB);
    // 此时第一局那笔才晚回来，它的结果必须被丢弃（抽到的已不是它）
    loader.settle(0, frameA);

    expect(round.takeFrame()).toBe(frameB);
  });

  it('每次 prepare 都作废旧的待显示帧：新结果到来前取不到帧', () => {
    const loader = new FakeLoader();
    const round = new RoundBackground(loader.load, FIRST);

    round.prepare()(() => {});
    loader.settle(0, fakeFrame('A'));
    // 重新抽定后，上一次的待显示帧作废
    round.prepare()(() => {});

    expect(round.takeFrame()).toBeNull();
  });
});
