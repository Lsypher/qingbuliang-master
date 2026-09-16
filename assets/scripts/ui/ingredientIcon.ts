import { Color, Node, Sprite, SpriteFrame } from 'cc';
import { STRINGS } from '../config/strings';
import { createOutlinedText, createUiNode, loadSpriteFrame, UI_COLOR } from './uiFactory';

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
 * "已在碗里"的图标压暗到这个不透明度：还能认出是什么，但明显退到背景里去。
 * 只压暗精灵本体（改 Sprite 的 alpha），打勾标记是子节点、不受影响，勾始终是亮的。
 */
const CHECKED_ALPHA = 110;

/**
 * 异步取某配料的图标 SpriteFrame；路径固定为 `${INGREDIENT_DIR}/${id}`。
 * 加载失败回调 null，由调用方决定是否兜底（目前托盘/碗/订单卡都只显示标签，不致命）。
 * 取图本身走界面统一的加载入口，这里只留"配料 id → 路径"这一段本模块自己的约定。
 */
export function loadIngredientFrame(id: string, onLoad: (frame: SpriteFrame | null) => void): void {
  loadSpriteFrame(`${INGREDIENT_DIR}/${id}`, (frame, error) => {
    if (!frame) {
      console.warn('[ingredientIcon] 图标加载失败，已跳过', id, error);
      onLoad(null);
      return;
    }
    onLoad(frame);
  });
}

/**
 * 建一个图标节点（挂 Sprite）并填上对应配料图标；可选染色用于区分撞脸项。
 * 图标尺寸由调用方给定，节点锚点居中，方便横排对齐。
 *
 * `preloadedFrame` 为已预载到手的帧（过场期间先加载的那一份）：
 * - 传 `undefined` → 走正常异步加载（标盘之外、缓存未热的路径才用）；
 * - 传**有效帧** → 同步贴上，配料盘建格子的那一帧图标就位，不出现逐格冒出的过程；
 * - 传 `null` → 预载失败，沿用既有兜底（只显示中文标签），这一格不阻塞进局。
 */
export function createIngredientIcon(
  parent: Node,
  id: string,
  size: number,
  name = 'Icon',
  preloadedFrame?: SpriteFrame | null,
): Node {
  const node = createUiNode(parent, name, size, size);
  const sprite = node.addComponent(Sprite);
  // 用节点尺寸而非图片自身尺寸：图标被拉到格子/行里的大小，而不是变成 256×256
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;
  const tint = ingredientTint(id);
  if (tint) sprite.color = tint;
  if (preloadedFrame === undefined) {
    loadIngredientFrame(id, (frame) => {
      // 资源是异步加载的：等待期间节点/组件可能已被销毁（跟手幽灵抬手即拆、图标行重建等）。
      // 销毁后 sprite.node 会被置空，此时再赋 spriteFrame 会让引擎内部访问 null 崩溃，必须先校验。
      if (frame && node.isValid && sprite.isValid) sprite.spriteFrame = frame;
    });
  } else if (preloadedFrame) {
    // 预载已到手：同步贴上，首帧就位
    sprite.spriteFrame = preloadedFrame;
  }
  // preloadedFrame === null：预载失败，沿用兜底（不赋图，只显示中文标签）
  return node;
}

/**
 * 在容器里把一批配料横排成图标行：先清掉上一帧的图标（Icon_ 前缀，避免误删别的子节点），
 * 再按需新建。碗里与订单卡共用本函数，保证两处是同一套图标、同一套排布逻辑。
 *
 * 传了 `checkedIds` 就把命中的项画成"已放入碗中"（变暗 + 打勾）——只有订单卡会传，
 * 碗里的图标本来就是"已放入"，不需要再标一次。
 */
export function renderIconRow(
  container: Node,
  ids: readonly string[],
  iconSize: number,
  gap: number,
  checkedIds?: ReadonlySet<string>,
): void {
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
    if (checkedIds?.has(id)) markChecked(icon, iconSize);
  });
}

/** 标出"已在碗里"：图标压暗，右上角盖一个亮绿勾，还差哪几项一眼可见 */
function markChecked(icon: Node, iconSize: number): void {
  const sprite = icon.getComponent(Sprite);
  if (sprite) sprite.color = new Color(sprite.color.r, sprite.color.g, sprite.color.b, CHECKED_ALPHA);

  const check = createOutlinedText(
    icon,
    'OrderCheck',
    STRINGS.orderCheckMark,
    Math.round(iconSize * 0.5),
    UI_COLOR.orderCheck,
    UI_COLOR.orderCheckShadow,
    iconSize,
  );
  // 落在图标右上角：勾只占角上一小块，不挡住配料本身
  check.setPosition(iconSize * 0.28, iconSize * 0.28, 0);
}
