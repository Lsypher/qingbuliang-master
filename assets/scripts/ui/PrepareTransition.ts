import { _decorator, BlockInputEvents, Component, Graphics } from 'cc';
import {
  PREPARE_MIN_SHOW_MS,
  PREPARE_SWEEP_PERIOD_MS,
  PREPARE_TIMEOUT_MS,
  sweepPhase,
} from '../config/prepareTransition';
import { STRINGS } from '../config/strings';
import type { EntryLimits } from '../core/entryGate';
import { decideEntry } from '../core/entryGate';
import type { PreloadTask } from './uiFactory';
import { createLabel, createUiNode, paintPanel, UI_COLOR, visibleWidth } from './uiFactory';

const { ccclass } = _decorator;

/** 放行判据的两个上限（从 config 层取）：模块级常量，免得每帧都新建一个对象 */
const ENTRY_LIMITS: EntryLimits = { minShowMs: PREPARE_MIN_SHOW_MS, timeoutMs: PREPARE_TIMEOUT_MS };

/** 过场文案的字号与纵向位置（设计像素）：文案居中，04 号票的扫动条接在它下面 */
const TEXT_FONT_SIZE = 40;
const TEXT_Y = 0;
/** 扫动条相对文案的纵向偏移（设计像素，向下为负）：留出文案高度，不压字 */
const BAR_Y = TEXT_Y - 78;
/** 扫动条高度（设计像素）与占轨道宽度的比例：段比轨道短，才看得出"在扫" */
const BAR_HEIGHT = 12;
const BAR_SEGMENT_RATIO = 0.35;
/**
 * 扫动条宽度取「可见宽度的 7 折」与固定上限里较小者，再让出左右各 50 的留白。
 * 窄屏（可见宽约 590）下据此收窄，保证过场内容不被裁切；宽屏则封顶、不铺满整屏。
 */
const BAR_MAX_WIDTH = 520;
const BAR_SIDE_MARGIN = 50;

/**
 * 准备过场层：横在开始页／结算页与单局页之间的一段全屏过场（无按钮、不可交互）。
 *
 * 它**不是第 4 个界面状态**：出现时底下的页面仍在场，"三个界面状态互斥显示"那条不变式与切页逻辑都不动。
 * 它只做三件事：把组合根交来的预载任务跑起来、亮满节拍（放行判据在 core 层，见 core/entryGate.ts），
 * 然后在**同一帧里**把交接交给组合根，最后才熄自己。
 *
 * 预载任务由**拥有资源的那些层**提供（本局背景来自背景层、12 格图标来自配料盘），
 * 本层只数"已决几项"，不碰加载路径、也不区分成功与失败——缺图各有各的既有兜底。
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
  /** 预载**已决**数与总数：喂给放行判据。已决不区分成功与失败 */
  private settled = 0;
  private total = 0;
  /** 扫动条画板：每帧清掉重画（不累积），所以重入过场也不会留下上一局的残影 */
  private barGraphics: Graphics | null = null;
  /** 扫动条宽度（设计像素）：在 build 里按可见宽度算一次，整段过场不变 */
  private barWidth = 0;

  /**
   * 亮起过场：先把 `preloads` 跑起来，再按判据（最短展示时长 / 预载完成 / 硬超时）等放行。
   * 放行那一帧调用 `onHandOff`（组合根在那里切页 + 开一局新的），随后自己熄灭。
   * 重复调用不会叠出第二段过场：组合根用"正在进入"的幂等标志挡住重复进入。
   */
  begin(onHandOff: () => void, preloads: readonly PreloadTask[]): void {
    this.build();
    this.onHandOff = onHandOff;
    this.elapsedMs = 0;
    this.settled = 0;
    this.total = preloads.length;
    this.running = true;
    this.node.active = true;
    this.startPreloads(preloads);
    // 亮起即画第一帧静止的扫动条（相位归零=停在左端），避免首帧空白；后续每帧由 update 驱动
    this.drawBar();
  }

  protected update(deltaTime: number): void {
    if (!this.running) return;
    this.elapsedMs += deltaTime * 1000;
    // 整段过场期间不停顿、不结束：相位只由经过时间决定，与放行判据无关
    this.drawBar();
    // 放行 = max(最短展示时长, 预载完成)，另有硬超时兜底；判据本身在 core 层，这里只喂"过了多久、已决几项"
    if (decideEntry(this.elapsedMs, this.settled, this.total, ENTRY_LIMITS) === 'go') this.handOff();
  }

  /**
   * 跑预载任务：每项**有结果**（成功或失败）时把"已决数"加一。
   *
   * 每项只认第一次回调——重复回调会让已决数超过总数，判据在预载并没真的做完时就提前放行。
   */
  private startPreloads(preloads: readonly PreloadTask[]): void {
    for (const preload of preloads) {
      let settled = false;
      preload(() => {
        if (settled) return;
        settled = true;
        this.settled++;
      });
    }
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
   * 装配过场内容：一块整屏面板 + 一句文案 + 一条不定式扫动条。
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
    // 文案框宽取可见宽度：窄屏下也居中铺满、绝不溢出裁切（文字短，实际只占中间一小段）
    createLabel(this.node, 'PrepareText', STRINGS.prepareTransition, TEXT_Y, TEXT_FONT_SIZE, UI_COLOR.textPrimary, visibleWidth());

    // 扫动条按可见宽度算宽、确保窄屏不被裁切；画板每帧重画，重入过场不残留
    this.barWidth = Math.min(BAR_MAX_WIDTH, visibleWidth() - BAR_SIDE_MARGIN * 2);
    const bar = createUiNode(this.node, 'PrepareBar', this.barWidth, BAR_HEIGHT, BAR_Y);
    this.barGraphics = bar.addComponent(Graphics);

    this.node.addComponent(BlockInputEvents);
  }

  /**
   * 画（或重画）扫动条：底槽 + 一段在槽里左右往返的扫动段。
   *
   * 每帧 `clear()` 后重画，绝不累加——这是"连进多次过场不残留、不串味"的关键：
   * 上一局最后一帧画的东西会被下一局第一帧覆盖，不会叠在画板上。
   * 扫动段位置只由 `sweepPhase(elapsedMs)` 决定，`begin` 把 `elapsedMs` 归零，
   * 于是每次亮起都从同一相位（左端）起步，多次进入观感一致。
   *
   * 配色复用统一配色表的 `barTrack` / `barFill`（与倒计时进度条同一套色系），不另起一套。
   */
  private drawBar(): void {
    const g = this.barGraphics;
    if (!g) return;
    const trackW = this.barWidth;
    const segW = trackW * BAR_SEGMENT_RATIO;
    // 相位 0→1 映射成扫动段中心从「左端」到「右端」：相位 0.5 时居中
    const segCenterX = (sweepPhase(this.elapsedMs, PREPARE_SWEEP_PERIOD_MS) - 0.5) * (trackW - segW);

    g.clear();
    // 底槽：半透明圆角长条
    g.fillColor = UI_COLOR.barTrack;
    g.roundRect(-trackW / 2, -BAR_HEIGHT / 2, trackW, BAR_HEIGHT, BAR_HEIGHT / 2);
    g.fill();
    // 扫动段：实色圆角短条，左右往返
    g.fillColor = UI_COLOR.barFill;
    g.roundRect(segCenterX - segW / 2, -BAR_HEIGHT / 2, segW, BAR_HEIGHT, BAR_HEIGHT / 2);
    g.fill();
  }
}
