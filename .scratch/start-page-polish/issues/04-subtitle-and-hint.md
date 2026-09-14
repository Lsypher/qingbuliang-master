# 04: 副标题底框与玩法说明的分层

**What to build:** 开始页的文字从"压在花哨背景上的裸文字"变成有层级的信息：副标题垫上一块圆角半透明黑框，在任意背景上都读得清；玩法说明从抢戏变成安静的辅助信息（字号更小、颜色更淡、挪到屏幕中间偏下，把中间让给画面）。窄屏下两者都完整可见。

**Blocked by:** 02（复用底座：圆角绘制）

**Status:** done

- [x] 副标题下方有一块圆角半透明黑框：圆角半径 16、黑色 45% 透明、内边距水平 28 / 垂直 14（设计像素）——场景里的 `SubtitleBox` 设计尺寸 506×75.88 = 文字 450×47.88 + 28×2 / 14×2，运行时按同一份内边距重画
- [x] 底框在渲染顺序上位于文字**下层**，不遮挡文字——场景子节点顺序 `… SubtitleBox, Subtitle …`，运行时 `placeSubtitleBox()` 兜住这条顺序（评审揪出的下标差一已修，见 Comments）
- [x] 底框宽度跟随文字盒宽：窄屏收窄时底框一起收窄，不出现"框比字宽"或"框切字"——框宽 = 文字盒宽 + 56，窄屏下文字盒宽由代码给定，关系是精确的
- [x] 底框与玩法说明共用同一个"当前可见宽度"来源，收窄行为与既有的文字收窄逻辑一致（不另起一份判断）——两者都走 `fitLineWidth()` → `uiFactory.visibleWidth()`
- [x] 玩法说明：字号降到 22、颜色比原来更淡、纵向位置挪到中间偏下（−230 量级）——场景实测 22 号 / 行高 28 / 颜色 150,162,182（原 196,206,222）/ y = −230
- [x] 把编辑器 Game View 拖窄到比 9:16 更窄时，副标题底框与说明文字都不被裁、不越界——窄屏算式逐档核对（见 Comments 的验证证据）；**拖窄后的截图证据按 spec 归 07 号票**，本机编辑器窗口抓不到游戏画面
- [x] 副标题文案仍是原来那句（苏轼句），仍来自集中文案表，未散落进场景——`STRINGS.subtitle`，场景里那串只是摆版预览值
- [x] 单局页与结算页不受影响——本次 diff 只落在开始页（`StartView` / `uiFactory` 的主题色 / 场景的开始页节点），其余视图组件与 `strings.ts` 未动

## Comments

实现完成（2026-09-14）。改动与验证如下。

### 改动清单

- `assets/scenes/main.scene`
  - 副标题 `Subtitle`：位置 232 → 205；字号 32 → 30、行高 42 → 38，盒 480×52.92 → **450×47.88**（新字号下引擎实测出来的自然宽高，不是按比例凑的）。
  - 玩法说明 `HowToPlay`：位置 120 → **−230**（背景底部的安静区）；字号 30 → 22、行高 39 → 28，盒 → 470.58×35.28；颜色 196/206/222 → **150/162/182**（比原来淡一档，压在背景压暗层上仍读得清）。
  - 新增 `SubtitleBox`：副标题的圆角底框。位置 (0, 205)、设计尺寸 506×75.88、图层 `UI_2D`、组件 `UITransform + Graphics`；在 `StartPage` 的子节点里排在 `Subtitle` **之前**，渲染因此在文字下层。框本身不在场景里画（Graphics 的绘制路径不序列化），由 `StartView` 运行时按当前文字盒绘制。
  - 顺手还原保存场景时编辑器回写的 Canvas 自动布局噪音（`_lpos` 80/920 → 360/640、内容尺寸 160×1840 → 720×1280），本次场景 diff 里只剩上面三处真正的改动。
- `assets/scripts/ui/uiFactory.ts`：`UI_COLOR` 新增 `subtitleBackdrop`（黑、α = 115 ≈ 45% 不透明）。绘制复用 02 票收口的 `paintRoundPanel`，没有新造画板。
- `assets/scripts/ui/StartView.ts`
  - 新增 `fitLineWidth(nodeName, sideMargin)`：**副标题与玩法说明共用的收窄**——装得下就保持场景里摆的设计宽（`Overflow.NONE` + 自动换行），装不下就收进"可见宽度 − 这一行自己的留白"（关掉换行 + `Overflow.SHRINK`，交给引擎缩字号）。可见宽度只有一个来源（`uiFactory.visibleWidth()`）。原先玩法说明那段独立实现被它取代，行为不变。
  - 新增 `fitSubtitle()`：先收窄文字 → 底框按"文字盒 + 内边距"重设尺寸 → `paintRoundPanel(box, subtitleBackdrop, 16)` 重画。文字与底框同一份尺寸来源，窄屏一起收窄。
  - 新增 `placeSubtitleBox()`：兜住"底框不能排在文字之后"这条渲染顺序（见评审修正）。
  - `refit()` 接上 `fitSubtitle()`，于是 `canvas-resize`（转屏、拖窗口）时标题缩放 / 副标题底框 / 玩法说明用的是同一次重排。
  - 副标题文案仍走 `STRINGS.subtitle`。

### 验证证据

- **场景实测**（MCP 场景脚本读回来的值）：`SubtitleBox` → size 506×75.88、`_layer` 33554432（UI_2D）、组件 `[UITransform, Graphics]`、子节点顺序 `TitleArt, TitleFallback, SubtitleBox, Subtitle, HowToPlay, BestScore, StartButton`。
- **绘制能力实测**：在编辑器里按 `drawPanel` 的同一序列跑一遍 `roundRect(506×75.88, r=16)` + `fill`，读回 `impl.paths = 1`、`points = 37`、`fillColor = (0,0,0,115)`、`renderDataList = 1`——圆角矩形确实画得出来、颜色就是那个 45% 不透明的黑。验证后已 `clear()`，未落盘。
- **窄屏（比 9:16 更窄）算式核对**，底框宽 = min(450, 可见宽 − 72) + 56：
  - 可见宽 **590 / 550 / 522**：文字仍是设计宽 450 → 底框 506，两侧余量 42 / 22 / 8；
  - 可见宽 **500 / 400 / 320**：文字收到 428 / 328 / 248 → 底框 484 / 384 / 304，两侧余量恒为 8。
  - 玩法说明 = min(470.58, 可见宽 − 40)，窄屏走 `Overflow.SHRINK`（盒子尺寸不被引擎改写，字号缩进去，不裁字也不折行）。
- `npm test`：28 个用例全绿（核心层 21 + 标题缩放 7，作为回归基线）；`npx tsc --noEmit` 与引擎脚本诊断（MCP `run_script_diagnostics`）均 **0 错误**。
- **单局页与结算页**：本次 diff 只落在开始页——`HudView` / `OrderCard` / `BowlView` / `IngredientTray` / `GuideHint` / `ResultView` 与 `strings.ts` 一行未动，结算页那行最高分仍是原有文案。

### 备注

- **截图证据归 07**：本机编辑器窗口抓不到游戏画面（`capture_preview_screenshot` 报 "Could not locate a visible 'game' panel"、`capture_game_screenshot` 只截到 Game View 的工具条，桌面截图时前台是 IDE）。按 spec，「窄屏截图 + 五处元素逐条目视」属 07 号票，本票以场景实测 + 绘制实测 + 算式核对替代。
- **底框在编辑器里不画**：Graphics 的绘制路径不序列化，而框的尺寸又来自实测文字宽，所以它只在运行时绘制；场景里留下来的是节点本身（位置与设计尺寸都能在检查器里看到、能调）。这与 ADR-0002「骨架进场景」不冲突——版面的位置与尺寸都在场景里。
- **"黑色 45% 透明"的口径**：取设计工具的写法（Black 45% = α 115 ≈ 45% 不透明）。若验收口径是"45% 透明度"（α ≈ 140），改 `UI_COLOR.subtitleBackdrop` 一个数即可。
- 玩法说明的新颜色写在场景里（与开始页其它文字颜色一样，场景是开始页文字颜色的来源），没有登记进 `UI_COLOR`——`UI_COLOR` 目前服务的是在代码里装配的那几页。
- `fitLineWidth` 对"可见宽度窄到装不下自身留白"（把窗口拖到极窄）这条死角加了下限兜底（`Math.max(0, …)`），与 `startPageLayout` 对同类死角的处理保持一致。
- 本票未改 `funplay-cocos-mcp.config.json`（运行中的 MCP 服务自己写的端口）。

### 评审结论（code-review 两轴，固定点 `HEAD`，两轴各一个只读子代理）

**Standards 轴**：一条硬性违规，已修；其余为判断题。

- **`placeSubtitleBox()` 的下标差一（已修）**：`box.setSiblingIndex(text.getSiblingIndex())` 会把底框插到文字**后面**——`setSiblingIndex` 是"先摘出自己、再插到该下标"，摘下底框之后文字的下标会前移一位。编辑器实测确认：原顺序 `…SubtitleBox, Subtitle…` 执行后变成 `…Subtitle, SubtitleBox…`，也就是半透明黑框会盖住字。改成"只在底框已经排到文字之后时才挪回去"（幂等，且不会把正确的顺序改坏）。
- **`fitLineWidth` 在极窄可见宽度下会算出负宽度（已修）**：加了 `Math.max(0, …)` 兜底，与 `startPageLayout` 的同类处理对齐。
- 判断题，保留：`fitSubtitle` 对同一节点取了两次（一次拿 `UITransform`、一次在 `fitLineWidth` 里拿 `Label`）——是树查找而不是重复逻辑；`fitHowToPlay` 只剩一行转发——有意保留，两行长文字各有一个说得出口的入口，读代码时不必到处跳。
- `UI_COLOR` 里 `subtitleBackdrop` 与 `backgroundDim` 同为半透明黑但数值不同——一个是文字底框、一个是全屏压暗，不合并。

**Spec 轴**：无缺失、无范围蔓延（子代理环境无 shell、没能跑 diff，把 03 票留下的标题代码误当成夹带；已用 `git diff HEAD -- assets/scripts/ui/StartView.ts` 逐块核对，本次改动只落在副标题 / 玩法说明 / 共用的收窄逻辑上）。三条被点到的可疑项处理如下：

- **「编辑器里看不见底框」** → 见备注，属已知形态（绘制路径不序列化）；节点与设计尺寸都在场景里，07 号票做目视验收。
- **「宽屏下框可能比字宽」** → `Overflow.NONE` 下引擎按实测文字宽改写盒子，那个宽与场景里的设计宽是同一号字量出来的（本次的 450 就是从 480 按 30/32 实测下来的）；窄屏下盒子宽由代码给定，精确等于"文字 + 56"。这条差异已写进 `fitSubtitle` 的注释。
- **「窄屏依赖 `canvas-resize` 是否触发」** → 该机制与 03 票的标题缩放共用，本票没有新引入事件路径；实测留证归 07 号票。
