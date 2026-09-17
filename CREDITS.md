# 素材来源与许可

登记游戏里用到的每一份外部素材及其许可。依据 `docs/adr/0001-asset-sourcing-and-licensing.md`：只用授权明确的素材（CC0 / MIT / CC-BY / 项目自备），来源不明的素材站一律不用。

## 背景图（5 张：4 张单局随机池 + 1 张开始页专属）

按 `docs/art/background-prompts.md` 的出图需求产出、由用户交付。原始文件为 1600×2848 PNG，已随提交 `e0ed041` 入库；需要取回原图时执行 `git checkout e0ed041 -- assets/art/backgrounds`。仓库里现存的是下面这套压缩后的上线档位。

| 文件 | 内容 | 来源 |
| --- | --- | --- |
| `assets/resources/art/backgrounds/qilou-street-night.jpg` | 骑楼老街夜市 | 按出图需求产出，用户交付 |
| `assets/resources/art/backgrounds/qingbuliang-stall-night.jpg` | 清补凉夜市摊 | 同上 |
| `assets/resources/art/backgrounds/palm-coast-dusk.jpg` | 椰林海岸黄昏 | 同上 |
| `assets/resources/art/backgrounds/li-brocade-pattern.png` | 黎锦纹样底纹 | 同上 |
| `assets/resources/art/backgrounds/start-page.jpg` | 清补凉夜市摊（**开始页专属**，固定不随机） | 用户交付，源图 607×1080 |

**已处理的素材问题（12 号切片验收时发现并裁掉）**：4 张图右下角都带 **"豆包AI生成"** 水印；`palm-coast-dusk.jpg` 还不只是水印——它是一张手机截图，顶部带着手机状态栏（电量百分比 / 信号 / Wi-Fi / 电池图标），底部还有 home 指示条。单局页底部被配料盘盖住看不见，但**开始页与结算页压暗后两者都清晰可见**。处置方式：**从 `e0ed041` 的原图裁切**（原图未动，要重出可整张替换）。四张统一按 9:16 收边：裁下 98 px、左右各 26 px；`palm-coast-dusk` 另裁上 138 px、左右各 65 px。

压缩档位（约束：单张 ≤400 KB、合计 ≤1.6 MB）：

| 文件 | 档位 | 体积 | 保真度（PSNR，相对缩放后原图） |
| --- | --- | --- | --- |
| `qilou-street-night.jpg` | 1080×1920 JPEG q80 | 334 KB | 34.2 dB |
| `qingbuliang-stall-night.jpg` | 1080×1920 JPEG q86 | 295 KB | 37.9 dB |
| `palm-coast-dusk.jpg` | 1080×1920 JPEG q86 | 162 KB | 39.5 dB |
| `li-brocade-pattern.png` | 540×960 PNG-128 调色板 | 342 KB | 33.0 dB |
| `start-page.jpg` | 607×1080 JPEG q90 | 102 KB | 38.7 dB |
| **合计** | | **1235 KB** | |

开始页专属背景 2026-09-15 由用户交付（交付件是 607×1080 的 JPEG，原扩展名为 `.png`，入库时按真实格式改名为 `.jpg`）；交付时已按验收清单核对：四角放大无生图工具水印、无手机状态栏 / home 指示条，比例即 9:16，无需裁切——只做了一次 q90 重编码压进 400 KB 以内。

黎锦纹样是满幅几何图案：JPEG 在细线上振铃明显且压不进 400 KB，改用减色 PNG（线条锐利、无振铃），代价是分辨率降到 540×960。

## 配料图标

玩家自绘的**透明底 PNG**，文件名即配料 id，放在 `assets/resources/art/ingredients/`，换图（同名替换）不用动代码、也不用回编辑器接线。图标为原创作品（非第三方素材），无需对外署名；游戏内致谢处（`STRINGS.creditLine`）登记为"原创手绘（玩家自绘）"。

| 配料 id | 中文标签 | 文件 |
| --- | --- | --- |
| `coconut_milk` | 椰奶 | `coconut_milk.png` |
| `coconut_water` | 椰子水 | `coconut_water.png` |
| `brown_sugar_water` | 红糖水 | `brown_sugar_water.png` |
| `red_bean` | 红豆 | `red_bean.png` |
| `mung_bean` | 绿豆 | `mung_bean.png` |
| `sago` | 西米 | `sago.png` |
| `taro_ball` | 芋圆 | `taro_ball.png` |
| `watermelon` | 西瓜丁 | `watermelon.png` |
| `mango` | 芒果丁 | `mango.png` |
| `macaroni` | 通心粉 | `macaroni.png` |
| `grass_jelly` | 仙草冻 | `grass_jelly.png` |
| `quail_egg` | 鹌鹑蛋 | `quail_egg.png` |

红豆与绿豆现各有独立手绘图，不再共用图标、也不再靠染色区分；图标颜色直接由美术原图决定。椰奶（牛奶杯）与椰子水（椰子）本就是不同图标，无歧义。

## 开始页界面图（4 个文件）

按 `docs/art/ui-prompts.md` 的出图需求产出、由用户交付（项目自备，来源与授权策略同背景图，见 `docs/adr/0001-asset-sourcing-and-licensing.md`）。全部是 32 位透明底 PNG，放在 `assets/resources/art/ui/`，按文件名在运行时加载——**同名覆盖即换图**，不改代码、不回编辑器接线。

| 文件 | 内容 | 规格（设计 / 导出） | 实际交付 |
| --- | --- | --- | --- |
| `title-art.png` | 标题艺术字「清补凉大师」 | 560×160 / 1120×320 | 2400×800 |
| `start-button.png` | 开摊按钮底图（正常态） | 360×140 / 720×280 | 2400×800 |
| `start-button-pressed.png` | 开摊按钮底图（按下态） | 360×140 / 720×280 | 2400×807 |
| `best-score-trophy.png` | 最高分奖杯图标 | 44×44 / 88×88 | 2048×2048 |

**交付图与规格的偏差（已知，程序侧不做补偿；重出后同名覆盖即生效）**：

- **标题艺术字**交付为 2400×800（3:1），规格是 1120×320（3.5:1）。代码按图自身高宽比算显示高度，所以不会被拉变形，但显示高度比设计稿略高。
- **按钮底图**交付为 2400×800 / 2400×807（两态高度还差 7px），规格是 720×280。四角圆头半径约 328px、几乎占满半个画布，九宫格因此切不出中段（`left` 只能取到 843、`top` 取 328，见 `docs/art/ui-prompts.md` 的"九宫格准备"一行），按钮目前由四块角块拼成。两张图刻意用**同一组**边距，避免按下换图时木牌跳动。
- **奖杯**交付为 2048×2048 方画布，奖杯本体只占 (328,456)–(1712,1640)，即画布宽的约 68%、高的约 58%，且导入时未裁剪（`rect` 就是整张画布）。按 44×44 节点渲染时奖杯本体约 30×26 像素，比设计的 44×44 小一圈。

三张图的规格与提示词在 `docs/art/ui-prompts.md`；图缺失时的兜底（标题文字 / 按钮占位底 / 奖杯不显示破图）记在该文档末段。
