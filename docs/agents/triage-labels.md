# Triage 标签

各技能使用五个规范 triage 角色，本文件把它们映射到本仓库 issue 记录中实际使用的标签字符串。

| 技能中的角色 | 本仓库的标签 | 含义 |
| --- | --- | --- |
| `needs-triage` | `needs-triage` | 维护者需要评估此 issue |
| `needs-info` | `needs-info` | 等待报告者补充信息 |
| `ready-for-agent` | `ready-for-agent` | 已完全明确，可交给 AFK agent |
| `ready-for-human` | `ready-for-human` | 需要人工实现 |
| `wontfix` | `wontfix` | 不予处理 |
| （五角色之外的终态） | `done` | 实施类 ticket 已完成并通过验收 |

实施类 ticket 验收通过后置 `done`；triage 五角色只描述"待处理"阶段，不含完成态。

技能提到某个角色时（例如「apply the AFK-ready triage label」），使用表中对应行的标签字符串。

若日后改用既有标签命名，直接编辑上表右列即可。
