import { _decorator, Button, Component, Label, Node, Sprite, UITransform } from 'cc';
import { STRINGS } from '../config/strings';
import { readBestScore } from '../game/bestScore';
import { BEST_SCORE_ICON_GAP, BEST_SCORE_ICON_SIZE, layoutBestScoreRow } from './startPageLayout';
import { UI_COLOR, loadSpriteFrame, paintRoundPanel, setLabelText } from './uiFactory';

const { ccclass } = _decorator;

/**
 * 场景里最高分那一行的结构：行容器 → 奖杯图标 + 文字。
 * 整行（图标宽 + 间距 + 文字宽）按实际宽度重算居中，见 placeBestScoreRow。
 */
const BEST_SCORE_ROW_NODE = 'BestScore';
const BEST_SCORE_ICON_NODE = 'Icon';
const BEST_SCORE_LABEL_NODE = 'Label';

/**
 * 奖杯图在资源目录里的路径（按文件名取图，与背景图、配料图标同一套约定）：美术把 `best-score-trophy.png`
 * 同名覆盖进这个目录即生效；图缺失或加载失败时这一行只显示文字，不会出现一张破图。
 */
const BEST_SCORE_TROPHY_PATH = 'art/ui/best-score-trophy';

/**
 * 开摊按钮底图在资源目录里的路径（同上，按文件名取图）：正常 / 按下两张，
 * 美术把 `start-button.png` / `start-button-pressed.png` 同名覆盖进这个目录即生效——
 * 不改代码、也不回编辑器接线。**不取悬停态**：手机端没有悬停，出一张只在桌面鼠标上生效的图不值得。
 */
const START_BUTTON_ART_PATH = 'art/ui/start-button';
const START_BUTTON_PRESSED_ART_PATH = 'art/ui/start-button-pressed';

/**
 * 场景里按钮的结构：按钮节点（Sprite 底图 + Button）→ 占位底图 + 文字。
 * 占位底图排在文字之前，所以压不到"开摊"两个字。
 */
const START_BUTTON_NODE = 'StartButton';
const START_BUTTON_PLACEHOLDER_NODE = 'Placeholder';
const START_BUTTON_LABEL_NODE = 'Label';

/**
 * 占位底图的圆角半径（设计像素）：与交付的木牌底图同一档圆角量级，
 * 缺图时占位底看上去仍是"同一块牌子"，底图到位后换上不会突然换个形状。
 */
const START_BUTTON_PLACEHOLDER_RADIUS = 16;

/**
 * 按下时按钮缩到的比例：手机端没有悬停，玩家对"按下有没有反应"的感知全在这一瞬间的画面变化上。
 * 0.95 量级——看得出来动了，又不至于像"掉下去"。
 */
const START_BUTTON_PRESS_SCALE = 0.95;

/**
 * 开始页：一张烤进标题与副标题的整屏封面图（由背景层画），加上两个由代码刷新的部分——最高分行与开摊按钮。
 *
 * 页面上的固定文字（标题、副标题、玩法一句话）全部在图里，所以这里没有任何"贴字"的代码。
 * 代价是**改开始页的文案等同于重出封面图**，文案表里不再有它们的位置（见 docs/adr/0004-start-page-cover-art.md）。
 *
 * 最高分每次页面显示时重读本地存储：上一局刚破的纪录，回到开始页立刻看得见。
 */
@ccclass('StartView')
export class StartView extends Component {
  protected onLoad(): void {
    // 按钮的占位底图与"按下缩小"各只需要做一次，所以放这里，而不是每回开始页都重来一遍的 onEnable
    this.setupStartButton();
  }

  protected onEnable(): void {
    this.showBestScore();
    this.showStartButton();
  }

  protected onDisable(): void {
    // 按到一半被切走（起手就进了单局）时把形变收回来，别把"按下的样子"漏到下一次显示
    this.node.getChildByName(START_BUTTON_NODE)?.setScale(1, 1, 1);
  }

  /**
   * 最高分那一行：文案 + 奖杯，摆成一行并整行居中。
   *
   * 文案用**开始页专用串**（带全角冒号，"最高分：128"读起来是一个完整句子），与结算页共用的
   * `bestScoreLabel` 分开（两条互不牵动）。数字每次都重读本地存储：
   * 上一局刚破的纪录，回到开始页立刻看得见。
   */
  private showBestScore(): void {
    const row = this.node.getChildByName(BEST_SCORE_ROW_NODE);
    if (!row) {
      console.warn('[StartView] 最高分那一行的容器没接上，这行这次不刷新');
      return;
    }
    setLabelText(row, BEST_SCORE_LABEL_NODE, `${STRINGS.bestScoreStartLabel}${readBestScore()}`);
    // 文字先落定，居中排布才有宽度可量（顺序不能反）
    this.showBestScoreIcon();
    this.placeBestScoreRow();
  }

  /**
   * 奖杯二选一：取到图就显示，取不到（图还没交付、文件坏了）就整个收起来——这一行只显示文字，
   * 不会出现一张破图。取图与开摊按钮同一套（按文件名走界面统一入口），同名覆盖即换图。
   *
   * 图显示 / 收起来都会让整行宽度变一次，所以两条路径回来都重排一次（见 placeBestScoreRow）。
   */
  private showBestScoreIcon(): void {
    const icon = this.node.getChildByName(BEST_SCORE_ROW_NODE)?.getChildByName(BEST_SCORE_ICON_NODE);
    const sprite = icon?.getComponent(Sprite);
    if (!icon || !sprite) {
      console.warn('[StartView] 最高分那一行的奖杯节点没接上，这行只显示文字');
      return;
    }
    // 已经在本地缓存里拿到过图（再次回到开始页）就直接显示，不必等回调，免得这一行先只有文字再补上奖杯
    if (sprite.spriteFrame) {
      icon.active = true;
      return;
    }
    icon.active = false;

    loadSpriteFrame(BEST_SCORE_TROPHY_PATH, (frame, error) => {
      // 资源是异步加载的：回调回来时节点可能已经被销毁（页面被切走、场景重开），得先校验
      if (!icon.isValid) return;
      if (!frame) {
        console.warn('[StartView] 奖杯图没取到，最高分这一行只显示文字', error);
        icon.active = false;
      } else {
        sprite.spriteFrame = frame;
        icon.active = true;
      }
      this.placeBestScoreRow();
    });
  }

  /**
   * 把奖杯与文字摆成一行、整行居中；算式在 startPageLayout 里（不依赖引擎、有单测），
   * 这里只负责量出两段宽度喂给它、再把算出来的偏移原样用上。
   *
   * 文字宽用文字节点自己量：`Overflow.NONE` 下引擎按实测文字宽改写这个盒子，但那一步要等渲染才做——
   * 先 `updateRenderData(true)` 强制同步一次，否则读到的是上一句的宽度，位数一变整行就跑偏。
   * `updateRenderData` 是引擎的**内部 API**（未进官方文档），升引擎时要复核它是否还在、还同步。
   * 奖杯没显示时按 0 宽参与计算（算式会连间距一起忽略），文字因此仍然居中。
   *
   * 奖杯宽取场景里那个节点的：骨架进场景后版面尺寸以场景为准，常量只作取不到时的兜底。
   */
  private placeBestScoreRow(): void {
    const row = this.node.getChildByName(BEST_SCORE_ROW_NODE);
    const label = row?.getChildByName(BEST_SCORE_LABEL_NODE)?.getComponent(Label);
    const labelTransform = label?.node.getComponent(UITransform);
    if (!row || !label || !labelTransform) return;

    label.updateRenderData(true);
    const icon = row.getChildByName(BEST_SCORE_ICON_NODE);
    const iconWidth = icon?.active ? (icon.getComponent(UITransform)?.width ?? BEST_SCORE_ICON_SIZE) : 0;
    const layout = layoutBestScoreRow(iconWidth, BEST_SCORE_ICON_GAP, labelTransform.width);

    if (icon) icon.setPosition(layout.iconX, icon.position.y, 0);
    label.node.setPosition(layout.textX, label.node.position.y, 0);
  }

  /**
   * 开摊按钮的一次性装配：画好占位底图、把"按下缩小"接上。
   *
   * 按下缩小**不能交给 Button 的缩放过渡**：一个按钮只有一种过渡方式，而换图已经用了 Sprite 过渡
   * （正常 / 按下两态），所以这条自己接。缩的是按钮节点本身，而"开摊"两个字是它的子节点，
   * 于是文字跟着底图一起动，不会出现"文字与底图分离"。
   */
  private setupStartButton(): void {
    const buttonNode = this.node.getChildByName(START_BUTTON_NODE);
    if (!buttonNode) {
      console.warn('[StartView] 开摊按钮没接上，按钮区这次不刷新');
      return;
    }
    this.paintStartButtonPlaceholder(buttonNode);

    // 按下 / 松手都是一次性 setScale、不做补间：这一瞬间的形变就是全部反馈，补间反而慢半拍
    const shrink = (): void => buttonNode.setScale(START_BUTTON_PRESS_SCALE, START_BUTTON_PRESS_SCALE, 1);
    const restore = (): void => buttonNode.setScale(1, 1, 1);
    buttonNode.on(Node.EventType.TOUCH_START, shrink, this);
    buttonNode.on(Node.EventType.TOUCH_END, restore, this);
    // 手指划出按钮范围（Button 判定为取消）也要还原，否则按钮会卡在缩小的样子
    buttonNode.on(Node.EventType.TOUCH_CANCEL, restore, this);
  }

  /**
   * 占位底图：程序化画一块木色圆角面板（颜色取自交付底图的木纹中间调）。
   *
   * 底图还没交付 / 加载失败时它顶着，版面与按下反馈当天就能验收，不必等美术；
   * 它是按钮的子节点，所以按下时跟按钮一起缩。取到真底图后由 setStartButtonPlaceholderVisible 收起——
   * 两者互斥，占位底不会盖住真图，也就不需要在场景里留按钮自己的纯色绘制组件。
   */
  private paintStartButtonPlaceholder(buttonNode: Node): void {
    const placeholder = buttonNode.getChildByName(START_BUTTON_PLACEHOLDER_NODE);
    if (!placeholder) {
      console.warn('[StartView] 按钮的占位底图节点没接上，底图缺失时按钮会没有底板');
      return;
    }
    paintRoundPanel(placeholder, UI_COLOR.startButtonPlaceholder, START_BUTTON_PLACEHOLDER_RADIUS);
    placeholder.active = true;
  }

  /**
   * 开摊按钮：文字仍从文案表取；底图按文件名取（正常 / 按下两态），换图由场景里设好的
   * Sprite 过渡完成——按下换图、松手换回，**不提供悬停态图**（手机端没有悬停，悬停复用正常态）。
   */
  private showStartButton(): void {
    const buttonNode = this.node.getChildByName(START_BUTTON_NODE);
    const button = buttonNode?.getComponent(Button);
    if (!buttonNode || !button) return;
    setLabelText(buttonNode, START_BUTTON_LABEL_NODE, STRINGS.startButton);
    this.showStartButtonArt(buttonNode, button);
  }

  /**
   * 按钮底图二选一：取到图就用图（并收起占位底），取不到（图还没交付、文件坏了）就留着占位底——
   * 按钮任何时候都有底板，不会变成一块空白。取图与奖杯同一套（按文件名走界面统一入口）。
   *
   * 按下态是**可缺**的：Button 在按下时拿不到 pressedSprite 会保持当前这一帧，不会画出破图，
   * 所以这里只告警、不拿它当失败。正常态拿不到才算真没底图，占位底继续顶着。
   */
  private showStartButtonArt(buttonNode: Node, button: Button): void {
    // 已经在本地缓存里拿到过图（再次回到开始页）就直接用，不必等回调，免得闪一下占位底
    if (button.normalSprite) {
      this.setStartButtonPlaceholderVisible(buttonNode, false);
      return;
    }
    loadSpriteFrame(START_BUTTON_ART_PATH, (normal, error) => {
      // 资源是异步加载的：回调回来时节点可能已经被销毁（页面被切走、场景重开），得先校验
      if (!buttonNode.isValid) return;
      if (!normal) {
        console.warn('[StartView] 按钮底图没取到，继续用程序化占位底', error);
        return;
      }
      button.normalSprite = normal;
      // 悬停复用正常态：手机端没有悬停，不为桌面鼠标单独出一张图
      button.hoverSprite = normal;
      this.setStartButtonPlaceholderVisible(buttonNode, false);
    });
    loadSpriteFrame(START_BUTTON_PRESSED_ART_PATH, (pressed, error) => {
      if (!buttonNode.isValid) return;
      if (!pressed) {
        console.warn('[StartView] 按钮按下态底图没取到，按下时仍显示正常态', error);
        return;
      }
      button.pressedSprite = pressed;
    });
  }

  /** 有真底图就把占位底收起来，没有就让它继续顶着（两者互斥，谁也不会盖住谁） */
  private setStartButtonPlaceholderVisible(buttonNode: Node, visible: boolean): void {
    const placeholder = buttonNode.getChildByName(START_BUTTON_PLACEHOLDER_NODE);
    if (placeholder) placeholder.active = visible;
  }
}
