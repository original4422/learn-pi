# 版本与来源

核验日期：**2026-09-19**。本课程使用已发布包与对应源码，不以变化中的 `main` 作为 API 契约。

## 锁定版本

| 项目 | 选定版本 / 标识 |
| --- | --- |
| Pi coding agent | `@earendil-works/pi-coding-agent@0.85.1` |
| Pi model layer | `@earendil-works/pi-ai@0.85.1` |
| 对应 npm `gitHead` | `d981de1229ef899957bbe968bc8dcda02a21f477` |
| Node 最低版本 | `22.19.0` |
| 工具 schema | `typebox@1.3.7` |
| MCP SDK | `@modelcontextprotocol/sdk@1.30.0` |
| 文档站 | `vitepress@1.6.4` |

npm 元数据中的 `version`、`gitHead`、`engines` 与 `dist.integrity` 是发布核验依据，安装树由 `package-lock.json` 保持一致。当前官方入口为 [earendil-works/pi](https://github.com/earendil-works/pi)，此前仓库名会重定向。不要把旧资料里的 `@mariozechner/pi-coding-agent` 与本课程包名混搭；依赖树里个别历史命名辅助包不意味着主 API 要改回旧命名。

## 固定到发布源码的阅读入口

- [Pi README：能力与使用](https://github.com/earendil-works/pi/blob/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent/README.md)
- [原生扩展 API](https://github.com/earendil-works/pi/blob/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent/docs/extensions.md)
- [SDK](https://github.com/earendil-works/pi/blob/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent/docs/sdk.md)
- [RPC 协议](https://github.com/earendil-works/pi/blob/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent/docs/rpc.md)
- [上下文压缩](https://github.com/earendil-works/pi/blob/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent/docs/compaction.md)
- [容器化说明](https://github.com/earendil-works/pi/blob/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent/docs/containerization.md)
- [MCP 官方 TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)

安装后也可直接阅读 `node_modules/@earendil-works/pi-coding-agent/docs/` 与 `examples/extensions/`，避免网络文档更新造成接口漂移。

## 官方示例与课程扩展

以下来源均固定到相同发布 commit。课程遵循这些公开模式，但围绕统一工作区策略、双语教学和确定性实验重新组织实现。

| 官方示例 | 课程对应 | 区别 |
| --- | --- | --- |
| [plan-mode](https://github.com/earendil-works/pi/tree/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent/examples/extensions/plan-mode) | 模式与工具切换 | 与所有章节共用策略 |
| [todo.ts](https://github.com/earendil-works/pi/blob/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent/examples/extensions/todo.ts) | 任务管理 | 课程使用工作区快照与损坏恢复 |
| [permission-gate.ts](https://github.com/earendil-works/pi/blob/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent/examples/extensions/permission-gate.ts) | 审批 | 默认拒绝、独立可测的 gate |
| [protected-paths.ts](https://github.com/earendil-works/pi/blob/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent/examples/extensions/protected-paths.ts) | 路径策略 | 规范化路径、别名拒绝、保护元数据 |
| [subagent](https://github.com/earendil-works/pi/tree/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent/examples/extensions/subagent) | 只读子会话 | 固定角色、重新安装路径策略、明确预算 |
| [git-checkpoint.ts](https://github.com/earendil-works/pi/blob/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent/examples/extensions/git-checkpoint.ts) | 样例检查点 | 专用标记目录、私有 index、有限恢复 |

Pi 及示例按 MIT 授权，版权归 Mario Zechner 等相应权利人。保留说明见仓库 `THIRD_PARTY_NOTICES.md`。本项目不是 Pi、OpenAI 或 Anthropic 官方课程，也不宣称发明这些扩展模式。

## 产品比较资料

比较依据是公开文档，不是闭源实现推断，访问日期同上：[Codex 沙箱](https://learn.chatgpt.com/docs/sandboxing)、[Codex 子 Agent](https://learn.chatgpt.com/docs/agent-configuration/subagents)、[Codex MCP](https://learn.chatgpt.com/docs/extend/mcp)、[Claude Code 权限](https://code.claude.com/docs/en/permissions)、[Claude Code 子 Agent](https://code.claude.com/docs/en/sub-agents)。产品行为可能随版本、平台和账户变化；对照只覆盖[比较页](./comparison)列出的具体概念。
