/**
 * 文案表：界面上的中文全部集中在这里，不散落在组件里。
 * 页面上的固定文案由各自的视图组件从这里取（场景里那几行只是摆版时的预览值），
 * 改文案只改这一处，"界面与文案表不一致"这种错不会再出现。
 *
 * **例外：开始页的标题、副标题与玩法一句话不在这里**——它们已经烤进整屏封面图
 * （`assets/resources/art/backgrounds/start-page.png`），改那几行字等同于重出图，
 * 文案表管不到（见 docs/adr/0004-start-page-cover-art.md）。
 *
 * 海南味文案刻意克制、不做全篇方言：**界面上**带方言味的就 3 处——食饱未、连击的"够劲！"
 * （见 comboShout）、结算页的"老板娘都服了"；"再来一碗"与统计行都是普通话。
 * 原本还有第 4 处"开摊"，随开摊按钮换成自带文字的底图后不再上屏（见 startButton）。
 */
export const STRINGS = {
  /**
   * 开摊按钮的文案。**当前不上屏**：按钮上的字烤在底图里（图上写的是"开始游戏"），
   * 场景里那个文字节点已停用。这个键只作**旧文案的墓碑**留档——日后重出无字底图、
   * 把节点恢复回来时它才复活（理由见 ADR-0011）。
   */
  startButton: '开摊',
  /** 首局引导：浮在配料盘上方，首单出餐后消失（见 ui/GuideHint.ts） */
  guide: '把配料拖进碗里，凑齐即出餐',
  /**
   * 准备过场上的那一句（见 ui/PrepareTransition.ts）。
   * 刻意**不带海南味**：界面上方言配额的三处在文件头列明，这里要用就得从别处挪一个出来。
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
  bowlEmpty: '空碗',
  /** 连击达到门槛（见 balance 的 COMBO_SHOUT_AT）时冒出 */
  comboShout: '够劲！',
  /** 出餐得分飘字的前缀，后面直接拼核心给出的本单得分 */
  scoreFloatPrefix: '+',
  /** 订单卡上"已在碗里"的打勾标记 */
  orderCheckMark: '✓',
  /** 错放时在计时处飘出。这个"-3"与扣时值、与弹窗位图绑在一起，同步点见 balance.MISDROP_PENALTY_MS */
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
