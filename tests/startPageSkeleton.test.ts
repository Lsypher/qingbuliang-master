/// <reference types="vite/client" />
/**
 * 开始页骨架的锁定测试。
 *
 * 直接读场景 JSON，断言这次改动的三条不变量：
 *   1. 开始页上只剩两个部分——最高分行与开摊按钮。标题、副标题与其底框、玩法说明这五类节点
 *      已经烤进整屏封面图，不该再作为节点回来（回来一个就会在封面图上多叠一层字或一块黑框）。
 *   2. 留下的两部分结构仍然完整（最高分 = 奖杯 + 文字，按钮 = 占位底 + 文字节点）——
 *      `StartView` 是按这些节点名取子节点的，少一个只会静默地不刷新那一块，不会报错。
 *   3. 按钮上的字烤在底图里（`start-button.png` 自带"开始游戏"），所以那个文字节点必须是**停用**的——
 *      启用回来就会在图上的字上面再叠一层"开摊"（见 docs/adr/0011-start-button-art-carries-its-own-text.md）。
 *
 * 不依赖引擎（只解析静态 JSON，场景以 vite 的 ?raw 形式读成字符串），改场景接线就会被这条用例抓住。
 * 测试名用中文写成一句需求，读起来就是验收标准。
 */

import sceneRaw from '../assets/scenes/main.scene?raw';
import { describe, expect, it } from 'vitest';

/** 场景里一个组件（Sprite / Label / Button 都是 `__type__` 打头的对象） */
interface SceneComponent {
  __type__: string;
}

/** 场景里一个节点 */
interface SceneNode {
  __type__: 'cc.Node';
  _name: string;
  /** 节点是否启用（未启用的节点及其子树不参与渲染） */
  _active: boolean;
  /** 组件引用，`__id__` 指向场景对象数组里的下标 */
  _components: { __id__: number }[];
  /** 子节点引用，同上；没有子节点时是空数组 */
  _children?: { __id__: number }[];
}

/**
 * 读场景并把它拆成"按位置索引的对象数组"与"按名字查的节点表"。
 * 场景是序列化扁平数组：对象本身不带 `__id__`，下标即身份，引用里的 `__id__` 就是数组下标，靠它回指。
 */
function loadScene(): { byIndex: unknown[]; nodes: SceneNode[] } {
  const byIndex = JSON.parse(sceneRaw) as unknown[];
  const nodes = byIndex.filter(
    (o): o is SceneNode => !!o && typeof o === 'object' && (o as { __type__?: string }).__type__ === 'cc.Node',
  );
  return { byIndex, nodes };
}

/** 按名字取节点，取不到直接让用例失败（比裸 undefined 报错更清楚） */
function findNode(nodes: SceneNode[], name: string): SceneNode {
  const node = nodes.find((n) => n._name === name);
  expect(node, `场景里应存在名为 ${name} 的节点`).toBeDefined();
  return node as SceneNode;
}

/** 解析一个节点的直接子节点（按 `_children` 的下标从场景对象数组里取回来） */
function childrenOf(node: SceneNode, byIndex: unknown[]): SceneNode[] {
  return (node._children ?? []).map((ref) => byIndex[ref.__id__] as SceneNode);
}

/** 节点上是否挂了某个组件（按组件类名匹配） */
function hasComponent(node: SceneNode, byIndex: unknown[], type: string): boolean {
  return node._components.map((ref) => byIndex[ref.__id__] as SceneComponent).some((c) => c?.__type__ === type);
}

/**
 * 已烤进封面图（`assets/resources/art/backgrounds/start-page.png`）、不再作为节点存在的节点名。
 * 与 docs/adr/0004-start-page-cover-art.md 同源：改这份清单等同于改封面图的构成。
 */
const BAKED_INTO_COVER = ['TitleArt', 'TitleFallback', 'Subtitle', 'SubtitleBox', 'HowToPlay'];

describe('开始页上只剩最高分行与开摊按钮', () => {
  const { byIndex, nodes } = loadScene();

  it('开始页的直接子节点恰好是最高分行与开摊按钮两部分', () => {
    const names = childrenOf(findNode(nodes, 'StartPage'), byIndex).map((child) => child._name);
    expect(names.sort()).toEqual(['BestScore', 'StartButton']);
  });

  it('标题、副标题与其底框、玩法说明都不再作为节点存在（它们已经烤进封面图）', () => {
    for (const name of BAKED_INTO_COVER) {
      expect(
        nodes.some((n) => n._name === name),
        `${name} 不应再出现在场景里`,
      ).toBe(false);
    }
  });
});

describe('留下的两部分结构仍然完整', () => {
  const { byIndex, nodes } = loadScene();

  it('最高分行是"奖杯图标 + 文字"，且奖杯挂着 Sprite', () => {
    const children = childrenOf(findNode(nodes, 'BestScore'), byIndex);
    // 奖杯与文字是并列的两块，谁先谁后不影响画面（各占一个横向位置），所以按集合比
    expect(children.map((child) => child._name).sort()).toEqual(['Icon', 'Label']);
    expect(hasComponent(findNode(nodes, 'Icon'), byIndex, 'cc.Sprite'), '奖杯节点应挂 Sprite').toBe(true);
  });

  it('开摊按钮是"占位底 + 文字节点"，且按钮挂着 Button', () => {
    const button = findNode(nodes, 'StartButton');
    // 顺序仍有意义：同层先画的在下层，占位底必须排在文字节点之后画的那一层之下
    expect(childrenOf(button, byIndex).map((child) => child._name)).toEqual(['Placeholder', 'Label']);
    expect(hasComponent(button, byIndex, 'cc.Button'), '按钮节点应挂 Button').toBe(true);
  });

  it('按钮上的文字节点是停用的（字已经烤进底图，启用就会叠字）', () => {
    const button = findNode(nodes, 'StartButton');
    const label = childrenOf(button, byIndex).find((child) => child._name === 'Label');
    expect(label, '按钮下应有名为 Label 的子节点').toBeDefined();
    expect(label?._active).toBe(false);
  });
});
