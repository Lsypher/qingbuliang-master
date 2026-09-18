/**
 * 文案表：界面上的中文全部集中在这里，不散落在组件里。
 * 页面上的固定文案由各自的视图组件从这里取（场景里那几行只是摆版时的预览值），
 * 改文案只改这一处，"界面与文案表不一致"这种错不会再出现。
 *
 * 海南味文案刻意克制、不做全篇方言：带方言味的就 4 处——开摊、食饱未、连击的"够劲！"（见 comboShout）、
 * 结算页的"老板娘都服了"；副标题是苏轼句，"再来一碗"与统计行都是普通话。
 */
export const STRINGS = {
  /**
   * 标题：与艺术字图片（`resources/art/ui/title-art`）上的五个字互为镜像，
   * 只在图片没交付 / 加载失败时显示（见 ui/StartView.ts）。改这一串不会改到图上——
   * **改文案等同于重出一张图**，两边要一起动，别只改这一处。
   */
  title: '清补凉大师',
  /** 苏轼咏椰奶清补凉句，作为副标题 */
  subtitle: '椰树之上采琼浆，捧来一碗白玉香',
  howToPlay: '把配料拖进碗里，凑齐即出餐，60 秒看谁调得多',
  startButton: '开摊',
  /** 首局引导：浮在配料盘上方，首单出餐后消失（见 ui/GuideHint.ts） */
  guide: '把配料拖进碗里，凑齐即出餐',
  /**
   * 准备过场上的那一句（见 ui/PrepareTransition.ts）。
   * 刻意**不带海南味**：方言配额的四处在文件头列明，这里要用就得从别处挪一个出来。
   */
  prepareTransition: '正在备料…',

  scoreLabel: '分数',
  comboLabel: '连击',
  ordersLabel: '完成订单',
  countdownLabel: '倒计时',
  /**
   * 最高分的共用串（**不带冒号**）：结算页那行用它，形如"最高分 128"。
   * 开始页另用带冒号的 bestScoreStartLabel。
   */
  bestScoreLabel: '最高分',
  /**
   * 开始页专用串：带**全角冒号**，与后面的数字连起来读是"最高分：128"一个完整句子。
   * 与 bestScoreLabel 分开的理由：改结算页那句与改开始页这行互不牵动。
   */
  bestScoreStartLabel: '最高分：',
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
  /** 错放时在计时处飘出；"-3" 与 balance 的 MISDROP_PENALTY_MS 对应，改扣时必须同步改这里 */
  misdropText: '-3 秒',

  result: {
    title: '食饱未？',
    scoreLabel: '本局分数',
    ordersLabel: '完成订单',
    comboLabel: '最高连击',
    /** 只在破了纪录时显示 */
    newRecord: '老板娘都服了',
    restartButton: '再来一碗',
  },

} as const;

export type Strings = typeof STRINGS;
