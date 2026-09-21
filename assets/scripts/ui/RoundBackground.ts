/**
 * 本局背景的抽定与预载：把"从池子里抽一张 → 过场期间预载 → 交接时交帧"三步收进一个对象，
 * 取代原先散在 BackgroundView 里的待显示路径 / 帧，以及那段"哪次加载算数"的守卫。
 *
 * **不 import 引擎**（与 core/entryGate.ts、ui/trayLayout.ts 同一约束）：加载入口由调用方注入
 * （真实实现是 uiFactory.loadSpriteFrame），随机源可注入，于是"上一局晚回的加载不覆盖新局"这类
 * 时序分支不必开编辑器就能测（见 tests/roundBackground.test.ts）。
 *
 * 与 BackgroundView 的分工：本模块只管"本局背景是哪张、加载好了没有"；换图、释放旧图、
 * 开始页固定背景与压暗都留在 BackgroundView（纯绘制）。
 */

import type { SpriteFrame } from 'cc';
import { BACKGROUND_DIR, BACKGROUNDS } from '../config/backgrounds';
import type { RandomSource } from '../core/random';
import { createRandom, pickOne } from '../core/random';
import type { PreloadTask } from './uiFactory';

/** 帧加载入口：真实实现是 uiFactory.loadSpriteFrame，测试注入可控版本 */
export type FrameLoader = (path: string, onLoad: (frame: SpriteFrame | null, error?: unknown) => void) => void;

/**
 * 本局背景的抽定器 / 预载器。
 *
 * 生命周期：`prepare()` 抽定一张并交出一项预载任务（过场跑它）→ 交接那一帧 `takeFrame()` 取走帧。
 */
export class RoundBackground {
  /** 本局已抽定的背景路径：抽定与显示分离后，它是这两步之间唯一的交接物，也是"哪次结果算数"的凭据 */
  private rolledPath: string | null = null;
  /** 预载到手的帧：有它就能在交接那一帧同步换上，不再走一次异步加载 */
  private rolledFrame: SpriteFrame | null = null;

  constructor(
    private readonly load: FrameLoader,
    private readonly random: RandomSource = createRandom(Date.now() >>> 0),
  ) {}

  /**
   * 抽定本局背景，并交出一项"预载它"的任务给过场。
   *
   * 重复抽定不叠加：新的一局用新路径覆盖上一次的待显示状态（待显示帧先归零）。
   */
  prepare(): PreloadTask {
    const path = `${BACKGROUND_DIR}/${pickOne(BACKGROUNDS, this.random)}`;
    this.rolledPath = path;
    this.rolledFrame = null;

    return (done) => {
      this.load(path, (frame, error) => {
        // 只有"本局抽定的还是这一张"时才认这次结果：上一局那笔悬而未决的加载晚回来时，
        // 不能把新一局的待显示状态覆盖掉。认不认结果都要报"有结果"，否则过场要白等到超时。
        if (this.rolledPath === path) {
          if (!frame) {
            // 预载失败也照样放行：缺图沿用既有兜底（保留旧图）
            console.warn('[RoundBackground] 本局背景预载失败，本局沿用当前这张', path, error);
          }
          this.rolledFrame = frame;
        }
        done();
      });
    };
  }

  /**
   * 取走本局预载到的帧，**取走即清**：同一张不会应用两次。
   * 没预载到手（失败，或超时放行时还没回来）返回 null，由调用方沿用当前这张。
   */
  takeFrame(): SpriteFrame | null {
    const frame = this.rolledFrame;
    this.rolledFrame = null;
    return frame;
  }
}
