# 开始页界面出图需求与提示词

给《清补凉大师》**开始页**出 2 类图、共 3 个文件：开始按钮底图 2 张（正常 / 按下）、最高分奖杯图标 1 张。以下提示词可直接复制使用（中文版读起来最直观，英文版给英文美术或英文工具）。

> 按当前实际交付，按钮的正常 / 按下两态是**同一个文件**（见下一段提示），所以真正要收的只有"一张按钮图 + 一张奖杯图"。

> **标题艺术字已作废（2026-09-22）**：开始页改成整屏封面图，标题与副标题画在图里，不再需要一张透明底艺术字，`title-art.png` 也已从仓库删除。下方"图 1"只作历史记录保留——**不要照它出图**，要改开始页的标题请重出封面图（`assets/resources/art/backgrounds/start-page.png`，见 `docs/adr/0004-start-page-cover-art.md`）。

> **开始按钮底图已换成另一张图（2026-09-23）**：当前用的是**自带"开始游戏"四个字**的胶囊按钮（240×86，正常 / 按下同一个文件），它**不走九宫格**、按钮上的文字节点已停用。下方"图 2"是上一版（木牌、图上无文字、九宫格 843/328）的出图需求，**只作历史记录保留——不要照它出图**；要改按钮外观，直接换 `assets/resources/art/ui/start-button.png`（见 `docs/adr/0011-start-button-art-carries-its-own-text.md`）。本文件里所有"按钮两态 / 图上不许有文字 / 九宫格边距"的要求随之作废。

> **素材来源**：本批图按**项目自备（用户交付）**处理，只用授权明确的素材（见 `docs/adr/0001-asset-sourcing-and-licensing.md`）。**本次不启用 AI 生成**——要用生图工具产出，得先改那条 ADR；下面的提示词只是出图依据，不改变这条策略。

## 通用规格（每张都必须满足）

| 项 | 要求 |
|---|---|
| 画幅 | 一律**横平竖直的正构图**（正投影、左右对称），不要四边加边框、不要透视斜角；**没有统一画幅比**——这是透明底裁切件（不是满幅背景），画布就是各自的"设计尺寸 ×2"，逐张见规格表 |
| 导出倍率 | **2 倍**：设计像素 ×2 导出（每张的导出尺寸见各自规格表）；导出后不要再缩放，由引擎缩 |
| 透明通道 | **必须是 32 位透明底 PNG**（带 alpha）；不要白底 / 黑底，不要 JPG |
| 四周透明留白 | 逐张数值见各自规格表；留白必须**四边等宽、完全透明**（图 2 按钮底图例外：刻意铺满画布、不留外圈，理由见该表） |
| 阴影 / 外发光 | **图上一律不带投影、外发光、底晕**。"图上有阴影就没法调光影"：光影由引擎统一处理，图上自带阴影既没法再调、缩放时还会露出硬边 |
| 风格 | 中国南方糖水铺 / 海南夜市气质；暖色调，与现有的 5 张背景（单局池 4 张 + 开始页封面图）同族，别冷、别灰 |
| 禁止 | 任何水印、设备界面元素（手机状态栏 / 电量 / 信号 / 时间 / home 指示条）、文字乱码、写实照片风 |

**通用风格串（可拼在每条提示词末尾）**

- 中文：`扁平厚涂质感，暖色调，柔和光晕，正投影，纯透明底，无文字无水印，不要投影不要外发光`
- 英文：`flat painterly finish, warm color palette, soft glow, straight-on view, pure transparent background, no text no watermark, no drop shadow no outer glow`

**通用负向提示词**

`水印, 生成工具水印, 文字乱码, 手机状态栏, 电量百分比, 信号图标, Wi-Fi 图标, 时间, home 指示条, 白底, 黑底, 投影, 外发光, 冷色调, 灰调, 写实照片, 边框, 透视斜角`

---

## 图 1 · 标题艺术字「清补凉大师」（**已作废**，仅作历史记录，不要照它出图）

| 项 | 要求 |
|---|---|
| 内容 | 五个汉字**横排一行**：清 补 凉 大 师；不竖排、不换行、不加副标题、不加装饰外框 |
| 设计尺寸 | 560×160（五字整体占满安全区） |
| 导出尺寸 | **1120×320**（2 倍） |
| 四周透明留白 | 四周各留 **20px（设计像素；2 倍图即 40px）**——五字**不贴边**，窄屏缩小时才有余量 |
| 阴影 / 外发光 | **不带**。要立体感请用"**字内渐变 + 描边**"表达，不要投影 |
| 配色 | 主体暖金渐变（亮部 `#FFD98A`、暗部 `#E8B44F`），一圈深棕细描边保证压在浅色底上也清晰，可加一点奶白高光 |

**中文**

> 「清补凉大师」五个汉字横排成一行，中式糖水铺招牌 / 游戏标题艺术字：字形圆润饱满、略带手写招牌味，主体为暖金色渐变（亮部 #FFD98A、暗部 #E8B44F），字缘一圈深棕细描边以便压在浅色底上也读得清，字面可有一点奶白高光；五个字间距均匀、整体居中、不换行；纯透明底，四周留白，**不带投影、不带外发光、不带底晕**；扁平厚涂质感，暖色调，无水印无乱码。

**English**

> Chinese title lettering “清补凉大师” — five characters in a single horizontal row, a dessert-shop signboard / game title wordmark: rounded plump strokes with a slightly hand-painted signboard feel, warm gold gradient (highlight #FFD98A, shadow #E8B44F), a thin dark-brown outline so it stays legible on light backgrounds, a touch of cream highlight on the face; even letter spacing, all five glyphs centered, no line break; pure transparent background with margin on all sides, **no drop shadow, no outer glow, no background halo**; flat painterly finish, warm color palette, no watermark, no garbled text.

---

## 图 2 · 开始按钮底图（正常 / 按下，共 2 张）（**已被当前底图取代**，仅作历史记录，不要照它出图）

| 项 | 要求 |
|---|---|
| 造型 | 木牌 / 椰壳招牌质感的**圆角横牌**（不是纯色方块、不是玻璃拟物） |
| 设计尺寸 | 360×140 |
| 导出尺寸 | **720×280 ×2 张**（正常态、按下态各一张） |
| 四周透明留白 | **不留外圈透明边**：整块木牌**铺满画布**（按钮就是按 360×140 用的，留白会让木牌缩水）。若要留，最多 4px（设计）且四边等宽 |
| 九宫格准备 | 四角装饰必须整块收在**角块内**，且角块要小到留得下中段：按 2 倍图（720×280）说，装饰**距边不超过 360（水平）× 140（竖直）像素**；中间区域必须是**可无限拉伸的均匀平纹**（无独立图案、无焦点），横向拉伸时不能出现被拉长的具象东西。**当前交付图没做到这一条**（角部圆头大得占满了半个画布，见下一行），重出时按本条来 |
| 九宫格切边（给程序用） | 引擎把 `SpriteFrame` 的 border **同时**当两样用：纹理里的切分位置（**原图像素**）与角块画出来的大小（**设计像素**）——所以它是按**交付回来的原图**量的，不能照设计稿换算。两条硬约束：① `left ÷ top = 360 ÷ 140`（角块画出来多宽 = 节点宽 ÷ (left + right)、多高 = 节点高 ÷ (top + bottom)，只有这个比例能让四角**同倍缩放**、圆头不变形）；② `left ≤ 180、top ≤ 70`，否则两倍角块放不下 360×140 的按钮，引擎会把角块等比缩小、把中段挤成 0（仍是"不变形"，但按钮由四块角块拼成、丢掉画面正中的高光）。当前交付图实测角部圆头半径约 328px、左右装饰到 336px，故取 **left / right = 843、top / bottom = 328**（已写进 `.meta`）；它满足①但不满足②（圆头太大），所以按钮目前是四块角块拼的。装饰收到"距边 ≤ 360×140px"后，border 就能回到 **180 / 70** 这一档、中段也回来了 |
| 阴影 / 外发光 | **不带投影、不带外发光**；立体感用"顶部一道柔和高光 + 底边略暗"表达 |
| 文字 | 图里**不要**出现"开摊"或任何文字——文字由引擎作为子节点叠在图上 |
| 两态差异 | 见下方"按下态要求" |

**按下态要求（与正常态对照）**

- 整体**压暗约 15%**；
- 顶部高光**收窄、变弱**，边缘可有一点**向内的暗边**表达"被按下去"的凹陷感；
- 造型、四角装饰、木纹走向、画布尺寸、透明底**与正常态完全一致**；
- 差异要**一眼能看出"按下了"**，但**不能靠换色调**（两态必须同一色族，只分亮暗）。

**中文（正常态）**

> 手机游戏开始按钮底图，一块横向的木牌 / 椰壳招牌：暖棕色木纹底，四角做圆角并带简化的椰壳 / 藤编包角装饰，**牌面中间是均匀、无焦点花纹的平整木纹**（便于横向拉伸不变形），顶部一道柔和高光表现立体感；左右、上下对称，正投影，**无文字**；纯透明底，整块招牌铺满画布，**不带投影、不带外发光**；扁平厚涂质感，暖色调，无水印。

**English（正常态）**

> Mobile game start-button base — a horizontal wooden plaque / coconut-shell signboard: warm brown wood grain, rounded corners with simplified coconut-shell / rattan corner ornaments, **the center panel is an even, focus-free flat wood texture** (safe to stretch horizontally without distortion), a soft top highlight for slight depth; left-right and top-bottom symmetric, straight-on view, **no text**; pure transparent background, the plaque fills the canvas, **no drop shadow, no outer glow**; flat painterly finish, warm color palette, no watermark.

**中文（按下态）**

> （与上一张**同一块木牌**，作为"**按下态**"）整体比正常态**压暗约 15%**，顶部高光收窄、变弱，边缘有一点向内的暗边表达被按下去的凹陷感；造型、四角装饰、木纹、尺寸、透明底与正常态**完全一致**，两张放一起能明显看出差别；无文字，不带投影、不带外发光。

**English（按下态）**

> (The **same wooden plaque** as the previous image, now the **"pressed" state**) darkened about 15% overall, top highlight narrowed and dimmed, a subtle inner dark edge suggesting the plaque is pressed down; otherwise identical in shape, corner ornaments, wood grain, size and transparent background to the normal state, so the two read clearly different side by side; no text, no drop shadow, no outer glow.

---

## 图 3 · 最高分奖杯图标

| 项 | 要求 |
|---|---|
| 内容 | 一个小奖杯：**碗形杯身 + 两侧对称把手 + 小底座**，剪影清晰，缩小后仍一眼认得出是奖杯 |
| 设计尺寸 | 44×44 |
| 导出尺寸 | **88×88**（2 倍） |
| 四周透明留白 | 四周各留 **2px（设计像素；2 倍图即 4px）**——杯子与把手**不贴边**，避免被裁 |
| 配色 | **与标题同一金色家族**：暖金渐变（亮部 `#FFD98A`、暗部 `#E8B44F`）配深棕细描边；**不要冷金 / 白金 / 银灰**，否则和标题金色脱节 |
| 阴影 / 外发光 | **不带投影、不带外发光**；立体感用字内渐变与描边表达 |

**中文**

> 一个简洁的手机游戏**奖杯图标**：碗形杯身 + 两侧对称把手 + 小底座，剪影清晰、缩小后一眼认得出是奖杯；暖金色渐变（亮部 #FFD98A、暗部 #E8B44F）配深棕细描边，与标题金色**同一色族**；纯透明底，居中，四周留白，**不带投影、不带外发光**；扁平质感，暖色调，无水印。

**English**

> A simple mobile game **trophy icon**: a bowl-shaped cup with two symmetric handles and a small base, clear silhouette still readable when tiny; warm gold gradient (highlight #FFD98A, shadow #E8B44F) with a thin dark-brown outline, the **same gold family as the title**; pure transparent background, centered, with margin on all sides, **no drop shadow, no outer glow**; flat finish, warm color palette, no watermark.

---

## 收图检查清单

> **按钮相关的第 1、4、7 条随"图 2"一起作废**：当前按钮底图自带文字、不走九宫格、正常 / 按下是同一个文件（见文件头的提示）。奖杯那几条（第 2、3、5、6、8 条）照旧。

1. **尺寸与倍率对得上**：按钮 `720×280`（正常 / 按下各一张）、奖杯 `88×88`；全部是 **32 位透明底 PNG**。（标题艺术字已作废，不再收。）
2. **无水印**——包括**生图工具水印**（上次背景图就裁过一次"豆包AI生成"这类角标）。
3. **无设备界面元素**：手机状态栏、电量百分比、信号 / Wi-Fi / 电池图标、时间、home 指示条。**上次有一张背景其实是带状态栏的手机截图**，逐张放大看四边。
4. **无文字乱码**：**按钮图与奖杯图里都不许出现任何文字**，也别出现坏字 / 错别字。
5. **色调与现有 4 张背景统一**（都偏暖），把新图与背景放一起看，别一张冷一张暖。
6. **留白到位、不贴边**：奖杯杯子不贴边；四周透明边四边等宽（按钮底图例外，它刻意铺满画布）。
7. **按钮两态可辨**：正常态与按下态放一起能明显看出差别；四角装饰都收在角块内（按 2 倍图说，距边 ≤ 360×140px），中间是均匀平纹。
8. **通用动作：把每张图摆到 720×1280 的视图里、按真实显示尺寸看一眼**——觉得糊、发虚、边缘有硬边，或按钮中间纹理被拉出条纹，就**重出**。

## 交付方式

图片丢进 `assets/resources/art/ui/` 就行（**必须在 `resources` 下**——美术资源是按文件名在运行时加载的），文件名按下表**固定**：

| 图 | 文件名 |
|---|---|
| ~~标题艺术字~~（**已作废**） | ~~`title-art.png`~~ |
| 开始按钮底图（正常态） | `start-button.png` |
| 开始按钮底图（按下态） | `start-button-pressed.png` |
| 最高分奖杯图标 | `best-score-trophy.png` |

**同名覆盖文件即生效**：同路径覆盖同名图片时，引擎的资源标识不变，场景与代码的引用都不会断——**换图不需要改代码、不需要回编辑器接线**。

**导入设置固定（交付前对一眼）**：奖杯图标这张**透明底裁切件**保持
「裁剪 = 关闭（保留原始画布，位置才与设计稿对得上）」「参与自动图集 = 关」——后者是避免将来开启图集时边缘渗色。按钮底图同样保持这两项（九宫格靠原始画布上的切分位置定位，
被裁或进图集都会让角块对不上），另外**九宫格边距也记在 `.meta` 里**（`borderTop/Bottom/Left/Right`），
换图时若只丢 PNG、不覆盖 `.meta`，边距会连同这两项一起回到默认值（0），按钮的四角就会跟着变形。
连 `.meta` 一起覆盖最省事；只丢 PNG 的话，新导入的文件会回到默认设置，需要手工再设一次。
其中**九宫格那条只对旧木牌底图有效**：当前按钮底图是整图拉伸，它的九宫格边距在 `.meta` 里是 0，
只丢 PNG 也不会变形；"不裁剪、不进图集"这两项仍要照做。

**图没到位时页面照常可验收（不阻塞开发）**：按钮显示程序化木色圆角占位底图、奖杯缺失时那一行只显示文字、不显示破图。版面与层级当天就能对照验收；图一到（同名覆盖）自动生效。
