# 04: 过场的动效与文案

**What to build:** 过场不再是一块静止的面板：出现一条不定式来回扫动的进度条，配一句中文文案。整段过场给人"在做事"的感觉，而不是"卡住了"。全部由代码绘制，不依赖任何尚未加载的美术资源。

**Blocked by:** 01

**Status:** done

- [x] 过场里有一条持续的不定式动效（来回扫动），在整个过场期间不停顿、不结束
- [x] 文案从 `config` 层的文案表读取，中文、语气与游戏一致，且不带方言（方言配额已用在别处）
- [x] 配色取自统一配色表，不与既有界面产生第二套色系
- [x] 不新增任何美术资源文件；过场不依赖未加载的图片（否则会卡在"等自己"）
- [x] 窄屏（可见宽约 590）下过场内容不被裁切
- [x] 连续多次进入过场，观感一致，没有动效残留或状态串味

## Comments

实现完成（2026-09-16）。改动、验证与评审如下。

### 改动清单

- **`assets/scripts/config/prepareTransition.ts`**：
  - 新增 `PREPARE_SWEEP_PERIOD_MS = 1400`（扫动一个来回的时长，与最短展示时长错开，避免观感像"卡帧"）。
  - 新增纯函数 `sweepPhase(elapsedMs, periodMs?)`：把过场经过时间映射成 0→1→0 的三角波相位，不碰引擎、可被 vitest 直接测；按可见宽度相关逻辑无关，只做算术。
- **`assets/scripts/ui/PrepareTransition.ts`**：
  - `build()` 里新增扫动条：按 `visibleWidth()` 算宽（取 `min(520, 可见宽−100)`），用 `createUiNode` 建 `PrepareBar` 子节点挂 `Graphics`；文案框宽也改取 `visibleWidth()`，两者窄屏都不裁切。
  - 新增 `drawBar()`：每帧 `clear()` 后重画底槽（半透明圆角长条，`UI_COLOR.barTrack`）+ 扫动段（实色圆角短条，`UI_COLOR.barFill`），段中心由 `sweepPhase(elapsedMs)` 决定、左右往返。配色复用统一配色表，不另起一套。
  - `begin()` 复位 `elapsedMs = 0` 后立刻 `drawBar()` 画首帧（停在左端），避免首帧空白；`update()` 每帧驱动 `drawBar()`，整段过场不停顿、不结束。
  - 复用既有 `paintPanel` / `createLabel` / `createUiNode` / `visibleWidth` / `UI_COLOR`，未重复封装。
- **`tests/prepareSweep.test.ts`**（新增，6 个用例）：锁 `sweepPhase` 的外部行为——相位恒在 [0,1]、起点=左端(0)、半周期=右端(1)、整周期回左端、左右对称、重入（`elapsedMs` 归零）相位一致。

### 验收点对应

- **持续不定式动效**：`update()` 每帧按 `elapsedMs` 重算相位，与放行判据无关，过场不熄不停顿。
- **文案从 config**：沿用 `STRINGS.prepareTransition = '正在备料…'`（01 已落地，刻意不带方言）。
- **配色统一**：复用 `UI_COLOR.barTrack` / `barFill`（与倒计时条同色系）。
- **无美术资源**：扫动条由 `Graphics` 代码绘制，无新增图片、不依赖未加载资源。
- **窄屏不裁切**：条宽与文案框宽均按 `visibleWidth()` 收窄（590 可见宽 → 条宽 490、文案框 590，居中不溢出）。
- **连进一致无残留**：`begin` 复位 `elapsedMs` 使每次从同一相位起步；`drawBar` 每帧 `clear()` 不累加，上一局残影被下一局首帧覆盖。

### 验证证据

- **单测**：`npx vitest run` → 4 个文件 **47 个用例全绿**（新增 6 个；既有 41 个作回归基线）。
- **类型与脚本**：`npx tsc --noEmit` exitCode 0；Cocos 引擎脚本诊断（MCP `get_script_diagnostic_context`）exitCode 0、0 错误。
- **静态核对**：`GameRoot` / `uiFactory` / `strings` / `entryGate` 一行未动；过场仍非第 4 个界面状态、切页与开局两步顺序未改。

### 备注

- 扫动条尺寸（高 12、段占轨道 35%、周期 1400ms）属表现层手感，均集中在 `PrepareTransition.ts` 顶部常量，调手感只改这几处。
- 本票未回编辑器接线：`PrepareBar` 是运行时装配的子节点，场景文件无需改动。
