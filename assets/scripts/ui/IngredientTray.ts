import { _decorator, Button, Component, Node } from 'cc';
import { ALL_INGREDIENTS } from '../config/ingredients';
import { BusEvent, bus } from '../game/bus';
import { createLabel, createUiNode, paintPanel, UI_COLOR } from './uiFactory';

const { ccclass } = _decorator;

/** 配料盘格子排布：4 列 × 3 行正好填满 12 格 */
const COLUMN_COUNT = 4;
const COLUMN_SPACING = 180;
const ROW_SPACING = 118;
const SLOT_WIDTH = 160;
const SLOT_HEIGHT = 96;

/**
 * 配料盘：把 12 格配料摆出来，负责"玩家点了哪一格"。
 * 它不知道规则——点一下只发一条事件，放不放得进碗由核心决定。
 */
@ccclass('IngredientTray')
export class IngredientTray extends Component {
  private slotNodes = new Map<string, Node>();

  protected onLoad(): void {
    this.buildSlots();
  }

  protected onDestroy(): void {
    this.slotNodes.clear();
  }

  /** 供拖动（06 切片）查询某格节点 */
  getSlotNode(ingredientId: string): Node | null {
    return this.slotNodes.get(ingredientId) ?? null;
  }

  private buildSlots(): void {
    ALL_INGREDIENTS.forEach((ingredient, index) => {
      const column = index % COLUMN_COUNT;
      const row = Math.floor(index / COLUMN_COUNT);
      const x = (column - (COLUMN_COUNT - 1) / 2) * COLUMN_SPACING;
      const y = -row * ROW_SPACING;

      const slot = createUiNode(this.node, `Slot_${ingredient.id}`, SLOT_WIDTH, SLOT_HEIGHT, y, x);
      paintPanel(slot, UI_COLOR.panel, UI_COLOR.panelBorder);

      // 汤底与小料用不同字色区分，避免一眼看混两类
      const labelColor = ingredient.category === 'base' ? UI_COLOR.textAccent : UI_COLOR.textPrimary;
      createLabel(slot, 'Name', ingredient.name, 0, 26, labelColor, SLOT_WIDTH - 16);

      const button = slot.addComponent(Button);
      button.transition = Button.Transition.NONE;
      const ingredientId = ingredient.id;
      slot.on(Button.EventType.CLICK, () => this.onSlotClicked(ingredientId), this);

      this.slotNodes.set(ingredientId, slot);
    });
  }

  private onSlotClicked(ingredientId: string): void {
    // 只上报"玩家点了谁"，判定权在核心
    bus.emit(BusEvent.DropIngredient, ingredientId);
  }
}
