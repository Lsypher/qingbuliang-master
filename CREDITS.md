# 素材来源与许可

登记游戏里用到的每一份外部素材及其许可。依据 `docs/adr/0001-asset-sourcing-and-licensing.md`：只用授权明确的素材（CC0 / MIT / CC-BY / 项目自备），来源不明的素材站一律不用。

## 背景图（4 张）

按 `docs/art/background-prompts.md` 的出图需求产出、由用户交付。原始文件为 1600×2848 PNG，已随提交 `e0ed041` 入库，需要时可随时取回；仓库里现存的是下面这套压缩后的上线档位。

| 文件 | 内容 | 来源 |
| --- | --- | --- |
| `assets/resources/art/backgrounds/qilou-street-night.jpg` | 骑楼老街夜市 | 按出图需求产出，用户交付 |
| `assets/resources/art/backgrounds/qingbuliang-stall-night.jpg` | 清补凉夜市摊 | 同上 |
| `assets/resources/art/backgrounds/palm-coast-dusk.jpg` | 椰林海岸黄昏 | 同上 |
| `assets/resources/art/backgrounds/li-brocade-pattern.png` | 黎锦纹样底纹 | 同上 |

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

12 格配料图标尚未接入（08 切片），计划取 Microsoft Fluent Emoji（MIT），接入时在此逐个登记。
