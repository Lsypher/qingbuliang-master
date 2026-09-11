# 01: 配置层与纯逻辑核心

**What to build:** 一份不依赖引擎的规则核心：订单生成、集合匹配、错放扣时、连击计分、难度三段、计时相位，全部通过事件对外表达；配套行为测试。

**Blocked by:** None (can start immediately)

**Status:** done

- [x] 核心层不出现任何引擎 import
- [x] `npm test` 全绿（21 个用例）
- [x] 引擎脚本诊断 0 错误
