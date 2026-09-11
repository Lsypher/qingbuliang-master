/**
 * 数值配置：单局时长、难度曲线、计分规则、各种时间参数。
 * 规则代码只读这里的常量，不写死数字。
 */

/** 单局总时长（毫秒） */
export const ROUND_DURATION_MS = 60_000;

/** 错放扣时（毫秒） */
export const MISDROP_PENALTY_MS = 3_000;

/** 出餐过渡时长（毫秒）：碗清空、顾客换人的动画时间，期间计时暂停 */
export const SERVE_TRANSITION_MS = 400;

/** 最后这段剩余时间触发倒计时告警（变红脉冲） */
export const COUNTDOWN_WARNING_MS = 10_000;

/**
 * 难度分段：按"已用时间"切换新订单要求的小料数量。
 * untilMs 是该档的结束时刻，也是下一档的起点；只影响之后新生成的订单，不改动当前订单。
 */
export const DIFFICULTY_STAGES: readonly { untilMs: number; toppingCount: number }[] = [
  { untilMs: 20_000, toppingCount: 3 },
  { untilMs: 40_000, toppingCount: 4 },
  { untilMs: ROUND_DURATION_MS, toppingCount: 5 },
];

/** 每单基础分 = 基础分系数 ×（小料数 + 1），汤底也计入一份 */
export const BASE_SCORE_PER_PORTION = 10;

/**
 * 连击加分：第 n 次连续出餐额外得 COMBO_BONUS_STEP × (n - 1)，上限 COMBO_BONUS_CAP。
 * 即首单不加分、第二单 +5，到 25 分封顶。
 */
export const COMBO_BONUS_STEP = 5;
export const COMBO_BONUS_CAP = 25;
