import { _decorator, BlockInputEvents, Component } from 'cc';
import { PREPARE_MIN_SHOW_MS, PREPARE_TIMEOUT_MS } from '../config/prepareTransition';
import { STRINGS } from '../config/strings';
import type { EntryLimits } from '../core/entryGate';
import { decideEntry } from '../core/entryGate';
import { createLabel, paintPanel, UI_COLOR } from './uiFactory';

const { ccclass } = _decorator;

/** 放行判据的两个上限（从 config 层取）：模块级常量，免得每帧都新建一个对象 */
const ENTRY_LIMITS: EntryLimits = { minShowMs: PREPARE_MIN_SHOW_MS, timeoutMs: PREPARE_TIMEOUT_MS };

/** 过场文案的字号与纵向位置（设计像素）：文案居中，04 号票的扫动条会接在它下面 */
const TEXT_FONT_SIZE = 40;
const TEXT_Y = 0;

/**
 * 准备过场层：横在开始页／结算页与单局页之间的一段全屏过场（无按钮、不可交互）。
 *
 * 它**不是第 4 个界面状态**：出现时底下的页面仍在场，"三个界面状态互斥显示"那条不变式与切页逻辑都不动。
 * 它只做两件事：亮满最短展示时长（放行判据在 core 层，见 core/entryGate.ts），
 * 然后在**同一帧里**把交接交给组合根，最后才熄自己。
 *
 * 计时不可能在过场期间偷跑：本组件不碰 GameSession，单局页此时仍是隐藏的、其组件不参与逐帧推进，
 * 而单局计时由"开一局新的"这个动作建立——它落在交接之后，所以准备时间不占那 60 秒。
 */
@ccclass('PrepareTransition')
export class PrepareTransition extends Component {
  /** 从"亮起"那一刻起算的经过时间（毫秒） */
  private elapsedMs = 0;
  private running = false;
  /** 交接回调：由组合根在 begin 时给，放行那一帧调用一次，用完即清 */
  private onHandOff: (() => void) | null = null;
  /** 内容只装配一次：过场每局都要亮一次，反复建节点等于每局多一份垃圾 */
  private built = false;

  /**
   * 亮起过场。放行那一帧调用 `onHandOff`（组合根在那里切页 + 开一局新的），随后自己熄灭。
   * 重复调用不会叠出第二段过场：组合根用"正在进入"的幂等标志挡住重复进入。
   */
  begin(onHandOff: () => void): void {
    this.build();
    this.onHandOff = onHandOff;
    this.elapsedMs = 0;
    this.running = true;
    this.node.active = true;
  }

  protected update(deltaTime: number): void {
    if (!this.running) return;
    this.elapsedMs += deltaTime * 1000;
    // 01 号票还没有要预载的东西：已决数与总数都是 0，判据退化成"只等最短展示时长"。
    // 接上真预载（本局背景、12 格配料图标）是 02、03 号票的事，这一步只把判据接进真实节拍。
    if (decideEntry(this.elapsedMs, 0, 0, ENTRY_LIMITS) === 'go') this.handOff();
  }

  /**
   * 交接：过场保持不透明到最后一帧，所以顺序固定为"切页 → 开一局新的 → 熄过场"，
   * 熄自己排在回调**之后**——这就是这段过场"结束感"的全部来源。
   *
   * 不做淡出：淡出要么先露出旧页，要么让倒计时在玩家还没看清单局页时就已经开始跑。
   */
  private handOff(): void {
    this.running = false;
    const handOff = this.onHandOff;
    this.onHandOff = null;
    handOff?.();
    this.node.active = false;
  }

  /**
   * 装配过场内容：一块整屏面板 + 一句文案。
   *
   * 面板由代码绘制、不取任何图片：过场要挡的正是"图还没加载好"这件事，
   * 它自己再去等一张图就会卡在"等自己"上（配色取自统一配色表，不新起一套色系）。
   *
   * `BlockInputEvents` 让这块面板把它盖住的整屏输入都吃掉：过场不透明、底下的按钮看不见，
   * 手指落在原按钮的位置上也不会点到底下的按钮。它挡的是**空间上的穿透**；
   * "过场期间连点只开一局"那道**时间上的重复**由组合根的幂等标志挡，两者不重复。
   *
   * 不写在 `onLoad`：本层装配时是隐藏的，隐藏节点上的组件不执行 `onLoad`，
   * 那样要等到第一次亮起才建内容；这里在 `begin` 里显式建，时序更直白。
   */
  private build(): void {
    if (this.built) return;
    this.built = true;

    paintPanel(this.node, UI_COLOR.transitionBackdrop);
    createLabel(this.node, 'PrepareText', STRINGS.prepareTransition, TEXT_Y, TEXT_FONT_SIZE, UI_COLOR.textPrimary);
    this.node.addComponent(BlockInputEvents);
  }
}
