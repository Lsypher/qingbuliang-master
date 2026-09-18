/// <reference types="vite/client" />
/**
 * 标题艺术字 / 文字兜底 的结构锁定测试。
 *
 * 直接读场景 JSON，断言这次改动的两条不变量：
 *   1. 艺术字挂在 `TitleArt` 节点上（带 Sprite、且图片槽位已接），原文字 Label 已挪到
 *      `TitleFallback` 兜底节点——不再把"清补凉大师"压在艺术字节点上。
 *   2. 两套节点互斥显示：默认态艺术字 active、文字兜底收起，页面既不会"图与字叠在一起"，也不会开天窗。
 *
 * 不依赖引擎（只解析静态 JSON，场景以 vite 的 ?raw 形式读成字符串），改场景接线就会被这条用例抓住。
 * 测试名用中文写成一句需求，读起来就是验收标准。
 */

import sceneRaw from '../assets/scenes/main.scene?raw';
import { describe, expect, it } from 'vitest';

/** 场景里一个组件（Sprite / Label / UITransform 都是 __type__ 打头的对象） */
interface SceneComponent {
  __type__: string;
  /** 仅 cc.Label 有：节点上显示的文案 */
  _string?: string;
  /** 仅 cc.Sprite 有：图片槽位引用，空槽位为 undefined */
  _spriteFrame?: unknown;
}

/** 场景里一个节点 */
interface SceneNode {
  __type__: 'cc.Node';
  _name: string;
  /** 默认是否显示 */
  _active: boolean;
  /** 组件引用，__id__ 指向场景对象数组里的下标 */
  _components: { __id__: number }[];
}

/** 读场景并把它拆成"按位置索引的对象数组"与"按名字查的节点表" */
function loadScene(): { byIndex: unknown[]; nodes: SceneNode[] } {
  // 场景是序列化扁平数组：对象本身不带 __id__，下标即身份，组件引用里的 __id__ 就是数组下标，靠它回指
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

/** 解析一个节点的全部组件（按组件引用的下标从场景对象数组里取回来） */
function componentsOf(node: SceneNode, byIndex: unknown[]): SceneComponent[] {
  return node._components.map((ref) => byIndex[ref.__id__] as SceneComponent);
}

const TITLE = '清补凉大师';

describe('标题艺术字挂在 TitleArt 节点上', () => {
  const { byIndex, nodes } = loadScene();
  const art = findNode(nodes, 'TitleArt');
  const text = findNode(nodes, 'TitleFallback');
  const artComps = componentsOf(art, byIndex);
  const textComps = componentsOf(text, byIndex);

  it('TitleArt 挂了 Sprite 且图片槽位已接上艺术字', () => {
    const sprite = artComps.find((c) => c.__type__ === 'cc.Sprite');
    expect(sprite, 'TitleArt 应挂一个 Sprite 组件承载艺术字').toBeDefined();
    expect(sprite?._spriteFrame, 'TitleArt 的 Sprite 图片槽位应已接上艺术字（非空槽）').toBeTruthy();
  });

  it('原文字 Label 已挪到 TitleFallback，不再压在艺术字节点上', () => {
    // 艺术字节点上若有 Label，也绝不应该是那行兜底文字
    const artLabel = artComps.find((c) => c.__type__ === 'cc.Label');
    if (artLabel) expect(artLabel._string).not.toBe(TITLE);

    const textLabel = textComps.find((c) => c.__type__ === 'cc.Label');
    expect(textLabel, 'TitleFallback 应承载文字兜底 Label').toBeDefined();
    expect(textLabel?._string).toBe(TITLE);
  });
});

describe('标题艺术字与文字兜底互斥显示', () => {
  const { byIndex, nodes } = loadScene();
  const art = findNode(nodes, 'TitleArt');
  const text = findNode(nodes, 'TitleFallback');

  it('默认态艺术字显示、文字兜底收起', () => {
    expect(art._active, '默认态艺术字应显示（与场景"艺术字在先"的设计一致）').toBe(true);
    expect(text._active, '默认态文字兜底应收起').toBe(false);
  });

  it('两者不会同时 active：页面不会图字叠显，也不会因两者皆收而开天窗', () => {
    expect(art._active && text._active, '标题艺术字与文字兜底不应同时显示').toBe(false);
    expect(art._active || text._active, '标题区同一时刻至少应显示一种：图或字，不能都收着').toBe(true);
  });
});
