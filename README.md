# 清补凉大师

海南清补凉主题的拖拽配对 H5 小游戏：顾客下单，玩家把配料拖进碗里，凑齐即出餐，60 秒比分数。

竖屏 720×1280、`FitHeight` 适配，构建目标 `web-mobile`（浏览器打开即玩，不用装 App）。
领域术语（清补凉 / 汤底 / 小料 / 配料 / 订单 / 碗 / 配料盘 / 出餐 / 错放 / 连击 / 单局 / 最高分）见 `CONTEXT.md`。

## 玩法

| 项 | 规则 |
| --- | --- |
| 单局时长 | 60 秒；正确出餐不加时 |
| 订单 | 恰好 1 种汤底 + 3~5 种小料，从 12 格配料池随机 |
| 难度 | 0–20 秒 3 小料 / 20–40 秒 4 小料 / 40–60 秒 5 小料，只影响之后新生成的订单 |
| 放入 | 拖动（松手判定、拖到碗上高亮）或点按（直接飞入） |
| 匹配 | 与放入顺序无关的集合匹配，凑齐即自动出餐，换下一位顾客（过渡 0.4 秒期间计时暂停） |
| 错放 | 订单外的配料进碗：扣 3 秒 + 弹回 + 连击清零；碗中已有同一配料时再次放入静默拒绝、不扣时 |
| 计分 | 每单 10 ×（小料数 + 1），连击每单额外 +5、上限 +25（5 连封顶） |
| 连击 | 连续出餐且期间未错放的累计单数，一次错放清零；连到 3 单起每单冒一句"够劲！" |
| 背景 | 每局从 4 张海南背景里随机一张；纯视觉，不影响玩法 |
| 最高分 | 存本机 `sys.localStorage`，刷新浏览器不丢 |

12 格配料池：汤底 3 种（椰奶、椰子水、红糖水）+ 小料 9 种（红豆、绿豆、西米、芋圆、西瓜丁、芒果丁、通心粉、仙草冻、鹌鹑蛋）。

## 跑起来

### 环境

- [Cocos Creator 3.8.8](https://www.cocos.com/creator)（编辑器版本写在 `package.json` 的 `creator.version`）
- Node.js（只用于跑单元测试与类型检查；游戏本身不依赖）

### 编辑器里预览

用 Cocos Creator 3.8.8 打开本仓库，打开场景 `assets/scenes/main.scene`，点预览（浏览器或 Game View）即可。

### 构建 web-mobile 产物

**编辑器**：菜单「项目 → 构建发布」，平台选 `web-mobile`，点「构建」。产物默认落在 `build/web-mobile`。

**命令行**（Windows 示例；[官方文档](https://docs.cocos.com/creator/3.8/manual/zh/editor/publish/publish-in-command-line.html) 约定退出码 `36` = 构建成功、`32` = 参数不合法、`34` = 构建出错）：

```powershell
& "C:\ProgramData\cocos\editors\Creator\3.8.8\CocosCreator.exe" `
  --project "d:\CocosProjects\NewProject" `
  --build "platform=web-mobile;debug=false"
```

> 本次上线包是用**编辑器里的构建任务**出的：命令行方式在这台机器上实测没有产出（进程立刻退出、退出码 `0`、日志为空）。要把命令行接进 CI，得先单独排一遍。

### 本地跑起来

`build/web-mobile` 是**纯静态站点**，用任意静态服务器托管即可（不能直接双击 `index.html`，`file://` 下取不到包体资源）：

```powershell
npx --yes serve -l 8080 build/web-mobile   # 浏览器打开 http://localhost:8080
```

想用手机真机试玩（同一 Wi-Fi 下）：把静态服务器监听到局域网地址（如 `npx --yes serve -l 8080 -n 0.0.0.0 build/web-mobile`），手机浏览器打开 `http://<电脑局域网 IP>:8080`。

## 测试与类型检查

```powershell
npm install      # 首次
npm test         # vitest：只测不依赖引擎的纯逻辑核心层（tests/session.test.ts）
npx tsc --noEmit # 类型检查（依赖编辑器生成的 temp/tsconfig.cocos.json，先开一次编辑器）
```

测试只覆盖**规则核心**（`assets/scripts/core/`）：拖拽跟手、动画、排版、H5 适配这些只能手动验收，验收清单见 `docs/design/mvp-spec.md`。

## 目录结构

```
assets/
  scenes/main.scene            唯一场景：开始页 / 单局页 / 结算页 + 背景层
  scripts/
    config/                    纯数据：配料表、难度与计分、文案、背景池、布局
    core/                      纯逻辑规则核心（不 import 引擎，唯一被测对象）
    game/                      核心与表现层之间的桥：事件总线、会话组件、最高分存储
    ui/                        表现层：开始页 / 顶栏 / 订单卡 / 碗 / 配料盘 / 结算页 / 各类反馈
  resources/art/
    backgrounds/               4 张海南背景（按文件名运行时加载，换图只换文件）
    ingredients/               12 张配料图标（文件名即配料 id）
    ui/                        开始页界面图 4 个文件：标题艺术字、按钮底图（正常 / 按下）、最高分奖杯
                               （同样按文件名加载，同名覆盖即换图）
docs/                          ADR、设计基线、背景与界面出图需求、agent 约定
tests/                         纯逻辑核心层的单元测试
```

规则只住在 `core/`：输入 → 核心 → 事件 → 渲染，表现层不反向写状态、"这一单值多少分"也由核心给出。
背景与图标都按文件名从 `assets/resources/` 动态加载，替换同名文件即可换图，不用回编辑器接线。

## 素材来源与授权

每一份外部素材都登记在 `CREDITS.md`：

- **配料图标**：Microsoft Fluent Emoji（3D 风格 PNG，256×256，**MIT**），12 格里有 6 格用近似图标 + 中文标签兜底。
- **背景图**：4 张按 `docs/art/background-prompts.md` 的出图需求产出、由项目方交付；压缩档位与保真度记在 `CREDITS.md`。
- **开始页界面图**：4 个文件按 `docs/art/ui-prompts.md` 的出图需求产出、由项目方交付；与规格的偏差记在 `CREDITS.md`。
- **音频**：无（本版本不做音频）。

致谢同时出现在游戏内结算页底部（`STRINGS.creditLabel`）。

## 文档

- `CONTEXT.md`：领域词表（术语以它为准）
- `docs/design/mvp-spec.md`：设计基线（玩法、界面、验收清单）
- `docs/adr/0001-asset-sourcing-and-licensing.md`：素材来源与授权策略
- `docs/adr/0002-start-page-skeleton-in-scene.md`：开始页骨架进场景、其余页维持运行时装配的取舍
- `docs/art/background-prompts.md`：背景出图需求
- `docs/art/ui-prompts.md`：开始页界面出图需求（标题艺术字 / 按钮底图两态 / 最高分奖杯）
