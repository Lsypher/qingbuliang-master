# 08: 看懂了——配料图标与中文标签

**What to build:** 12 格换成 Fluent Emoji 图标并在下方配中文短标签，碗里与订单卡上同步显示图标；素材来源登记进 `CREDITS.md`。

**Blocked by:** 03

**Status:** resolved

- [x] 12 格图标清晰不发虚，每格都有中文短标签
- [x] 红豆与绿豆、椰奶与椰子水这类"撞脸"项靠颜色或标签可区分
- [x] 订单卡与碗里显示的是同一套图标
- [x] `CREDITS.md` 记录来源与许可

## Answer

配料图标取自 Microsoft Fluent Emoji 3D 风格 PNG（MIT，256×256、带透明通道），下载到
`assets/resources/art/ingredients/`，文件名即配料 id，并补了对应的 Cocos `.meta`（spriteFrame），
与背景图同套"同名替换即换图"的约定。`CREDITS.md` 已逐张登记来源与许可。

代码侧新增 `assets/scripts/ui/ingredientIcon.ts`：
- `createIngredientIcon` 异步加载图标并挂到节点（SizeMode.CUSTOM，按节点尺寸显示）；
- `renderIconRow` 横排一批图标，碗里与订单卡共用，保证两处是同一套图标；
- 红豆/绿豆共用 `Beans` 图标，分别染暖红/绿区分，标签一并兜底。

`IngredientTray` 每格改为"图标在上、中文标签在下"；`BowlView` 有料时显示图标行、空碗仍显示"空碗"；
`OrderCard` 用图标行展示所需配料。`debug/SelfCheck` 改为从订单卡图标行的节点名（`Icon_<id>_<index>`）
读回所需配料，替代已移除的 `OrderLine` 文本标签。

非阻断提示：绿豆为棕底×绿染，可能略偏橄榄色，但中文标签已兜底，满足"靠颜色或标签可区分"。
