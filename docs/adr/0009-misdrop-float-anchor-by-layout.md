# 跨视图的节点窥探改成版面契约：错放飘字不再去顶栏的节点树里找标签

**决定**：`MisdropFeedback` 的"-3 秒"飘字不再递归查找 `CountdownLabel`，直接摆在**自己的局部坐标** `(220, COUNTDOWN_Y)` 上——`COUNTDOWN_Y` 取自 `config/layout.ts`（与 `HudView` 共用同一份）。那段为此专门写的 `findNodeByName` 递归查找删除。

**为什么成立**：倒计时标签与飘字**挂在同一个节点上**。`HudView` 与 `MisdropFeedback` 都是游戏页（`GamePage`）的组件，前者把 `CountdownLabel` 建在 `this.node`（即游戏页）下、局部坐标 `(0, COUNTDOWN_Y)`，后者建的飘字也在游戏页下。两边局部坐标同系，所以"标签右侧偏移 220"就是我们自己的局部坐标。

**顺带修掉一处坐标混用**：被删掉的那条兜底分支是 `countdown ? countdown.worldPosition : new Vec3(0, COUNTDOWN_Y, 0)`——它把"以单局页中心为原点"的**版面坐标**当**世界坐标**用了。正常路径先把世界坐标换算回局部坐标，所以看不出问题；只有找不到标签时才走那条分支，而那时飘字会偏到另一处。现在这个分支不存在了。

## Considered Options

- **让 `HudView` 在摆好之后把锚点发到总线上（选中与否）**：多一条事件、多一份要维护的缓存、再加一条"收不到就用兜底"的路——为一个静态版面值不值得。
- **保留递归查找**：它是一处**反向窥探**——`MisdropFeedback` 因此必须知道"倒计时的节点叫什么、埋在顶栏哪一层"。`HudView` 挪一次结构，飘字就悄悄跑到别处，且不报错。
- **把节点名集中成一份常量**：`BowlArea` / `TrayArea` / `Background` / `PrepareTransition` 各被读一两次，挪出使用处反而更难读；本次只处理反向窥探这一处。

## Consequences

- 新增一处**隐性契约**：`HudView` 与 `MisdropFeedback` 必须挂在同一个节点上（当前都是游戏页）。它写在三处注释里——`HudView.buildCountdown`（纵向位置必须与 `COUNTDOWN_Y` 一致）、`MisdropFeedback.floatPenalty`（飘字的位置是怎么来的）、`config/layout.ts` 的 `COUNTDOWN_Y`（两个模块各自怎么读它）。若将来有一条不再挂在游戏页上，"-3 秒"会偏——**这是本次收口换来的代价，明确接受**。
- **人工验收**：错放时"-3 秒"仍出现在倒计时右侧。
- 其余节点名不动，`MisdropFeedback` 仍按名字找 `TrayArea`（那是它自己的弹回终点，只有一处）。
