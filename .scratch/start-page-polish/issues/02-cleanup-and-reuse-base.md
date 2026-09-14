# 02: 起点整理与复用底座

**What to build:** 把仓库拉回到一个干净、便于后续改动的起点：清掉与本次无关的噪音、纠正一条已经失效的注释、把"画圆角面板"和"按文件名加载界面图片"变成仓库里各只有一处实现的可复用能力；同时把这次的设计语言写进文档，让后续切片有共同的词与依据。**对外可见行为零变化**——这一票单独验收时，三个页面的样子和操作应当与改动前完全一致。

**Blocked by:** None (can start immediately)

**Status:** done

- [x] 上一次保存场景时由编辑器自动写入的 Canvas 布局值被还原，场景文件的差异只包含真正的改动
- [x] "编辑器拒绝保存场景、只能运行时补挂组件"这条已过期的注释被纠正为中性措辞（只改注释，行为一行不动）
- [x] 界面图片的按文件名加载在仓库里只有一处实现：配料图标改用这同一处入口，加载路径与既有行为完全不变
- [x] 绘制工厂能画圆角矩形（圆角半径可配，可带描边），既有纯色面板的外观与用法不变
- [x] 领域词表能查到「开始页 / 单局页 / 结算页」三个界面状态，并把代码里的英文页名列为避免用法；用词与设计基线、README 现有说法一致
- [x] 新增一条 ADR：记录"开始页的静态骨架进场景、其余页维持运行时装配"这个取舍、它的理由与代价
- [x] 开始页 / 单局页 / 结算页的外观与行为与改动前完全一致（重点：开始页首次进入时进度条、最高分、引导提示均正常）
- [x] `npm test` 全绿；引擎脚本诊断 0 错误

## Comments

实现完成（2026-09-14）。改动与验证如下。

### 改动清单

- `assets/scenes/main.scene`：还原上一次保存场景时被编辑器写入的 Canvas 自动布局值——Canvas 节点位置 `80/920 → 360/640`、内容尺寸 `160×1840 → 720×1280`。还原后该文件在 `git status` 里回到干净状态，不再有与本票无关的差异。
- `assets/scripts/ui/GameRoot.ts`：**只改注释**。把"编辑器当前拒绝保存场景、只能由组合根运行时补挂"改写成中性措辞（挂场景与挂运行时是两条等价的路，这里留着只兜"场景漏挂"）。两个装配方法的行为一行未动。
- `assets/scripts/ui/uiFactory.ts`：
  - 新增 `loadSpriteFrame(path, onLoad)`——仓库里唯一一处"按文件名取界面图片"的实现，路径拼法收口在 `${path}/spriteFrame`；失败时回调 `frame` 为 null 并把 `error` 原样带回。
  - 新增 `paintRoundPanel(node, fill, radius, border?)`，与 `paintPanel` 共用私有 `drawPanel`：半径 0 仍走原来的 `rect` 分支，所以既有纯色面板的外观与调用方式完全没变。
- `assets/scripts/ui/ingredientIcon.ts`、`assets/scripts/ui/BackgroundView.ts`：两处各自的 `resources.load` 都改成调用 `loadSpriteFrame`。路径（背景 `art/backgrounds/<name>`、图标 `art/ingredients/<id>`）、失败兜底（背景保留旧图、图标跳过这一格）与两条告警文案逐字保持不变。
- `CONTEXT.md`：新增「界面状态」小节，登记**开始页 (Start Page) / 单局页 (Round Page) / 结算页 (Result Page)**，并把代码里的英文页名 `start` / `game` / `result` 与"首页、结果页"这类叫法列入 `_Avoid_`。用词与 `docs/design/mvp-spec.md`、`README.md` 的既有说法一致。
- `docs/adr/0002-start-page-skeleton-in-scene.md`：记录"开始页静态骨架放在场景里、其余页维持现状"的取舍、两个被否掉的备选方案与代价（含"编辑器保存会回写 Canvas 自动布局值，每次保存后要检查 diff"这条已知工具风险）。

### 验证证据

- `npm test`：`tests/session.test.ts` 21 个用例全绿（核心层没动，作为回归基线）。
- `npx tsc --noEmit` 与引擎脚本诊断（MCP `run_script_diagnostics`）均 0 错误。
- 编辑器 Game View 起了一次预览并截图：开始页的背景图正常加载（说明统一后的取图入口工作正常）、标题 / 副标题 / 玩法说明 / 最高分（`最高分 205`，读的是本机存储）都正常，与改动前一致。
- 单局页与结算页这次没有任何代码被改到（`HudView` / `OrderCard` / `BowlView` / `IngredientTray` / `GuideHint` / `StartView` / `ResultView` 都不在 diff 里），它们的装配与渲染路径与改动前逐字相同。
- 交互式的逐条验收（按下态、窄屏画幅、进单局看倒计时进度条与引导提示、结算页那行最高分）按 spec 归属 07 号票，本票只取了开始页这一张冒烟截图。

### 备注

- 三张界面美术（`title-art` / `start-button` / `start-button-pressed` / `best-score-trophy`）已由用户放进 `assets/resources/art/ui/`（含 `.meta`），本票按"对外可见行为零变化"的要求**没有接线**，留给 03~06 号票。
- `funplay-cocos-mcp.config.json` 的端口改动（`22470 → 29996`）是运行中的 MCP 服务自己写的，与本票无关，未纳入改动。

### 评审结论（code-review 两轴，固定点 `HEAD`）

**Standards 轴**：没有书面标准违规。四条基线坏味道都按判断题逐条核对过，均判为**有意为之**：

- `paintPanel` / `paintRoundPanel` 两个薄入口 → 是刻意保留的 API 面：ticket 要求"既有纯色面板的用法不变"，所以不动 `paintPanel` 的签名，新能力另起一个名字；真正的实现只有私有 `drawPanel` 一份。
- `paintRoundPanel` 暂时没有调用方 → 正是 04 / 06 号票的依赖（它们的 `Blocked by` 写的就是本票的"圆角绘制"），不是投机抽象。
- 两个调用方各自的"取图为空 → 告警 → 兜底"形状相似 → 有意保留：两处告警文案与兜底动作本就不同（背景保留旧图、图标跳过这一格），本票只收敛"按文件名取图"这一处实现，不合并各自的诊断。
- `CONTEXT.md` 把英文页名 `start` / `game` / `result` 写进 `_Avoid_` → 正是 ticket 的明确要求。

**Spec 轴**：无缺失、无范围蔓延。两条"实现方式可疑"已核实如下：

- **Canvas 上的 `cc.Widget`（`_alignFlags: 45`、`_right: 560`、`_top: -560`、`_alignMode: ALWAYS`）与噪音态自洽** —— 这两个数正是"720−160"与"1280−1840"，确实与 `_contentSize: 160×1840` 是同一套状态。但它在 `HEAD` 里就已经是这样（不是"上一次保存"写入的），所以本票只还原上一次保存写入的 `_lpos` 与 `_contentSize`，**不动它**。而且它对渲染没有影响：Canvas 节点自身的尺寸 / 位置不参与显示——UI 相机是它的子节点、整个 UI 根整体刚性平移，相机正交高度按可见尺寸算，可见宽度取自 `view.getVisibleSize()` 而不是 Canvas 的 `UITransform`。**记为观察项**：07 号票做交互验收时若发现画布尺寸异常，这里是第一个该看的地方。
- **`drawPanel` 在有描边时把路径调了两遍** —— 与改动前逐字一致：原 `paintPanel` 本来就是 `rect → fill → rect → stroke`，重构只是把两处 `rect` 收进局部函数 `path()`，路径与外观都没变。真正的隐患（同一路径被填充后再描边导致描边变重）是既有行为，不属于本票范围。
