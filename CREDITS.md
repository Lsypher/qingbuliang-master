# 素材来源与许可

登记游戏里用到的每一份外部素材及其许可。依据 `docs/adr/0001-asset-sourcing-and-licensing.md`：只用授权明确的素材（CC0 / MIT / CC-BY / 项目自备），来源不明的素材站一律不用。

## 背景图（4 张）

按 `docs/art/background-prompts.md` 的出图需求产出、由用户交付。原始文件为 1600×2848 PNG，已随提交 `e0ed041` 入库；需要取回原图时执行 `git checkout e0ed041 -- assets/art/backgrounds`。仓库里现存的是下面这套压缩后的上线档位。

| 文件 | 内容 | 来源 |
| --- | --- | --- |
| `assets/resources/art/backgrounds/qilou-street-night.jpg` | 骑楼老街夜市 | 按出图需求产出，用户交付 |
| `assets/resources/art/backgrounds/qingbuliang-stall-night.jpg` | 清补凉夜市摊 | 同上 |
| `assets/resources/art/backgrounds/palm-coast-dusk.jpg` | 椰林海岸黄昏 | 同上 |
| `assets/resources/art/backgrounds/li-brocade-pattern.png` | 黎锦纹样底纹 | 同上 |

**待处理的素材问题（12 号切片上线验收时发现）**：4 张图右下角都带 **"豆包AI生成"** 水印；`palm-coast-dusk.jpg` 还不只是水印——它是一张手机截图，顶部带着手机状态栏（电量百分比 / 信号 / Wi-Fi / 电池图标），底部还有 home 指示条。单局页底部被配料盘盖住看不见，但**开始页与结算页压暗后两者都清晰可见**。处置待定：首选重出（去掉水印、不要拿手机截图当底图）；退一步可由脚本裁掉水印带（底部约 5%，`palm-coast-dusk` 还要连顶部约 3% 的状态栏一起裁）。

压缩档位（约束：单张 ≤400 KB、合计 ≤1.6 MB）：

| 文件 | 档位 | 体积 | 保真度（PSNR，相对缩放后原图） |
| --- | --- | --- | --- |
| `qilou-street-night.jpg` | 1080×1920 JPEG q80 | 329 KB | 34.1 dB |
| `qingbuliang-stall-night.jpg` | 1080×1920 JPEG q86 | 293 KB | 37.9 dB |
| `palm-coast-dusk.jpg` | 1080×1920 JPEG q86 | 159 KB | 39.3 dB |
| `li-brocade-pattern.png` | 540×960 PNG-128 调色板 | 339 KB | 33.2 dB |
| **合计** | | **1121 KB** | |

黎锦纹样是满幅几何图案：JPEG 在细线上振铃明显且压不进 400 KB，改用减色 PNG（线条锐利、无振铃），代价是分辨率降到 540×960。

## 配料图标

取 Microsoft Fluent Emoji 的 **3D 风格** PNG（256×256、带透明通道），许可 **MIT**，仓库 `microsoft/fluentui-emoji`（分支 `main`）。文件名即配料 id，放在 `assets/resources/art/ingredients/`，换图（同名替换）不用动代码、也不用回编辑器接线。

按 `docs/adr/0001-asset-sourcing-and-licensing.md`：MIT 不强制署名，但本项目统一在游戏内致谢处（见 `STRINGS.creditLabel`）与 `CREDITS.md` 登记来源。

| 配料 id | 中文标签 | Fluent Emoji 素材名 | 文件 |
| --- | --- | --- | --- |
| `coconut_milk` | 椰奶 | Glass of milk | `coconut_milk.png` |
| `coconut_water` | 椰子水 | Coconut | `coconut_water.png` |
| `brown_sugar_water` | 红糖水 | Bubble tea | `brown_sugar_water.png` |
| `red_bean` | 红豆 | Beans（染暖红区分） | `red_bean.png` |
| `mung_bean` | 绿豆 | Beans（同图，染绿区分） | `mung_bean.png` |
| `sago` | 西米 | Cooked rice | `sago.png` |
| `taro_ball` | 芋圆 | Dango | `taro_ball.png` |
| `watermelon` | 西瓜丁 | Watermelon | `watermelon.png` |
| `mango` | 芒果丁 | Mango | `mango.png` |
| `macaroni` | 通心粉 | Spaghetti | `macaroni.png` |
| `grass_jelly` | 仙草冻 | Custard | `grass_jelly.png` |
| `quail_egg` | 鹌鹑蛋 | Egg | `quail_egg.png` |

红豆与绿豆共用 `Beans` 图标：绿豆染绿、红豆保持原色偏暖红，靠颜色即可区分"撞脸"项（中文标签一并兜底）。椰奶（牛奶杯）与椰子水（椰子）本就是不同图标，无歧义。
