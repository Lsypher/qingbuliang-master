/**
 * 会话状态机：单局的所有规则都在这一层判定。
 * 本文件禁止 import 引擎（不出现 'cc'），所以它既能被 Cocos 编译，也能被 vitest 直接测试。
 *
 * 对外三个入口：
 *   createSession()      开局
 *   session.drop(id)     放入一份配料（拖动松手与点按都走这里）
 *   session.advance(ms)  推进时间（每帧调用）
 * 调用方靠返回的"事件"驱动表现，不自行判断规则——改规则只改这一层。
 */

import { BASE_POOL, TOPPING_POOL, getIngredient } from '../config/ingredients';
import {
  BASE_SCORE_PER_PORTION,
  COMBO_BONUS_CAP,
  COMBO_BONUS_STEP,
  COUNTDOWN_WARNING_MS,
  DIFFICULTY_STAGES,
  MISDROP_PENALTY_MS,
  ROUND_DURATION_MS,
  SERVE_TRANSITION_MS,
} from '../config/balance';
import type { RandomSource } from './random';
import { createRandom, pickDistinct, pickOne } from './random';

/** 单局相位：playing 进行中 / serving 出餐过渡（计时暂停）/ finished 已结束 */
export type SessionPhase = 'playing' | 'serving' | 'finished';

/** 一份订单：恰好一种汤底 + 3~5 种小料。匹配与放入顺序无关 */
export interface Order {
  baseId: string;
  /** 展示顺序，随机打乱，与匹配无关 */
  toppingIds: string[];
}

/** 会话状态快照 */
export interface SessionState {
  phase: SessionPhase;
  /** 剩余时间（毫秒） */
  remainingMs: number;
  /** 已用时间（毫秒）：只在进行相位累计，用于难度分段 */
  elapsedMs: number;
  score: number;
  /** 当前连击数（连续无错出餐的单数） */
  comboCount: number;
  bestCombo: number;
  servedOrders: number;
  order: Order;
  /** 碗中已放入的配料 id，按放入顺序 */
  bowlIds: string[];
  /** 过渡相位剩余时间（毫秒） */
  transitionRemainingMs: number;
  /** 当前难度档位下标 */
  stageIndex: number;
  /** 倒计时告警是否已发过（每局只发一次） */
  warned: boolean;
}

/** 核心产出的事件，表现层只认这些 */
export type SessionEvent =
  | { type: 'accepted'; ingredientId: string }
  | { type: 'served'; orderScore: number; baseScore: number; comboBonus: number; comboCount: number; score: number }
  | { type: 'misdrop'; ingredientId: string; penaltyMs: number; remainingMs: number }
  | { type: 'rejected'; ingredientId: string; reason: 'duplicate' }
  | { type: 'stageChanged'; stageIndex: number; toppingCount: number }
  | { type: 'countdownWarning' }
  | { type: 'finished'; score: number; servedOrders: number; bestCombo: number };

export interface Session {
  /** 当前状态快照：只读，外部不得修改 */
  readonly state: SessionState;
  /** 放入一份配料，返回本次产生的事件 */
  drop(ingredientId: string): SessionEvent[];
  /** 推进时间（毫秒），返回本次产生的事件 */
  advance(deltaMs: number): SessionEvent[];
}

/** 已用时间落在第几档难度（0 起） */
function stageIndexAt(elapsedMs: number): number {
  let index = 0;
  while (index < DIFFICULTY_STAGES.length - 1 && elapsedMs >= DIFFICULTY_STAGES[index].untilMs) {
    index++;
  }
  return index;
}

/** 生成一份订单：1 种汤底 + toppingCount 种互不重复的小料 */
function generateOrder(random: RandomSource, toppingCount: number): Order {
  return {
    baseId: pickOne(BASE_POOL, random).id,
    toppingIds: pickDistinct(TOPPING_POOL, toppingCount, random).map((item) => item.id),
  };
}

/** 该配料是否属于这份订单（汤底或小料） */
function isInOrder(order: Order, ingredientId: string): boolean {
  return order.baseId === ingredientId || order.toppingIds.includes(ingredientId);
}

/**
 * 订单是否已凑齐。
 * 因为只有订单内的配料能被接受、且同一配料不会重复进碗，正常情况下条目数相等即完成；
 * 这里仍做完整集合校验，让"完成"的定义不依赖上面那条不变量。
 */
function isOrderFulfilled(order: Order, bowlIds: readonly string[]): boolean {
  if (bowlIds.length !== order.toppingIds.length + 1) return false;
  if (!bowlIds.includes(order.baseId)) return false;
  return order.toppingIds.every((id) => bowlIds.includes(id));
}

export function createSession(options: { random?: RandomSource } = {}): Session {
  const random = options.random ?? createRandom(Date.now() >>> 0);

  const state: SessionState = {
    phase: 'playing',
    remainingMs: ROUND_DURATION_MS,
    elapsedMs: 0,
    score: 0,
    comboCount: 0,
    bestCombo: 0,
    servedOrders: 0,
    order: generateOrder(random, DIFFICULTY_STAGES[0].toppingCount),
    bowlIds: [],
    transitionRemainingMs: 0,
    stageIndex: 0,
    warned: false,
  };

  /** 时间归零：结束单局并产出结束事件 */
  function finish(events: SessionEvent[]): void {
    state.remainingMs = 0;
    state.phase = 'finished';
    events.push({
      type: 'finished',
      score: state.score,
      servedOrders: state.servedOrders,
      bestCombo: state.bestCombo,
    });
  }

  /** 凑齐出餐：结算本单得分、清空碗、进入过渡相位 */
  function serve(events: SessionEvent[]): void {
    state.comboCount += 1;
    state.bestCombo = Math.max(state.bestCombo, state.comboCount);

    const baseScore = BASE_SCORE_PER_PORTION * (state.order.toppingIds.length + 1);
    const comboBonus = Math.min(COMBO_BONUS_STEP * (state.comboCount - 1), COMBO_BONUS_CAP);
    const orderScore = baseScore + comboBonus;

    state.score += orderScore;
    state.servedOrders += 1;
    state.bowlIds = [];
    state.phase = 'serving';
    state.transitionRemainingMs = SERVE_TRANSITION_MS;

    events.push({
      type: 'served',
      orderScore,
      baseScore,
      comboBonus,
      comboCount: state.comboCount,
      score: state.score,
    });
  }

  return {
    state,

    drop(ingredientId: string): SessionEvent[] {
      const events: SessionEvent[] = [];
      // 只有进行相位接受放入；过渡与结束后一律忽略
      if (state.phase !== 'playing') return events;
      if (!getIngredient(ingredientId)) return events;

      // 碗里已有同一配料：静默拒绝，不扣时不弹回（60 秒里手滑连点不该重罚）
      if (state.bowlIds.includes(ingredientId)) {
        events.push({ type: 'rejected', ingredientId, reason: 'duplicate' });
        return events;
      }

      // 订单不需要的配料：错放，扣时 + 断连击，配料本身不进碗
      if (!isInOrder(state.order, ingredientId)) {
        state.comboCount = 0;
        state.remainingMs = Math.max(0, state.remainingMs - MISDROP_PENALTY_MS);
        events.push({
          type: 'misdrop',
          ingredientId,
          penaltyMs: MISDROP_PENALTY_MS,
          remainingMs: state.remainingMs,
        });
        if (state.remainingMs === 0) finish(events);
        return events;
      }

      // 订单内的配料：进碗，凑齐即出餐
      state.bowlIds.push(ingredientId);
      events.push({ type: 'accepted', ingredientId });
      if (isOrderFulfilled(state.order, state.bowlIds)) serve(events);
      return events;
    },

    advance(deltaMs: number): SessionEvent[] {
      const events: SessionEvent[] = [];
      if (state.phase === 'finished' || deltaMs <= 0) return events;

      // 过渡相位：只消耗过渡预算，不消耗单局时间（换顾客不偷走玩家的时间）
      if (state.phase === 'serving') {
        state.transitionRemainingMs -= deltaMs;
        if (state.transitionRemainingMs <= 0) {
          state.transitionRemainingMs = 0;
          state.phase = 'playing';
          // 新顾客入场时才拿到新订单，用的正是当前难度档位
          state.order = generateOrder(random, DIFFICULTY_STAGES[state.stageIndex].toppingCount);
        }
        return events;
      }

      state.elapsedMs += deltaMs;
      state.remainingMs -= deltaMs;

      // 难度换档：一档只播报一次；跨多档时也只播报一次（取最终档位）
      const nextStageIndex = stageIndexAt(state.elapsedMs);
      if (nextStageIndex !== state.stageIndex) {
        state.stageIndex = nextStageIndex;
        events.push({
          type: 'stageChanged',
          stageIndex: nextStageIndex,
          toppingCount: DIFFICULTY_STAGES[nextStageIndex].toppingCount,
        });
      }

      // 倒计时告警：每局一次
      if (!state.warned && state.remainingMs <= COUNTDOWN_WARNING_MS) {
        state.warned = true;
        events.push({ type: 'countdownWarning' });
      }

      if (state.remainingMs <= 0) finish(events);
      return events;
    },
  };
}
