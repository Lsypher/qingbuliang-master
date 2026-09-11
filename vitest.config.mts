import { defineConfig } from 'vitest/config';

/**
 * 用 .mts 而不是 .ts：项目根 package.json 不是 ESM 包，.ts 会被当成 CommonJS 加载从而报警告。
 *
 * 只跑 tests/ 下的用例：
 * assets/ 是引擎资源目录、extensions/ 是编辑器扩展目录，都不该被测试扫描到。
 */
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
