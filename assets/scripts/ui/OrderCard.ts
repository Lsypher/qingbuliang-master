import { _decorator, Component, Label } from 'cc';
import { ingredientName } from '../config/ingredients';
import { STRINGS } from '../config/strings';
import type { RenderPayload } from '../game/bus';
import { BusEvent, bus } from '../game/bus';
import { createLabel, UI_COLOR } from './uiFactory';

const { ccclass } = _decorator;

/**
 * 订单卡：显示当前顾客要的那一碗，以及已经放进去几项。
 * 只订阅渲染事件重绘；"还差哪几项打勾变暗"留给 10 切片。
 *
 * 三行内容整体压在下半区：顶部那条留给 04 切片的倒计时（数字 + 进度条）与分数行。
 */
@ccclass('OrderCard')
export class OrderCard extends Component {
  private orderLabel: Label | null = null;
  private progressLabel: Label | null = null;
  private lastSignature: string | null = null;

  protected onLoad(): void {
    createLabel(this.node, 'CardTitle', STRINGS.orderTitle, 45, 30, UI_COLOR.textMuted);
    this.orderLabel = createLabel(this.node, 'OrderLine', '', -55, 40, UI_COLOR.textAccent);
    this.progressLabel = createLabel(this.node, 'ProgressLine', '', -155, 26, UI_COLOR.textMuted);
    bus.on(BusEvent.Render, this.onRender, this);
  }

  protected onDestroy(): void {
    bus.off(BusEvent.Render, this.onRender, this);
  }

  private onRender(payload: RenderPayload): void {
    const { order, bowlIds } = payload.state;
    const signature = [order.baseId, order.toppingIds.join(','), bowlIds.join(',')].join('|');
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;

    const requiredIds = [order.baseId, ...order.toppingIds];
    if (this.orderLabel) this.orderLabel.string = requiredIds.map(ingredientName).join(' + ');
    if (this.progressLabel) {
      this.progressLabel.string = `${STRINGS.placedLabel} ${bowlIds.length} / ${requiredIds.length}`;
    }
  }
}
