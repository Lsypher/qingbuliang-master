# 01: 开始页换成整屏封面图，拆掉标题 / 副标题 / 玩法说明

Status: done

**What to build:** 开始页换成一张把标题与副标题都画进去的整屏**封面图**（`start-page.png`，1600×2848）；场景里删掉 `TitleArt`、`TitleFallback`、`Subtitle`、`SubtitleBox`、`HowToPlay` 五个节点，开始页只留最高分行与开摊按钮。

决策已经 grilling 收敛，落在 `docs/adr/0004-start-page-cover-art.md`，本票不重开。

**已定（每条都经用户确认）：**

1. 新图**同名覆盖** `art/backgrounds/start-page`，扩展名改 `.png`，**原样入库（不压缩）**；压缩连同单局池那 4 张另开一项，不混进本次。
2. 场景删**五个**节点（含两个配套的：`TitleFallback` 是艺术字的文字兜底、`SubtitleBox` 是副标题的圆角底框）。
3. 接受开始页因此少两行字：苏轼副标题换成图上的「— 60秒限时配对 —」；操作说明改由单局页首局引导承担。
4. `strings.ts` 的 `title` / `subtitle` / `howToPlay` **三个键全删**（零引用，留着只会让人以为开始页文案还归文案表管）。
5. 最高分行与开摊按钮的新坐标（`−430` / `−545`）由实现改到起点值，**最终位置由用户在编辑器里微调定稿**。
6. 最高分段压在亮沙滩上**先按无底衬看效果**；读不清再给文字加描边，不新增场景节点。
7. 生产代码清账：删 `StartView` 的标题 / 副标题 / 玩法说明相关方法与常量、`startPageLayout.ts` 的标题算法、`uiFactory` 的 `subtitleBackdrop`；`tests/titleArt.test.ts` 换成 `tests/startPageSkeleton.test.ts`。
8. 删 `assets/resources/art/ui/title-art.png` 与它在 `CREDITS.md` 里的登记行。
9. 新增 ADR-0004、给 ADR-0002 加"部分被取代"注记、`CONTEXT.md` 补「封面图」词条。

**顺带定下的两条（由第 2 条自动推出）：** `StartView` 的 `canvas-resize` 重排监听与 `refit()` 一起删除（重排的三件事全没了）；`UI_COLOR.subtitleBackdrop` 删除（唯一用户是副标题底框）。

**Blocked by:** 无

## 验收

- [x] 开始页显示新封面图，图上标题与「60秒限时配对」完整可见 —— 证据 `evidence/01-start-page-cover.png`
- [ ] 窄屏（比 9:16 更窄）下图上居中的文字不被裁、两侧装饰被裁掉属预期 —— **未验**（没做窄屏截图，留用户过一眼）
- [x] 最高分行与开摊按钮都落在图上大碗下方的区域，互不重叠、不压到碗 —— 证据 `evidence/01-start-page-cover.png`（最高分 `−430`、按钮 `−545` 的起点值成立）
- [x] 单局页与结算页无回归 —— 证据 `evidence/02-round-page-no-regression.png`、`evidence/03-result-page-no-regression.png`
- [ ] 图片槽位为空 / 加载失败时，按钮仍显示程序化占位底、最高分行仍只显示文字，页面不开天窗 —— **未验**（兜底逻辑在 `StartView` 重写时按原语义保留：奖杯缺失只显示文字、按钮底图缺失留着程序化占位底，两条路径都还在；但重写后没有重新实跑，要一次缺图验证）
- [x] `npm test` 全绿（73 条）；`npx tsc --noEmit` 与 IDE 诊断 0 错误

## Comments

### 改动清单（2026-09-22）

**资源**

- 新封面图入库为 `assets/resources/art/backgrounds/start-page.png`（1600×2848，4.6 MB 原样），`.meta` 由编辑器生成（`refresh_assets` 触发，uuid `6b0584f3-…`）。
- 删 `start-page.jpg` + `.meta`；删 `art/ui/title-art.png` + `.meta`。

**场景**（MCP 改，非手改 JSON）

- `Canvas/Pages/StartPage` 删除 `TitleArt`、`TitleFallback`、`Subtitle`、`SubtitleBox`、`HowToPlay` 五个节点，剩 `BestScore` 与 `StartButton`。
- 坐标：最高分行 `−330 → −430`，开摊按钮 `−490 → −545`。
- 保存后核对 diff：只有对象数组的索引重编号、那两行 `y`、以及编辑器重排序列化顺序，**没有** Canvas 自动布局噪音。

**代码**

- `ui/StartView.ts`：删 `showTitle` / `applyTitleArt` / `fitTitle` / `fitSubtitle` / `placeSubtitleBox` / `fitLineWidth` / `fitHowToPlay` / `refit` 与 `lineDesignWidths`、`TITLE_ART_PATH`、`TITLE_ART_NODE`、`TITLE_FALLBACK_NODE` 及全部标题/副标题/玩法说明常量；`onEnable` 只剩最高分与按钮；`canvas-resize` 监听随 `refit` 一起去掉。
- `ui/startPageLayout.ts`：删标题相关的 `TITLE_DESIGN_WIDTH/HEIGHT`、`TITLE_SIDE_MARGIN`、`TITLE_MAX_MARGIN_RATIO`、`fitTitleWidth`、`fitTitleScale`；只剩最高分那一行。文件头注明"封面图上的字不参与任何运行时计算"。
- `config/strings.ts`：删 `title` / `subtitle` / `howToPlay`，文件头加"开始页那几行字不归文案表管"的例外说明。
- `ui/uiFactory.ts`：删 `UI_COLOR.subtitleBackdrop`，并把引用它的 `backgroundDim` 注释改成引用还在的底衬。

**测试**

- 删 `tests/titleArt.test.ts`，新增 `tests/startPageSkeleton.test.ts`（4 条：开始页只剩两部分 / 那五个节点不存在 / 最高分结构 / 按钮结构与绘制顺序）。
- `tests/startPageLayout.test.ts`：删标题的 7 条，留最高分的 6 条。

**文档**

- 新增 `docs/adr/0004-start-page-cover-art.md`；`docs/adr/0002-…` 顶部加"内容清单部分已被 0004 取代"。
- `CONTEXT.md`：`开始页` 词条改成"一张封面图（标题与一行限时提示画在图上）、最高分与开摊按钮"，新增 `封面图 (Cover Art)` 词条。
- `docs/design/mvp-spec.md`、`README.md`、`CREDITS.md`、`docs/art/ui-prompts.md`（图 1 标作废墓碑）、`.scratch/start-page-polish/spec.md`（偏离注记追加本次）同步。

### 验证方式

- `npm test` 73 条全绿；`npx tsc --noEmit` 0 错误；IDE 诊断 0 错误。
- 浏览器预览（编辑器预览服务 `http://localhost:7456/`）+ playwright 驱动：开始页截图 → 点开摊按钮 → 单局页截图 → 等满 60 秒 → 结算页截图。全程控制台 **0 error**。

### 后续调整（2026-09-22，用户提出）

**最高分那行改成金色**：仓库里的原色是**白 `(255,255,255)`**（查 `HEAD` 的场景 JSON 可得）。改成项目统一的金色——`UI_COLOR.textAccent` 的值 `(255,226,168)`，它是仓库里唯一的金色常量（汤底标签、倒计时也在用），不新造第二种金。改的是**场景里** `BestScore/Label` 的 `_color`：骨架样式归编辑器，与本次拆除后的分工一致，代码没动。

**同时给它加了描边**：金色落在亮沙滩上几乎看不见（用户要的正是金色，不能靠改回深色来回避）。按 ADR-0004 里认可的做法——奖杯图自己就是"金色 + 一圈深棕细描边"才压得住浅底（`docs/art/ui-prompts.md` 图 3 的行文），开摊按钮的文字描边也是同一套——给这行加 `enableOutline`、`outlineColor (74,44,20)`、`outlineWidth 3`，与按钮文字**同一档**。证据 `evidence/04-best-score-gold.png`。

> 这是 Q6 约定的兜底路径（"最高分段压在亮底上先按无底衬看效果；读不清再给文字加描边，不新增场景节点"）第一次真的被触发，用的是 Label 自带的描边能力，没有新增节点。若嫌描边重，把 `outlineWidth` 调到 2 即可。

**一处当时的误记（复审纠正）**：动手前我在编辑器里读到该 Label 的实时颜色是橄榄黄 `(171,175,68)`，就把"原色"写成了它——那是**编辑器里未保存的改动**，仓库里从来没有过这个值（`HEAD` 的场景 JSON 里 `"g": 175` 出现 0 次）。副作用记一笔：`save_current_scene` 会把编辑器里**所有**未保存改动一起写盘；事后核对场景 diff，只有两处 `y`、颜色/描边四行与对象数组索引重编号，没有别的意外改动。

### 顺手发现（**不属本次改动，未处理**）

- **结算页文字在明亮的单局背景上读不清**：`食饱未？`／各项数值都是白字压在亮沙滩上，因为整屏压暗层 `backgroundDim` 的 alpha 早先被调成 0（见 `docs/adr/` 之前那次"关闭整屏背景压暗"的调整，本次未动它）。开始页靠封面图自带的深色区托文字，结算页没有这个条件。见 `evidence/03-result-page-no-regression.png`。要修的话是一次独立的小改动。
