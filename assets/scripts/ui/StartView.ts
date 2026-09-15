import { _decorator, Button, Component, Label, Node, Sprite, SpriteFrame, UITransform, view } from 'cc';
import { STRINGS } from '../config/strings';
import { readBestScore } from '../game/bestScore';
import {
  BEST_SCORE_ICON_GAP,
  BEST_SCORE_ICON_SIZE,
  TITLE_DESIGN_WIDTH,
  fitTitleScale,
  layoutBestScoreRow,
} from './startPageLayout';
import { UI_COLOR, loadSpriteFrame, paintRoundPanel, setLabelText, visibleWidth } from './uiFactory';

const { ccclass } = _decorator;

/** 玩法一句话两侧的留白（设计像素）：窄屏收字号时按"可见宽度 - 它"给盒子定宽 */
const HOW_TO_PLAY_SIDE_MARGIN = 40;

/**
 * 副标题两侧的留白（设计像素）：它下面垫着底框，而底框还要往文字外各扩 28（见 SUBTITLE_BOX_PADDING_X），
 * 所以这一行留得比玩法说明多——窄屏收窄时底框因此仍与屏幕边留着 8 像素余量。
 */
const SUBTITLE_SIDE_MARGIN = 72;

/** 副标题底框的内边距（设计像素）：水平 28 / 垂直 14，底框总比文字盒每边多出这么多 */
const SUBTITLE_BOX_PADDING_X = 28;
const SUBTITLE_BOX_PADDING_Y = 14;

/** 副标题底框的圆角半径（设计像素） */
const SUBTITLE_BOX_RADIUS = 16;

/** 场景里副标题的两套节点：文字与垫在它下层的圆角底框 */
const SUBTITLE_NODE = 'Subtitle';
const SUBTITLE_BOX_NODE = 'SubtitleBox';

/** 场景里玩法一句话的节点名 */
const HOW_TO_PLAY_NODE = 'HowToPlay';

/**
 * 场景里最高分那一行的结构：行容器 → 奖杯图标 + 文字。
 * 整行（图标宽 + 间距 + 文字宽）按实际宽度重算居中，见 placeBestScoreRow。
 */
const BEST_SCORE_ROW_NODE = 'BestScore';
const BEST_SCORE_ICON_NODE = 'Icon';
const BEST_SCORE_LABEL_NODE = 'Label';

/**
 * 标题艺术字在资源目录里的路径（按文件名取图，与背景图、配料图标同一套约定）。
 * 美术把 `title-art.png` 同名覆盖进这个目录即生效——不改代码、也不回编辑器接线。
 */
const TITLE_ART_PATH = 'art/ui/title-art';

/**
 * 奖杯图在资源目录里的路径（同上，按文件名取图）：美术把 `best-score-trophy.png`
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

/** 占位底图的圆角半径（设计像素）：与场景里副标题底框同一档圆角 */
const START_BUTTON_PLACEHOLDER_RADIUS = 16;

/**
 * 按下时按钮缩到的比例：手机端没有悬停，玩家对"按下有没有反应"的感知全在这一瞬间的画面变化上。
 * 0.95 量级——看得出来动了，又不至于像"掉下去"。
 */
const START_BUTTON_PRESS_SCALE = 0.95;

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
  /** 页面上每行长文字在场景里摆的原始盒宽：收窄过之后遇到宽屏要还原，所以先记住它 */
  private readonly lineDesignWidths = new Map<string, number>();

  protected onLoad(): void {
    // 按钮的占位底图与"按下缩小"各只需要做一次，所以放这里，而不是每回开始页都重来一遍的 onEnable
    this.setupStartButton();
  }

  protected onEnable(): void {
    setLabelText(this.node, TITLE_FALLBACK_NODE, STRINGS.title);
    setLabelText(this.node, SUBTITLE_NODE, STRINGS.subtitle);
    setLabelText(this.node, HOW_TO_PLAY_NODE, STRINGS.howToPlay);
    this.showTitle();
    this.placeSubtitleBox();
    this.showBestScore();
    this.showStartButton();
    this.refit();
    // 转屏 / 窗口缩放也会改可见宽度，跟着重算一次（标题缩放与玩法说明收窄读的是同一个数）
    view.on('canvas-resize', this.refit, this);
  }

  protected onDisable(): void {
    view.off('canvas-resize', this.refit, this);
    // 按到一半被切走（起手就进了单局）时把形变收回来，别把"按下的样子"漏到下一次显示
    this.node.getChildByName(START_BUTTON_NODE)?.setScale(1, 1, 1);
  }

  /**
   * 可见宽度变了（转屏、拖窗口）就重排：标题缩放、副标题与其底框、玩法说明的收窄读的是同一个数 */
  private refit(): void {
    this.fitSubtitle();
    this.fitHowToPlay();
    this.fitTitle();
  }

  /**
   * 把开始页的一行长文字收进当前可见宽度，返回它最终用的盒宽（设计像素）。
   *
   * 可见宽度只有一个来源（uiFactory.visibleWidth），收窄规则也只有这一份：
   * 装得下就保持场景里摆的设计宽（画面与改动前一致）；装不下就收进"可见宽度 − 这一行自己的留白"，
   * 同时关掉自动换行、交给引擎缩字号（横竖都还读得清，也不会折成两行把高度撑开）。
   * 副标题与玩法说明共用它——副标题的底框要跟着文字盒收窄，两边就不可能各算一套。
   */
  private fitLineWidth(nodeName: string, sideMargin: number): number {
    const label = this.node.getChildByName(nodeName)?.getComponent(Label);
    const transform = label?.node.getComponent(UITransform);
    if (!label || !transform) return 0;

    const design = this.lineDesignWidths.get(nodeName) ?? transform.width;
    this.lineDesignWidths.set(nodeName, design);
    // 可见宽度窄到装不下这一行的留白时（把窗口拖到极窄），下限兜到 0：宁可字缩到最小，也别给个负宽度
    const width = Math.max(0, Math.min(design, visibleWidth() - sideMargin));

    if (width >= design) {
      // 宽屏：还原成原始宽度与自动撑开（这是场景里摆版时的状态）
      label.overflow = Label.Overflow.NONE;
      label.enableWrapText = true;
    } else {
      label.enableWrapText = false;
      label.overflow = Label.Overflow.SHRINK;
    }
    transform.setContentSize(width, transform.height);
    return width;
  }

  /**
   * 副标题：拿共用的收窄结果给文字定宽，底框再跟着文字盒一起收窄——框总比文字每边多出 28 的内边距，
   * 窄屏上因此既不会"框还是设计宽"（比起文字大得夸张），也不会"框比文字窄"（把字切了）。
   *
   * 宽屏（`Overflow.NONE`）下文字会由引擎按实测文字宽自动撑开，那个宽与场景里摆的设计宽是同一号字
   * 量出来的，所以底框在宽屏上同样贴着文字；窄屏（`Overflow.SHRINK`）下盒子宽度由我们给定、不再被
   * 引擎改写，框与文字的 28 像素内边距就是精确的。
   *
   * 底框的高度跟着文字盒的高度走（同一份尺寸来源），所以两者永远同心。
   */
  private fitSubtitle(): void {
    const text = this.node.getChildByName(SUBTITLE_NODE);
    const textTransform = text?.getComponent(UITransform);
    const box = this.node.getChildByName(SUBTITLE_BOX_NODE);
    const boxTransform = box?.getComponent(UITransform);
    if (!box || !boxTransform || !textTransform) return;

    const textWidth = this.fitLineWidth(SUBTITLE_NODE, SUBTITLE_SIDE_MARGIN);
    boxTransform.setContentSize(
      textWidth + SUBTITLE_BOX_PADDING_X * 2,
      textTransform.height + SUBTITLE_BOX_PADDING_Y * 2,
    );
    // 尺寸先定好再画：绘制读的就是节点自己的尺寸，反了就会画出上一轮的框
    paintRoundPanel(box, UI_COLOR.subtitleBackdrop, SUBTITLE_BOX_RADIUS);
  }

  /**
   * 底框就位：**不能排在副标题之后**。同一层里的节点按顺序画，先画的在下层，
   * 所以"排在文字之前"就是"半透明黑框不盖住字"的全部依据——场景里本来就是这个顺序，
   * 这里只在顺序被改坏时把它挪回去（日后在编辑器里把底框拖到文字后面，字会被半透明黑盖住）。
   *
   * 只在"已经跑到后面"时才挪，是因为 `setSiblingIndex` 是"先摘出自己、再插到该下标"：
   * 底框本来就在前面时按文字下标插回去，反而会插到文字**后面**（摘掉自己后文字的下标会前移一位）。
   */
  private placeSubtitleBox(): void {
    const text = this.node.getChildByName(SUBTITLE_NODE);
    const box = this.node.getChildByName(SUBTITLE_BOX_NODE);
    if (!text || !box) return;
    if (box.getSiblingIndex() > text.getSiblingIndex()) box.setSiblingIndex(text.getSiblingIndex());
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
   * 最高分那一行：文案 + 奖杯，摆成一行并整行居中。
   *
   * 文案用**开始页专用串**（带全角冒号，"最高分：128"读起来是一个完整句子），与结算页共用的
   * `bestScoreLabel` 分开——本次只改开始页，不污染结算页那行。数字每次都重读本地存储：
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
   * 不会出现一张破图。取图与标题同一套（按文件名走界面统一入口），同名覆盖即换图。
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
   * 按钮任何时候都有底板，不会变成一块空白。取图与标题、奖杯同一套（按文件名走界面统一入口）。
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

  /** 玩法一句话是页面上最长的一行，比 9:16 更窄的全面屏只看得见约 590 像素宽，走共用的收窄 */
  private fitHowToPlay(): void {
    this.fitLineWidth(HOW_TO_PLAY_NODE, HOW_TO_PLAY_SIDE_MARGIN);
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
