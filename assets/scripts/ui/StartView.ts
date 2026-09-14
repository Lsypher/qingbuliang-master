import { _decorator, Component, Label, Node, Sprite, SpriteFrame, UITransform, view } from 'cc';
import { STRINGS } from '../config/strings';
import { readBestScore } from '../game/bestScore';
import { TITLE_DESIGN_WIDTH, fitTitleScale } from './startPageLayout';
import { loadSpriteFrame, setLabelText, visibleWidth } from './uiFactory';

const { ccclass } = _decorator;

/** 玩法一句话两侧的留白（设计像素）：窄屏收字号时按"可见宽度 - 它"给盒子定宽 */
const HOW_TO_PLAY_SIDE_MARGIN = 40;

/**
 * 标题艺术字在资源目录里的路径（按文件名取图，与背景图、配料图标同一套约定）。
 * 美术把 `title-art.png` 同名覆盖进这个目录即生效——不改代码、也不回编辑器接线。
 */
const TITLE_ART_PATH = 'art/ui/title-art';

/** 场景里承载标题的两套节点：图片（艺术字）与文字（兜底），同一时刻只显示其中一个 */
const TITLE_ART_NODE = 'TitleArt';
const TITLE_FALLBACK_NODE = 'TitleFallback';

/**
 * 开始页：标题艺术字（含文字兜底）、副标题、玩法一句话、最高分、开始按钮。
 *
 * 每次页面显示时重刷一遍：文案从 strings.ts 取（场景里那几行只是摆版时的预览值），
 * 最高分重新读一次本地存储——上一局刚破的纪录，回到开始页立刻看得见。
 */
@ccclass('StartView')
export class StartView extends Component {
  /** 玩法一句话在场景里摆的原始宽度：收窄过之后遇到宽屏要还原，所以先记住它 */
  private howToPlayDesignWidth: number | null = null;

  protected onEnable(): void {
    setLabelText(this.node, TITLE_FALLBACK_NODE, STRINGS.title);
    setLabelText(this.node, 'Subtitle', STRINGS.subtitle);
    setLabelText(this.node, 'HowToPlay', STRINGS.howToPlay);
    setLabelText(this.node, 'BestScore', `${STRINGS.bestScoreLabel} ${readBestScore()}`);
    this.showTitle();
    this.refit();
    // 转屏 / 窗口缩放也会改可见宽度，跟着重算一次（标题缩放与玩法说明收窄读的是同一个数）
    view.on('canvas-resize', this.refit, this);

    // 按钮文字在按钮节点下的 Label 上，得从按钮节点里找
    const startButton = this.node.getChildByName('StartButton');
    if (startButton) setLabelText(startButton, 'Label', STRINGS.startButton);
  }

  protected onDisable(): void {
    view.off('canvas-resize', this.refit, this);
  }

  /** 可见宽度变了（转屏、拖窗口）就重排：标题缩放与玩法说明的收窄读的是同一个数 */
  private refit(): void {
    this.fitHowToPlay();
    this.fitTitle();
  }

  /**
   * 标题二选一：取到艺术字图片就显示图片，取不到（图还没交付、文件坏了）就显示文字兜底，
   * 页面绝不会开天窗。两套节点互斥显示，切换只改 `active`，不动场景接线。
   *
   * 场景里给的是"兜底在先"的默认态（图片槽位为空的场景节点不参与渲染）；这里再加一层保险——
   * 已经在本地缓存里拿到过图（再次回到开始页）就直接显示图片，不必等回调，免得闪一下兜底文字。
   */
  private showTitle(): void {
    const art = this.node.getChildByName(TITLE_ART_NODE);
    const fallback = this.node.getChildByName(TITLE_FALLBACK_NODE);
    if (!art || !fallback) {
      console.warn('[StartView] 标题的图片节点或兜底节点没接上，标题区这次不刷新');
      return;
    }
    const sprite = art.getComponent(Sprite);

    if (sprite?.spriteFrame) {
      this.applyTitleArt(art, fallback, sprite, sprite.spriteFrame);
      return;
    }
    art.active = false;
    fallback.active = true;

    loadSpriteFrame(TITLE_ART_PATH, (frame, error) => {
      // 资源是异步加载的：回调回来时节点可能已经被销毁（页面被切走、场景重开），得先校验
      if (!art.isValid || !fallback.isValid) return;
      if (!frame || !sprite) {
        console.warn('[StartView] 标题艺术字没取到，已退回文字兜底', error);
        art.active = false;
        fallback.active = true;
        return;
      }
      this.applyTitleArt(art, fallback, sprite, frame);
    });
  }

  /**
   * 显示艺术字、收起兜底文字。
   *
   * 盒子的高度按**图片自身的高宽比**算，而不是硬套设计盒子的比例——美术交付的图哪怕比例与规格
   * 有出入（现在这张就是 3:1，规格要的是 3.5:1），也不会被拉变形；
   * 图按规格出（1120×320）时算出来正好是设计高度 160，与设计稿逐像素一致。
   */
  private applyTitleArt(art: Node, fallback: Node, sprite: Sprite, frame: SpriteFrame): void {
    sprite.spriteFrame = frame;
    const transform = art.getComponent(UITransform);
    if (transform && frame.width > 0) {
      transform.setContentSize(TITLE_DESIGN_WIDTH, (TITLE_DESIGN_WIDTH * frame.height) / frame.width);
    }
    art.active = true;
    fallback.active = false;
  }

  /**
   * 玩法一句话是页面上最长的一行（642 设计像素），比 9:16 更窄的全面屏手机只看得见约 590 像素宽，
   * 两边会被裁掉。这里把它的盒子收进可见宽度，交给引擎缩字号（关掉自动换行，保住一行的高度）。
   * 宽屏上仍旧按场景里摆的原始宽度渲染——收窄是可逆的，回到宽屏不会留下小字号。
   */
  private fitHowToPlay(): void {
    const label = this.node.getChildByName('HowToPlay')?.getComponent(Label);
    const transform = label?.node.getComponent(UITransform);
    if (!label || !transform) return;

    if (this.howToPlayDesignWidth === null) this.howToPlayDesignWidth = transform.width;
    const design = this.howToPlayDesignWidth;
    const limit = visibleWidth() - HOW_TO_PLAY_SIDE_MARGIN;
    const width = Math.min(design, limit);

    if (width >= design) {
      // 宽屏：还原成原始宽度与自动撑开（这是场景里摆版时的状态）
      label.overflow = Label.Overflow.NONE;
      label.enableWrapText = true;
    } else {
      label.enableWrapText = false;
      label.overflow = Label.Overflow.SHRINK;
    }
    transform.setContentSize(width, transform.height);
  }

  /**
   * 标题按可见宽度等比缩放（只缩不放），窄屏因此不会被切掉两头的字。
   * 算式在 startPageLayout 里（不依赖引擎、有单测），这里只负责把可见宽度量出来喂给它、
   * 再把这个系数原样用在同一节点的两个轴上——宽高同乘一个系数，高宽比自然不会变。
   *
   * 图片态与兜底态都要缩：两套节点是同一个标题的两种画法，谁在场都得是同一个宽度。
   */
  private fitTitle(): void {
    const scale = fitTitleScale(visibleWidth());
    for (const name of [TITLE_ART_NODE, TITLE_FALLBACK_NODE]) {
      const node = this.node.getChildByName(name);
      if (node) node.setScale(scale, scale, 1);
    }
  }
}
