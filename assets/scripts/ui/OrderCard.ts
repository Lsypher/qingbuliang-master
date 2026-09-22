import { _decorator, Node } from 'cc';
import { STRINGS } from '../config/strings';
import type { RenderPayload } from '../game/bus';
import { BusComponent } from '../game/busComponent';
import { renderIconRow } from './ingredientIcon';
import { SignatureGuard } from './redrawGuard';
import { orderCardSignature } from './renderSignatures';
import type { OutlinedText } from './uiFactory';
import { createOutlinedText, createUiNode, UI_COLOR } from './uiFactory';

const { ccclass } = _decorator;

/** 订单卡里"顾客要的配料"图标行：最多 6 项（1 汤底 + 5 小料），横排不挤 */
const ORDER_ICON_SIZE = 52;
const ORDER_ICON_GAP = 8;
/**
 * 图标行容器（设计像素）：宽取 `uiFactory` 里文字节点的默认宽（`TEXT_WIDTH`，当前 660），
 * 与同卡两行文字同宽，三行因此左右对齐——**那个默认宽改了，这里要跟着改**。
 * 图标在容器内居中排布（见 `iconRowLayout`），最多 6 项按 52 + 8 只需 352，
 * 所以这个宽是"留白同宽"而不是刚好塞满；收到 352 以下才会挤到图标行。
 */
const ORDER_ICON_ROW_WIDTH = 660;
/**
 * 容器高取"图标高 + 8"：容器既不裁剪子节点、内部也不做纵向排布，这个数不影响观感，
 * 沿用改动前的 8；改它只改盒子的名义尺寸。
 */
const ORDER_ICON_ROW_HEIGHT = ORDER_ICON_SIZE + 8;
/** 三行内容的纵向位置（设计像素，以订单卡中心为原点）：标题在上、图标行居中、已放进度在下；三行不重叠就是按这些值与 `ORDER_ICON_SIZE` 定的 */
const CARD_TITLE_Y = 45;
const CARD_ICONS_Y = -55;
const CARD_PROGRESS_Y = -155;
/** 标题与已放进度的字号（设计像素）：标题大一号，进度行小一号 */
const CARD_TITLE_FONT = 30;
const CARD_PROGRESS_FONT = 26;

/**
 * 订单卡：显示当前顾客要的那一碗，以及已经放进去几项。
 * 只订阅渲染事件重绘；已放入碗中的项在图标行里打勾变暗，剩下的保持原样。
 *
 * 三行内容整体压在下半区：顶部那条留给顶部信息条（倒计时与分数，见 HudView）。
 * 两行文字都带字形描边（来由与做法见 uiFactory.createOutlinedText）。
 */
@ccclass('OrderCard')
export class OrderCard extends BusComponent {
  private orderIcons: Node | null = null;
  /** 已放进度：本单已放入几项 / 共几项 */
  private progressLine: OutlinedText | null = null;
  /** 重绘守卫：订单与碗内容签名没变就跳过重绘（哨兵在守卫内部，见 ui/redrawGuard.ts） */
  private readonly redraw = new SignatureGuard();

  protected onViewLoad(): void {
    const title = createOutlinedText(this.node, 'CardTitle', STRINGS.orderTitle, CARD_TITLE_FONT, UI_COLOR.textBody, UI_COLOR.textOutline);
    title.node.setPosition(0, CARD_TITLE_Y, 0);
    // 顾客要的配料用图标行展示，与配料盘、碗里同一套图标
    this.orderIcons = createUiNode(this.node, 'OrderIcons', ORDER_ICON_ROW_WIDTH, ORDER_ICON_ROW_HEIGHT);
    this.orderIcons.setPosition(0, CARD_ICONS_Y, 0);
    this.progressLine = createOutlinedText(this.node, 'ProgressLine', '', CARD_PROGRESS_FONT, UI_COLOR.textBody, UI_COLOR.textOutline);
    this.progressLine.node.setPosition(0, CARD_PROGRESS_Y, 0);
  }

  protected onRendered(payload: RenderPayload): void {
    const { order, bowlIds } = payload.state;
    if (!this.redraw.changed(orderCardSignature(order, bowlIds))) return;

    const requiredIds = [order.baseId, ...order.toppingIds];
    if (this.orderIcons) {
      // 不另开"还差什么"的差集面板：打勾变暗已经说得清
      renderIconRow(this.orderIcons, requiredIds, ORDER_ICON_SIZE, ORDER_ICON_GAP, new Set(bowlIds));
    }
    this.progressLine?.setText(`${STRINGS.placedLabel} ${bowlIds.length} / ${requiredIds.length}`);
  }
}
