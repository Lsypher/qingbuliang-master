/**
 * 渲染签名的测试。
 *
 * 签名是"值没变就不重绘"这条短路唯一的判断依据（守卫本身见 ui/redrawGuard.ts），
 * 而签名写错的症状是**界面不刷新**——加一个字段、漏一个字段都不报错，只是画面对不上。
 * 所以每个签名逐字段断言：该影响的必须影响，不该影响的必须不影响。
 *
 * 用真实的 `SessionState` / `Order` 结构造最小样例，不 import 引擎。
 */

import { describe, expect, it } from 'vitest';
import type { Order } from '../assets/scripts/core/session';
import {
  bowlSignature,
  hudStatsSignature,
  orderCardSignature,
} from '../assets/scripts/ui/renderSignatures';

const ORDER: Order = { baseId: 'coconut-milk', toppingIds: ['red-bean', 'sago', 'taro-ball'] };

describe('碗的签名（BowlView）', () => {
  it('内容不变则签名不变', () => {
    expect(bowlSignature(['red-bean', 'sago'])).toBe(bowlSignature(['red-bean', 'sago']));
  });

  it('碗里多一项、少一项、换一项都会改变签名', () => {
    const base = bowlSignature(['red-bean', 'sago']);
    expect(bowlSignature(['red-bean', 'sago', 'taro-ball'])).not.toBe(base);
    expect(bowlSignature(['red-bean'])).not.toBe(base);
    expect(bowlSignature(['red-bean', 'mango'])).not.toBe(base);
  });

  it('顺序变了签名也要变：碗里图标按放入顺序排，顺序变了画面就得重排', () => {
    expect(bowlSignature(['red-bean', 'sago'])).not.toBe(bowlSignature(['sago', 'red-bean']));
  });

  it('空碗的签名与任何非空内容都不同', () => {
    expect(bowlSignature([])).not.toBe(bowlSignature(['red-bean']));
  });
});

describe('订单卡的签名（OrderCard）', () => {
  it('订单与碗都没变则签名不变', () => {
    expect(orderCardSignature(ORDER, ['red-bean'])).toBe(orderCardSignature({ ...ORDER }, ['red-bean']));
  });

  it('换汤底会改变签名', () => {
    const changed: Order = { ...ORDER, baseId: 'coconut-water' };
    expect(orderCardSignature(changed, [])).not.toBe(orderCardSignature(ORDER, []));
  });

  it('小料换一项会改变签名', () => {
    const changed: Order = { ...ORDER, toppingIds: ['red-bean', 'sago', 'mango'] };
    expect(orderCardSignature(changed, [])).not.toBe(orderCardSignature(ORDER, []));
  });

  it('小料顺序变了签名也要变：图标行按订单给的顺序摆', () => {
    const reordered: Order = { ...ORDER, toppingIds: ['sago', 'red-bean', 'taro-ball'] };
    expect(orderCardSignature(reordered, [])).not.toBe(orderCardSignature(ORDER, []));
  });

  it('碗里已放的内容变了会改变签名：图标行要重画打勾、进度行要重排', () => {
    expect(orderCardSignature(ORDER, ['red-bean'])).not.toBe(orderCardSignature(ORDER, []));
    expect(orderCardSignature(ORDER, ['red-bean', 'sago'])).not.toBe(orderCardSignature(ORDER, ['red-bean']));
  });

});

describe('顶部统计行的签名（HudView）', () => {
  const STATS = { score: 120, servedOrders: 4, comboCount: 2 };

  it('三个数都没变则签名不变', () => {
    expect(hudStatsSignature({ ...STATS })).toBe(hudStatsSignature(STATS));
  });

  it('分数、完成订单、连击任变其一都会改变签名', () => {
    const base = hudStatsSignature(STATS);
    expect(hudStatsSignature({ ...STATS, score: 130 })).not.toBe(base);
    expect(hudStatsSignature({ ...STATS, servedOrders: 5 })).not.toBe(base);
    expect(hudStatsSignature({ ...STATS, comboCount: 3 })).not.toBe(base);
  });

  it('只看这三个数：每帧都在变的倒计时字段进了签名，守卫就形同虚设', () => {
    // 多余的字段不该进签名——带上它们也必须得到同一个签名
    const withEveryFrameFields = {
      ...STATS,
      remainingMs: 4321,
      elapsedMs: 56789,
      transitionRemainingMs: 0,
      warned: true,
    };
    expect(hudStatsSignature(withEveryFrameFields)).toBe(hudStatsSignature(STATS));
  });
});
