# 01: 过场的出现、放行与硬切交接

**What to build:** 点「开摊」或「重开」之后，先出现一段全屏过场（此刻是盖住整屏的面板 + 一句文案，还没有动效），约 1.2 秒后过场熄灭、单局页出现，且单局页一出现就是 60 秒满格——计时不在过场期间推进。过场期间无论怎么点、怎么划，都不会影响到后面的对局：连点两下开摊也只开一局。**这是整件事的关键路径起点**：过场一出现，玩家"点下去就开跑、没有准备时间"这个问题就已经解决了。

**Blocked by:** None (can start immediately)

**Status:** done

- [x] 点开摊后先出现过场；过场结束时单局页第一帧就是 60 秒满格（倒计时数字与进度条都是满的）
- [x] 点重开走同一段过场，表现一致
- [x] 过场从出现到熄灭不少于 1200ms（该数值来自 `config` 层的常量，不是散落的字面量）
- [x] 过场期间连点开摊／重开只开一局；过场熄灭后立刻连点也不会重复开一局
- [x] 过场期间手指落在原按钮位置（过场不透明、按钮看不见）不会触发任何点击
- [x] 放行判据是不依赖引擎的纯函数，落在 `core` 层，配单测覆盖"未到最短时长 → 等待"与"已过最短时长 → 放行"两条分支
- [x] 切页与新开一局这两步的顺序与内容保持不变，只是被过场的亮起与熄灭包住
- [x] 过场层由组合根运行时装配到画布最上层，场景文件不因此需要回编辑器接线
- [x] 过场不是第 4 个界面状态：`CONTEXT.md` 的「过场」一节、`docs/adr/0003-prepare-transition.md`、`docs/design/mvp-spec.md` 界面小节补的那一行都已到位
- [x] `AGENTS.md` 里"本仓库无 git 远程"那句过时描述已纠正

## Comments

实现完成（2026-09-16）。改动、验证与评审如下。

### 改动清单

- **新增 `assets/scripts/core/entryGate.ts`**：放行判据 `decideEntry(elapsedMs, settled, total, limits)`，签名与 spec 逐字一致；不 `import` 引擎，所以能被 vitest 直接测。超时那条**先判且不看预载状态**——预载再有几项永远不回调，到点也必须放行。
- **新增 `assets/scripts/config/prepareTransition.ts`**：`PREPARE_MIN_SHOW_MS = 1200`、`PREPARE_TIMEOUT_MS = 3000`。文件名与前缀都用 `prepare`（准备过场），避开 `balance.ts` 里那个指"出餐换顾客"的 `SERVE_TRANSITION_MS`。没塞进 `balance.ts`：那份是单局规则数值，过场是纯表现层时序。
- **新增 `assets/scripts/ui/PrepareTransition.ts`**：过场层组件。`begin(onHandOff)` 亮起并重置计时；`update` 每帧把"过了多久"喂给判据；`handOff()` 里顺序固定为**回调（切页 → 开一局新的）→ 熄自己**，熄过场排在最后，这就是"过场保持不透明到最后一帧"的实现。内容由代码画：整屏面板（`paintPanel` + `UI_COLOR.transitionBackdrop`，完全不透明）+ 一句文案（`createLabel` + `STRINGS.prepareTransition`），并挂 `BlockInputEvents` 吃掉盖住范围内的全部输入。内容在 `begin` 里显式建（不写 `onLoad`：本层初始隐藏，隐藏节点上的组件不执行 `onLoad`）。
- **`assets/scripts/ui/GameRoot.ts`**：
  - `assemblePrepareTransition()`：按节点名认领/新建过场层节点（整屏尺寸），`setSiblingIndex(children.length - 1)` 保证盖在背景与三页之上，并按其既有套路加"存在性判断"，场景里已经挂了也不会重复挂；初始 `active = false`。
  - `showGame()`：`entering` 幂等标志 + `prepareTransition.begin(() => this.enterGame())`；过场层没装配上时退回改动前的直接进入（宁可没有过场，也不能把玩家挡在开始页）。
  - `enterGame()`：仍是"切页 → `startRound()`"这两步、顺序与内容一字未改；`entering` 延到下一帧（延迟 0 的定时器）才解开。
- **`assets/scripts/config/strings.ts`**：新增 `prepareTransition: '正在备料…'`（刻意不带海南味，方言配额已给结算页与连击）。
- **`assets/scripts/ui/uiFactory.ts`**：`UI_COLOR` 新增 `transitionBackdrop`（与面板同色系，但完全不透明——过场期间底下的按钮必须看不见）。
- **新增 `tests/entryGate.test.ts`**：3 个用例（节拍常量、未到最短时长等待、已过最短时长放行）。
- **文档**：`AGENTS.md` 那句纠正、`CONTEXT.md` 新增「过场」一节、`docs/design/mvp-spec.md` 界面小节那一行、`docs/adr/0003-prepare-transition.md`——这四处在动手前已写好，本次核对到位、未再改动。
- **`assets/scenes/main.scene` 一行未动**：过场层是运行时装配的，不需要回编辑器接线；也就没有 ADR-0002 提醒的那类编辑器回写噪声。

### 验证证据

- **单测**：`npm test` → 3 个文件 37 个用例全绿（新增 3 个；既有 34 个作为回归基线）。
- **类型与脚本**：`npx tsc --noEmit` exitCode 0；引擎脚本诊断（MCP `get_script_diagnostic_context`）exitCode 0、0 错误。
- **浏览器预览实测**（编辑器预览服务 `http://localhost:7456/`，视口 720×1280，用 playwright-cli 驱动鼠标点击 canvas，按"连续截同一块画面、看在哪一帧变了"测时序）：
  - **开摊路径**：点击后约 **60ms** 出现全屏过场（`evidence/transition-after-start.png`）；过场期间画面逐帧一致（面板静止），到 **1196ms** 那一帧仍是过场；检测到画面变化（= 交接完成）分别在 **1325ms / 1396ms** 各测一次 → 过场时长 **1265ms / 1338ms**，均 ≥ 1200ms。
  - **交接那一帧的单局页**：倒计时 **60**、进度条满格、分数/订单/连击都是 0（`evidence/round-first-frame-after-start.png`）。
  - **连点**：第 646ms 在按钮原位（360,1175）再点一次，**没有**第二段过场、**没有**第二局，交接仍只发生一次。
  - **重开路径**：跑完一局（60 秒）进结算页 → 点重开 → 同样出现过场（`evidence/transition-after-restart.png`），从点击到交接约 **1.23s**，交接后单局页首帧同样是倒计时 60 满格（`evidence/round-first-frame-after-restart.png`）。
  - **背景**：两次实测拿到不同背景，说明"每局随机抽一张、一局之内不切换"的既有行为没被改坏（抽图/显示的拆分是 02 号票的事）。
  - 证据截图存 `.scratch/prepare-transition/evidence/`（4 张，含两条路径各一组）。
- **回归**：`HudView` / `OrderCard` / `BowlView` / `IngredientTray` / `GuideHint` / `ResultView` / `BackgroundView` / `GameSession` / `core/session.ts` 一行未动，既有的缺图兜底（背景保留旧图、图标跳过这一格）也没碰。

### 评审结论（code-review 两轴，固定点 `HEAD`，两轴各一个只读子代理）

**Standards 轴**：无硬违规（注释中文且到位、标识符英文、过场复用 `paintPanel` / `createLabel` / `UI_COLOR` 未重复封装、切页与开局两步未删改、文案与常量各归其位）。判断题四条，处理如下：

- `{minShowMs, timeoutMs}` 在 `PrepareTransition.ts` 与 `entryGate.test.ts` 各组装了一次 → **保留**：那是放行判据的入参形状（spec 定下的签名），两处都是"这次调用传什么"，抽到 `config` 会引入 config → core 的倒向依赖。
- `TRANSITION_*` 与既有 `SERVE_TRANSITION_MS` 术语碰撞（都叫 transition，指两件事）→ **已采纳**：改名 `PREPARE_MIN_SHOW_MS` / `PREPARE_TIMEOUT_MS`、文件 `config/prepareTransition.ts`，`GameRoot` 的字段与常量同步改 `prepareTransition` / `PREPARE_TRANSITION_NODE`。
- `GameRoot` 兼管切页、三层装配与过场编排（Divergent Change）→ **保留**：ADR-0003 的 Consequences 已写明"过场层的装配、整屏吃触摸与幂等标志都落在组合根上"是自觉取舍。
- `settled / total` 当前恒传 `0, 0`（Speculative Generality）→ **保留**：形状由 spec 锁定，02、03 号票要接真预载。

**Spec 轴**：无缺失、无范围蔓延，10 条验收点逐条对得上；四处文档逐条打开确认到位。三处存疑的处理：

- 单测里"已过最短展示时长 → 放行"那条原先把 `PREPARE_TIMEOUT_MS` 也列了进去，那个点实际命中的是**超时**分支，不是最短展示边界 → **已改**成 `PREPARE_TIMEOUT_MS - 1`，让这一条只走"最短展示已过"；超时分支的用例按 03 号票的 checkbox 在那张票里补。
- `scheduleOnce(…, 0)` 旁的注释写"再多等一帧"与 delay=0 读起来含糊 → **已改写**清楚（延迟 0 = 下一帧）。
- `docs/design/mvp-spec.md` 的「相关文档」一节没列 ADR-0003 → **不动**：那一节连 0002 都没列，本票只要求补界面小节那一行，顺手加别的会引入与本票无关的改动。

### 备注

- **01 里超时分支走不到**：没有要预载的东西，`settled >= total` 恒真（判据退化成"只等最短展示时长"），`PREPARE_TIMEOUT_MS` 那条要到 03 号票接上真预载才可能被命中。代码注释里已写明这是过渡形态。
- **两个原始问题各自归谁**：本次只解决"没有准备时间"。"背景抽定提前 + 不跳一下"属 02，"12 格图标不逐格冒"属 03——实测里 12 格图标确实是进页之后才补齐的，与 spec 的问题陈述一致。
- **比 9:16 更宽的窗口**：本次实测的窗口是 720×1230，可见设计宽度略大于 720，设计区之外的画布底色条一直存在（背景图与三页面板都是 720 宽），过场与其它页表现一致，不是本次引入的。
- 本票未改 `funplay-cocos-mcp.config.json` 与 `settings/` 下的文件（运行中的编辑器自己写的，与本次无关）。
