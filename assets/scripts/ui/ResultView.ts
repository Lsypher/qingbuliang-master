import { _decorator, Component } from 'cc';
import type { SessionEvent } from '../core/session';
import { STRINGS } from '../config/strings';
import type { ScoreRecord } from '../game/bestScore';
import { recordScore } from '../game/bestScore';
import { setLabelText } from './uiFactory';

const { ccclass } = _decorator;

/** 核心给出的单局结算 */
type FinishedEvent = Extract<SessionEvent, { type: 'finished' }>;

/**
 * 结算页：把核心在单局结束时给出的三个数摆出来，落一条最高分，破纪录时补一句"老板娘都服了"。
 *
 * 为什么由 GameRoot 调用而不是自己订阅事件：结算页正是"被 finished 事件点亮"的那一页，
 * 它的组件要等页面激活才会 onLoad，而激活就发生在这次事件的分发当中——订阅得再早也收不到这条事件。
 * 所以由组合根在切页时把事件交过来（页面组件自己订阅会收到的那部分，仍然归自己订阅）。
 *
 * 分数一个都不在这里算：三个数直接取 finished 事件，最高分只做"读出来、比一比、写回去"，
 * "算不算破纪录"也由 bestScore 给出，界面只按结论决定显不显示。
 */
@ccclass('ResultView')
export class ResultView extends Component {
  /** 结算一局；GameRoot 在进入结算页时调用 */
  show(finished: FinishedEvent): void {
    // 先落盘再显示：破纪录的那一局即便没点"再来一碗"，纪录也已经存住了
    this.render(finished, recordScore(finished.score));
  }

  /**
   * 按给定的结算结论摆出这一页，一行字都不自己算。
   * 与"记账"分开各做一件事：写盘那次拿到结论后同样走这里，
   * "破纪录才显示"这条规则也因此能被单独驱动（开发期自检把两个方向各走一遍，不必真去改本地纪录）。
   * debug 目录删掉后若没有别的调用方，这个方法可以并回 show。
   */
  render(finished: FinishedEvent, record: ScoreRecord): void {
    // 结算页的标签是 02 切片的场景骨架摆好的，这里只改文字、不改布局
    setLabelText(this.node, 'Title', STRINGS.result.title);
    setLabelText(this.node, 'ScoreLine', `${STRINGS.result.scoreLabel} ${finished.score}`);
    setLabelText(this.node, 'OrdersLine', `${STRINGS.result.ordersLabel} ${finished.servedOrders}`);
    setLabelText(this.node, 'ComboLine', `${STRINGS.result.comboLabel} ${finished.bestCombo}`);
    setLabelText(this.node, 'BestLine', `${STRINGS.bestScoreLabel} ${record.best}`);
    setLabelText(this.node, 'NewRecordLine', STRINGS.result.newRecord);
    setLabelText(this.node, 'CreditLine', `${STRINGS.creditLabel}：${STRINGS.creditLine}`);

    // 按钮文字也在这页上，同样从文案表取（与开始页的开摊按钮一个规矩）
    const restartButton = this.node.getChildByName('RestartButton');
    if (restartButton) setLabelText(restartButton, 'Label', STRINGS.result.restartButton);

    // 只有这一局真的把纪录往前推了才亮相；没破纪录时整条藏起来，不占视觉
    const recordLine = this.node.getChildByName('NewRecordLine');
    if (recordLine) recordLine.active = record.improved;
  }
}
