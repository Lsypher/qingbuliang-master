import { Color, Graphics, Label, Layers, Node, SpriteFrame, UIOpacity, UITransform, Vec3, resources, tween, view } from 'cc';
import { SCREEN_WIDTH } from '../config/layout';

/**
 * 界面统一用色：改主题只改这里；素材配色到位前先用这套程序化配色。
 *
 * 由代码建的界面（单局页、各反馈层、过场）直接读这支表；**例外是开始页与结算页的骨架文字样式**——
 * 那两屏的正文色与描边烤在场景里（`assets/scenes/main.scene`），取值以本表为准、改本表不会跟着变。
 * 这两屏的其余东西仍归本表管：开摊按钮的占位底、整屏压暗层都是代码在读
 * （分工见 docs/adr/0002-start-page-skeleton-in-scene.md）。
 */
export const UI_COLOR = {
  /**
   * 正文白。只用在自带深色底板的地方：配料幽灵的标签（见 ui/ingredientGhost.ts）与准备过场的文案，
   * 另外 `createLabel` 不传色时默认取它。配料盘格子现已不用它（改由 traySlotLabel 那支顶替）。
   */
  textPrimary: new Color(255, 255, 255, 255),
  /**
   * 页面正文色（暖米黄）：单局页的统计行、订单卡标题与已放进度、空碗提示，
   * 以及结算页的完成订单 / 最高连击 / 再来一碗（后三处烤在场景里，见本表头）。
   * 用暖色而非中性灰，是因为背景美术通篇暖色（木纹、沙滩、夜市灯）加大片亮青，
   * 冷灰压上去显脏又争不到对比；米黄与背景同族、只靠明度退下去，配 textOutline 后对比度约 9:1。
   * 改它牵动单局页那四处（结算页三处烤在场景里，不会跟着变），且要连 textOutline 一起看——可读性其实由描边承担。
   */
  textBody: new Color(240, 219, 190, 255),
  /**
   * 强调色（暖金）：只给"必须第一眼看到"的东西——单局页倒计时数字、跟手幽灵的描边，
   * 以及开始页"最高分"、结算页的标题 / 本局分数 / 最高分（后面这几处烤在场景里，见本表头）。
   * 与倒计时进度条的填充同族（见 barFill），改色要连那一处一起看。
   * 配料盘的汤底标签不在这儿：暖金压在那片浅底上会糊没，那边走 traySlotLabelBase。
   */
  textAccent: new Color(255, 226, 168, 255),
  /**
   * 压在背景图上的静态文字的描边色（深暖棕）：单局页的静态文字（由 `createOutlinedText` 现建），
   * 与开始页"最高分"、开摊按钮、结算页全部 7 处文字同一支（后三处烤在场景里，见本表头）。
   * 描边只负责把字从任意背景上"抠"出来，不参与信息层级——层级交给正文色的明度与字号。
   * 反馈飘字与订单勾不共用它：它们各有与自身正文同色系的深色描边（见下面几支 *Outline）。
   */
  textOutline: new Color(74, 44, 20, 255),
  /** 配料幽灵的底板（跟手与弹回共用，见 ui/ingredientGhost.ts）：深蓝近黑，压在任意背景上都托得住图标与白字 */
  panel: new Color(24, 32, 46, 235),
  /**
   * 配料盘格子的底色（带一丝绿调的近白）：G 比 R / B 各高 7~9，所以肉眼读到的仍是白，
   * 只有 12 格成片铺开时才透出淡淡的薄荷绿——与整屏暖橙 / 沙滩的背景形成清爽的对照，
   * 也比原来的奶白（偏黄）更"轻"。与 traySlotLabel / traySlotLabelBase 是一套（深字压浅底），改一支要连那两支一起看。
   * 取不透明：格子底下的随机花纹会直接啃掉图标与中文名的可读性。
   */
  traySlot: new Color(242, 249, 240, 255),
  /** 格子上的小料名（深暖灰）：压在 traySlot 那层近白底上约 8.5:1，替掉原来"白字压深板"的那一对 */
  traySlotLabel: new Color(84, 70, 56, 255),
  /**
   * 格子上的汤底名（深暖棕）：比小料名重一档，保住"汤底与小料一眼分得开"这条既有意图——
   * 换色前靠暖金与白来分（见 textAccent），而暖金直接压在奶白底上会糊没。
   */
  traySlotLabelBase: new Color(150, 84, 32, 255),
  /** 倒计时进度条：底槽（半透明）与剩余时间填充 */
  barTrack: new Color(255, 255, 255, 30),
  barFill: new Color(255, 206, 130, 255),
  /** 拖动悬停时碗区的高亮：淡琥珀填充 + 亮琥珀描边，提示"松手就进碗" */
  bowlHighlightFill: new Color(255, 206, 130, 70),
  bowlHighlightBorder: new Color(255, 206, 130, 230),
  /**
   * 开始页与结算页的整屏压暗层：原意是压暗背景、让文字读得清。
   * 当前 alpha 0 = 关闭——质感升级后不再整屏压暗，改由各元素自带底衬托住自己（如开摊按钮自带木牌底图），背景美术能透出来。
   * 想恢复全局压暗就把 alpha 调回 175 左右（同时盖住开始页与结算页）。
   */
  backgroundDim: new Color(0, 0, 0, 0),
  /** 准备过场的整屏底：与面板同色系，但**完全不透明**——过场期间底下的按钮必须"看不见、也点不到" */
  transitionBackdrop: new Color(24, 32, 46, 255),
  /** 开始页开摊按钮的占位底图：木色圆角面板，取色自交付底图的木纹中间调；真底图到位后由 StartView 收起 */
  startButtonPlaceholder: new Color(183, 100, 40, 255),
  /** 错放红闪：只红在屏幕边缘（中间留空），不挡中央信息。实际亮度由 UIOpacity 控制淡出 */
  misdropFlash: new Color(255, 70, 70, 220),
  /** 错放飘字：高饱和正红，比原来的浅粉更跳眼，凑近也能一眼看见 */
  misdropText: new Color(255, 60, 60, 255),
  /** 错放飘字描边：深红近黑，压在任何背景上都把上面的红字托出来（不用 textOutline：红字配棕边会发浑） */
  misdropOutline: new Color(40, 0, 0, 255),
  /** 出餐得分飘字：暖金色，与"这是好事"对应 */
  scoreFloat: new Color(255, 236, 160, 255),
  /** 得分飘字描边：深棕近黑（与暖金同色系，同上不用 textOutline） */
  scoreFloatOutline: new Color(52, 30, 0, 255),
  /** 连击喊话"够劲！"：亮橙，要在任意背景上跳出来 */
  comboShout: new Color(255, 150, 60, 255),
  /** 连击喊话描边：深红近黑（与亮橙同色系，同上不用 textOutline） */
  comboShoutOutline: new Color(70, 16, 0, 255),
  /** 首局引导文字：暖白正文，描边用通用的 textOutline（压在碗区与配料盘之间的背景图上） */
  guideText: new Color(255, 246, 222, 255),
  /** 订单卡上"已放入碗中"的打勾：亮绿；图标本体同时压暗，只留勾是亮的 */
  orderCheck: new Color(126, 226, 138, 255),
  /** 打勾的描边：深绿近黑（与亮绿同色系，同上不用 textOutline） */
  orderCheckOutline: new Color(10, 44, 20, 255),
  /** 倒计时告警（最后 10 秒）：数字与进度条一起转红，数字脉冲 */
  countdownWarning: new Color(255, 74, 74, 255),
  /**
   * 倒计时告警态的描边：近黑的红，告警时与正文一起换上。
   * 告警红是中明度，配 textOutline 那支深暖棕只有约 3.8:1；换这支约 5.9:1——
   * 红字配近黑边已接近这套配色的上限（再想高就得把红提亮，那就不像告警了）。
   * 只影响告警态那一行数字。
   */
  countdownWarningOutline: new Color(30, 4, 4, 255),
} as const;

/**
 * 描边宽度：字号 × 0.09（四舍五入，下限 2）。
 * 34 号字下算出来正好是开始页"最高分"用的 3，与那一屏的观感对齐；
 * 随字号等比缩放，小字才不会被描边糊住（固定 3 压在 24 号字上，笔画会明显发胖）。
 */
function outlineWidthFor(fontSize: number): number {
  return Math.max(2, Math.round(fontSize * 0.09));
}

/**
 * 文字节点的默认宽度（设计像素）：设计宽 720 留出左右各 30 的余量。
 * `createOutlinedText` 与 `createLabel` 共用这一个默认值——"窄屏留边"这件事只有这一处来源，改这里两处一起变。
 */
const TEXT_WIDTH = 660;

/**
 * 当前屏幕能看见的设计宽度。
 *
 * FitHeight 下，比 9:16 更窄的屏幕（现代全面屏手机、拖窄的桌面窗口）只看得见比 720 更窄的一条，
 * 横向排版都得按它收窄——配料盘的列距、准备过场那行字与进度条都用这个数，
 * 别各自再写一遍 `Math.min(SCREEN_WIDTH, view.getVisibleSize().width)`。
 * 可见宽度不小于设计宽度时返回设计宽度，宽屏因此完全不受影响。
 */
export function visibleWidth(): number {
  return Math.min(SCREEN_WIDTH, view.getVisibleSize().width);
}

/** 建一个 UI 节点（自动挂 UITransform、设尺寸与层级） */
export function createUiNode(parent: Node, name: string, width: number, height: number, y = 0, x = 0): Node {
  const node = new Node(name);
  node.layer = Layers.Enum.UI_2D;
  parent.addChild(node);
  const transform = node.addComponent(UITransform);
  transform.setContentSize(width, height);
  transform.setAnchorPoint(0.5, 0.5);
  node.setPosition(x, y, 0);
  return node;
}

/**
 * 按文件名加载一张界面图片，是仓库里唯一一处"按文件名取图"的实现。
 *
 * 界面图片都放在 `assets/resources/` 下，以 `<目录>/<文件名>` 定位（路径拼法在这里收口：
 * `${path}/spriteFrame`）；换图只要同名覆盖文件，不用改代码、也不用回编辑器接线。
 * 背景图、配料图标与新加的界面美术都走它，免得各写一份、各自漂移。
 *
 * 加载失败时回调 `frame` 为 null（并原样带回 `error`），由调用方决定兜底：
 * 背景层保留旧图、配料图标跳过这一格。Cocos 按 uuid 缓存已加载资源，重复调用不会重复读盘。
 */
export function loadSpriteFrame(path: string, onLoad: (frame: SpriteFrame | null, error: Error | null) => void): void {
  resources.load(`${path}/spriteFrame`, SpriteFrame, (error, frame) => {
    onLoad(frame ?? null, error ?? null);
  });
}

/**
 * 一次预载任务：调用方拿到 `done`，加载**有结果**（成功或失败）时调它一次。
 *
 * 谁拥有资源谁提供任务——背景层给出"预载本局背景"、配料盘给出"预载 12 格图标"，
 * 加载路径因此各自留在自己那层，过场只数"已决几项"、不区分成败：
 * 缺图各有各的既有兜底（背景保留旧图、图标跳过这一格），不在这层再判一次。
 */
export type PreloadTask = (done: () => void) => void;

/** 在节点上画一块纯色面板，可带描边；重复调用会重画（换色、改尺寸都用它） */
export function paintPanel(node: Node, fill: Color, border?: Color): Graphics {
  return drawPanel(node, fill, 0, border);
}

/**
 * 在节点上画一块圆角面板：圆角半径可配、可带描边，与纯色面板共用同一块画板。
 * 尺寸同样取节点自身的 UITransform，重复调用会重画；半径传 0 就退化成纯色面板。
 */
export function paintRoundPanel(node: Node, fill: Color, radius: number, border?: Color): Graphics {
  return drawPanel(node, fill, radius, border);
}

/** 两种面板的共同实现：`radius` 为 0 画直角矩形，否则四角改圆 */
function drawPanel(node: Node, fill: Color, radius: number, border?: Color): Graphics {
  const transform = node.getComponent(UITransform);
  const width = transform ? transform.width : 0;
  const height = transform ? transform.height : 0;
  const graphics = node.getComponent(Graphics) ?? node.addComponent(Graphics);
  const left = -width / 2;
  const bottom = -height / 2;
  // 圆角与直角走两条路径：半径 0 时保持原来的 rect 绘制，外观与用法都不变
  const path = (): void => {
    if (radius > 0) graphics.roundRect(left, bottom, width, height, radius);
    else graphics.rect(left, bottom, width, height);
  };

  graphics.clear();
  graphics.fillColor = fill;
  path();
  graphics.fill();
  if (border) {
    graphics.lineWidth = 2;
    graphics.strokeColor = border;
    path();
    graphics.stroke();
  }
  return graphics;
}

/**
 * 改某个子节点上的标签文字（场景里摆好的骨架标签用这个写）。
 * 子节点或标签不存在时静默跳过——场景没接好也不该让玩法报错。
 */
export function setLabelText(parent: Node, nodeName: string, text: string): void {
  const label = parent.getChildByName(nodeName)?.getComponent(Label);
  if (label) label.string = text;
}

/**
 * 描边文字的句柄：把这个标签和它的描边设置收成一个对象，调用方不必自己去取 Label 组件。
 *
 * 文字要随状态变时才用得上它（倒计时读秒、统计行、已放进度）；用完即焚的浮字只取 `node` 摆位置、跑补间。
 */
export interface OutlinedText {
  /** 文字节点：位置、缩放、淡出等整体动作都作用在它上面 */
  readonly node: Node;
  setText(text: string): void;
  /** 只换正文颜色。描边是"把字从背景上抠出来"的那一层，默认不跟着正文换 */
  setTextColor(color: Color): void;
  /** 换描边颜色：正文整支换色系时才用（如倒计时告警，红字要同时配上近黑的红边） */
  setOutlineColor(color: Color): void;
}

/**
 * 建一段带描边的文字，返回它的句柄。
 *
 * 描边走引擎自带的**字形描边**（3.8.2 起 Label 直接支持，不必再挂 LabelOutline），
 * 而不是"再叠一层偏移文字"——叠两层会被看成两行字重在一起（发虚、易晕），
 * 字形描边是沿轮廓外扩，读起来仍是一个字。开始页的"最高分"就是这一套，单局页沿用同一支描边色。
 *
 * 单局页的文字压在每局随机抽出的美术图上、自己没有底板，可读性全交给这层描边。
 * 节点初始落在 (0, 0)，摆哪儿交给调用方（浮字按锚点算，静态文字给固定 y）。
 */
export function createOutlinedText(
  parent: Node,
  name: string,
  text: string,
  fontSize: number,
  color: Color,
  outlineColor: Color,
  width = TEXT_WIDTH,
): OutlinedText {
  const label = createLabel(parent, name, text, 0, fontSize, color, width);
  // 淡入淡出要就地取这个组件（见 ui/GuideHint.ts），所以建的时候就挂上，不留给调用方自己加
  label.node.addComponent(UIOpacity);
  label.enableOutline = true;
  label.outlineColor = outlineColor;
  label.outlineWidth = outlineWidthFor(fontSize);
  return {
    node: label.node,
    setText: (value) => {
      label.string = value;
    },
    setTextColor: (value) => {
      label.color = value;
    },
    setOutlineColor: (value) => {
      label.outlineColor = value;
    },
  };
}

/**
 * 世界坐标 → 某节点的局部坐标。
 * 反馈层拿到的锚点（碗心、松手点、配料盘）都是世界系，统一在这里换算，免得各自写一遍。
 */
export function toLocalPoint(node: Node, x: number, y: number): Vec3 {
  const transform = node.getComponent(UITransform);
  return transform ? transform.convertToNodeSpaceAR(new Vec3(x, y, 0)) : new Vec3(x, y, 0);
}

/**
 * 飘字收尾：可选上飘 + 淡出，动画结束后自己销毁节点。用完即焚的反馈（错放"-3 秒"、
 * 出餐得分、连击喊话）都走这一套，不要各自再写一遍补间。
 * `rise` 为 0 就是原地淡出；`delay` 用来让弹入之类的动作先走完。
 */
export function floatAway(node: Node, options: { duration: number; rise?: number; delay?: number }): void {
  const { duration, rise = 0, delay = 0 } = options;
  const opacity = node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
  opacity.opacity = 255;

  if (rise !== 0) {
    tween(node)
      .to(duration, { position: new Vec3(node.position.x, node.position.y + rise, 0) }, { easing: 'quadOut' })
      .start();
  }
  // 位移与淡出时长一致，节点的销毁只交给淡出这条——两条补间都调 destroy 会重复销毁报错
  tween(opacity)
    .delay(delay)
    .to(duration, { opacity: 0 }, { easing: 'quadIn' })
    .call(() => node.destroy())
    .start();
}

/** 建一个居中文本节点 */
export function createLabel(
  parent: Node,
  name: string,
  text: string,
  y: number,
  fontSize: number,
  color: Color = UI_COLOR.textPrimary,
  width = TEXT_WIDTH,
  x = 0,
): Label {
  const node = createUiNode(parent, name, width, fontSize * 1.6, y, x);
  const label = node.addComponent(Label);
  label.string = text;
  label.fontSize = fontSize;
  label.lineHeight = Math.round(fontSize * 1.25);
  label.horizontalAlign = Label.HorizontalAlign.CENTER;
  label.verticalAlign = Label.VerticalAlign.CENTER;
  label.color = color;
  return label;
}
