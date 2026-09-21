/**
 * 背景池：4 张海南背景的静态定义。纯数据、无逻辑。
 *
 * 资源放在 `assets/resources/art/backgrounds/`，name 同时是文件名——
 * 换图（用同名文件替换）不用动代码、也不用回编辑器接线；只有增删背景才需要改这里。
 */
export const BACKGROUND_DIR = 'art/backgrounds';

/**
 * 开始页专属背景：固定一张、不随机，也不进单局背景池——
 * 开始页要的是"这款游戏的门面"，随机四张会让首屏每次长得不一样。
 */
export const START_BACKGROUND = 'start-page';

/** 单局背景池：只有进单局才从这里随机抽，一局之内不再换 */
export const BACKGROUNDS: readonly string[] = [
  '1',
  '2',
  '3',
  '4',
];
