# 学习路线

这门课不要求先写一个玩具 Agent。主线从真实 Pi 起步，使用同一套 TypeScript 实现逐章开放能力。每章至少做一次成功实验、一次失败实验，再说明代码为何这样设计。

| 章节 | 新的理解 | 运行阶段 | 主要源码 |
| --- | --- | --- | --- |
| [00 TypeScript](../chapters/00-typescript) | 类型、异步、事件与运行时验证 | `npm run check` | `src/core/tasks.ts` |
| [01 Pi](../chapters/01-pi) | 原生循环与扩展边界 | `--stage 1` | `src/runtime.ts` |
| [02 计划](../chapters/02-plan) | 模式是状态与策略 | `--stage 2` | `src/core/policy.ts` |
| [03 任务](../chapters/03-tasks) | 可恢复状态与证据分离 | `--stage 3` | `src/core/tasks.ts` |
| [04 审批](../chapters/04-policy) | 默认拒绝、真实路径、审计 | `--stage 4` | `src/core/policy.ts` |
| [05 MCP](../chapters/05-mcp) | 协议、进程与信任 | `--stage 5` | `src/integrations/mcp.ts` |
| [06 子 Agent](../chapters/06-subagents) | 分派、隔离、预算、收敛 | `--stage 6` | `src/integrations/subagents.ts` |
| [07 编程](../chapters/07-coding) | 测试、diff 与文件恢复 | `--stage 7` | `src/core/checkpoints.ts` |
| [08 上下文](../chapters/08-context) | 资源加载与执行隔离不同 | `--stage 8` | `src/runtime.ts` |
| [09 SDK](../chapters/09-sdk) | 组合与最终验收 | `--stage 9` | `src/cli.ts` |

各章无 Key 实验统一使用 `npm run stage -- --stage N`，驱动真实 Pi 与脚本化 Provider。所有阶段的交互启动格式都是 `npm run agent -- --stage N --workspace examples/workspaces/todo`。阶段 4 与 8 主要展开已有机制的工程判断；它们没有为了显得“新增很多”而复制实现。阶段 9 装配全部能力。

## 选择适合你的入口

如果 TypeScript 陌生，从 00 开始；已有 TypeScript 经验，从快速开始与 01 开始。只想判断项目是否值得继续读，先跑无 Key 演示，再读 04 和 07：拒绝写入与恢复文件最容易暴露真实边界。

读完一章后记录三件事：Pi 原生提供什么、课程新增什么、仍未保证什么。能讲清这三项，比记住所有方法名更重要。

## 最终作品范围

你得到的是一个本地教学 Agent：能在样例项目内计划、记任务、请求批准、查目录、分派只读研究、修改并验证代码、审查差异和恢复检查点。它不是独立商业产品，也不承诺完整复刻 Codex 或 Claude Code。双语内容覆盖相同章节、实验与限制，翻译不维护第二份运行时代码。
