# 领域文档

工程类技能在探索本仓库代码时，应如何消费领域文档。

## 探索之前，先读这些

- 仓库根目录的 **`CONTEXT.md`**；或
- 若根目录存在 **`CONTEXT-MAP.md`**：它指向每个 context 各自的 `CONTEXT.md`，按当前主题读取相关的那几个
- **`docs/adr/`**：读取与你即将改动的区域相关的 ADR。多 context 仓库另需检查 `src/<context>/docs/adr/` 中的 context 级决策

这些文件不存在时**静默继续**：不要指出其缺失，也不要主动建议创建。`/domain-modeling` 技能（经 `/grill-with-docs`、`/improve-codebase-architecture` 到达）会在术语或决策真正被敲定时惰性创建它们。

## 文件结构

单 context 仓库（绝大多数仓库）：

```
/
├── CONTEXT.md
├── docs/adr/
│   ├── 0001-event-sourced-orders.md
│   └── 0002-postgres-for-write-model.md
└── src/
```

多 context 仓库（根目录存在 `CONTEXT-MAP.md`）：

```
/
├── CONTEXT-MAP.md
├── docs/adr/                          ← 系统级决策
└── src/
    ├── ordering/
    │   ├── CONTEXT.md
    │   └── docs/adr/                  ← context 级决策
    └── billing/
        ├── CONTEXT.md
        └── docs/adr/
```

本仓库为**单 context**：一个根级 `CONTEXT.md`，加根级 `docs/adr/`。

## 使用词表中的词汇

当输出中出现领域概念（issue 标题、重构提案、假设、测试名等）时，使用 `CONTEXT.md` 中定义的术语，不要漂移到词表明确避免的同义词。

若需要的概念尚未进入词表，这是一个信号：要么你在发明项目并不使用的语言（应重新考虑），要么确实存在缺口（记录下来，交给 `/domain-modeling`）。

## 标注 ADR 冲突

若你的输出与既有 ADR 相矛盾，明确标注出来，而不是默默覆盖：

> _与 ADR-0007（event-sourced orders）冲突，但值得重开，因为……_
