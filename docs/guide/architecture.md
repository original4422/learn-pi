# 架构与源码地图

主实现只有一套 TypeScript。课程 CLI 和官方 Pi CLI 都可以加载同一个扩展；阶段参数只改变开放能力，不复制运行时。

![Pi 会话、课程扩展及各模块的边界](/architecture.svg)

这张图的 SVG 源码保存在 `docs/public/architecture.svg`。虚线范围是宿主环境，不是沙箱。MCP 有独立子进程，子 Agent 则是同一个 Node 进程里的不同 Pi 会话。

## 从入口找到责任

| 路径 | 负责什么 | 不负责什么 |
| --- | --- | --- |
| `src/cli.ts` | 参数、交互命令、逐项审批 | 重写模型工具循环 |
| `src/auth.ts` | 仓库内认证和环境 Provider | 输出或提交密钥 |
| `src/runtime.ts` | Pi SDK 会话、资源与预算 | 模拟整个 Pi |
| `src/stages.ts` | 1–9 阶段累加工具 | 分叉成多套实现 |
| `src/extensions/course.ts` | 工具注册、事件、状态展示 | OS 权限限制 |
| `src/core/policy.ts` | 模式、路径、审批决策 | 防止任意宿主代码逃逸 |
| `src/core/tasks.ts` | 版本化任务快照与备份恢复 | 证明任务实际完成 |
| `src/core/audit.ts` | 有限操作记录 | 防篡改审计系统 |
| `src/core/checkpoints.ts` | 标记样例目录的 Git 快照 | 用户仓库通用回滚 |
| `src/integrations/mcp.ts` | 固定服务连接与工具适配 | 任意 MCP 服务器平台 |
| `src/integrations/subagents.ts` | 只读子会话和有限并发 | 多进程安全隔离 |
| `src/verification.ts` | 样例测试、diff、status | 任意项目构建系统 |
| `src/testing/scripted-model.ts` | 官方脚本化 Provider 适配 | 真实模型智能证明 |
| `examples/fixtures/todo/` | 不变的缺陷样例源 | 日常编辑目录 |
| `examples/workspaces/todo/` | 可重置的练习副本 | 保存个人文件 |

## 四种状态，四条生命周期

模型上下文在 Pi 会话中；任务快照在工作区 `.learn-pi` 中；样例文件在工作树中；检查点在专用 Git 对象与清单中。一次操作可能只改变其中一项。清单恢复不会恢复源码，文件回滚不会回滚对话，压缩不会把任务自动标成完成。

SDK 默认禁用自动资源发现，并显式加载受控扩展与工作区说明。原生 Pi 加载器有自身行为。阅读来源时，既看 API 名字，也看实际传入的配置。

## 推荐源码阅读顺序

先读 `stages.ts` 的能力清单，再读 `policy.ts` 的决策，接着读扩展里的事件接线，最后读 SDK 资源加载与生命周期。MCP、子 Agent、检查点可以按各自章节独立阅读。

测试是第二份接口文档：`tests/core.test.ts` 描述存储与路径边界，`tests/integrations.test.ts` 描述 MCP 与分派，`tests/runtime.test.ts` 验证真实 Pi 接线。具体检查结果见仓库 `reports/`；命令与人工实验见[实验页](./labs)。
