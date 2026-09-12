import { Color, Node, resources, Sprite, SpriteFrame } from 'cc';
import { createUiNode } from './uiFactory';

/**
 * 配料图标目录：12 张 Fluent Emoji 3D PNG，文件名即配料 id。
 * 与背景图同理——换图（同名替换）不动代码、也无需回编辑器接线；
 * 只有增删配料才需要改 `config/ingredients.ts`。
 */
export const INGREDIENT_DIR = 'art/ingredients';

/**
 * 靠颜色区分"撞脸"项：红豆与绿豆共用同一张 Beans 图标，
 * 这里把绿豆染成绿色、红豆保持原色偏红，肉眼即可分辨（标签也兜底区分）。
 */
const INGREDIENT_TINT: ReadonlyMap<string, Color> = new Map([
  ['red_bean', new Color(255, 140, 130, 255)],
  ['mung_bean', new Color(120, 215, 110, 255)],
]);

/** 取某配料的图标染色（无染色返回 null） */
export function ingredientTint(id: string): Color | null {
  return INGREDIENT_TINT.get(id) ?? null;
}

/**
 * 异步取某配料的图标 SpriteFrame；路径固定为 `${INGREDIENT_DIR}/${id}/spriteFrame`。
 * 加载失败回调 null，由调用方决定是否兜底（目前托盘/碗/订单卡都只显示标签，不致命）。
 * Cocos 按 uuid 缓存已加载资源，重复调用同一 id 不会重复读盘。
 */
export function loadIngredientFrame(id: string, onLoad: (frame: SpriteFrame | null) => void): void {
  resources.load(`${INGREDIENT_DIR}/${id}/spriteFrame`, SpriteFrame, (error, frame) => {
    if (error) {
      console.warn('[ingredientIcon] 图标加载失败，已跳过', id, error);
      onLoad(null);
      return;
    }
    onLoad(frame);
  });
}

/**
 * 建一个图标节点（挂 Sprite）并异步填上对应配料图标；可选染色用于区分撞脸项。
 * 图标尺寸由调用方给定，节点锚点居中，方便横排对齐。
 */
export function createIngredientIcon(parent: Node, id: string, size: number, name = 'Icon'): Node {
  const node = createUiNode(parent, name, size, size);
  const sprite = node.addComponent(Sprite);
  // 用节点尺寸而非图片自身尺寸：图标被拉到格子/行里的大小，而不是变成 256×256
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  const tint = ingredientTint(id);
  if (tint) sprite.color = tint;
  loadIngredientFrame(id, (frame) => {
    if (frame) sprite.spriteFrame = frame;
  });
  return node;
}

/**
 * 在容器里把一批配料横排成图标行：先清掉上一帧的图标（Icon_ 前缀，避免误删别的子节点），
 * 再按需新建。碗里与订单卡共用本函数，保证两处是同一套图标、同一套排布逻辑。
 */
export function renderIconRow(container: Node, ids: readonly string[], iconSize: number, gap: number): void {
  for (const child of [...container.children]) {
    if (child.name.startsWith('Icon_')) child.destroy();
  }
  const total = ids.length;
  if (total === 0) return;

  const step = iconSize + gap;
  const startX = -((total - 1) / 2) * step;
  ids.forEach((id, index) => {
    const icon = createIngredientIcon(container, id, iconSize, `Icon_${id}_${index}`);
    icon.setPosition(startX + index * step, 0, 0);
  });
}
