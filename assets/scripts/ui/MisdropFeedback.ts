import { _decorator, Graphics, Node, UIOpacity, Vec3, tween } from 'cc';
import { COUNTDOWN_Y, SCREEN_HEIGHT, SCREEN_WIDTH } from '../config/layout';
import { STRINGS } from '../config/strings';
import type { MisdropPayload } from '../game/bus';
import { BusEvent } from '../game/bus';
import { BusComponent } from '../game/busComponent';
import { createIngredientGhost } from './ingredientGhost';
import { showMisdropPopup } from './misdropPopup';
import { createOutlinedText, createUiNode, floatAway, toLocalPoint, UI_COLOR } from './uiFactory';

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
/** 飘字相对"倒计时"标签的水平偏移（设计像素）：落在其右侧，明确"扣在倒计时上" */
const COUNTDOWN_FLOAT_OFFSET_X = 220;
/** 飘字字号：比倒计时本体大一圈，凑近也能一眼看见 */
const COUNTDOWN_FLOAT_FONT = 48;

/**
 * 错放反馈：核心判定为错放后，这里负责四件事——配料弹回配料盘、屏幕边缘红闪、
 * 顶部飘出 "-3 秒"、屏幕中央弹出 "-3 秒"图片弹窗（见 ui/misdropPopup.ts）。
 *
 * 这些反馈都只做表现、不碰任何规则：吃的是适配层广播的 `Misdrop`（带落点世界坐标），
 * 落点世界坐标由 GameSession 给出（拖动取松手点、点按取碗中心）。用完即焚——每次错放新建节点，
 * 动画结束后自己销毁，组件本身不持有任何状态。
 *
 * "-3 秒" 有两处、内容相同、同时出现，这是有意的分工：飘字锚在顶部"倒计时"标签旁边（而不是落点），
 * 让玩家立刻把"被扣时"和倒计时对应起来；中央那张图管"一眼看见"（错放专用的美术件，抖动 + 残影）。
 * 两处都只挂显示组件、不拦触摸，所以不会挡住碗与配料盘的后续操作。
 *
 * 重复放入走的是核心的 `rejected` 事件，不经过这里，所以天然"无任何视觉变化"。
 */
@ccclass('MisdropFeedback')
export class MisdropFeedback extends BusComponent {
  /** 配料盘节点：弹回动画的终点就是它；onViewLoad 时缓存一次 */
  private trayNode: Node | null = null;

  protected onViewLoad(): void {
    this.trayNode = this.node.getChildByName('TrayArea');
    this.listen(BusEvent.Misdrop, this.onMisdrop);
  }

  private onMisdrop(payload: MisdropPayload): void {
    this.flashEdges();
    this.floatPenalty();
    this.bounceBack(payload);
    // 弹窗建在最后：节点追加在末尾 = 画在最上层，才不会被同帧新建的弹回幽灵压在下面
    showMisdropPopup(this.node);
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

  /** 飘字：在顶部"倒计时"标签右侧冒出 "-3 秒"，上飘同时淡出；深色描边保证在任意背景下都跳出来 */
  private floatPenalty(): void {
    // 位置直接用版面常量，**不去顶栏的节点树里找那个标签**：倒计时标签与本组件建的飘字都挂在游戏页上
    // （HudView 与 MisdropFeedback 都是游戏页的组件），局部坐标同系，所以"标签右侧偏移 220"
    // 在我们自己的局部坐标里就是 (220, COUNTDOWN_Y)。常量与 HudView 共用同一份，见 config/layout.ts。
    const float = createOutlinedText(
      this.node,
      'MisdropFloat',
      STRINGS.misdropText,
      COUNTDOWN_FLOAT_FONT,
      UI_COLOR.misdropText,
      UI_COLOR.misdropOutline,
      240,
    ).node;
    float.setPosition(COUNTDOWN_FLOAT_OFFSET_X, COUNTDOWN_Y, 0);
    floatAway(float, { duration: FLOAT_DURATION, rise: FLOAT_RISE });
  }

  /**
   * 弹回：在落点生成一份配料幽灵，飞回配料盘，呼应"配料弹回配料盘"。
   * 幽灵的样子（面板 / 图标 / 名称 / 尺寸）与跟手幽灵共用 ui/ingredientGhost.ts 一处实现，
   * 只有描边色不同：这里用错放红说明"这一份放错了"。
   */
  private bounceBack(payload: MisdropPayload): void {
    const start = toLocalPoint(this.node, payload.x, payload.y);
    const ghost = createIngredientGhost(this.node, {
      ingredientId: payload.ingredientId,
      name: 'MisdropBounce',
      border: UI_COLOR.misdropText,
      at: { x: start.x, y: start.y },
    });

    // 终点取配料盘世界坐标（找不到就退回落点正下方），转回本节点局部坐标再补间
    const trayWorld = this.trayNode ? this.trayNode.worldPosition : new Vec3(payload.x, payload.y - 320, 0);
    const target = toLocalPoint(this.node, trayWorld.x, trayWorld.y);
    tween(ghost)
      .to(BOUNCE_DURATION, { position: new Vec3(target.x, target.y, 0) }, { easing: 'quadIn' })
      .call(() => ghost.destroy())
      .start();
  }
}
