import { _decorator, Component, Node, Sprite, SpriteFrame, assetManager } from 'cc';
import { BACKGROUND_DIR, START_BACKGROUND } from '../config/backgrounds';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../config/layout';
import type { ScenePage } from '../game/bus';
import { BusEvent, bus } from '../game/bus';
import { RoundBackground } from './RoundBackground';
import type { PreloadTask } from './uiFactory';
import { createUiNode, loadSpriteFrame, paintPanel, UI_COLOR } from './uiFactory';

const { ccclass } = _decorator;

/**
 * 背景层：开始页用专属的**封面图**（固定不随机），进单局才从背景池随机抽一张，同一局内不切换；
 * 开始页与结算页把它压暗。
 *
 * 纯表现，不参与任何规则判定：它只听"现在切到哪一页"这一条广播，
 * 页面状态只在组合根那一处产生，这里不再自己拼一份。
 *
 * 本局背景的**抽定 / 预载 / 显示**是三步而不是一步：过场开始前先抽定（委托 RoundBackground.prepare）、
 * 过场期间预载（它交出去的那项任务）、过场结束那一帧才显示（takeFrame 取回预载帧）。
 * 拆开是为了让"进单局页那一帧背景已就位"成立——预载到的帧由 RoundBackground 留着，交接时同步换上，
 * 不再等一次异步加载。抽定、预载与背景池都收在 ui/RoundBackground.ts，本层只管把帧画上屏、放掉旧帧。
 *
 * 内存上只留当前一张：换背景时把上一张 release 掉——
 * 5 张 1080x1920 全常驻要 40MB 上下，而任意时刻只会显示一张。
 * 唯一的例外是过场那一小段：预载到的下一张与正在显示的上一张会同时在场（RoundBackground 里的待显示帧），
 * 交接换图时上一张随 `applyFrame` 放掉，多出来的一张不会活过这一帧。
 */
@ccclass('BackgroundView')
export class BackgroundView extends Component {
  private imageNode: Node | null = null;
  private dimNode: Node | null = null;
  /** 本局背景的抽定与预载：加载入口注入真实实现，池子与随机源都在它内部 */
  private readonly round = new RoundBackground(loadSpriteFrame);

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

    // 开始页用封面图垫着；等玩家开局才随机换
    this.showStartBackground();
  }

  protected onDestroy(): void {
    bus.off(BusEvent.PageShown, this.onPageShown, this);
  }

  /**
   * 跟着页面走：进单局显示本局抽定的那张（这一局里就不再变），回开始页换回封面图，
   * 其余页面一律压暗给文字让路。
   * 压暗只有这一个来源——"回开始页忘了解压暗"这种错不会再有第二个地方可以漏。
   */
  private onPageShown(page: ScenePage): void {
    this.setDimmed(page !== 'game');
    if (page === 'game') this.showRolledBackground();
    else if (page === 'start') this.showStartBackground();
  }

  /** 开始页封面图：固定一张，不参与随机 */
  private showStartBackground(): void {
    this.showAt(`${BACKGROUND_DIR}/${START_BACKGROUND}`);
  }

  /**
   * 抽定本局背景（过场开始前由组合根调用），并交出一项"预载它"的任务给过场。
   *
   * 具体抽图与预载收在 RoundBackground（池子与随机源都在那里），本层只把它转交出去：
   * 组合根因此既不知道抽到了哪张，也不用关心"哪次加载算数"。
   */
  rollRoundBackground(): PreloadTask {
    return this.round.prepare();
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
    const frame = this.round.takeFrame();
    if (frame) this.applyFrame(frame);
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
