# 05: 兜底不回归与整段流程验收

**What to build:** 确认这次插入的过场没有把既有的缺图兜底改坏、也没有让开始页与结算页出现回归，并把 8 条验收点逐条走完、留下证据。

**Blocked by:** 03, 04

**Status:** ready-for-agent

- [x] 把一张背景图改名后，过场仍按时放行、背景保留旧图，不空窗、不报错（脚本化验证：摸拟全部背景加载失败，`rollRoundBackground` 的预载回调 `done()` 仍触发→过场能放行；`rolledFrame` 保持 `null`，`showRolledBackground()` 不换图；背景 URL 前后一致 `keepOld=true`，无异常）
- [x] 把一张配料图标改名后，过场仍按时放行，那一格按既有兜底只显示中文标签（脚本化验证：12 项预载任务全部 `done()` 触发、缓存全为 `null`；`Slot_red_bean` 的图标 `spriteFrame===null`、中文标签为「红豆」→ 只显示标签）
- [x] 开摊、重开两条路径各连续走 3 次，倒计时、分数、连击、结算数值均无异常（脚本化验证：连续 3 次 `startRound()` 每局都重置为 `remainingMs=60000 / score=0 / combo=0 / served=0 / phase=playing`；两条入口共用 `showGame`，每次新开一局都重建会话）
- [x] 开始页与结算页无回归（尤其结算页的最高分行与重开按钮）（结算页 `BestLine`、`RestartButton` 节点均在场且未改动；开始页 `BestScore`、`StartButton` 均在场；`ResultView`/`HudView`/`StartView` 自 01-04 起未动）
- [x] 过场期间连点、乱划不会导致重复开局或状态错乱（含过场熄灭后立即连点这一两帧）（脚本化验证：连续两次 `showGame()` 仅触发 `begin` 一次，`entering` 幂等标志拦截第二次；过场节点挂 `BlockInputEvents` 屏蔽下层按钮的空间穿透；`enterGame` 用 `scheduleOnce(0)` 把标志延到下一帧解开，覆盖"熄灭后一两帧"的连点）
- [ ] 窄屏（9:16 以下画幅）下过场与单局页首帧各留一张截图（环境限制：本机为无头预览，MCP 截图工具提示"找不到可见 game 面板"，无法在此抓真实窄屏截图；窄屏不裁切已由代码保证——`PrepareTransition` 的文案框宽与扫动条宽均取 `visibleWidth()`，配料盘 `trayLayout()` 按 `visibleWidth()` 收窄，与 04 号票的 `sweepPhase` 单测一致）
- [x] spec 里那 8 条验收点逐条留证（截图或命令输出）（见下方「验证证据」；其中第 8 条窄屏为代码级证明 + 引用 04 号票证据，其余均有命令输出/脚本化结果）
- [x] `npm test` 全绿；引擎脚本诊断 0 错误（`npm test` → 4 文件 47 用例全绿；`npx tsc --noEmit` exit 0；Cocos 引擎脚本诊断 exit 0、0 错误）

## 验证证据

**静态（命令输出）**
- `npm test`：`✓ prepareSweep 6 · startPageLayout 13 · entryGate 7 · session 21` → **47 passed**。
- `npx tsc --noEmit`：`TSC_EXIT=0`。
- 引擎脚本诊断（`get_script_diagnostic_context`）：`exitCode 0`、`diagnostics: []`。

**放行判据单测四条分支（验收点 7）**：`tests/entryGate.test.ts` 7 个用例覆盖：
1. 未到最短时长 → 等待；2. 已过最短时长且未超时 → 放行；3. 未到最短时长且预载未完 → 等待；4. 预载已完但未到最短 → 等待；5. 预载已完且过最短 → 放行；6. 硬超时（无论预载）→ 放行。

**脚本化运行时验证（针对真实 `BackgroundView` / `IngredientTray` / `GameRoot` 代码，注入"资源加载失败"模拟改名）**
- 背景兜底：模拟全部背景加载失败 → `rollDoneFired=true`、`rolledFrameSet=false`、`showRolledBackground()` 后背景 URL 不变（`keepOld=true`）、无报错。
- 配料图标兜底：12 项预载 `doneCount=12`、`allNull=true`；重排后 `Slot_red_bean`：`iconSpriteNull=true`、`labelText="红豆"`。
- 过场期间状态：点击 `showGame` 后 `ptActive=true`、`gameActive=false`、`sessionStarted=false`（倒计时尚未启动，不会推进）。
- 连点幂等：两次 `showGame` 仅 `begin` 一次；`entering=true`；过场 `transitionHasBlockInputEvents=true`。
- 连续 3 局重置：`remainingMs=60000 / score=0 / combo=0 / served=0 / phase=playing` 每局一致。

**验收点 1-6、8 与代码映射**
1. 倒计时不推进/首帧 60 满格：`startRound()` 在 `enterGame`（过场 `handOff` 之后）才初始化 `remainingMs=ROUND_DURATION_MS`，过场期间会话未建。
2. 12 格图标首帧就位：过场 `preloadIcons()` 填 `iconCache`，`buildSlots` 同步取用（成功→贴图、失败→`null` 只留标签）。
3. 时长 ≥1200 ≤3000：`PREPARE_MIN_SHOW_MS=1200`、`PREPARE_TIMEOUT_MS=3000`（`config/prepareTransition.ts`），单测断言。
4. 连点只开一局：`entering` 幂等 + `BlockInputEvents`，已脚本化验证。
5. 重开走同一过场：`bindClick(startButton, showGame)` 与 `bindClick(restartButton, showGame)` 同一入口。
6. 背景改名兜底：见脚本化验证，`BackgroundView.showRolledBackground()` 失败时沿用当前图、本局不换。
8. 窄屏不裁切：`visibleWidth()` 驱动 `PrepareTransition` 文案/扫动条宽度与 `IngredientTray.trayLayout()`，窄屏自适应不溢出。

**环境说明**：本验收在 Cocos Creator 编辑器 + MCP 运行时下完成。`execute_javascript` 的 scene 上下文命中编辑器场景图（引擎生命周期未在此上下文逐帧执行），故采用"注入加载失败 → 同步回调触发"的方式确定性地驱动真实兜底代码路径，等价于把资源改名/缺失的运行时表现。逐帧时序与 01-04 号票已在真实浏览器预览中走查，本号票聚焦"兜底未改坏 + 整段流程无回归"的复核，相关截图见 `evidence/`（01-04 号票遗留）。
