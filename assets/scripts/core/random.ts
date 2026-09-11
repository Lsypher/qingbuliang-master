/**
 * 随机源：可注入、可复现。
 * 生产环境用时间种子；测试注入固定种子，订单序列必须完全一致。
 */

/** 返回 [0, 1) 的随机函数 */
export type RandomSource = () => number;

/**
 * mulberry32：小而稳的可播种伪随机数发生器。
 * 用它而不是 Math.random，是为了让"订单生成"这件事可以被测试断言。
 */
export function createRandom(seed: number): RandomSource {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 从非空池子里随机取一个 */
export function pickOne<T>(pool: readonly T[], random: RandomSource): T {
  return pool[Math.floor(random() * pool.length)];
}

/** 从池子里随机取 count 个互不重复的项（count 超过池子长度时取满为止） */
export function pickDistinct<T>(pool: readonly T[], count: number, random: RandomSource): T[] {
  const rest = [...pool];
  const picked: T[] = [];
  const total = Math.min(count, rest.length);
  for (let i = 0; i < total; i++) {
    const index = Math.floor(random() * rest.length);
    picked.push(rest.splice(index, 1)[0]);
  }
  return picked;
}
