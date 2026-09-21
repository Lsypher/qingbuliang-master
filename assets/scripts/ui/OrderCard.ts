import { _decorator, Component, Label, Node } from 'cc';
import { STRINGS } from '../config/strings';
import type { RenderPayload } from '../game/bus';
import { BusEvent, bus } from '../game/bus';
import { renderIconRow } from './ingredientIcon';
import { SignatureGuard } from './redrawGuard';
import { createLabel, createUiNode, UI_COLOR } from './uiFactory';

const { ccclass } = _decorator;

/** 订单卡里"顾客要的配料"图标行：最多 6 项（1 汤底 + 5 小料），横排不挤 */
const ORDER_ICON_SIZE = 52;
const ORDER_ICON_GAP = 8;

/**
 * 订单卡：显示当前顾客要的那一碗，以及已经放进去几项。
 * 只订阅渲染事件重绘；已放入碗中的项在图标行里打勾变暗，剩下的保持原样。
 *
 * 三行内容整体压在下半区：顶部那条留给顶部信息条（倒计时与分数，见 HudView）。
 */
@ccclass('OrderCard')
export class OrderCard extends Component {
  private orderIcons: Node | null = null;
  private progressLabel: Label | null = null;
  /** 重绘守卫：订单与碗内容签名没变就跳过重绘（哨兵在守卫内部，见 ui/redrawGuard.ts） */
  private readonly redraw = new SignatureGuard();

  protected onLoad(): void {
    createLabel(this.node, 'CardTitle', STRINGS.orderTitle, 45, 30, UI_COLOR.textMuted);
    // 顾客要的配料用图标行展示，与托盘、碗里同一套图标
    this.orderIcons = createUiNode(this.node, 'OrderIcons', 660, ORDER_ICON_SIZE + 8);
    this.orderIcons.setPosition(0, -55, 0);
    this.progressLabel = createLabel(this.node, 'ProgressLine', '', -155, 26, UI_COLOR.textMuted);
    bus.on(BusEvent.Render, this.onRender, this);
  }

  protected onDestroy(): void {
    bus.off(BusEvent.Render, this.onRender, this);
  }

  private onRender(payload: RenderPayload): void {
    const { order, bowlIds } = payload.state;
    const signature = [order.baseId, order.toppingIds.join(','), bowlIds.join(',')].join('|');
    if (!this.redraw.changed(signature)) return;

    const requiredIds = [order.baseId, ...order.toppingIds];
    if (this.orderIcons) {
      // 不另开"还差什么"的差集面板：打勾变暗已经说得清
      renderIconRow(this.orderIcons, requiredIds, ORDER_ICON_SIZE, ORDER_ICON_GAP, new Set(bowlIds));
    }
    if (this.progressLabel) {
      this.progressLabel.string = `${STRINGS.placedLabel} ${bowlIds.length} / ${requiredIds.length}`;
    }
  }
}
