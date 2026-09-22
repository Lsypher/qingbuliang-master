import { Color, Node } from 'cc';
import { ingredientName } from '../config/ingredients';
import { createIngredientIcon } from './ingredientIcon';
import { createLabel, createUiNode, paintPanel, UI_COLOR } from './uiFactory';

/**
 * 配料幽灵（Ingredient Ghost）：玩家"手里那一份配料"的样子——小面板 + 配料图标 + 中文名。
 *
 * 有两处要用它，画法必须一致，所以只有这一处实现：拖动时的跟手幽灵（见 ui/IngredientTray.ts）
 * 与错放时的弹回幽灵（见 ui/MisdropFeedback.ts）——后者要让人一眼认出"飞回去的就是刚才那一份"，
 * 两个幽灵长得不一样就等于把这个线索丢了。
 *
 * 调用方只决定**在哪、叫什么、描边用哪支色**：描边色是唯一有意保留的差异——
 * 跟手用强调色（"手里拿着东西"），弹回用错放红（"这一份放错了"）。
 */

/**
 * 幽灵尺寸（设计像素）：比配料盘格子小一号，跟着手指走又不挡太多视线。
 * 两个用途共用同一个尺寸，换尺寸就两处一起变。
 */
const GHOST_WIDTH = 120;
const GHOST_HEIGHT = 64;

/**
 * 图标与名称在幽灵里的位置（设计像素，以幽灵中心为原点）：图标在上、名称在下。
 * 图标 36 比配料盘格子里的 52 小一圈，给下方名称让出高度；名称字号 18 随图标一起收小，
 * "两者不重叠"就是按这三个数定的，改一个要连相邻的一起看。
 */
const GHOST_ICON_SIZE = 36;
const GHOST_ICON_Y = 12;
const GHOST_LABEL_Y = -16;
const GHOST_LABEL_FONT = 18;
/** 名称框宽（设计像素）：比幽灵两端各让出 6，长名字不贴边 */
const GHOST_LABEL_WIDTH = GHOST_WIDTH - 12;

/**
 * 造一份配料幽灵。建出来就已经摆到位（`at` 是父节点的局部坐标），调用方不必再 `setPosition`——
 * 免得两处调用里有一处漏摆，幽灵停在父节点原点。
 *
 * 缺图不在这里兜底：走 `createIngredientIcon` 的既有兜底（只显示中文名），与配料盘格子同一套。
 */
export function createIngredientGhost(
  parent: Node,
  options: {
    ingredientId: string;
    /** 节点名：层级面板里靠它区分是跟手幽灵还是弹回幽灵 */
    name: string;
    /** 描边色：跟手传 `UI_COLOR.textAccent`，弹回传 `UI_COLOR.misdropText` */
    border: Color;
    /** 落位（父节点的局部坐标） */
    at: { x: number; y: number };
  },
): Node {
  const ghost = createUiNode(parent, options.name, GHOST_WIDTH, GHOST_HEIGHT);
  paintPanel(ghost, UI_COLOR.panel, options.border);

  const icon = createIngredientIcon(ghost, options.ingredientId, GHOST_ICON_SIZE, 'Icon');
  icon.setPosition(0, GHOST_ICON_Y, 0);
  // id 非法时 ingredientName 原样返回 id，显示一个短英文名比显示空白强（见 config/ingredients.ts）
  const label = ingredientName(options.ingredientId);
  createLabel(ghost, 'Name', label, GHOST_LABEL_Y, GHOST_LABEL_FONT, UI_COLOR.textPrimary, GHOST_LABEL_WIDTH);

  ghost.setPosition(options.at.x, options.at.y, 0);
  return ghost;
}
