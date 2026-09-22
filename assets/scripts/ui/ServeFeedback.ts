import { _decorator, Node, Vec3, tween } from 'cc';
import { COMBO_SHOUT_AT } from '../config/balance';
import { STRINGS } from '../config/strings';
import type { RenderPayload } from '../game/bus';
import { BusComponent } from '../game/busComponent';
import { createOutlinedText, floatAway, toLocalPoint, UI_COLOR } from './uiFactory';

const { ccclass } = _decorator;

/** 得分飘字：字号、上飘距离（设计像素）与存活时长（秒） */
const SCORE_FLOAT_FONT = 56;
/** 上飘距离：够看出"飘出来"，又不至于钻进上面那句"够劲！"的字里 */
const SCORE_FLOAT_RISE = 40;
const SCORE_FLOAT_DURATION = 0.7;
/** 得分飘字相对碗中心的纵向偏移：落在碗口上方，不压住碗里刚放好的图标 */
const SCORE_FLOAT_OFFSET_Y = 120;

/**
 * 连击喊话：字号更大、带弹入。位置比得分飘字"上飘的终点"再高一档——
 * 两个反馈常常同一单里一起出现，字面不能叠在一起。
 */
const SHOUT_FONT = 68;
const SHOUT_OFFSET_Y = 250;
/** 弹入：从这么小弹起来 */
const SHOUT_START_SCALE = 0.4;
const SHOUT_POP_IN = 0.18;
/** 弹到位后停留（秒），再淡出 */
const SHOUT_HOLD = 0.42;
const SHOUT_FADE = 0.3;

/**
 * 出餐反馈：出餐瞬间在碗口上方飘出本单得分；连到门槛以上再冒一句"够劲！"。
 *
 * 只做表现、不碰规则：得分数值直接取核心 `served` 事件里的 `orderScore`（本单得分，
 * 含连击加分），连击门槛也只读核心给的 `comboCount` 与配置常量——视图不自己算分。
 * 节点用完即焚：每次出餐新建，动画结束自己销毁，组件本身不持有任何状态。
 */
@ccclass('ServeFeedback')
export class ServeFeedback extends BusComponent {
  /** 碗区节点：反馈都锚在它中心，版面怎么挪都不用改这里的坐标 */
  private bowlNode: Node | null = null;

  protected onViewLoad(): void {
    this.bowlNode = this.node.getChildByName('BowlArea');
  }

  protected onRendered(payload: RenderPayload): void {
    // 每帧广播里的 events 都是"本次新产生的"，出餐事件一条也不会漏（同帧两次出餐也各给一次反馈）
    for (const event of payload.events) {
      if (event.type !== 'served') continue;
      this.showScore(event.orderScore);
      if (event.comboCount >= COMBO_SHOUT_AT) this.showShout();
    }
  }

  /** 得分飘字：在碗口上方冒出本单得分，上飘同时淡出 */
  private showScore(orderScore: number): void {
    const at = this.anchor(SCORE_FLOAT_OFFSET_Y);
    const float = createOutlinedText(
      this.node,
      'ScoreFloat',
      `${STRINGS.scoreFloatPrefix}${orderScore}`,
      SCORE_FLOAT_FONT,
      UI_COLOR.scoreFloat,
      UI_COLOR.scoreFloatOutline,
    ).node;

    float.setPosition(at.x, at.y, 0);
    floatAway(float, { duration: SCORE_FLOAT_DURATION, rise: SCORE_FLOAT_RISE });
  }

  /** 连击喊话：从小弹到略超再收回，停一下再淡出——"够劲！"要有一下子的劲儿 */
  private showShout(): void {
    const at = this.anchor(SHOUT_OFFSET_Y);
    const shout = createOutlinedText(
      this.node,
      'ComboShout',
      STRINGS.comboShout,
      SHOUT_FONT,
      UI_COLOR.comboShout,
      UI_COLOR.comboShoutOutline,
    ).node;

    shout.setPosition(at.x, at.y, 0);
    shout.setScale(SHOUT_START_SCALE, SHOUT_START_SCALE, 1);
    tween(shout)
      .to(SHOUT_POP_IN, { scale: new Vec3(1.15, 1.15, 1) }, { easing: 'backOut' })
      .to(SHOUT_POP_IN, { scale: new Vec3(1, 1, 1) }, { easing: 'quadOut' })
      .start();
    floatAway(shout, { duration: SHOUT_FADE, delay: SHOUT_POP_IN * 2 + SHOUT_HOLD });
  }

  /** 碗区中心往上偏移后的本节点局部坐标 */
  private anchor(offsetY: number): Vec3 {
    const world = this.bowlNode ? this.bowlNode.worldPosition : new Vec3(0, 0, 0);
    return toLocalPoint(this.node, world.x, world.y + offsetY);
  }
}
