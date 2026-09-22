import { _decorator, Component, Node } from 'cc';
import { STRINGS } from '../config/strings';
import type { DragOverBowlPayload, RenderPayload } from '../game/bus';
import { BusEvent, bus } from '../game/bus';
import { BOWL_DROP_ZONE } from '../game/dropZone';
import { renderIconRow } from './ingredientIcon';
import { SignatureGuard } from './redrawGuard';
import type { OutlinedText } from './uiFactory';
import { createOutlinedText, createUiNode, paintPanel, UI_COLOR } from './uiFactory';

/** 碗里图标大小与间距：最多 6 项（1 汤底 + 5 小料），按这个尺寸横排只需 444 */
const BOWL_ICON_SIZE = 64;
const BOWL_ICON_GAP = 12;
/**
 * 图标行的宽（设计像素）：取的是"碗区内容宽度"，两端各让开一点，图标行不压到高亮框的边。
 * 别再从落区宽减一个数算出来——两者语义无关，捆在一起会一起漂。
 */
const BOWL_ICON_ROW_WIDTH = 560;
/** 碗区两行文字的纵向位置与字号（设计像素，以碗区中心为原点）：标题在上，空碗提示居中；与图标行（`BowlIcons`）不重叠就是按这两组值定的 */
const BOWL_TITLE_Y = 180;
const BOWL_TITLE_FONT = 30;
const BOWL_EMPTY_Y = 10;
const BOWL_EMPTY_FONT = 34;

const { ccclass } = _decorator;

/**
 * 碗：显示已经放进碗里的配料，按放入顺序排列。
 * 只有核心接受了的配料才会出现在这里，所以这里不需要任何判断。
 * 拖动悬停高亮也在这里画：它只听适配层的"落点在不在碗上"，自己不做几何判定。
 *
 * 标题与空碗提示都带字形描边（来由与做法见 uiFactory.createOutlinedText）。
 */
@ccclass('BowlView')
export class BowlView extends Component {
  /** 空碗提示：碗里有料时换成图标行（见 onRender） */
  private emptyHint: OutlinedText | null = null;
  private iconRow: Node | null = null;
  private highlightNode: Node | null = null;
  /** 重绘守卫：碗内容签名没变就跳过重绘（null 哨兵在守卫内部，见 ui/redrawGuard.ts） */
  private readonly redraw = new SignatureGuard();

  protected onLoad(): void {
    // 尺寸取自落区模块：这里画的是**本体**那一圈（判定比它多一圈容差，见 game/dropZone.ts 文件头）
    this.highlightNode = createUiNode(this.node, 'BowlHighlight', BOWL_DROP_ZONE.visualWidth, BOWL_DROP_ZONE.visualHeight);
    paintPanel(this.highlightNode, UI_COLOR.bowlHighlightFill, UI_COLOR.bowlHighlightBorder);
    this.highlightNode.active = false;

    const title = createOutlinedText(this.node, 'BowlTitle', STRINGS.bowlTitle, BOWL_TITLE_FONT, UI_COLOR.textBody, UI_COLOR.textOutline);
    title.node.setPosition(0, BOWL_TITLE_Y, 0);
    // 图标行与配料盘、订单卡共用 ingredientIcon 那一套图标
    this.emptyHint = createOutlinedText(this.node, 'BowlEmptyHint', '', BOWL_EMPTY_FONT, UI_COLOR.textBody, UI_COLOR.textOutline);
    this.emptyHint.node.setPosition(0, BOWL_EMPTY_Y, 0);
    this.iconRow = createUiNode(this.node, 'BowlIcons', BOWL_ICON_ROW_WIDTH, BOWL_ICON_SIZE);
    this.iconRow.setPosition(0, 10, 0);
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
    if (!this.redraw.changed(bowlIds.join(','))) return;

    const empty = bowlIds.length === 0;
    // 空碗只留提示文字；有料时改由图标行展示
    if (this.emptyHint) {
      this.emptyHint.node.active = empty;
      this.emptyHint.setText(empty ? STRINGS.bowlEmpty : '');
    }
    if (this.iconRow) {
      this.iconRow.active = !empty;
      if (!empty) renderIconRow(this.iconRow, bowlIds, BOWL_ICON_SIZE, BOWL_ICON_GAP);
    }
  }
}
