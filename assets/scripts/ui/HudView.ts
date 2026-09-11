import { _decorator, Component, Label, Node } from 'cc';
import { ROUND_DURATION_MS } from '../config/balance';
import { STRINGS } from '../config/strings';
import type { RenderPayload } from '../game/bus';
import { BusEvent, bus } from '../game/bus';
import { createLabel, createUiNode, paintPanel, UI_COLOR } from './uiFactory';

const { ccclass } = _decorator;

/** 倒计时进度条尺寸：填充从左端起，随剩余时间收短 */
const BAR_WIDTH = 560;
const BAR_HEIGHT = 14;
/** 进度条重绘阈值：比例变化小于此值就不动（560 像素宽下约 1 像素，省掉绝大多数帧的重绘） */
const BAR_REDRAW_EPSILON = 0.002;

/**
 * 顶部信息条：倒计时（数字 + 进度条）、分数、完成订单、连击。
 *
 * 倒计时完全由核心给出的 `remainingMs` 推导——数字向上取整到秒、进度条取剩余比例，
 * 两者同源，所以"数字与进度条一致"是天然成立而不是靠对齐维护的。
 * 最后 10 秒变红脉冲留给 10 切片。
 */
@ccclass('HudView')
export class HudView extends Component {
  private countdownLabel: Label | null = null;
  private lineLabel: Label | null = null;
  /** 进度条填充节点：用 x 缩放表示剩余比例，比每帧重画 Graphics 便宜 */
  private barFillNode: Node | null = null;

  private lastSeconds = -1;
  private lastBarRatio = -1;
  private lastSignature: string | null = null;

  protected onLoad(): void {
    this.buildCountdown();
    this.lineLabel = createLabel(this.node, 'HudLine', '', 528, 24, UI_COLOR.textMuted);
    bus.on(BusEvent.Render, this.onRender, this);
  }

  protected onDestroy(): void {
    bus.off(BusEvent.Render, this.onRender, this);
  }

  /** 倒计时区：上一行数字，下一行进度条 */
  private buildCountdown(): void {
    this.countdownLabel = createLabel(this.node, 'CountdownLabel', '', 604, 34, UI_COLOR.textAccent);

    const track = createUiNode(this.node, 'CountdownBar', BAR_WIDTH, BAR_HEIGHT, 566);
    paintPanel(track, UI_COLOR.barTrack);

    // 整条先画满一次，之后只靠缩放和位移表示剩余比例——比每帧重画 Graphics 便宜
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

  private onRender(payload: RenderPayload): void {
    this.renderCountdown(payload.state.remainingMs);
    this.renderStats(payload.state);
  }

  /** 倒计时：整秒向上取整（开局正好 60、归零正好 0），进度条取剩余比例 */
  private renderCountdown(remainingMs: number): void {
    const seconds = Math.ceil(Math.max(0, remainingMs) / 1000);
    if (seconds !== this.lastSeconds) {
      this.lastSeconds = seconds;
      if (this.countdownLabel) this.countdownLabel.string = `${STRINGS.countdownLabel} ${seconds}`;
    }

    const ratio = Math.min(1, Math.max(0, remainingMs / ROUND_DURATION_MS));
    // 归零时必须画到空，不能被阈值挡掉
    if (ratio === 0 || Math.abs(ratio - this.lastBarRatio) >= BAR_REDRAW_EPSILON) {
      this.lastBarRatio = ratio;
      this.drawBar(ratio);
    }
  }

  /** 分数 / 完成订单 / 连击：值没变就不重排文本 */
  private renderStats(state: RenderPayload['state']): void {
    const { score, servedOrders, comboCount } = state;
    const signature = `${score}|${servedOrders}|${comboCount}`;
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;

    if (!this.lineLabel) return;
    this.lineLabel.string = [
      `${STRINGS.scoreLabel} ${score}`,
      `${STRINGS.ordersLabel} ${servedOrders}`,
      `${STRINGS.comboLabel} ${comboCount}`,
    ].join('　');
  }
}
