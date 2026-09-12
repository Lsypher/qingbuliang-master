/**
 * 文案表：界面上的中文全部集中在这里，不散落在组件里。
 * 海南味文案刻意克制在 5 处（副标题、开摊、食饱未、老板娘都服了、再来一碗），不做全篇方言。
 */
export const STRINGS = {
  title: '清补凉大师',
  /** 苏轼咏椰奶清补凉句，作为副标题 */
  subtitle: '椰树之上采琼浆，捧来一碗白玉香',
  howToPlay: '把配料拖进碗里，凑齐即出餐，60 秒看谁调得多',
  startButton: '开摊',
  /** 首局引导，首单出餐后消失 */
  guide: '把配料拖进碗里，凑齐即出餐',

  scoreLabel: '分数',
  comboLabel: '连击',
  ordersLabel: '完成订单',
  countdownLabel: '倒计时',
  /** 最高分：开始页与结算页共用一行文案 */
  bestScoreLabel: '最高分',
  /** 订单卡标题与已放进度 */
  orderTitle: '顾客要这一碗',
  placedLabel: '已放',
  /** 碗区域文案 */
  bowlTitle: '碗中',
  bowlEmpty: '空碗',
  /** 连击达到门槛（见 balance 的 COMBO_SHOUT_AT）时冒出 */
  comboShout: '够劲！',
  /** 出餐得分飘字的前缀，后面直接拼核心给出的本单得分 */
  scoreFloatPrefix: '+',
  /** 订单卡上"已在碗里"的打勾标记 */
  orderCheckMark: '✓',
  /** 错放时在计时处飘出 */
  misdropText: '-3 秒',

  result: {
    title: '食饱未？',
    scoreLabel: '本局分数',
    ordersLabel: '完成订单',
    comboLabel: '最高连击',
    newRecord: '老板娘都服了',
    restartButton: '再来一碗',
  },

  creditLabel: '素材致谢',
} as const;

export type Strings = typeof STRINGS;
