/**
 * 重绘守卫的测试。
 *
 * 守卫不依赖引擎，只比较字符串签名。测试名用中文写成一句需求。
 */

import { describe, expect, it } from 'vitest';
import { SignatureGuard } from '../assets/scripts/ui/redrawGuard';

describe('重绘守卫', () => {
  it('首个签名判"有变"：首帧必重绘', () => {
    expect(new SignatureGuard().changed('a')).toBe(true);
  });

  it('签名与上次相同判"无变"：跳过重绘', () => {
    const guard = new SignatureGuard();
    guard.changed('a');
    expect(guard.changed('a')).toBe(false);
  });

  it('空串签名不被当成"还没画过"：第一次有变、第二次无变', () => {
    // 空碗的签名恰好是空串；若用空串当哨兵，首帧会被短路（这正是守卫要防的）
    const guard = new SignatureGuard();
    expect(guard.changed('')).toBe(true);
    expect(guard.changed('')).toBe(false);
  });

  it('reset 后恢复"首帧"：下一个签名必判有变', () => {
    const guard = new SignatureGuard();
    guard.changed('a');
    guard.reset();
    expect(guard.changed('a')).toBe(true);
  });
});
