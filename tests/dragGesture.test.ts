/**
 * 拖拽手势状态机的测试。
 *
 * 只断言外部行为：喂一串「触点落下 / 移动 / 抬手 / 打断」，看每一步给出的结论。
 * 阈值、多指、点按与拖动的分界这些分支，抽出之前散在 IngredientTray 的三个触摸回调里，
 * 只能靠手动拖一遍——这也是把它们收进这个不 import 引擎的模块的全部理由。
 */

import { describe, expect, it } from 'vitest';
import { DRAG_THRESHOLD_PX, createDragGesture } from '../assets/scripts/ui/dragGesture';

/** 起点取非原点：这样"拖动后回到起点"与"从没动过"能区分开 */
const START = { x: 100, y: 200 };
/** 沿 x 单调位移时，距起点的直线距离就等于位移量 */
const AT_THRESHOLD = { x: START.x + DRAG_THRESHOLD_PX, y: START.y };
const BEYOND = { x: START.x + DRAG_THRESHOLD_PX + 1, y: START.y };

describe('拖拽手势：点按与拖动的分界', () => {
  it('触点落下即被认领', () => {
    expect(createDragGesture().start(1, START.x, START.y)).toBe(true);
  });

  it('没挪动过就抬手算点按', () => {
    const gesture = createDragGesture();
    gesture.start(1, START.x, START.y);
    expect(gesture.finish(1)?.dragged).toBe(false);
  });

  it('距起点恰好等于阈值仍算点按，超过才算拖动（判定是严格大于）', () => {
    const atThreshold = createDragGesture();
    atThreshold.start(1, START.x, START.y);
    expect(atThreshold.move(1, AT_THRESHOLD.x, AT_THRESHOLD.y)?.dragging).toBe(false);

    const beyond = createDragGesture();
    beyond.start(1, START.x, START.y);
    expect(beyond.move(1, BEYOND.x, BEYOND.y)?.dragging).toBe(true);
  });

  it('斜着挪按直线距离算：两轴各挪半个阈值时，斜距仍不到阈值', () => {
    const gesture = createDragGesture();
    gesture.start(1, START.x, START.y);
    const half = DRAG_THRESHOLD_PX / 2;
    expect(gesture.move(1, START.x + half, START.y + half)?.dragging).toBe(false);
  });

  it('阈值判的是距起点的直线距离：来回抖动不会累积越界', () => {
    const gesture = createDragGesture();
    gesture.start(1, START.x, START.y);
    const step = Math.floor(DRAG_THRESHOLD_PX / 2);
    for (let index = 0; index < 5; index++) {
      expect(gesture.move(1, START.x + step, START.y)?.dragging).toBe(false);
      expect(gesture.move(1, START.x, START.y)?.dragging).toBe(false);
    }
  });

  it('越过阈值之后一直是拖动中：拉回起点也不回落', () => {
    const gesture = createDragGesture();
    gesture.start(1, START.x, START.y);
    expect(gesture.move(1, BEYOND.x, BEYOND.y)?.dragging).toBe(true);
    // 回落就意味着"拖出去再拖回来"会在半路变回点按，抬手时配料直接进碗
    expect(gesture.move(1, START.x, START.y)?.dragging).toBe(true);
  });
});

describe('拖拽手势：落点', () => {
  it('拖动结束给出的落点是最后一次移动到的位置', () => {
    const gesture = createDragGesture();
    gesture.start(1, START.x, START.y);
    gesture.move(1, BEYOND.x, BEYOND.y);
    gesture.move(1, 500, 600);
    expect(gesture.finish(1)).toEqual({ dragged: true, x: 500, y: 600 });
  });

  it('点按结束给出的位置就是起点', () => {
    const gesture = createDragGesture();
    gesture.start(1, START.x, START.y);
    expect(gesture.finish(1)).toEqual({ dragged: false, x: START.x, y: START.y });
  });
});

describe('拖拽手势：触点身份与结束', () => {
  it('一次只认一根手指：手势进行中时另一个触点落下不接，也不影响正在进行的手势', () => {
    const gesture = createDragGesture();
    gesture.start(1, START.x, START.y);
    expect(gesture.start(2, START.x, START.y)).toBe(false);
    expect(gesture.move(1, BEYOND.x, BEYOND.y)?.dragging).toBe(true);
  });

  it('不是本手势认领的触点：移动与抬手都不认，本手势也不受影响', () => {
    const gesture = createDragGesture();
    gesture.start(1, START.x, START.y);
    expect(gesture.move(2, BEYOND.x, BEYOND.y)).toBeNull();
    expect(gesture.finish(2)).toBeNull();
    expect(gesture.finish(1)).toEqual({ dragged: false, x: START.x, y: START.y });
  });

  it('抬手之后手势复位：同一个触点不能接着用，新触点可以重新开始', () => {
    const gesture = createDragGesture();
    gesture.start(1, START.x, START.y);
    gesture.finish(1);
    expect(gesture.move(1, BEYOND.x, BEYOND.y)).toBeNull();
    expect(gesture.finish(1)).toBeNull();
    expect(gesture.start(2, START.x, START.y)).toBe(true);
  });

  it('打断之后手势复位：原来的触点不再算数，新触点可以重新开始', () => {
    const gesture = createDragGesture();
    gesture.start(1, START.x, START.y);
    gesture.interrupt();
    expect(gesture.move(1, BEYOND.x, BEYOND.y)).toBeNull();
    expect(gesture.start(2, START.x, START.y)).toBe(true);
  });

  it('没有手势时打断是空操作，不会让下一个触点落不下来', () => {
    const gesture = createDragGesture();
    gesture.interrupt();
    expect(gesture.start(1, START.x, START.y)).toBe(true);
  });
});
