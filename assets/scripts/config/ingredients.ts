/**
 * 配料表：12 格配料池的静态定义（3 汤底 + 9 小料）。
 * 纯数据、无逻辑、不依赖引擎；id 同时用作图标文件名，改名等于换图。
 */

/** 配料分类：汤底是液体基底，小料是固态配料 */
export type IngredientCategory = 'base' | 'topping';

export interface IngredientDef {
  /** 稳定标识，同时是图标文件名（对应 `art/ingredients/<id>.png` 的手绘透明底图） */
  id: string;
  /** 界面上的中文短标签，也是玩家的识别主通道 */
  name: string;
  category: IngredientCategory;
}

/** 汤底：一碗清补凉恰好一种 */
export const BASE_POOL: readonly IngredientDef[] = [
  { id: 'coconut_milk', name: '椰奶', category: 'base' },
  { id: 'coconut_water', name: '椰子水', category: 'base' },
  { id: 'brown_sugar_water', name: '红糖水', category: 'base' },
];

/**
 * 小料：订单里要求 3~5 种。
 * 选型原则是"颜色 + 形状两两不撞脸"，所以真正的海南配料里略掉了芋头块（撞芋圆）等项。
 */
export const TOPPING_POOL: readonly IngredientDef[] = [
  { id: 'red_bean', name: '红豆', category: 'topping' },
  { id: 'mung_bean', name: '绿豆', category: 'topping' },
  { id: 'sago', name: '西米', category: 'topping' },
  { id: 'taro_ball', name: '芋圆', category: 'topping' },
  { id: 'watermelon', name: '西瓜丁', category: 'topping' },
  { id: 'mango', name: '芒果丁', category: 'topping' },
  { id: 'macaroni', name: '通心粉', category: 'topping' },
  { id: 'grass_jelly', name: '仙草冻', category: 'topping' },
  { id: 'quail_egg', name: '鹌鹑蛋', category: 'topping' },
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

/** 按 id 取配料的中文名；id 非法时原样返回，兜底显示比显示空白强 */
export function ingredientName(id: string): string {
  return INGREDIENTS_BY_ID.get(id)?.name ?? id;
}
