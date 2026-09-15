import { _decorator, Component, Node, Sprite, assetManager } from 'cc';
import { BACKGROUND_DIR, BACKGROUNDS, START_BACKGROUND } from '../config/backgrounds';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../config/layout';
import type { RandomSource } from '../core/random';
import { createRandom, pickOne } from '../core/random';
import type { ScenePage } from '../game/bus';
import { BusEvent, bus } from '../game/bus';
import { createUiNode, loadSpriteFrame, paintPanel, UI_COLOR } from './uiFactory';

const { ccclass } = _decorator;

/**
 * 背景层：开始页用专属背景图（固定不随机），进单局才从背景池随机抽一张，同一局内不切换；
 * 开始页与结算页把它压暗。
 *
 * 纯表现，不参与任何规则判定：它只听"现在切到哪一页"这一条广播，
 * 页面状态只在组合根那一处产生，这里不再自己拼一份。
 *
 * 内存上只留当前一张：换背景时把上一张 release 掉——
 * 5 张 1080x1920 全常驻要 40MB 上下，而任意时刻只会显示一张。
 */
@ccclass('BackgroundView')
export class BackgroundView extends Component {
  private imageNode: Node | null = null;
  private dimNode: Node | null = null;
  private random: RandomSource = createRandom(Date.now() >>> 0);

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
   * 跟着页面走：进单局才随机换背景（这一局里就不再变），回开始页换回专属背景，
   * 其余页面一律压暗给文字让路。
   * 压暗只有这一个来源——"回开始页忘了解压暗"这种错不会再有第二个地方可以漏。
   */
  private onPageShown(page: ScenePage): void {
    this.setDimmed(page !== 'game');
    if (page === 'game') this.pickBackground();
    else if (page === 'start') this.showStartBackground();
  }

  /** 开始页专属背景：固定一张，不参与随机 */
  private showStartBackground(): void {
    this.showAt(`${BACKGROUND_DIR}/${START_BACKGROUND}`);
  }

  /** 从单局背景池随机抽一张换上 */
  private pickBackground(): void {
    this.showAt(`${BACKGROUND_DIR}/${pickOne(BACKGROUNDS, this.random)}`);
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
      const sprite = this.imageNode?.getComponent(Sprite);
      // 加载是异步的：期间背景层可能已被销毁，销毁后 sprite.node 置空，再赋 spriteFrame 会崩
      if (!sprite || !sprite.isValid) return;
      const previous = sprite.spriteFrame;
      sprite.spriteFrame = frame;
      if (previous && previous !== frame) assetManager.releaseAsset(previous);
    });
  }

  private setDimmed(dimmed: boolean): void {
    if (this.dimNode) this.dimNode.active = dimmed;
  }
}
