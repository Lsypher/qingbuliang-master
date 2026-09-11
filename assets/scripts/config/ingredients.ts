/**
 * 配料表：12 格配料池的静态定义（3 汤底 + 9 小料）。
 * 纯数据、无逻辑、不依赖引擎；id 同时用作图标文件名，改名等于换图。
 */

/** 配料分类：汤底是液体基底，小料是固态配料 */
export type IngredientCategory = 'base' | 'topping';

export interface IngredientDef {
  /** 稳定标识，同时是图标文件名 */
  id: string;
  /** 界面上的中文短标签，也是玩家的识别主通道 */
  name: string;
  category: IngredientCategory;
  /** 取图用的 emoji 素材名（对应 Fluent Emoji 的素材目录名） */
  emojiAsset: string;
  /** 图标与素材的落差说明：没有直接对应图标时写清用哪个近似 */
  iconNote?: string;
}

/** 汤底：一碗清补凉恰好一种 */
export const BASE_POOL: readonly IngredientDef[] = [
  { id: 'coconut_milk', name: '椰奶', category: 'base', emojiAsset: 'Glass of milk', iconNote: '近似牛奶杯' },
  { id: 'coconut_water', name: '椰子水', category: 'base', emojiAsset: 'Coconut' },
  { id: 'brown_sugar_water', name: '红糖水', category: 'base', emojiAsset: 'Bubble tea', iconNote: '近似棕色饮品' },
];

/**
 * 小料：订单里要求 3~5 种。
 * 选型原则是"颜色 + 形状两两不撞脸"，所以真正的海南配料里略掉了芋头块（撞芋圆）等项。
 */
export const TOPPING_POOL: readonly IngredientDef[] = [
  { id: 'red_bean', name: '红豆', category: 'topping', emojiAsset: 'Beans' },
  { id: 'mung_bean', name: '绿豆', category: 'topping', emojiAsset: 'Beans', iconNote: '与红豆同一图标，需换成绿色' },
  { id: 'sago', name: '西米', category: 'topping', emojiAsset: 'Cooked rice', iconNote: '近似白米粒' },
  { id: 'taro_ball', name: '芋圆', category: 'topping', emojiAsset: 'Dango' },
  { id: 'watermelon', name: '西瓜丁', category: 'topping', emojiAsset: 'Watermelon' },
  { id: 'mango', name: '芒果丁', category: 'topping', emojiAsset: 'Mango' },
  { id: 'macaroni', name: '通心粉', category: 'topping', emojiAsset: 'Spaghetti', iconNote: '近似意大利面' },
  { id: 'grass_jelly', name: '仙草冻', category: 'topping', emojiAsset: 'Custard' },
  { id: 'quail_egg', name: '鹌鹑蛋', category: 'topping', emojiAsset: 'Egg' },
];

/** 全部配料，顺序固定（汤底在前），便于调试与展示 */
export const ALL_INGREDIENTS: readonly IngredientDef[] = [...BASE_POOL, ...TOPPING_POOL];

const INGREDIENTS_BY_ID: ReadonlyMap<string, IngredientDef> = new Map(
  ALL_INGREDIENTS.map((item) => [item.id, item]),
);

/** 按 id 取配料定义；id 非法时返回 undefined，由调用方决定如何处理 */
export function getIngredient(id: string): IngredientDef | undefined {
  return INGREDIENTS_BY_ID.get(id);
}
