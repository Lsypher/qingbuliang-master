import { _decorator, Component, Node, Sprite, SpriteFrame, assetManager } from 'cc';
import { BACKGROUND_DIR, BACKGROUNDS, START_BACKGROUND } from '../config/backgrounds';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../config/layout';
import type { RandomSource } from '../core/random';
import { createRandom, pickOne } from '../core/random';
import type { ScenePage } from '../game/bus';
import { BusEvent, bus } from '../game/bus';
import type { PreloadTask } from './uiFactory';
import { createUiNode, loadSpriteFrame, paintPanel, UI_COLOR } from './uiFactory';

const { ccclass } = _decorator;

/**
 * 背景层：开始页用专属背景图（固定不随机），进单局才从背景池随机抽一张，同一局内不切换；
 * 开始页与结算页把它压暗。
 *
 * 纯表现，不参与任何规则判定：它只听"现在切到哪一页"这一条广播，
 * 页面状态只在组合根那一处产生，这里不再自己拼一份。
 *
 * 本局背景的**抽定 / 预载 / 显示**是三步而不是一步：过场开始前先抽定（rollRoundBackground）、
 * 过场期间预载（它交出去的那项任务）、过场结束那一帧才显示（showRolledBackground）。
 * 拆开是为了让"进单局页那一帧背景已就位"成立——预载到的帧由本层留着，交接时同步换上，
 * 不再等一次异步加载。背景池与随机源因此始终留在本层，组合根不知道池子里有哪几张。
 *
 * 内存上只留当前一张：换背景时把上一张 release 掉——
 * 5 张 1080x1920 全常驻要 40MB 上下，而任意时刻只会显示一张。
 * 唯一的例外是过场那一小段：预载到的下一张与正在显示的上一张会同时在场（`rolledFrame`），
 * 交接换图时上一张随 `applyFrame` 放掉，多出来的一张不会活过这一帧。
 */
@ccclass('BackgroundView')
export class BackgroundView extends Component {
  private imageNode: Node | null = null;
  private dimNode: Node | null = null;
  private random: RandomSource = createRandom(Date.now() >>> 0);

  /** 本局已抽定的背景路径：抽定与显示分离后，它是这两步之间唯一的交接物 */
  private rolledPath: string | null = null;
  /** 预载到手的帧：有它就能在交接那一帧同步换上，不再走一次异步加载 */
  private rolledFrame: SpriteFrame | null = null;

  protected onLoad(): void {
    const image = createUiNode(this.node, 'BackgroundImage', SCREEN_WIDTH, SCREEN_HEIGHT);
    const sprite = image.addComponent(Sprite);
    // 用节点尺寸而不是图片自身尺寸：这样图片被拉满全屏，而不是把节点改成图片大小
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.imageNode = image;

    const dim = createUiNode(this.node, 'BackgroundDim', SCREEN_WIDTH, SCREEN_HEIGHT);
    paintPanel(dim, UI_COLOR.backgroundDim);
    this.dimNode = dim;

    bus.on(BusEvent.PageShown, this.onPageShown, this);

    // 开始页用专属背景图垫着；等玩家开局才随机换
    this.showStartBackground();
  }

  protected onDestroy(): void {
    bus.off(BusEvent.PageShown, this.onPageShown, this);
  }

  /**
   * 跟着页面走：进单局显示本局抽定的那张（这一局里就不再变），回开始页换回专属背景，
   * 其余页面一律压暗给文字让路。
   * 压暗只有这一个来源——"回开始页忘了解压暗"这种错不会再有第二个地方可以漏。
   */
  private onPageShown(page: ScenePage): void {
    this.setDimmed(page !== 'game');
    if (page === 'game') this.showRolledBackground();
    else if (page === 'start') this.showStartBackground();
  }

  /** 开始页专属背景：固定一张，不参与随机 */
  private showStartBackground(): void {
    this.showAt(`${BACKGROUND_DIR}/${START_BACKGROUND}`);
  }

  /**
   * 抽定本局背景（过场开始前由组合根调用），并交出一项"预载它"的任务给过场。
   *
   * 抽图与显示由此拆成两步：这里只抽不显示，显示要等过场结束（见 showRolledBackground）。
   * 池子与随机源都不出本层——交出去的只是个"加载好了叫我"的回调，组合根不知道抽到了哪张。
   *
   * 重复抽定不叠加：新的一局会用新的路径和新的帧覆盖掉上一次的待显示状态。
   */
  rollRoundBackground(): PreloadTask {
    const path = `${BACKGROUND_DIR}/${pickOne(BACKGROUNDS, this.random)}`;
    this.rolledPath = path;
    this.rolledFrame = null;

    return (done) => {
      loadSpriteFrame(path, (frame, error) => {
        // 只有"本局抽定的还是这一张"时才认这次结果：上一局那笔悬而未决的加载晚回来时，
        // 不能把新一局的待显示状态覆盖掉。认不认结果都要报"有结果"，否则过场要白等到超时。
        if (this.rolledPath === path) {
          if (!frame) {
            // 预载失败也照样放行：缺图沿用既有兜底（保留旧图）
            console.warn('[BackgroundView] 本局背景预载失败，本局沿用当前这张', path, error);
          }
          this.rolledFrame = frame;
        }
        done();
      });
    };
  }

  /**
   * 显示本局抽定的那一张（过场结束那一帧随切页走到这里），**不再重抽**。
   *
   * 预载已到手 → 同步换上：切页那一帧背景就已就位，既不空窗也不"啪"地跳一下。
   * 预载没到手（失败，或超时放行时还没回来）→ **沿用当前这张，本局不再换**。
   * 这里不给它另开一条异步换图的路：那会让玩家在本局中途看到背景"啪"地跳一次——
   * 正是这次要消掉的东西，也会把"一局之内背景不切换"这条破掉。代价是这一局顶着旧图，
   * 与既有兜底（背景保留旧图、图标跳过这一格）是同一个取舍。
   */
  private showRolledBackground(): void {
    if (this.rolledFrame) this.applyFrame(this.rolledFrame);
  }

  /**
   * 换上一张背景。
   * 新图到手之前保留旧图，避免闪一下空白；到手之后再把旧图放掉。
   */
  private showAt(path: string): void {
    loadSpriteFrame(path, (frame, error) => {
      if (!frame) {
        // 没拿到新图就继续用当前这张，避免闪一下空白
        console.warn('[BackgroundView] 背景加载失败，继续用当前这张', path, error);
        return;
      }
      this.applyFrame(frame);
    });
  }

  /** 把一张已到手的帧换上，并把上一张放掉；同一张不重复释放（随机重开到同一张就会出现这种情况） */
  private applyFrame(frame: SpriteFrame): void {
    const sprite = this.currentSprite();
    if (!sprite) return;
    const previous = sprite.spriteFrame;
    sprite.spriteFrame = frame;
    if (previous && previous !== frame) assetManager.releaseAsset(previous);
  }

  /**
   * 当前精灵。加载是异步的：期间背景层可能已被销毁，销毁后 sprite.node 置空，
   * 此时再赋 spriteFrame 会让引擎内部访问 null 崩溃，必须先校验。
   */
  private currentSprite(): Sprite | null {
    const sprite = this.imageNode?.getComponent(Sprite);
    return sprite && sprite.isValid ? sprite : null;
  }

  private setDimmed(dimmed: boolean): void {
    if (this.dimNode) this.dimNode.active = dimmed;
  }
}
