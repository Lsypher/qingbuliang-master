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
   * 正文白。只用在自带深色底板的地方：准备过场的文案（压在 transitionBackdrop 那块深底上），
   * 另外 `createLabel` 不传色时默认取它。格子的名字（traySlotLabel / traySlotLabelBase）与
   * 幽灵的名字（traySlotLabel）都不用它——那几处的底都是近白的。
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
   * 强调色（暖金）：只给"必须第一眼看到"的东西——单局页倒计时数字，
   * 以及开始页"最高分"、结算页的本局分数 / 最高分（后面这几处烤在场景里，见本表头）。
   * 结算页标题**不再用它**：改成白字压木牌底板，见 resultTitleOutline。
   * 与倒计时进度条的填充同族（见 barFill），改色要连那一处一起看。
   *
   * **暖金只能压在深色上**——压在近白底（traySlot）上会糊没，这条约束的权威说明就是本段；
   * 已有两处为它让路：配料盘的汤底标签与配料幽灵的跟手描边都换成了 traySlotLabelBase。
   * 想再把暖金用到浅底上，先量对比度。
   */
  textAccent: new Color(255, 226, 168, 255),
  /**
   * 压在背景图上的静态文字的描边色（深暖棕）：单局页的静态文字（由 `createOutlinedText` 现建），
   * 与开始页"最高分"、开摊按钮、结算页除标题与重启按钮外的 5 处文字同一支（后三处烤在场景里，见本表头）。
   * 描边只负责把字从任意背景上"抠"出来，不参与信息层级——层级交给正文色的明度与字号。
   * 反馈飘字与订单勾不共用它：它们各有与自身正文同色系的深色描边（见下面几支 *Outline）。
   */
  textOutline: new Color(74, 44, 20, 255),
  /**
   * 结算页标题"食饱未？"的描边色（暖近黑）：这行字是**白字压在木牌底板**上
   * （`art/ui/result-title-board.png`，见 docs/adr/0013-result-title-board.md），
   * 白字配 textOutline 那支深暖棕会在浅黄板面上糊掉，得换一支近乎黑的把字"抠"出来。
   * 不取纯黑：纯黑压暖色木牌会显脏；暖近黑肉眼读到的同样是黑，又不脱出这套配色的色族。
   *
   * **只有结算页标题这一处用它**（烤在场景里，见本表头）——它与这页其余几处（暖金 / 米黄 + 深暖棕边）
   * 的差别正是"白字 + 黑边"，改这支等于改标题的观感，其余几行不受影响。
   */
  resultTitleOutline: new Color(36, 22, 12, 255),
  /**
   * 结算页"再来一碗"按钮的描边色（深绿近黑）：按钮底是**亮绿胶囊**（`art/ui/restart-button.png`），
   * 这行字是白字（与开摊按钮、结算页标题同一条"按钮 / 标题用白字"的规矩，见 docs/adr/0014）。
   * 白字压在亮绿上（约 1.8:1）全靠这圈描边把字形抠出来；描边取**按钮深绿边缘的同族色**，
   * 而不是 textOutline 的深暖棕——暖棕边压在冷绿底上会发浑。
   *
   * **只有结算页这个按钮用它**（烤在场景里，见本表头）：改这支等于改按钮文字的观感。
   */
  restartButtonOutline: new Color(27, 58, 14, 255),
  /**
   * 配料盘格子的底色（带一丝绿调的近白）：G 比 R / B 各高 7~9，所以肉眼读到的仍是白，
   * 只有 12 格成片铺开时才透出淡淡的薄荷绿——与整屏暖橙 / 沙滩的背景形成清爽的对照，
   * 也比原来的奶白（偏黄）更"轻"。与 traySlotLabel / traySlotLabelBase 是一套（深字压浅底），改一支要连那两支一起看。
   * 取不透明：格子底下的随机花纹会直接啃掉图标与中文名的可读性。
   *
   * **配料幽灵的底板也读它**（见 ui/ingredientGhost.ts）：两处共用同一支色值，
   * 是为了"幽灵与配料盘一致"这件事只有一处来源、不会各自漂移。来由见 docs/adr/0012。
   */
  traySlot: new Color(242, 249, 240, 255),
  /**
   * 格子上的小料名（深暖灰）：压在 traySlot 那层近白底上约 8.5:1，替掉原来"白字压深板"的那一对。
   * 配料幽灵的中文名也读它——白字压在同一块近白底上只剩约 1.07:1（见 docs/adr/0012）。
   */
  traySlotLabel: new Color(84, 70, 56, 255),
  /**
   * 格子上的汤底名（深暖棕）：比小料名重一档，保住"汤底与小料一眼分得开"这条既有意图——
   * 换色前靠暖金与白来分，而暖金压不住浅底（约束见 textAccent）。
   *
   * 配料幽灵的**跟手描边**也读它：近白底上可用的深色只有这一支（弹回的错放红另算）。
   */
  traySlotLabelBase: new Color(150, 84, 32, 255),
  /**
   * 单局页顶部的玻璃底板：半透明白，把倒计时、统计行与订单卡标题从每局随机背景图上托起来。
   * 与 glassHighlight / glassBorder 是一套（画法见 `paintGlassPanel`），改一支要连另两支一起看。
   * alpha 取 112 是"压得住花纹、又还看得出底下是张什么图"的折中：再低背景花纹会从字缝里钻出来。
   */
  glassPanel: new Color(255, 255, 255, 112),
  /**
   * 玻璃底板的顶部高光（纵向渐变的峰值色）：叠在 glassPanel 上、由顶边向下淡到全透明，
   * 做出"光从上面来"的受光面。只铺一层半透明底会像蒙了层雾，不像玻璃，这一层才是质感来源。
   * 它是**峰值**：顶边与 glassPanel 叠加后约 0.62 不透明，往下递减到底边只剩 glassPanel 那一层。
   */
  glassHighlight: new Color(255, 255, 255, 85),
  /** 玻璃底板的亮边：接近实白的细边，模拟玻璃边缘的反光，是这层质感里最亮的一笔 */
  glassBorder: new Color(255, 255, 255, 220),
  /** 倒计时进度条：底槽（半透明）与剩余时间填充 */
  barTrack: new Color(255, 255, 255, 30),
  barFill: new Color(255, 206, 130, 255),
  /** 拖动悬停时碗区的高亮：淡琥珀填充 + 亮琥珀描边，提示"松手就进碗" */
  bowlHighlightFill: new Color(255, 206, 130, 70),
  bowlHighlightBorder: new Color(255, 206, 130, 230),
  /**
   * 开始页与结算页的整屏压暗层：原意是压暗背景、让文字读得清。
   * 当前 alpha 0 = 关闭——质感升级后不再整屏压暗，改由各元素自带底衬托住自己
   * （开摊按钮自带木牌底图、单局页顶部自带 glassPanel 那块玻璃底板），背景美术能透出来。
   * 想恢复全局压暗就把 alpha 调回 175 左右（同时盖住开始页与结算页）。
   */
  backgroundDim: new Color(0, 0, 0, 0),
  /** 准备过场的整屏底（深蓝近黑）：**完全不透明**——过场期间底下的按钮必须"看不见、也点不到" */
  transitionBackdrop: new Color(24, 32, 46, 255),
  /**
   * 开始页开摊按钮的占位底图：木色圆角面板，取色自早期木牌底图的木纹中间调
   * （现底图已换成自带文字的胶囊按钮，占位底仍沿用这支色——它只在底图缺失时露一次脸）。
   * 真底图到位后由 StartView 收起。
   */
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

/**
 * 一张按路径缓存的界面图。
 *
 * 「按路径取帧 + 缓存 + 标记已决 + 交出预载任务」这套形状在仓库里有两个用户（`ingredientIcon`
 * 的 12 格图标、`misdropPopup` 的弹窗图），所以收在这里一份：各模块只给出路径，
 * 不再各写一遍缓存与已决标记——两份写法迟早会漂移成两种行为。
 *
 * 三种状态由 `resolved()` 与 `frame()` 组合表示：
 * - 未决：`resolved()` 为 false（还没读过盘）
 * - 已决且成功：`resolved()` 为 true，`frame()` 非空
 * - 已决且失败：`resolved()` 为 true，`frame()` 为 null（缺图，由调用方决定怎么兜底）
 */
export interface SpriteFrameSlot {
  /** 交出预载任务：加载**有结果**（成功或失败）时回调一次 `done`，过场靠它数"已决几项" */
  preload(): PreloadTask;
  /** 帧；未决或加载失败时都是 null，要区分就配 `resolved()` 看 */
  frame(): SpriteFrame | null;
  /** 是否已经问过盘（成功与失败都算），用来识别"加载过但没拿到" */
  resolved(): boolean;
  /** 异步取帧并写进缓存；给"还没预载到"的兜底路径用，回调里拿结果 */
  load(onLoad: (frame: SpriteFrame | null) => void): void;
}

/**
 * 建一个按路径缓存的帧槽。路径拼法仍由 `loadSpriteFrame` 收口，这里只管缓存与已决标记。
 * 加载失败时打一条带路径的告警（各模块的兜底策略不同，所以只告警、不在这里替调用方兜底）。
 */
export function createSpriteFrameSlot(path: string): SpriteFrameSlot {
  let frame: SpriteFrame | null = null;
  let resolved = false;

  const load = (onLoad: (frame: SpriteFrame | null) => void): void => {
    loadSpriteFrame(path, (loaded, error) => {
      // 无论成败都写进槽：成功存帧、失败存 null 以标记"已决"，
      // 下游就能同步识别"加载过但没拿到"，不重复读盘、也不阻塞进局
      frame = loaded;
      resolved = true;
      if (!loaded) console.warn(`[uiFactory] 界面图加载失败：${path}`, error);
      onLoad(loaded);
    });
  };

  return {
    preload: () => (done) => load(() => done()),
    frame: () => (resolved ? frame : null),
    resolved: () => resolved,
    load,
  };
}

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

/**
 * 面板类绘制的公共起点：取节点的画板与几何。
 *
 * 尺寸取节点自身的 UITransform（没挂时按 0 算），坐标系以节点中心为原点，
 * 所以返回的左下角是负的半宽半高。`drawPanel` 与 `paintGlassPanel` 都从这一步开始，别各自再取一遍。
 */
function panelGeometry(node: Node): { graphics: Graphics; width: number; height: number; left: number; bottom: number } {
  const transform = node.getComponent(UITransform);
  const width = transform ? transform.width : 0;
  const height = transform ? transform.height : 0;
  const graphics = node.getComponent(Graphics) ?? node.addComponent(Graphics);
  return { graphics, width, height, left: -width / 2, bottom: -height / 2 };
}

/** 两种面板的共同实现：`radius` 为 0 画直角矩形，否则四角改圆 */
function drawPanel(node: Node, fill: Color, radius: number, border?: Color): Graphics {
  const { graphics, width, height, left, bottom } = panelGeometry(node);
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
 * 玻璃高光的纵向档数：Graphics 只有纯色填充、没有渐变，高光得靠一层层等高条带叠出来。
 * 档数越多、相邻两档的 alpha 差越小，渐变越看不出台阶；48 档摊在顶部底板约 190 设计像素高上、每档约 4 像素，
 * 相邻档差在 2% 不透明度以内，压在这种细节背景上已经看不出分档。顶点数多一点不影响开销（整个底板仍是一次绘制）。
 */
const GLASS_GRADIENT_STEPS = 48;

/**
 * 高光衰减的幂指数：1 是线性，越大越集中在顶边。
 * 1.6 的观感是"上沿一片受光、往下渐渐收干净"；线性的话整块面板会均匀发白，反倒像脏了。
 */
const GLASS_HIGHLIGHT_FALLOFF = 1.6;

/**
 * 玻璃亮边的线宽：比 `drawPanel` 的描边（2）粗一档。
 * 这支边压在低 alpha 的底上，细了会和底糊成一片，看不出反光。
 */
const GLASS_BORDER_WIDTH = 3;

/**
 * 在节点上画一块玻璃面板：半透明底 + 自上而下淡出的高光 + 亮白细边。
 * 尺寸取节点自身的 UITransform（见 `panelGeometry`）；与另外两个 paint* 一样，重复调用会重画。
 *
 * 高光为什么用条带叠：Graphics 没有渐变填充。条带怎么贴着圆角收窄、为什么画成梯形，见循环里的注释。
 * 一叠条带彼此不干扰、不会越描越黑，依据是引擎的 fill 只绘制"上一次 fill 之后新增的路径"
 * （graphics-assembler 里的 `updatePathOffset`；每个绘制命令都以一个 moveTo 起头）。
 */
export function paintGlassPanel(node: Node, fill: Color, highlight: Color, radius: number, border: Color): Graphics {
  const { graphics, width, height, left, bottom } = panelGeometry(node);
  const top = height / 2;
  const right = -left;
  graphics.clear();

  graphics.fillColor = fill;
  graphics.roundRect(left, bottom, width, height, radius);
  graphics.fill();

  // 高光从底边的全透明涨到顶边的最亮，逐条改 alpha；这里先拿一份可改的副本，不碰调用方传进来的配色表
  const tint = new Color(highlight.r, highlight.g, highlight.b, highlight.a);
  const stepHeight = height / GLASS_GRADIENT_STEPS;
  for (let i = 0; i < GLASS_GRADIENT_STEPS; i++) {
    const y = bottom + i * stepHeight;
    // 按条带中点算受光量：0 = 底边（全透），1 = 顶边（最亮）
    const lit = (y + stepHeight / 2 - bottom) / height;
    tint.a = Math.round(highlight.a * Math.pow(lit, GLASS_HIGHLIGHT_FALLOFF));
    // 已经淡到看不见的档直接跳过，省掉顶点
    if (tint.a < 2) continue;
    // 条带画成梯形而不是矩形：上下边各按**自己所在高度**的圆角轮廓收窄，才严丝合缝贴住圆角——
    // 整条取统一内缩（两端取大者）会在圆角处留下一圈锯齿台阶，完全不内缩则从顶角探出方块。
    // 相邻两条共用一条边、端点出自同一个算式，所以既不露缝也不重叠（重叠那一像素会亮成一道横纹）
    const insetTop = cornerInsetAt(y + stepHeight, bottom, top, radius);
    const insetBottom = cornerInsetAt(y, bottom, top, radius);
    graphics.fillColor = tint;
    graphics.moveTo(left + insetBottom, y);
    graphics.lineTo(left + insetTop, y + stepHeight);
    graphics.lineTo(right - insetTop, y + stepHeight);
    graphics.lineTo(right - insetBottom, y);
    graphics.close();
    graphics.fill();
  }

  graphics.lineWidth = GLASS_BORDER_WIDTH;
  graphics.strokeColor = border;
  graphics.roundRect(left, bottom, width, height, radius);
  graphics.stroke();
  return graphics;
}

/**
 * 圆角轮廓在高度 `y` 处的横向内缩量，落在中间直边段上是 0。
 * 圆的方程：距圆心落差 d 处，轮廓比直边窄 `r - √(r² - d²)`。
 *
 * 区间必须取**闭**的：`y` 正好落在顶边 / 底边上时落差等于半径，内缩量正是半径本身，
 * 漏掉这两个端点会让那一条高光带按 0 内缩、从圆角的顶角探出方块（曾经就是这么错的）。
 *
 * 只服务 `paintGlassPanel` 的高光条带，别处的矩形/圆角绘制不需要它。
 */
function cornerInsetAt(y: number, bottom: number, top: number, radius: number): number {
  if (radius <= 0) return 0;

  const fromBottom = bottom + radius - y;
  if (fromBottom >= 0 && fromBottom <= radius) return radius - Math.sqrt(radius * radius - fromBottom * fromBottom);

  const fromTop = y - (top - radius);
  if (fromTop >= 0 && fromTop <= radius) return radius - Math.sqrt(radius * radius - fromTop * fromTop);

  return 0;
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
 * 单局页的文字大多压在每局随机抽出的美术图上、自己没有底板，可读性主要交给这层描边；
 * 顶部那几条另有玻璃底板垫着（见 `ui/HudView.ts` 的顶部底板），描边在那里的作用是压住底板自身的亮度。
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
