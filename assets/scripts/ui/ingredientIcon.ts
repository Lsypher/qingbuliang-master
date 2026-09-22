import { Color, Node, Sprite, SpriteFrame, UITransform } from 'cc';
import { STRINGS } from '../config/strings';
import { iconRowLayout } from './iconRowLayout';
import { createOutlinedText, createUiNode, loadSpriteFrame, UI_COLOR } from './uiFactory';

/**
 * 配料图标目录：12 张原创手绘透明底 PNG，文件名即配料 id。
 * 与背景图同理——换图（同名替换）不动代码、也无需回编辑器接线；
 * 只有增删配料才需要改 `config/ingredients.ts`。
 */
export const INGREDIENT_DIR = 'art/ingredients';

/**
 * 配料图标帧的共享缓存：按 id 存 SpriteFrame（加载失败记 null）。
 *
 * 谁拥有资源谁预载：过场期间由配料盘统一把 12 张图加载进来（见 IngredientTray.preloadIcons，
 * 它内部走的就是下面的 `loadIngredientFrame`，结果会自动写进这份缓存）。订单卡、碗、跟手幽灵等
 * 所有用到配料图标的地方，都从这份缓存**同步**取用——过场放行时早已就绪，进单局页那一帧就位、
 * 不逐格冒出，与背景预载同理。只有"还没预载到"才退回异步加载（兜底，理论上不会走到）。
 *
 * 用模块级单例而非各组件各自缓存：避免配料盘、订单卡各维护一份、彼此不同步；
 * 全部图标的预载与取用都收口到本文件。
 */
const ingredientFrameCache = new Map<string, SpriteFrame | null>();

/** 取某配料已预载到手的帧：未预载返回 undefined、预载失败返回 null、成功返回帧 */
function getCachedIngredientFrame(id: string): SpriteFrame | null | undefined {
  return ingredientFrameCache.get(id);
}

/**
 * "已在碗里"的图标压暗到这个不透明度：还能认出是什么，但明显退到背景里去。
 * 只压暗精灵本体（改 Sprite 的 alpha），打勾标记是子节点、不受影响，勾始终是亮的。
 */
const CHECKED_ALPHA = 110;

/**
 * 异步取某配料的图标 SpriteFrame；路径固定为 `${INGREDIENT_DIR}/${id}`。
 * 加载失败回调 null，由调用方决定是否兜底（目前配料盘/碗/订单卡都只显示标签，不致命）。
 * 取图本身走界面统一的加载入口，这里只留"配料 id → 路径"这一段本模块自己的约定。
 */
export function loadIngredientFrame(id: string, onLoad: (frame: SpriteFrame | null) => void): void {
  loadSpriteFrame(`${INGREDIENT_DIR}/${id}`, (frame, error) => {
    // 无论成败都写进共享缓存：成功存入帧、失败存 null 以标记"已决"，
    // 订单卡等下游就能同步识别"加载过但没拿到"，不重复读盘也不阻塞进局。
    ingredientFrameCache.set(id, frame);
    if (!frame) {
      console.warn('[ingredientIcon] 图标加载失败，已跳过', id, error);
      onLoad(null);
      return;
    }
    onLoad(frame);
  });
}

/**
 * 建一个图标节点（挂 Sprite）并填上对应配料图标。
 * `size` 是格子边长：图标按原图比例 contain 进格子（不拉伸变形），节点锚点居中，方便横排对齐。
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
  // 用 CUSTOM：图标被拉到格子大小；但实际尺寸由下面 apply 按原图比例收成 contain，
  // 避免手绘图内容非正方形时被塞进正方形格子压扁/拉长（auto-trim 后会裁到内容包围盒）。
  sprite.sizeMode = Sprite.SizeMode.CUSTOM;

  // 贴帧并做 contain 适配：保持原图宽高比，整体塞进 size×size 的格子内（取较小缩放），不拉伸。
  const apply = (frame: SpriteFrame): void => {
    sprite.spriteFrame = frame;
    const iw = frame.width;
    const ih = frame.height;
    if (iw > 0 && ih > 0) {
      const scale = Math.min(size / iw, size / ih);
      const transform = node.getComponent(UITransform);
      if (transform) transform.setContentSize(iw * scale, ih * scale);
    }
  };

  // 贴图优先级：显式传入的预载帧 > 共享缓存里的帧 > 异步加载兜底（缓存由过场预载写入，见文件头）
  if (preloadedFrame !== undefined) {
    // 传了预载帧：null 表示预载失败，不赋图、只留中文标签兜底
    if (preloadedFrame) apply(preloadedFrame);
  } else {
    const cached = getCachedIngredientFrame(id);
    if (cached) {
      apply(cached);
    } else if (cached === null) {
      // 已决且失败：不再重复读盘，只留中文标签兜底
    } else {
      // 还没预载到（理论上过场放行时早已就绪，这里只是兜底）：异步加载并写回缓存
      loadIngredientFrame(id, (frame) => {
        // 等待期间节点可能已被销毁（跟手幽灵抬手即拆、图标行重建）：销毁后 sprite.node 被置空，
        // 此时再赋 spriteFrame 会让引擎内部访问 null 崩溃，必须先校验
        if (frame && node.isValid && sprite.isValid) apply(frame);
      });
    }
  }
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

  const positions = iconRowLayout(total, iconSize, gap);
  ids.forEach((id, index) => {
    const icon = createIngredientIcon(container, id, iconSize, `Icon_${id}_${index}`);
    icon.setPosition(positions[index], 0, 0);
    if (checkedIds?.has(id)) markChecked(icon, iconSize);
  });
}

/** 标出"已在碗里"：图标压暗，右上角盖一个亮绿勾，还差哪几项一眼可见 */
function markChecked(icon: Node, iconSize: number): void {
  const sprite = icon.getComponent(Sprite);
  if (sprite) sprite.color = new Color(sprite.color.r, sprite.color.g, sprite.color.b, CHECKED_ALPHA);

  // 勾按图标真实尺寸定位（图标已按比例 contain 进格子，尺寸可能小于格子），落在右上角不挡配料
  const transform = icon.getComponent(UITransform);
  const w = transform ? transform.width : iconSize;
  const h = transform ? transform.height : iconSize;
  const check = createOutlinedText(
    icon,
    'OrderCheck',
    STRINGS.orderCheckMark,
    Math.round(Math.min(w, h) * 0.5),
    UI_COLOR.orderCheck,
    UI_COLOR.orderCheckOutline,
    Math.min(w, h),
  ).node;
  check.setPosition(w * 0.28, h * 0.28, 0);
}
