import { _decorator, Component, Label, UITransform, view } from 'cc';
import { STRINGS } from '../config/strings';
import { readBestScore } from '../game/bestScore';
import { setLabelText, visibleWidth } from './uiFactory';

const { ccclass } = _decorator;

/** 玩法一句话两侧的留白（设计像素）：窄屏收字号时按"可见宽度 - 它"给盒子定宽 */
const HOW_TO_PLAY_SIDE_MARGIN = 40;

/**
 * 开始页：标题、副标题、玩法一句话、最高分、开始按钮。
 *
 * 每次页面显示时重刷一遍：文案从 strings.ts 取（场景里那几行只是摆版时的预览值），
 * 最高分重新读一次本地存储——上一局刚破的纪录，回到开始页立刻看得见。
 */
@ccclass('StartView')
export class StartView extends Component {
  /** 玩法一句话在场景里摆的原始宽度：收窄过之后遇到宽屏要还原，所以先记住它 */
  private howToPlayDesignWidth: number | null = null;

  protected onEnable(): void {
    setLabelText(this.node, 'Title', STRINGS.title);
    setLabelText(this.node, 'Subtitle', STRINGS.subtitle);
    setLabelText(this.node, 'HowToPlay', STRINGS.howToPlay);
    setLabelText(this.node, 'BestScore', `${STRINGS.bestScoreLabel} ${readBestScore()}`);
    this.fitHowToPlay();
    // 转屏 / 窗口缩放也会改可见宽度，跟着重算一次
    view.on('canvas-resize', this.fitHowToPlay, this);

    // 按钮文字在按钮节点下的 Label 上，得从按钮节点里找
    const startButton = this.node.getChildByName('StartButton');
    if (startButton) setLabelText(startButton, 'Label', STRINGS.startButton);
  }

  protected onDisable(): void {
    view.off('canvas-resize', this.fitHowToPlay, this);
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
}
