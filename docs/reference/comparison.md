# 对照设计，不承诺完整复刻

本页比较的是公开机制与课程取舍，核验日期为 2026-09-19。相同功能名不意味着相同实现、产品完整度或安全保证。

| 设计问题 | 公开产品参照 | learn-pi 的教学选择 |
| --- | --- | --- |
| 探索时如何避免改动 | Claude Code 提供计划模式 | 人控制两态模式；计划期拒绝 shell 与源码修改 |
| 授权和沙箱有什么区别 | Codex 文档讨论沙箱；Claude Code 区分权限与沙箱 | 应用钩子负责准入；容器是独立实验 |
| 如何接入外部工具 | Codex 支持 MCP | 固定本地 stdio 目录服务，不做通用服务器管理 |
| 如何减少主上下文的研究噪声 | 两者公开提供子 Agent 工作流 | 两种只读角色、新会话、最多两个并发 |
| 如何相信代码已修好 | 本课以可观察工程证据为准 | 固定样例测试、diff、任务状态分开记录 |
| 如何恢复操作 | 不推断产品内部实现 | 样例 Git 检查点，与 Pi 会话分支明确分离 |

前四行的产品事实来源：[Claude Code 权限](https://code.claude.com/docs/en/permissions)、[Codex 沙箱](https://learn.chatgpt.com/docs/sandboxing)、[Codex MCP](https://learn.chatgpt.com/docs/extend/mcp)、[Claude Code 子 Agent](https://code.claude.com/docs/en/sub-agents)、[Codex 子 Agent](https://learn.chatgpt.com/docs/agent-configuration/subagents)。后两行说明本课方法，不声称产品采用相同底层实现。

## 为什么保留这些简化

关闭计划期 shell，使只读边界更容易验证；固定 MCP 服务，使协议实验不被认证和远程部署分散；只读子 Agent，避免并发写入和冲突合并；专用样例目录，把恢复风险限制到明确范围。每个简化都应该能说清代价，而不是被包装成完整产品能力。

## 明确不包括的范围

本课程没有企业权限管理、通用命令风险分类、远程 MCP OAuth、多机任务调度、跨进程安全沙箱、完整会话恢复 UI 或任意仓库自动合并。Pi 原生功能超出课程 UI 的部分，仍可通过官方文档学习；不要用课程的简化入口代表 Pi 的全部能力。

判断下一项功能是否该加入时，先提出可验证的问题，再选择扩展、SDK、独立服务或隔离环境。功能数量不是这门课的验收标准，可解释、可运行和可证伪才是。
