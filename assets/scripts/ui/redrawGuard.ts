/**
 * 重绘守卫：把"值没变就不重绘"的短路收口一处。
 *
 * 核心每帧都广播全量状态（见 GameSession.update），各视图自己短路才不会每帧重排文本、重建图标。
 * 各视图原先各写一份"算签名 + 比较"，且都要自己记得那个坑：用空串当"还没画过"的哨兵，
 * 会被"签名恰好是空串"的状态（如空碗）短路掉首帧。这里内置 null 哨兵，一次性解决。
 *
 * 只覆盖**字符串签名**的比较；HudView 里"整秒等值"与"比例阈值（epsilon）"是另一种语义，留在原处。
 */

/** 重绘守卫：记住上一次的签名，判断这次要不要重绘 */
export class SignatureGuard {
  /** 用 null 而不是空串作"还没画过"的哨兵：签名恰好是空串时，首帧不能被短路 */
  private last: string | null = null;

  /** 传入本次签名：与上次不同返回 true（该重绘），相同返回 false（跳过） */
  changed(signature: string): boolean {
    if (signature === this.last) return false;
    this.last = signature;
    return true;
  }

  /** 恢复成"还没画过"：下一个签名无论是什么都算有变（重开一局等场景用） */
  reset(): void {
    this.last = null;
  }
}
