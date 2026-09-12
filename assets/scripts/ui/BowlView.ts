import { _decorator, Component, Label, Node } from 'cc';
import { ingredientName } from '../config/ingredients';
import { BOWL_DROP_ZONE_HEIGHT, BOWL_DROP_ZONE_WIDTH } from '../config/layout';
import { STRINGS } from '../config/strings';
import type { DragOverBowlPayload, RenderPayload } from '../game/bus';
import { BusEvent, bus } from '../game/bus';
import { createLabel, createUiNode, paintPanel, UI_COLOR } from './uiFactory';

const { ccclass } = _decorator;

/**
 * 碗：显示已经放进碗里的配料，按放入顺序排列。
 * 只有核心接受了的配料才会出现在这里，所以这里不需要任何判断。
 * 拖动悬停高亮也在这里画：它只听适配层的"落点在不在碗上"，自己不做几何判定。
 */
@ccclass('BowlView')
export class BowlView extends Component {
  private itemsLabel: Label | null = null;
  private highlightNode: Node | null = null;
  /** 用 null 而不是空串作"还没画过"的哨兵：空碗的签名恰好就是空串，否则首帧会被短路 */
  private lastSignature: string | null = null;

  protected onLoad(): void {
    // 高亮框与落点判定同源（同一份落区配置）：看得见的框即落区，判定再外扩容差一圈
    this.highlightNode = createUiNode(this.node, 'BowlHighlight', BOWL_DROP_ZONE_WIDTH, BOWL_DROP_ZONE_HEIGHT);
    paintPanel(this.highlightNode, UI_COLOR.bowlHighlightFill, UI_COLOR.bowlHighlightBorder);
    this.highlightNode.active = false;

    createLabel(this.node, 'BowlTitle', STRINGS.bowlTitle, 180, 30, UI_COLOR.textMuted);
    this.itemsLabel = createLabel(this.node, 'BowlItems', '', 0, 34, UI_COLOR.textPrimary);
    bus.on(BusEvent.Render, this.onRender, this);
    bus.on(BusEvent.DragOverBowl, this.onDragOverBowl, this);
  }

  protected onDestroy(): void {
    bus.off(BusEvent.Render, this.onRender, this);
    bus.off(BusEvent.DragOverBowl, this.onDragOverBowl, this);
  }

  protected onDisable(): void {
    // 拖到一半单局结束、页面被藏起来时，高亮不能再带到下一局
    if (this.highlightNode) this.highlightNode.active = false;
  }

  /** 悬停高亮只在"在/不在"翻转时动一下开关，反复来回拖动不会反复重绘 */
  private onDragOverBowl(payload: DragOverBowlPayload): void {
    if (!this.highlightNode) return;
    if (this.highlightNode.active === payload.overBowl) return;
    this.highlightNode.active = payload.overBowl;
  }

  private onRender(payload: RenderPayload): void {
    const { bowlIds } = payload.state;
    const signature = bowlIds.join(',');
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;

    if (!this.itemsLabel) return;
    this.itemsLabel.string = bowlIds.length === 0 ? STRINGS.bowlEmpty : bowlIds.map(ingredientName).join('、');
  }
}
