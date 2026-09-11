# 问题记录：本地 Markdown

本仓库的 issue 与 spec 以 Markdown 文件形式存放在 `.scratch/`。

## 约定

- 每个特性一个目录：`.scratch/<feature-slug>/`
- spec 位于 `.scratch/<feature-slug>/spec.md`
- 实现类 ticket 一个文件一张：`.scratch/<feature-slug>/issues/<NN>-<slug>.md`，从 `01` 编号，禁止合并成单个 tickets 文件
- triage 状态写在 issue 文件顶部的 `Status:` 行（角色字符串见 `triage-labels.md`）
- 评论与讨论历史追加到文件末尾的 `## Comments` 标题下

## 技能要求「publish to the issue tracker」时

在 `.scratch/<feature-slug>/` 下新建文件（目录不存在则一并创建）。

## 技能要求「fetch the relevant ticket」时

读取指定路径的文件。用户通常会直接给出路径或编号。

## Wayfinding 操作

供 `/wayfinder` 使用。**map** 是一个文件，每个 ticket 是一个 child 文件。

- **Map**：`.scratch/<effort>/map.md`（承载 Notes / Decisions-so-far / Fog 正文）
- **Child ticket**：`.scratch/<effort>/issues/NN-<slug>.md`，从 `01` 编号，正文为待解问题。`Type:` 行记录类型（`research`/`prototype`/`grilling`/`task`）；`Status:` 行记录 `claimed`/`resolved`
- **Blocking**：顶部写 `Blocked by: NN, NN` 行。所列文件全部为 `resolved` 后，该 ticket 才算 unblocked
- **Frontier**：扫描 `.scratch/<effort>/issues/`，取 open、unblocked、unclaimed 的文件，编号最小者优先
- **Claim**：先写入 `Status: claimed` 并保存，再开始任何工作
- **Resolve**：在 `## Answer` 标题下追加答案，置 `Status: resolved`，再把上下文指针（要点 + 链接）追加到 `map.md` 的 Decisions-so-far
