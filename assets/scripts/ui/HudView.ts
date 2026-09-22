import { _decorator, Node, Tween, Vec3, tween } from 'cc';
import { ROUND_DURATION_MS } from '../config/balance';
import { COUNTDOWN_Y } from '../config/layout';
import { STRINGS } from '../config/strings';
import type { RenderPayload } from '../game/bus';
import { BusComponent } from '../game/busComponent';
import { SignatureGuard } from './redrawGuard';
import { hudStatsSignature } from './renderSignatures';
import type { OutlinedText } from './uiFactory';
import { createOutlinedText, createUiNode, paintPanel, UI_COLOR } from './uiFactory';

const { ccclass } = _decorator;

/**
 * 顶部信息条的版面（设计像素，以单局页中心为原点）：倒计时数字在上、进度条夹中间、统计行在下。
 * 三个 y 彼此间距就是按这些值定的，改一个要连相邻那个一起看。
 * 字号按"隔着一层美术也一眼扫到"定：倒计时最大、统计行小一号；这一条没有底板（文字与进度条都压在每局随机背景图上），
 * 所以字号只往上调、不再往下压。
 * `COUNTDOWN_Y` 不在这里：错放飘字也要读它，按 config/layout.ts 的约定把它提到了那边。
 */
const COUNTDOWN_FONT = 34;
const BAR_Y = 566;
const STATS_Y = 528;
const STATS_FONT = 24;
/** 倒计时进度条尺寸：填充从左端起，随剩余时间收短 */
const BAR_WIDTH = 560;
const BAR_HEIGHT = 14;
/** 进度条重绘阈值：比例变化小于此值就不动（560 像素宽下约 1 像素，省掉绝大多数帧的重绘） */
const BAR_REDRAW_EPSILON = 0.002;
/** 倒计时告警脉冲：放大到 1.15 再回落为一轮，半周期（秒） */
const PULSE_HALF_PERIOD = 0.35;
const PULSE_SCALE = 1.15;

/**
 * 顶部信息条：倒计时（数字 + 进度条）、分数、完成订单、连击。
 *
 * 倒计时完全由核心给出的 `remainingMs` 推导——数字向上取整到秒、进度条取剩余比例，
 * 两者同源，所以"数字与进度条一致"是天然成立而不是靠对齐维护的。
 *
 * 最后 10 秒的变红脉冲只认核心状态里的 `warned`：核心保证每局只置真一次，
 * 这里只是把它镜像成"亮着 / 灭着"两种表现——所以既不会重复触发，新一局也自然复位。
 *
 * 两行文字都带字形描边（来由与做法见 uiFactory.createOutlinedText）。
 */
@ccclass('HudView')
export class HudView extends BusComponent {
  /** 倒计时数字（告警时正文与描边一起转红，见 setCountdownWarning） */
  private countdownLabel: OutlinedText | null = null;
  /** 统计行：分数 / 完成订单 / 连击 */
  private statsLine: OutlinedText | null = null;
  /** 进度条填充节点：用 x 缩放表示剩余比例，比每帧重画 Graphics 便宜 */
  private barFillNode: Node | null = null;

  private lastSeconds = -1;
  private lastBarRatio = -1;
  /** 统计行（分数 / 完成订单 / 连击）的重绘守卫；倒计时的秒与比例各有自己的判断语义 */
  private readonly statsRedraw = new SignatureGuard();
  /** 告警是否正亮着：与核心的 warned 保持同步，用来判断脉冲该起还是该停 */
  private warningActive = false;
  private pulseTween: Tween<Node> | null = null;

  protected onViewLoad(): void {
    this.buildCountdown();
    this.statsLine = createOutlinedText(this.node, 'HudLine', '', STATS_FONT, UI_COLOR.textBody, UI_COLOR.textOutline);
    this.statsLine.node.setPosition(0, STATS_Y, 0);
  }

  /** 停脉冲：组件销毁前基类会调到这里（Render 的退订由基类做） */
  protected onViewDestroy(): void {
    this.stopPulse();
  }

  /** 倒计时区：上一行数字，下一行进度条 */
  private buildCountdown(): void {
    // 纵向位置必须与 config/layout.ts 的 COUNTDOWN_Y 一致：错放的"-3 秒"按那条常量摆到数字右侧，
    // 不再按节点名去顶栏里找它（见 ADR-0009）；节点名留着只是为了在层级面板里认得出
    this.countdownLabel = createOutlinedText(this.node, 'CountdownLabel', '', COUNTDOWN_FONT, UI_COLOR.textAccent, UI_COLOR.textOutline);
    this.countdownLabel.node.setPosition(0, COUNTDOWN_Y, 0);

    const track = createUiNode(this.node, 'CountdownBar', BAR_WIDTH, BAR_HEIGHT, BAR_Y);
    paintPanel(track, UI_COLOR.barTrack);

    // 先按满宽画一次，之后只改缩放与位移
    const fill = createUiNode(track, 'CountdownBarFill', BAR_WIDTH, BAR_HEIGHT);
    paintPanel(fill, UI_COLOR.barFill);
    this.barFillNode = fill;
  }

  /** 进度条按剩余比例收短：缩放围绕节点中心，位置跟着往左挪，左端才始终贴着底槽 */
  private drawBar(ratio: number): void {
    if (!this.barFillNode) return;
    this.barFillNode.setScale(ratio, 1, 1);
    this.barFillNode.setPosition(-BAR_WIDTH / 2 + (BAR_WIDTH * ratio) / 2, 0, 0);
  }

  protected onRendered(payload: RenderPayload): void {
    // 只在"亮 / 灭"翻转时动一次：脉冲进行中反复启动会把动画按住不动
    if (payload.state.warned !== this.warningActive) this.setCountdownWarning(payload.state.warned);
    this.renderCountdown(payload.state.remainingMs);
    this.renderStats(payload.state);
  }

  /** 最后 10 秒：数字与进度条一起转红，数字开始脉冲；复位时全部还原 */
  private setCountdownWarning(active: boolean): void {
    this.warningActive = active;
    // 正文与描边一起换：告警红是中明度，只换正文的话配深暖棕边只有约 3.8:1，托不住
    this.countdownLabel?.setTextColor(active ? UI_COLOR.countdownWarning : UI_COLOR.textAccent);
    this.countdownLabel?.setOutlineColor(active ? UI_COLOR.countdownWarningOutline : UI_COLOR.textOutline);
    if (this.barFillNode) paintPanel(this.barFillNode, active ? UI_COLOR.countdownWarning : UI_COLOR.barFill);
    if (active) this.startPulse();
    else this.stopPulse();
  }

  /** 缩放脉冲：放大—还原往返循环；锚点在中心，不影响排版，只让数字"跳"起来 */
  private startPulse(): void {
    if (!this.countdownLabel || this.pulseTween) return;
    const node = this.countdownLabel.node;
    this.pulseTween = tween(node)
      .to(PULSE_HALF_PERIOD, { scale: new Vec3(PULSE_SCALE, PULSE_SCALE, 1) }, { easing: 'sineInOut' })
      .to(PULSE_HALF_PERIOD, { scale: new Vec3(1, 1, 1) }, { easing: 'sineInOut' })
      .union()
      .repeatForever()
      .start();
  }

  /** 停脉冲并复位缩放：重开一局时数字必须回到正常大小 */
  private stopPulse(): void {
    this.pulseTween?.stop();
    this.pulseTween = null;
    // 组件销毁时子节点已被先一步回收（Label 还在、node 已是 null），这里不能直接碰它
    const labelNode = this.countdownLabel?.node;
    if (labelNode && labelNode.isValid) labelNode.setScale(1, 1, 1);
  }

  /** 倒计时：整秒向上取整（开局正好 60、归零正好 0），进度条取剩余比例 */
  private renderCountdown(remainingMs: number): void {
    const seconds = Math.ceil(Math.max(0, remainingMs) / 1000);
    if (seconds !== this.lastSeconds) {
      this.lastSeconds = seconds;
      this.countdownLabel?.setText(`${STRINGS.countdownLabel} ${seconds}`);
    }

    const ratio = Math.min(1, Math.max(0, remainingMs / ROUND_DURATION_MS));
    // 归零时必须画到空，不能被阈值挡掉
    if (ratio === 0 || Math.abs(ratio - this.lastBarRatio) >= BAR_REDRAW_EPSILON) {
      this.lastBarRatio = ratio;
      this.drawBar(ratio);
    }
  }

  /** 分数 / 完成订单 / 连击：值没变就不重排文本（签名怎么取见 ui/renderSignatures.ts） */
  private renderStats(state: RenderPayload['state']): void {
    if (!this.statsRedraw.changed(hudStatsSignature(state))) return;
    const { score, servedOrders, comboCount } = state;

    this.statsLine?.setText([
      `${STRINGS.scoreLabel} ${score}`,
      `${STRINGS.ordersLabel} ${servedOrders}`,
      `${STRINGS.comboLabel} ${comboCount}`,
    ].join('　'));
  }
}
