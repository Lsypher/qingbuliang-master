# 02: 本局背景在过场前抽定并预载

**What to build:** 过场出现之前，本局要显示的那张背景已经被抽定；过场这段时间里它被预载，等过场结束、单局页出现时背景直接就是这张图，不再"啪"地跳一下、也没有空白期。背景池与随机源的知识仍然留在背景层，组合根只做编排。

**Blocked by:** 01

**Status:** done

- [x] 进单局页时背景在切换的瞬间就已就位，没有"先空一下再出来"
- [x] 抽图与显示被拆成两步：抽定发生在过场开始前，过场结束时显示的是**抽定的那一张**，不再重抽
- [x] 连续重开若干局，每局背景仍是随机、且各局之间正常变化（没有被钉死成同一张）
- [x] 背景池与随机源仍留在背景层，组合根不知道有哪些背景
- [x] 背景预载失败或超时时不阻塞放行，背景保留旧图（既有兜底不变）
- [x] 一局之内背景不切换；换图时旧图仍按既有做法释放，不出现"预载的那张被误释放"

## Comments

实现完成（2026-09-16）。改动、验证与评审如下。

### 改动清单

- **`assets/scripts/ui/BackgroundView.ts`**：抽图与显示拆成三步。
  - `rollRoundBackground(): PreloadTask`：过场开始前由组合根调用。抽定本局背景（池与随机源都留在本层），并交出一项"预载它"的任务给过场；只抽不显示。
  - `showRolledBackground()`：过场结束那一帧随切页走到这里，把预载到手的帧**同步**换上，不再重抽；预载没到手（失败或超时放行时还没回来）就沿用当前这张、**本局不再换**。
  - `applyFrame()` / `currentSprite()`：从原 `showAt` 里抽出来的"换上一帧并把上一张放掉"与"当前精灵是否还活着"，两处换图走同一条释放路径（同一张不重复释放）。
  - 预载回调带一道"本局抽定的还是这一张"的判定：上一局那笔悬而未决的加载晚回来时，不能覆盖新一局的待显示状态；认不认结果都报"有结果"，否则过场要白等到超时。
- **`assets/scripts/ui/uiFactory.ts`**：新增 `PreloadTask = (done: () => void) => void`。谁拥有资源谁交任务（背景层给背景、配料盘给 12 格图标），加载路径因此各自留在自己那层，过场只数"已决几项"、不区分成败。
- **`assets/scripts/ui/PrepareTransition.ts`**：`begin(onHandOff, preloads)` 先把任务跑起来并记下"已决数/总数"，`update` 把这两个真实数值喂给既有的 `decideEntry`——放行条件从"只等固定时长"变成 `max(最短展示时长, 预载完成)`，3000ms 硬超时不变。每项预载只认第一次回调，避免已决数虚高让判据提前放行。`core/entryGate.ts` 与 `config/prepareTransition.ts` 一行未动。
- **`assets/scripts/ui/GameRoot.ts`**：留下背景层引用；`showGame()` 在**亮起过场之前**先让它抽定本局背景，并把交出的预载任务转交给过场。组合根只做编排——不知道背景池里有哪几张。
- **`tests/` 与场景**：一行未动。`assets/scenes/main.scene` 未动（过场层仍是运行时装配，没有编辑器回写噪声）。
- **新增证据**：`evidence/02-round-first-frame-after-start.png`、`evidence/02-round-first-frame-after-restart.png`。

### 验证证据

- **单测**：`npm test` → 3 个文件 37 个用例全绿（与 01 号票同一份基线，本票未增删用例）。
- **类型与脚本**：`npx tsc --noEmit` exitCode 0；引擎脚本诊断（MCP `get_script_diagnostic_context`）exitCode 0、0 错误；浏览器控制台 0 个来自本改动的 error。
- **开摊路径（整页重载 = 资源缓存全清，即"背景图冷加载"的真实处境）**：点击前背景 `start-page`；过场亮起那一帧（t=19ms）本局背景**已经抽定**为 `qilou-street-night`；交接那一帧 `已拿到帧=true`、`在显示的帧=qilou-street-night` = 抽定的那张；交接后连续 **95 帧**里出现过的背景帧集合只有一个值 → 没有晚到的换图、没有"啪"地跳一下。
- **重开路径（真实跑完一局 60 秒 → 点"再来一碗"）**：点前背景 `qilou-street-night`；过场亮起那一帧已抽定为 `li-brocade-pattern`；过场时长 **1195ms**；交接帧 `已拿到帧=true`、`在显示的帧=li-brocade-pattern` = 抽定的那张；交接后 **101 帧**背景帧集合只有一个值。截图 `02-round-first-frame-after-restart.png`：倒计时 60 满格、背景已就位、分数/订单/连击都是 0。
- **连续重开 6 局**（走重开按钮绑定的同一个 `showGame`）：抽定路径依次 `palm-coast-dusk`、`palm-coast-dusk`、`qingbuliang-stall-night`、`qingbuliang-stall-night`、`palm-coast-dusk`、`li-brocade-pattern`——随机、各局之间正常变化，且每局"在显示的帧"都等于本局抽定的那张。序列里出现过**连续两局抽到同一张**，第二局照常显示，说明"预载的那张恰是当前正在显示的那张"时不会被误释放。
- **故障注入（拦下 `cc.resources.load` 的背景图这一路，并固定抽到与当前不同的一张）**：
  - **失败**（150ms 后回调 error）：抽定 `qingbuliang-stall-night`、交接前背景 `qilou-street-night` → 过场 **1186ms** 就放行（不阻塞），交接帧 `已拿到帧=false`，交接后 49 帧背景一直是 `qilou-street-night`（保留旧图、局中不换）。
  - **永不回调（加载卡住）**：过场 **2988ms**（≈3000ms 硬超时）放行，交接帧 `已拿到帧=false`，交接后 38 帧背景一直是 `qilou-street-night`（保留旧图）。
  - 这条也第一次真正走到了 `PREPARE_TIMEOUT_MS` 那条分支——01 号票没有要预载的东西，判据那时退化成只看时间。
- **截图**：`02-round-first-frame-after-start.png` 是冷启动单局页首帧——背景已是本局抽定的那张（12 格配料图标仍是空的，那是 03 号票的事，与 spec 的问题陈述一致）。
- **回归**：`core/entryGate.ts`、`config/prepareTransition.ts`、`HudView` / `OrderCard` / `BowlView` / `IngredientTray` / `GuideHint` / `ResultView` / `GameSession` / `core/session.ts` 一行未动；既有的缺图兜底（背景保留旧图、图标跳过这一格）没碰。

### 评审结论（code-review 两轴，固定点 `HEAD`，两轴各一个只读子代理）

**Standards 轴**：硬违规 1 条、判断题 4 条，处理如下：

- 类头那句"内存上只留当前一张…任意时刻只会显示一张"与本改动新增的预载帧自相矛盾 → **已采纳**：补写"唯一的例外是过场那一小段，预载到的下一张与正在显示的上一张会同时在场，交接换图时上一张随 `applyFrame` 放掉"。
- `rolledPath` / `rolledFrame` / `rolledSettled` 三个字段像 Data Clumps → **部分采纳**：`rolledSettled` 随下面那条超时裁决一起删掉了，只剩"抽定路径 + 预载到的帧"两个字段，凑不成一个类型。
- `rollRoundBackground` 的回调与 `showAt` 形状重复 → **保留**：一处是"存起来等交接换"，一处是"立刻换上"，共用的只有 `loadSpriteFrame` 本身（早已在 `uiFactory` 收口）。
- `begin` 的 `preloads` 参数与 `PreloadTask` 眼下只有一位调用方（Speculative Generality，轻）→ **部分采纳**：去掉没人用的 `= []` 默认值；数组形状保留（ADR-0003 已定 03 号票要接配料盘那 12 张）。
- `GameRoot` 兼管切页与过场编排、`PreloadTask` 放在 `uiFactory` → **保留**：ADR-0003 的 Consequences 已写明组合根职责；`PreloadTask` 与它唯一依赖的 `loadSpriteFrame` 同一文件。

**Spec 轴**：无缺失、无范围蔓延，6 条验收点逐条对得上；两处存疑的处理：

- spec 写「组合根…让背景层先抽定本局背景**并取回路径**，过场预载它」，实现成"背景层交出一项预载任务"，路径不出背景层 → **保留**：功能等价，且更贴合同一条里的"背景池与随机源留在背景层、组合根不知道有哪些背景"（组合根连路径都不经手）；预载到的帧必须留在背景层，才能在交接那一帧同步换上——若把路径交出去让别处加载，反倒要把帧再递回背景层，多一层耦合。
- 原实现在"超时放行时预载还没回来"那一支退回既有的异步换图，被判与会破掉"一局之内背景不切换"（也会让玩家在本局中途看到"啪"地跳一次，正是本票要消掉的东西）→ **已采纳**：失败与超时合并成同一句"沿用当前这张、本局不再换"，`rolledSettled` 随之删除，理由写在 `showRolledBackground` 的注释里。

### 备注

- **超时分支这时才第一次走得到**：判据的形状与常量都是 01 号票定的，本票只是把 `settled / total` 换成真值；`PREPARE_TIMEOUT_MS` 要到"加载卡住"时才被命中（注入实测 2988ms，按帧粒度计）。
- **放行判据四条分支的单测仍按 03 号票的 checkbox 在那张票里补**：本票没动 `tests/entryGate.test.ts`，只用注入实测覆盖了超时分支的行为。
- **03 号票接手时不用再动判据与节拍**：`PrepareTransition.begin(onHandOff, preloads)` 已经收任务数组，配料盘只要交出 12 项预载任务即可。
- 本票未改 `funplay-cocos-mcp.config.json` 与 `settings/` 下的文件（运行中的编辑器自己写的，与本次无关）。
