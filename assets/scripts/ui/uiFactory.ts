import { Color, Graphics, Label, Layers, Node, UITransform } from 'cc';

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
} as const;

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

/** 在节点上画一块纯色面板，可带描边 */
export function paintPanel(node: Node, fill: Color, border?: Color): Graphics {
  const transform = node.getComponent(UITransform);
  const width = transform ? transform.width : 0;
  const height = transform ? transform.height : 0;
  const graphics = node.getComponent(Graphics) ?? node.addComponent(Graphics);
  graphics.fillColor = fill;
  graphics.rect(-width / 2, -height / 2, width, height);
  graphics.fill();
  if (border) {
    graphics.lineWidth = 2;
    graphics.strokeColor = border;
    graphics.rect(-width / 2, -height / 2, width, height);
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
