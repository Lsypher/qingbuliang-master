/// <reference types="vite/client" />
/**
 * 结算页骨架的锁定测试（标题底板与"再来一碗"按钮底板）。
 *
 * 直接读场景 JSON，断言这一页两处"底板 + 文字"的结构与样式：
 *   1. `Title` 与 `RestartButton` 都是**容器**：渲染组件（`Sprite`）下沉到各自的 `Board` 子节点上，
 *      `Board` 必须排在 `Label` **之前**——兄弟顺序就是绘制顺序，反了底板会压住文字（肉眼易漏、代码里查不出）。
 *   2. 两处的 `Sprite.sizeMode` 是 CUSTOM、节点在 UI_2D 层、底板帧已在场景里接线。
 *   3. 两行字都是**白字 + 描边 + 加粗**：标题 50 号配暖近黑边，按钮 40 号配深绿边
 *      （字号与描边宽是照素材反推的，改一个就得连另一个一起看）。
 *
 * 每一条约束的**取值与理由的权威说明**见 docs/adr/0013-result-title-board.md 的
 * 「结算页底板的导入与场景约定」一节，本文件只负责"锁住它"、不复述为什么。
 * 不依赖引擎（只解析静态 JSON，场景以 vite 的 ?raw 形式读成字符串），改场景接线就会被这条用例抓住。
 * 测试名用中文写成一句需求，读起来就是验收标准。
 */

import sceneRaw from '../assets/scenes/main.scene?raw';
import { describe, expect, it } from 'vitest';

/** 场景里一个组件（Sprite / Label 都是 `__type__` 打头的对象） */
interface SceneComponent {
  __type__: string;
  [key: string]: unknown;
}

/** 场景里一个节点 */
interface SceneNode {
  __type__: 'cc.Node';
  _name: string;
  /** 渲染层：UI 节点必须是 UI_2D，否则相机（可见层为 UI_2D）不会渲染它 */
  _layer: number;
  /** 组件引用，`__id__` 指向场景对象数组里的下标 */
  _components: { __id__: number }[];
  /** 子节点引用，同上；没有子节点时是空数组 */
  _children?: { __id__: number }[];
}

/** `Layers.Enum.UI_2D`：画布相机只渲染这一层的节点（漏设就是"数据全对、画面全空"） */
const UI_2D_LAYER = 33554432;

/** 素材原始像素比例（3360×1312）：节点尺寸就是这个比例的等比缩放，见 ADR-0013 */
const BOARD_ART_RATIO = 3360 / 1312;

/**
 * `result-title-board.png` 的 `spriteFrame` uuid：场景里 `Board` 引用的就是它。
 * 同路径覆盖文件不会改这个值；**删掉再重新导入**才会换，那时这条断言会失败、提醒回编辑器重接一次。
 */
const BOARD_ART_UUID = 'e3482d3b-147c-41da-87a3-ab0e5526abe9@f9941';

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

/** 取节点上某个组件的原始数据（场景里就是它的序列化对象，所以字段名带下划线） */
function componentOf<T = SceneComponent>(node: SceneNode, byIndex: unknown[], type: string): T {
  const found = node._components
    .map((ref) => byIndex[ref.__id__] as SceneComponent)
    .find((c) => c?.__type__ === type);
  expect(found, `${node._name} 上应挂着 ${type}`).toBeDefined();
  return found as unknown as T;
}

/** 结算页标题的两个子节点名，顺序有意义（先画的在下层） */
const TITLE_CHILD_ORDER = ['Board', 'Label'];

describe('结算页标题是"木牌底板 + 文字"两层', () => {
  const { byIndex, nodes } = loadScene();

  it('Title 自己只是容器，渲染组件都下沉到子节点上', () => {
    const title = findNode(nodes, 'Title');
    const types = title._components.map((ref) => (byIndex[ref.__id__] as SceneComponent).__type__);
    expect(types).toEqual(['cc.UITransform']);
  });

  it('Title 的直接子节点恰好是 Board 与 Label，且 Board 排在前面', () => {
    const names = childrenOf(findNode(nodes, 'Title'), byIndex).map((child) => child._name);
    // 顺序而非集合：底板必须画在文字之下，换了顺序底板就盖住了字（见 ADR-0013）
    expect(names).toEqual(TITLE_CHILD_ORDER);
  });

  it('底板节点挂 Sprite，尺寸模式是 CUSTOM、类型是整图拉伸', () => {
    const sprite = componentOf<{ _sizeMode: number; _type: number }>(
      findNode(nodes, 'Board'),
      byIndex,
      'cc.Sprite',
    );
    // CUSTOM(0)：不跟着帧尺寸走，否则运行时一贴帧节点就被撑到原图的 3360×1312
    expect(sprite._sizeMode).toBe(0);
    // SIMPLE(0)：木牌整图等比拉伸，不走九宫格
    expect(sprite._type).toBe(0);
  });

  it('底板图在场景里接了线，指向 result-title-board.png（编辑器里所见即所得）', () => {
    const sprite = componentOf<{ _spriteFrame: unknown }>(findNode(nodes, 'Board'), byIndex, 'cc.Sprite');
    // 接线与"同名覆盖即换图"并不冲突：同路径覆盖文件时 uuid 不变，换图照样生效。
    // 但**删掉再重新导入**会换 uuid，那时要回编辑器重接一次——这条断言会先报错提醒。
    expect(sprite._spriteFrame).toEqual({ __uuid__: BOARD_ART_UUID, __expectedType__: 'cc.SpriteFrame' });
  });

  it('Title 与 Board 同尺寸，且宽高比就是素材比例（等比拉伸，不压扁木牌）', () => {
    const title = componentOf<{ _contentSize: { width: number; height: number } }>(
      findNode(nodes, 'Title'),
      byIndex,
      'cc.UITransform',
    );
    const board = componentOf<{ _contentSize: { width: number; height: number } }>(
      findNode(nodes, 'Board'),
      byIndex,
      'cc.UITransform',
    );
    expect(board._contentSize).toEqual(title._contentSize);
    expect(board._contentSize.width / board._contentSize.height).toBeCloseTo(BOARD_ART_RATIO, 2);
  });
});

describe('标题文字是白字加描边', () => {
  const { byIndex, nodes } = loadScene();

  /**
   * 取结算页标题的文字组件。
   * 不能按名字全局找 `Label`——开始页与结算页的按钮底下各有一个同名节点，会取错人。
   */
  function titleLabel<T = SceneComponent>(): T {
    const label = childrenOf(findNode(nodes, 'Title'), byIndex).find((child) => child._name === 'Label');
    expect(label, 'Title 下应有名为 Label 的子节点').toBeDefined();
    return componentOf<T>(label as SceneNode, byIndex, 'cc.Label');
  }

  it('文字节点挂在 Title/Label 上，用文案表里那句"食饱未？"', () => {
    // 场景里的是摆版预览值，每次进结算页都由 ResultView 从 strings.ts 重刷
    expect(titleLabel<{ _string: string }>()._string).toBe('食饱未？');
  });

  it('正文是白色', () => {
    // 场景里的 `cc.Color` 比裸对象多一个 `__type__`，所以用 toMatchObject 只认颜色分量
    expect(titleLabel<{ _color: unknown }>()._color).toMatchObject({ r: 255, g: 255, b: 255, a: 255 });
  });

  it('描边开启、近黑、宽度 5，且加粗（粗壮感靠加粗承担）', () => {
    const label = titleLabel<{
      _enableOutline: boolean;
      _outlineColor: { r: number; g: number; b: number; a: number };
      _outlineWidth: number;
      _isBold: boolean;
      _fontSize: number;
    }>();
    expect(label._enableOutline).toBe(true);
    // 暖近黑：白字压在浅黄木牌上要它把字抠出来（UI_COLOR.resultTitleOutline）
    expect(label._outlineColor).toMatchObject({ r: 36, g: 22, b: 12, a: 255 });
    // 与 uiFactory.outlineWidthFor 的规则同源：字号 50 × 0.09 取整
    expect(label._outlineWidth).toBe(5);
    expect(label._isBold).toBe(true);
    expect(label._fontSize).toBe(50);
  });
});

describe('结算页"再来一碗"是"绿胶囊底板 + 文字"两层', () => {
  const { byIndex, nodes } = loadScene();

  /** `restart-button.png` 的 `spriteFrame` uuid：与标题那条同理，覆盖同名文件不改它、删了重导才会换 */
  const RESTART_ART_UUID = '099b4c91-934b-419d-bdc5-c71fa851a572@f9941';
  /** 素材原始像素比例（3296×1184）：按钮与底板都是它的等比缩放，见 ADR-0014 */
  const RESTART_ART_RATIO = 3296 / 1184;

  /** 取按钮下的底板节点（按钮这层还挂着一个空的 Graphics，找节点时别被它带偏） */
  function findBoard(): SceneNode {
    const board = childrenOf(findNode(nodes, 'RestartButton'), byIndex).find((child) => child._name === 'Board');
    expect(board, 'RestartButton 下应有名为 Board 的子节点').toBeDefined();
    return board as SceneNode;
  }

  it('RestartButton 的子节点是 Board 与 Label，且 Board 排在前面', () => {
    const names = childrenOf(findNode(nodes, 'RestartButton'), byIndex).map((child) => child._name);
    // 顺序而非集合：底板必须画在文字之下（Sprite 与 Graphics 不能同节点共存，底板只能当子节点）
    expect(names).toEqual(['Board', 'Label']);
  });

  it('底板挂 Sprite、尺寸模式是 CUSTOM，并已接线指向 restart-button.png', () => {
    const sprite = componentOf<{ _sizeMode: number; _type: number; _spriteFrame: unknown }>(
      findBoard(),
      byIndex,
      'cc.Sprite',
    );
    expect(sprite._sizeMode).toBe(0);
    expect(sprite._type).toBe(0);
    expect(sprite._spriteFrame).toEqual({ __uuid__: RESTART_ART_UUID, __expectedType__: 'cc.SpriteFrame' });
  });

  it('按钮与底板同尺寸，且宽高比就是素材比例（不把胶囊压扁）', () => {
    const buttonTransform = componentOf<{ _contentSize: { width: number; height: number } }>(
      findNode(nodes, 'RestartButton'),
      byIndex,
      'cc.UITransform',
    );
    const boardTransform = componentOf<{ _contentSize: { width: number; height: number } }>(
      findBoard(),
      byIndex,
      'cc.UITransform',
    );
    expect(boardTransform._contentSize).toEqual(buttonTransform._contentSize);
    expect(buttonTransform._contentSize.width / buttonTransform._contentSize.height).toBeCloseTo(RESTART_ART_RATIO, 2);
  });

  it('文字是白字 + 深绿描边 + 加粗（字号 40 不变）', () => {
    const labelNode = childrenOf(findNode(nodes, 'RestartButton'), byIndex).find((c) => c._name === 'Label');
    expect(labelNode, 'RestartButton 下应有名为 Label 的子节点').toBeDefined();
    const label = componentOf<{
      _color: unknown;
      _enableOutline: boolean;
      _outlineColor: unknown;
      _outlineWidth: number;
      _isBold: boolean;
      _fontSize: number;
    }>(labelNode as SceneNode, byIndex, 'cc.Label');
    expect(label._color).toMatchObject({ r: 255, g: 255, b: 255, a: 255 });
    expect(label._enableOutline).toBe(true);
    // 深绿近黑：白字压在亮绿胶囊上，靠它抠出字形（UI_COLOR.restartButtonOutline）
    expect(label._outlineColor).toMatchObject({ r: 27, g: 58, b: 14, a: 255 });
    expect(label._outlineWidth).toBe(4);
    expect(label._isBold).toBe(true);
    expect(label._fontSize).toBe(40);
  });

  it('按下反馈走 Button 的缩放过渡（素材只有一张，没有按下态图可换）', () => {
    const button = componentOf<{ _transition: number; _zoomScale: number }>(
      findNode(nodes, 'RestartButton'),
      byIndex,
      'cc.Button',
    );
    // SCALE(3) + 0.95：原来是 NONE，点下去毫无反应（见 ADR-0014）
    expect(button._transition).toBe(3);
    expect(button._zoomScale).toBe(0.95);
  });
});

describe('两处底板与文字的节点都在 UI_2D 层', () => {
  const { byIndex, nodes } = loadScene();

  it('Title 与 RestartButton 的子节点 layer 都是 UI_2D', () => {
    // 用编辑器手工拖出来的节点默认就对；程序化新建的会落在 DEFAULT，那时数据全对、画面全无
    for (const hostName of ['Title', 'RestartButton']) {
      for (const child of childrenOf(findNode(nodes, hostName), byIndex)) {
        expect(child._layer, `${hostName} 下 ${child._name} 的 layer 应为 UI_2D`).toBe(UI_2D_LAYER);
      }
    }
  });
});
