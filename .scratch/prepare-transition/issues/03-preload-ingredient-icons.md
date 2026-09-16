# 03: 12 格配料图标预载，放行判据接真

**What to build:** 过场期间把全部 12 个配料图标预载完；放行条件从"只等固定时长"变成"等固定时长与预载完成取较晚者"，并保留 3 秒硬超时。第一次开摊进入单局页时，12 格配料图标已经全部就位——不再一张一张往外冒。**这一条做完，这次需求的两个问题都被解决。**

**Blocked by:** 02

**Status:** done

- [x] 首次开摊（图标从未加载过）进入单局页时，12 格配料图标全部已就位，没有逐格冒出的过程
- [x] 放行条件为 `max(最短展示时长, 预载完成)`，并保留 3000ms 硬超时（三个数值都来自 `config` 层的常量）
- [x] 任一图标加载失败即计入已决并放行，缺的那格沿用既有兜底（只显示中文标签），不阻塞进局
- [x] 放行判据的单测覆盖四条分支：未到最短时长且未预载完 → 等待；已预载完但未到最短时长 → 等待；已预载完且过最短时长 → 放行；超时（无论预载状态）→ 放行
- [x] 重开一局（图标已在缓存）时过场仍走满最短展示时长，但不会多等
- [x] 过场期间单局页仍然隐藏，其组件不参与逐帧推进（计时不可能偷跑）
- [x] `npm test` 全绿；引擎脚本诊断 0 错误

## Comments

实现完成（2026-09-16）。改动、验证与评审如下。

### 改动清单

- **`assets/scripts/ui/ingredientIcon.ts`**：`createIngredientIcon` 新增可选第 5 个参数 `preloadedFrame`。
  - `undefined`（默认，标盘之外 / 缓存未热的路径）→ 仍走原异步加载，标盘、订单卡、碗、跟手幽灵行为不变；
  - 传**有效帧** → 同步贴上，配料盘建格子的那一帧图标就位，不出现逐格冒出的过程；
  - 传 `null`（预载失败）→ 不赋图，沿用既有兜底（只显示中文标签），这一格不阻塞进局。
  这是"预载到手"与"建格子用图"两件事能同步的关键——与背景层的 `rolledFrame` 同源思路。
- **`assets/scripts/ui/IngredientTray.ts`**：
  - 新增 `iconCache: Map<string, SpriteFrame | null>`：过场期间预载到的帧缓存（失败存 `null`）。
    缓存随组件实例长存，重开时图标已在资源层命中缓存、这里也还是热的，不会重复读盘，也不会多等。
  - 新增 `preloadIcons(): PreloadTask[]`：交出 12 项预载任务，一项对应一格配料图标；每项**有结果**（成功或失败）时调用 `done`。
    加载路径留在配料盘自己这一层，过场只数"已决几项"、不区分成败（缺图各有各的兜底，不在这里再判一次）。
    本方法在过场开始前被组合根调用，那时本组件 `onLoad` 还没跑（单局页还隐藏），不依赖任何由 `onLoad` 建立的字段。
  - `buildSlots` 建格子图标时改为 `createIngredientIcon(slot, id, 52, 'Icon', this.iconCache.get(id))`：预载已到手就同步贴、没到手回退异步加载。
- **`assets/scripts/ui/GameRoot.ts`**：
  - 留下配料盘引用：`assembleTray()` 按节点认领单局页上的 `IngredientTray`（同样带存在性判断，兜"场景漏挂"）。
  - `showGame()` 把 `tray.preloadIcons()` 的 12 项并入 `preloads` 数组交给过场；背景任务与图标任务各自把加载路径留在本层，组合根只做编排。
  - `core/entryGate.ts` 与 `config/prepareTransition.ts` 一行未动——放行判据与节拍沿用 01/02 定的形状与常量。
- **`tests/entryGate.test.ts`**：在原有 3 条基础上补到 7 条，覆盖接真预载后的四条分支（含"预载先回也不能提前放行""超时先看且不看预载状态"两条）；总项数用真实值 `PRELOAD_TOTAL = 13`（12 配料 + 1 背景）便于对照。

### 验证证据

- **单测**：`npm test` → 3 个文件 41 个用例全绿（`entryGate.test.ts` 由 3 增到 7，覆盖四条分支；既有 34 个作为回归基线）。
- **类型与脚本**：`npx tsc --noEmit` exitCode 0；引擎脚本诊断（`get_script_diagnostic_context`）exitCode 0、0 错误。
- **逻辑核对（首局路径）**：点开摊 → `showGame` 先请背景层抽定、请配料盘交出 12 项预载 → 过场 `begin` 跑 13 项任务；`max(最短展示 1200ms, 13 项全决)` 放行，
  交接那一帧 `IngredientTray.onLoad` 才跑 `buildSlots`，此时 `iconCache` 已全填好，12 格图标同步贴上——第一帧就位，不逐格冒出。
- **逻辑核对（重开路径）**：图标已在资源层命中缓存、`iconCache` 也仍热；13 项任务几乎瞬间全决，过场由 `minShow=1200ms` 主导、走满最短展示时长但不会多等。
- **失败兜底**：任一图标加载失败 → 该任务 `iconCache.set(id, null)` 并 `done()`，计入已决、不阻塞放行；交接后那格 `createIngredientIcon` 收到 `null` 不赋图，只显示中文标签，沿用既有兜底。
- **超时兜底**：加载卡住时过场在 3000ms 硬超时放行（判据的超时分支先判且不看预载状态），未到手的格回退进页后异步加载。
- **计时不偷跑**：过场期间单局页仍 `active=false`，`IngredientTray.onLoad` 未跑、其组件不参与逐帧推进；单局计时由 `enterGame` 里的 `startRound()` 建立，落在交接之后。
- **回归**：`BackgroundView` / `PrepareTransition` / `HudView` / `OrderCard` / `BowlView` / `ServeFeedback` / `MisdropFeedback` / `GameSession` / `core/session.ts` 一行未动；
  `renderIconRow` 与跟手幽灵走 `createIngredientIcon` 默认参数，行为不变；既有缺图兜底（背景保留旧图、图标跳过这一格）没碰。
- **`assets/scenes/main.scene` 未动**：过场层与配料盘仍是运行时装配 / 场景已挂，没有编辑器回写噪声。

### 备注

- **本票没有新加测试缝**：放行判据（`core/entryGate.ts`）是 01 定的唯一缝，本票只把它接真；配料盘的预载任务沿用 02 定的 `PreloadTask` 形状与 `PrepareTransition.begin(onHandOff, preloads)` 收口。
- **"12 格图标就位"的体感**：预载是让 13 项在过场里并发完成、缓存命中，进页后同步贴图；冷启动时它们是"同一帧贴上"而非"几百毫秒里一张张冒"，这与 spec 问题陈述里"逐格冒出"要消掉的正好相反。
- **没做浏览器逐帧实测**：本机运行中的编辑器预览（playwright 驱动、按连续截帧看图标在哪帧补齐）无现成脚本，未补该证据；逻辑与单元层已覆盖路径，如需要可后续补截图证据。
