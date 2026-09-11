import { _decorator, Component, Label } from 'cc';
import { getIngredient } from '../config/ingredients';
import { STRINGS } from '../config/strings';
import type { RenderPayload } from '../game/bus';
import { BusEvent, bus } from '../game/bus';
import { createLabel, UI_COLOR } from './uiFactory';

const { ccclass } = _decorator;

/**
 * 碗：显示已经放进碗里的配料，按放入顺序排列。
 * 只有核心接受了的配料才会出现在这里，所以这里不需要任何判断。
 */
@ccclass('BowlView')
export class BowlView extends Component {
  private itemsLabel: Label | null = null;
  /** 用 null 而不是空串作"还没画过"的哨兵：空碗的签名恰好就是空串，否则首帧会被短路 */
  private lastSignature: string | null = null;

  protected onLoad(): void {
    createLabel(this.node, 'BowlTitle', STRINGS.bowlTitle, 180, 30, UI_COLOR.textMuted);
    this.itemsLabel = createLabel(this.node, 'BowlItems', '', 0, 34, UI_COLOR.textPrimary);
    bus.on(BusEvent.Render, this.onRender, this);
  }

  protected onDestroy(): void {
    bus.off(BusEvent.Render, this.onRender, this);
  }

  private onRender(payload: RenderPayload): void {
    const { bowlIds } = payload.state;
    const signature = bowlIds.join(',');
    if (signature === this.lastSignature) return;
    this.lastSignature = signature;
    this.lastSignature = signature;

    if (!this.itemsLabel) return;
    this.itemsLabel.string = bowlIds.length === 0 ? STRINGS.bowlEmpty : bowlIds.map(ingredientName).join('、');
  }
}

function ingredientName(ingredientId: string): string {
  const ingredient = getIngredient(ingredientId);
  return ingredient ? ingredient.name : ingredientId;
}
