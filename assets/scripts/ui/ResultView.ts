import { _decorator, Component } from 'cc';
import type { SessionEvent } from '../core/session';
import { STRINGS } from '../config/strings';
import { recordScore } from '../game/bestScore';
import { setLabelText } from './uiFactory';

const { ccclass } = _decorator;

/** 核心给出的单局结算 */
type FinishedEvent = Extract<SessionEvent, { type: 'finished' }>;

/**
 * 结算页：把核心在单局结束时给出的三个数摆出来，并落一条最高分。
 *
 * 为什么由 GameRoot 调用而不是自己订阅事件：结算页正是"被 finished 事件点亮"的那一页，
 * 它的组件要等页面激活才会 onLoad，而激活就发生在这次事件的分发当中——订阅得再早也收不到这条事件。
 * 所以由组合根在切页时把事件交过来（页面组件自己订阅会收到的那部分，仍然归自己订阅）。
 *
 * 分数一个都不在这里算：三个数直接取 finished 事件，最高分只做"读出来、比一比、写回去"。
 */
@ccclass('ResultView')
export class ResultView extends Component {
  /** 渲染一局的结果；GameRoot 在进入结算页时调用 */
  show(finished: FinishedEvent): void {
    // 先落盘再显示：破纪录的那一局即便没点"再来一碗"，纪录也已经存住了
    const best = recordScore(finished.score);

    // 结算页的标签是 02 切片的场景骨架摆好的，这里只改文字、不改布局
    setLabelText(this.node, 'ScoreLine', `${STRINGS.result.scoreLabel} ${finished.score}`);
    setLabelText(this.node, 'OrdersLine', `${STRINGS.result.ordersLabel} ${finished.servedOrders}`);
    setLabelText(this.node, 'ComboLine', `${STRINGS.result.comboLabel} ${finished.bestCombo}`);
    setLabelText(this.node, 'BestLine', `${STRINGS.bestScoreLabel} ${best}`);
  }
}
