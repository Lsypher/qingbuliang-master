import { _decorator, Component } from 'cc';
import type { Session, SessionEvent } from '../core/session';
import { createSession } from '../core/session';
import { BusEvent, bus } from './bus';

const { ccclass } = _decorator;

/**
 * 适配层：把 Cocos 的时间与输入翻译成核心调用，再把核心的事件广播给表现层。
 * 这里不写任何规则判断——错放扣几秒、这一单值多少分，全部由 core 决定。
 */
@ccclass('GameSession')
export class GameSession extends Component {
  private session: Session | null = null;

  /** 开一局新单局（进入单局页或重开时调用） */
  startRound(): void {
    this.session = createSession();
    // 先广播开局，再推首帧状态：背景这类表现要在玩家看到第一帧前就换好
    bus.emit(BusEvent.RoundStarted);
    this.publish([]);
  }

  protected onLoad(): void {
    bus.on(BusEvent.DropIngredient, this.onDropIngredient, this);
  }

  protected onDestroy(): void {
    bus.off(BusEvent.DropIngredient, this.onDropIngredient, this);
  }

  protected update(deltaTime: number): void {
    if (!this.session) return;
    // 每帧都广播：视图自己做"值没变就不重绘"的短路，避免漏帧导致界面与状态不一致
    this.publish(this.session.advance(deltaTime * 1000));
  }

  /** 玩家的一次放入请求 */
  private onDropIngredient(ingredientId: string): void {
    if (!this.session) return;
    this.publish(this.session.drop(ingredientId));
  }

  private publish(events: SessionEvent[]): void {
    if (!this.session) return;
    bus.emit(BusEvent.Render, { state: this.session.state, events });
  }
}
