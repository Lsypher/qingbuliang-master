import { Color, Graphics, Label, Layers, Node, SpriteFrame, UIOpacity, UITransform, Vec3, resources, tween, view } from 'cc';
import { SCREEN_WIDTH } from '../config/layout';

/** 界面统一用色：改主题只改这里（08/09 切片会换成素材配色） */
export const UI_COLOR = {
  textPrimary: new Color(255, 255, 255, 255),
  textMuted: new Color(178, 190, 208, 255),
  textAccent: new Color(255, 226, 168, 255),
  panel: new Color(24, 32, 46, 235),
  panelBorder: new Color(120, 140, 170, 180),
  /** 倒计时进度条：底槽（半透明）与剩余时间填充 */
  barTrack: new Color(255, 255, 255, 30),
  barFill: new Color(255, 206, 130, 255),
  /** 拖动悬停时碗区的高亮：淡琥珀填充 + 亮琥珀描边，提示"松手就进碗" */
  bowlHighlightFill: new Color(255, 206, 130, 70),
  bowlHighlightBorder: new Color(255, 206, 130, 230),
  /** 背景压暗层：开始页与结算页盖在背景图上，让文字读起来不费劲 */
  backgroundDim: new Color(0, 0, 0, 175),
  /** 开始页副标题的圆角底框：45% 不透明的黑（α = 255 × 0.45 ≈ 115），垫在文字下面，压在花哨背景上也读得清 */
  subtitleBackdrop: new Color(0, 0, 0, 115),
  /** 开始页开摊按钮的占位底图：木色圆角面板，取色自交付底图的木纹中间调；真底图到位后由 StartView 收起 */
  startButtonPlaceholder: new Color(183, 100, 40, 255),
  /** 错放红闪：只红在屏幕边缘（中间留空），不挡中央信息。实际亮度由 UIOpacity 控制淡出 */
  misdropFlash: new Color(255, 70, 70, 220),
  /** 错放飘字：高饱和正红，比原来的浅粉更跳眼，凑近也能一眼看见 */
  misdropText: new Color(255, 60, 60, 255),
  /** 错放飘字垫底描边：深红近黑，压在任何背景上都把上面的红字托出来 */
  misdropShadow: new Color(40, 0, 0, 255),
  /** 出餐得分飘字：暖金色，与"这是好事"对应 */
  scoreFloat: new Color(255, 236, 160, 255),
  /** 得分飘字垫底描边：深棕近黑 */
  scoreFloatShadow: new Color(52, 30, 0, 255),
  /** 连击喊话"够劲！"：亮橙，要在任意背景上跳出来 */
  comboShout: new Color(255, 150, 60, 255),
  /** 连击喊话垫底描边：深红近黑 */
  comboShoutShadow: new Color(70, 16, 0, 255),
  /** 首局引导文字：暖白正文 + 深色垫底，浮在碗区面板上也读得清 */
  guideText: new Color(255, 246, 222, 255),
  guideShadow: new Color(28, 34, 44, 255),
  /** 订单卡上"已放入碗中"的打勾：亮绿；图标本体同时压暗，只留勾是亮的 */
  orderCheck: new Color(126, 226, 138, 255),
  orderCheckShadow: new Color(10, 44, 20, 255),
  /** 倒计时告警（最后 10 秒）：数字与进度条一起转红，数字脉冲 */
  countdownWarning: new Color(255, 74, 74, 255),
} as const;

/** 描边文字的垫底偏移（设计像素）：暗色垫底略往右下挪，亮色正文盖在上面 */
const OUTLINE_OFFSET = 3;

/**
 * 当前屏幕能看见的设计宽度。
 *
 * FitHeight 下，比 9:16 更窄的屏幕（现代全面屏手机、拖窄的桌面窗口）只看得见比 720 更窄的一条，
 * 横向排版都得按它收窄——配料盘分列、开始页那行长文案都用这个数，
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
 * 建一段"带深色垫底"的文字，返回承载它的容器节点（盒内是垫底与正文两层标签）。
 *
 * 引擎没有现成的文字描边 API，用"暗色垫底略偏移 + 亮色正文盖上去"实现，在任意背景上都读得清。
 * 缩放 / 位移 / 淡出都作用在容器上——两层一起动，不会散架。
 */
export function createOutlinedText(
  parent: Node,
  name: string,
  text: string,
  fontSize: number,
  color: Color,
  outlineColor: Color,
  width = 660,
): Node {
  const box = createUiNode(parent, name, width, fontSize * 1.6);
  box.addComponent(UIOpacity);
  createLabel(box, `${name}Outline`, text, -OUTLINE_OFFSET, fontSize, outlineColor, width, OUTLINE_OFFSET);
  createLabel(box, `${name}Text`, text, 0, fontSize, color, width);
  return box;
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
  width = 660,
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
