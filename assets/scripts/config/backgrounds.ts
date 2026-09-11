/**
 * 背景池：4 张海南背景的静态定义。纯数据、无逻辑。
 *
 * 资源放在 `assets/resources/art/backgrounds/`，name 同时是文件名——
 * 换图（用同名文件替换）不用动代码、也不用回编辑器接线；只有增删背景才需要改这里。
 */
export const BACKGROUND_DIR = 'art/backgrounds';

export const BACKGROUNDS: readonly string[] = [
  'qilou-street-night',
  'qingbuliang-stall-night',
  'palm-coast-dusk',
  'li-brocade-pattern',
];
