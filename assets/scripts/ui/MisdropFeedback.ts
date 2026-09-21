import { _decorator, Component, Graphics, Label, Node, UIOpacity, Vec3, tween } from 'cc';
import { SCREEN_HEIGHT, SCREEN_WIDTH } from '../config/layout';
import { ingredientName } from '../config/ingredients';
import { STRINGS } from '../config/strings';
import type { MisdropPayload } from '../game/bus';
import { BusEvent, bus } from '../game/bus';
import { createLabel, createOutlinedText, createUiNode, floatAway, paintPanel, toLocalPoint, UI_COLOR } from './uiFactory';

const { ccclass } = _decorator;

/** 红闪边框厚度（设计像素）：只红在屏幕边缘，中间留空不挡信息 */
const FLASH_THICKNESS = 36;
/** 红闪淡出时长（秒） */
const FLASH_DURATION = 0.32;
/** 飘字上飘距离（设计像素）：贴近顶部，飘太高会探出屏幕，给个小位移即可 */
const FLOAT_RISE = 24;
/** 飘字存活时长（秒） */
const FLOAT_DURATION = 0.6;
/** 弹回动画时长（秒）：比飘字短，先一步归位，呼应"立刻弹回" */
const BOUNCE_DURATION = 0.32;
/** 弹回幽灵尺寸：比配料盘格子小一号，和拖拽幽灵同款，一眼认出是"手里那份配料" */
const BOUNCE_GHOST_WIDTH = 120;
const BOUNCE_GHOST_HEIGHT = 64;
/** 飘字相对"倒计时"标签的水平偏移（设计像素）：落在其右侧，明确"扣在倒计时上" */
const COUNTDOWN_FLOAT_OFFSET_X = 220;
/** 飘字字号：比倒计时本体大一圈，凑近也能一眼看见 */
const COUNTDOWN_FLOAT_FONT = 48;

/**
 * 错放反馈：核心判定为错放后，这里负责三件事——配料弹回配料盘、屏幕边缘红闪、飘出 "-3 秒"。
 *
 * 这三种反馈都只做表现、不碰任何规则：吃的是适配层广播的 `Misdrop`（带落点世界坐标），
 * 落点世界坐标由 GameSession 给出（拖动取松手点、点按取碗中心）。用完即焚——每次错放新建节点，
 * 动画结束后自己销毁，组件本身不持有任何状态。
 *
 * "-3 秒" 锚在顶部"倒计时"标签旁边（而不是落点），让玩家立刻把"被扣时"和倒计时对应起来；
 * 重复放入走的是核心的 `rejected` 事件，不经过这里，所以天然"无任何视觉变化"。
 */
@ccclass('MisdropFeedback')
export class MisdropFeedback extends Component {
  /** 配料盘节点：弹回动画的终点就是它；onLoad 时缓存一次 */
  private trayNode: Node | null = null;

  protected onLoad(): void {
    this.trayNode = this.node.getChildByName('TrayArea');
    bus.on(BusEvent.Misdrop, this.onMisdrop, this);
  }

  protected onDestroy(): void {
    bus.off(BusEvent.Misdrop, this.onMisdrop, this);
  }

  private onMisdrop(payload: MisdropPayload): void {
    this.flashEdges();
    this.floatPenalty();
    this.bounceBack(payload);
  }

  /** 屏幕边缘红闪：四条红边围成框，中间留空，不遮中央倒计时与订单卡 */
  private flashEdges(): void {
    const node = createUiNode(this.node, 'MisdropFlash', SCREEN_WIDTH, SCREEN_HEIGHT);
    const opacity = node.addComponent(UIOpacity);

    const g = node.addComponent(Graphics);
    g.fillColor = UI_COLOR.misdropFlash;
    const w = SCREEN_WIDTH;
    const h = SCREEN_HEIGHT;
    const t = FLASH_THICKNESS;
    g.rect(-w / 2, h / 2 - t, w, t); // 上边
    g.rect(-w / 2, -h / 2, w, t); // 下边
    g.rect(-w / 2, -h / 2, t, h); // 左边
    g.rect(w / 2 - t, -h / 2, t, h); // 右边
    g.fill();

    // 起手最亮，再快速淡出；UIOpacity 归零后节点自己销毁
    opacity.opacity = 255;
    tween(opacity)
      .to(FLASH_DURATION, { opacity: 0 }, { easing: 'quadOut' })
      .call(() => node.destroy())
      .start();
  }

  /** 飘字：在顶部"倒计时"标签右侧冒出 "-3 秒"，上飘同时淡出；暗色垫底保证在任意背景下都跳出来 */
  private floatPenalty(): void {
    const countdown = findNodeByName(this.node, 'CountdownLabel');
    const baseWorld = countdown ? countdown.worldPosition : new Vec3(0, 604, 0);
    const local = toLocalPoint(this.node, baseWorld.x + COUNTDOWN_FLOAT_OFFSET_X, baseWorld.y);

    const float = createOutlinedText(
      this.node,
      'MisdropFloat',
      STRINGS.misdropText,
      COUNTDOWN_FLOAT_FONT,
      UI_COLOR.misdropText,
      UI_COLOR.misdropShadow,
      240,
    );
    float.setPosition(local.x, local.y, 0);
    floatAway(float, { duration: FLOAT_DURATION, rise: FLOAT_RISE });
  }

  /** 弹回：在落点生成一份配料幽灵，飞回配料盘，呼应"配料弹回配料盘" */
  private bounceBack(payload: MisdropPayload): void {
    const start = toLocalPoint(this.node, payload.x, payload.y);
    const ghost = createUiNode(this.node, 'MisdropBounce', BOUNCE_GHOST_WIDTH, BOUNCE_GHOST_HEIGHT);
    paintPanel(ghost, UI_COLOR.panel, UI_COLOR.misdropText);
    createLabel(ghost, 'Name', ingredientName(payload.ingredientId), 0, 26, UI_COLOR.textPrimary, BOUNCE_GHOST_WIDTH - 12);
    ghost.setPosition(start.x, start.y, 0);

    // 终点取配料盘世界坐标（找不到就退回落点正下方），转回本节点局部坐标再补间
    const trayWorld = this.trayNode ? this.trayNode.worldPosition : new Vec3(payload.x, payload.y - 320, 0);
    const target = toLocalPoint(this.node, trayWorld.x, trayWorld.y);
    tween(ghost)
      .to(BOUNCE_DURATION, { position: new Vec3(target.x, target.y, 0) }, { easing: 'quadIn' })
      .call(() => ghost.destroy())
      .start();
  }
}

/** 递归按名字找节点：视图节点都是运行时建的，跨层级只能按名字找 */
function findNodeByName(root: Node | null, name: string): Node | null {
  if (!root) return null;
  if (root.name === name) return root;
  for (const child of root.children) {
    const hit = findNodeByName(child, name);
    if (hit) return hit;
  }
  return null;
}
