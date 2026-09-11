/**
 * 纯逻辑核心的行为测试。
 * 只断言外部行为：给定状态与输入，产出什么事件、状态怎么变；
 * 不碰内部字段、不 mock 内部协作对象。
 * 测试名用中文写成一句需求，读起来就是验收标准。
 */

import { describe, expect, it } from 'vitest';
import type { Session, SessionEvent } from '../assets/scripts/core/session';
import { createSession } from '../assets/scripts/core/session';
import { createRandom } from '../assets/scripts/core/random';
import { BASE_POOL, TOPPING_POOL } from '../assets/scripts/config/ingredients';
import {
  BASE_SCORE_PER_PORTION,
  COMBO_BONUS_STEP,
  COUNTDOWN_WARNING_MS,
  MISDROP_PENALTY_MS,
  ROUND_DURATION_MS,
  SERVE_TRANSITION_MS,
} from '../assets/scripts/config/balance';

const BASE_IDS = BASE_POOL.map((item) => item.id);
const TOPPING_IDS = TOPPING_POOL.map((item) => item.id);

/** 开一局；固定种子保证可复现 */
function newSession(seed = 20260911): Session {
  return createSession({ random: createRandom(seed) });
}

/** 把一个订单放满（故意倒序放小料，顺带验证顺序无关），返回最后一批事件 */
function serveCurrentOrder(session: Session): SessionEvent[] {
  const { baseId, toppingIds } = session.state.order;
  let events: SessionEvent[] = [];
  for (let i = toppingIds.length - 1; i >= 0; i--) {
    events = session.drop(toppingIds[i]);
  }
  return session.drop(baseId);
}

/** 跳过出餐过渡 */
function skipTransition(session: Session): void {
  session.advance(SERVE_TRANSITION_MS);
}

/** 取出本次的出餐事件，没有则报错 */
function servedEvent(events: SessionEvent[]) {
  const found = events.find((event) => event.type === 'served');
  if (!found || found.type !== 'served') throw new Error('本次没有出餐事件');
  return found;
}

/** 订单之外的汤底（用于制造错放） */
function wrongBase(session: Session): string {
  const id = BASE_IDS.find((item) => item !== session.state.order.baseId);
  if (!id) throw new Error('汤底池至少要有两种汤底');
  return id;
}

/** 订单之外的小料（用于制造错放） */
function wrongTopping(session: Session): string {
  const id = TOPPING_IDS.find((item) => !session.state.order.toppingIds.includes(item));
  if (!id) throw new Error('订单不该占满全部小料');
  return id;
}

describe('开局', () => {
  it('开局是 60 秒、3 种小料的订单、空碗、0 分、进行中', () => {
    const session = newSession();
    expect(session.state.remainingMs).toBe(ROUND_DURATION_MS);
    expect(session.state.score).toBe(0);
    expect(session.state.bowlIds).toEqual([]);
    expect(session.state.phase).toBe('playing');
    expect(BASE_IDS).toContain(session.state.order.baseId);
    expect(session.state.order.toppingIds).toHaveLength(3);
  });

  it('订单生成恒合法：汤底取自汤底池，小料互不重复且取自小料池', () => {
    for (let seed = 1; seed <= 300; seed++) {
      const { order } = createSession({ random: createRandom(seed) }).state;
      expect(BASE_IDS).toContain(order.baseId);
      expect(order.toppingIds).toHaveLength(3);
      expect(new Set(order.toppingIds).size).toBe(order.toppingIds.length);
      order.toppingIds.forEach((id) => expect(TOPPING_IDS).toContain(id));
    }
  });

  it('同一随机种子得到同一订单序列（可复现）', () => {
    const first = newSession(42);
    const second = newSession(42);
    expect(first.state.order).toEqual(second.state.order);

    for (let i = 0; i < 3; i++) {
      serveCurrentOrder(first);
      skipTransition(first);
      serveCurrentOrder(second);
      skipTransition(second);
    }
    expect(first.state.order).toEqual(second.state.order);
    expect(first.state.score).toBe(second.state.score);
  });
});

describe('放入配料与集合匹配', () => {
  it('放入订单内的配料被接受并进入碗中', () => {
    const session = newSession();
    const id = session.state.order.toppingIds[0];
    expect(session.drop(id)).toEqual([{ type: 'accepted', ingredientId: id }]);
    expect(session.state.bowlIds).toEqual([id]);
  });

  it('放进顺序与订单展示顺序相反也能出餐', () => {
    const session = newSession();
    const { baseId, toppingIds } = session.state.order;
    [...toppingIds].reverse().forEach((id) => {
      const events = session.drop(id);
      expect(events.some((event) => event.type === 'served')).toBe(false);
    });
    const events = session.drop(baseId);
    expect(events.some((event) => event.type === 'served')).toBe(true);
    expect(session.state.phase).toBe('serving');
    expect(session.state.bowlIds).toEqual([]);
  });

  it('订单没凑齐不会出餐', () => {
    const session = newSession();
    const ids = session.state.order.toppingIds;
    session.drop(ids[0]);
    session.drop(ids[1]);
    expect(session.state.servedOrders).toBe(0);
    expect(session.state.phase).toBe('playing');
  });

  it('放入订单之外的汤底算错放，不进碗', () => {
    const session = newSession();
    const events = session.drop(wrongBase(session));
    expect(events.map((event) => event.type)).toEqual(['misdrop']);
    expect(session.state.bowlIds).toEqual([]);
  });

  it('未知配料 id 不产生任何事件、不扣时间', () => {
    const session = newSession();
    expect(session.drop('not_an_ingredient')).toEqual([]);
    expect(session.state.remainingMs).toBe(ROUND_DURATION_MS);
  });

  it('重复放入同一配料被静默拒绝，不扣时间也不弹回', () => {
    const session = newSession();
    const id = session.state.order.toppingIds[0];
    session.drop(id);
    expect(session.drop(id)).toEqual([{ type: 'rejected', ingredientId: id, reason: 'duplicate' }]);
    expect(session.state.remainingMs).toBe(ROUND_DURATION_MS);
    expect(session.state.bowlIds).toEqual([id]);
  });

  it('一次凑齐只出餐一次，过渡期间再放入无任何事件', () => {
    const session = newSession();
    const events = serveCurrentOrder(session);
    expect(events.filter((event) => event.type === 'served')).toHaveLength(1);
    expect(session.state.servedOrders).toBe(1);
    expect(session.drop(session.state.order.baseId)).toEqual([]);
  });
});

describe('错放惩罚', () => {
  it('错放扣 3 秒、清空连击、不改变碗内容', () => {
    const session = newSession();
    serveCurrentOrder(session);
    skipTransition(session);
    const bowlBefore = [...session.state.bowlIds];

    const wrong = wrongTopping(session);
    expect(session.drop(wrong)).toEqual([
      { type: 'misdrop', ingredientId: wrong, penaltyMs: MISDROP_PENALTY_MS, remainingMs: ROUND_DURATION_MS - MISDROP_PENALTY_MS },
    ]);
    expect(session.state.comboCount).toBe(0);
    expect(session.state.bowlIds).toEqual(bowlBefore);
  });

  it('错放把时间扣到零时立即结束单局', () => {
    const session = newSession();
    session.advance(ROUND_DURATION_MS - 2_000);
    const events = session.drop(wrongTopping(session));
    expect(events.map((event) => event.type)).toEqual(['misdrop', 'finished']);
    expect(session.state.remainingMs).toBe(0);
    expect(session.state.phase).toBe('finished');
  });
});

describe('计分与连击', () => {
  it('首单不加连击分，第二单起每单多 5 分', () => {
    const session = newSession();

    const first = servedEvent(serveCurrentOrder(session));
    expect(first.baseScore).toBe(BASE_SCORE_PER_PORTION * 4); // 3 种小料 + 1 份汤底
    expect(first.comboBonus).toBe(0);
    skipTransition(session);

    const second = servedEvent(serveCurrentOrder(session));
    expect(second.baseScore).toBe(BASE_SCORE_PER_PORTION * 4);
    expect(second.comboBonus).toBe(COMBO_BONUS_STEP);
    expect(session.state.score).toBe(first.orderScore + second.orderScore);
  });

  it('连击加分到 25 分封顶', () => {
    const session = newSession();
    const bonuses: number[] = [];
    for (let i = 0; i < 8; i++) {
      bonuses.push(servedEvent(serveCurrentOrder(session)).comboBonus);
      skipTransition(session);
    }
    expect(bonuses).toEqual([0, 5, 10, 15, 20, 25, 25, 25]);
    expect(session.state.bestCombo).toBe(8);
  });

  it('错放后连击归零，再出餐重新从零累计', () => {
    const session = newSession();
    serveCurrentOrder(session);
    skipTransition(session);
    serveCurrentOrder(session);
    skipTransition(session);
    expect(session.state.comboCount).toBe(2);

    session.drop(wrongTopping(session));
    expect(session.state.comboCount).toBe(0);

    const served = servedEvent(serveCurrentOrder(session));
    expect(served.comboBonus).toBe(0);
    expect(session.state.comboCount).toBe(1);
  });
});

describe('难度换档', () => {
  it('20 秒后换档一次，新订单要 4 种小料', () => {
    const session = newSession();
    const events = session.advance(20_000);
    const stageEvents = events.filter((event) => event.type === 'stageChanged');
    expect(stageEvents).toHaveLength(1);
    expect(stageEvents[0]).toMatchObject({ toppingCount: 4 });

    // 当前订单不受影响，下一个订单才变难
    expect(session.state.order.toppingIds).toHaveLength(3);
    serveCurrentOrder(session);
    skipTransition(session);
    expect(session.state.order.toppingIds).toHaveLength(4);
  });

  it('40 秒后再换档，新订单要 5 种小料', () => {
    const session = newSession();
    session.advance(20_000);
    const events = session.advance(20_000);
    const stageEvents = events.filter((event) => event.type === 'stageChanged');
    expect(stageEvents).toHaveLength(1);
    expect(stageEvents[0]).toMatchObject({ toppingCount: 5 });

    serveCurrentOrder(session);
    skipTransition(session);
    expect(session.state.order.toppingIds).toHaveLength(5);
  });

  it('一次跨多档也只播报一次换档', () => {
    const session = newSession();
    const events = session.advance(ROUND_DURATION_MS - COUNTDOWN_WARNING_MS);
    expect(events.filter((event) => event.type === 'stageChanged')).toHaveLength(1);
  });
});

describe('计时', () => {
  it('出餐过渡期间计时暂停，过渡结束才回到进行相位', () => {
    const session = newSession();
    serveCurrentOrder(session);
    expect(session.state.phase).toBe('serving');

    session.advance(SERVE_TRANSITION_MS - 1);
    expect(session.state.phase).toBe('serving');
    expect(session.state.remainingMs).toBe(ROUND_DURATION_MS);

    session.advance(1);
    expect(session.state.phase).toBe('playing');
    expect(session.state.remainingMs).toBe(ROUND_DURATION_MS);
    expect(session.state.transitionRemainingMs).toBe(0);
  });

  it('倒计时告警每局只发一次', () => {
    const session = newSession();
    const events = session.advance(ROUND_DURATION_MS - COUNTDOWN_WARNING_MS);
    expect(events.filter((event) => event.type === 'countdownWarning')).toHaveLength(1);
    expect(session.state.remainingMs).toBe(COUNTDOWN_WARNING_MS);

    const later = session.advance(1_000);
    expect(later.filter((event) => event.type === 'countdownWarning')).toHaveLength(0);
    expect(session.state.remainingMs).toBe(COUNTDOWN_WARNING_MS - 1_000);
  });

  it('时间归零结束单局，结束后不再接受放入也不再推进', () => {
    const session = newSession();
    const events = session.advance(ROUND_DURATION_MS);
    expect(events.find((event) => event.type === 'finished')).toMatchObject({
      score: 0,
      servedOrders: 0,
      bestCombo: 0,
    });
    expect(session.state.phase).toBe('finished');
    expect(session.state.remainingMs).toBe(0);

    expect(session.drop(session.state.order.toppingIds[0])).toEqual([]);
    expect(session.advance(1_000)).toEqual([]);
    expect(session.state.score).toBe(0);
  });
});
