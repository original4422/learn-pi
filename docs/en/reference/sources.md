# Versions and sources

Verified on **2026-09-19**. This course targets a published package and its corresponding source, not a moving `main` branch.

## Pinned versions

| Component | Selected version / identifier |
| --- | --- |
| Pi coding agent | `@earendil-works/pi-coding-agent@0.85.1` |
| Pi model layer | `@earendil-works/pi-ai@0.85.1` |
| npm `gitHead` | `d981de1229ef899957bbe968bc8dcda02a21f477` |
| Minimum Node | `22.19.0` |
| Tool schemas | `typebox@1.3.7` |
| MCP SDK | `@modelcontextprotocol/sdk@1.30.0` |
| Documentation | `vitepress@1.6.4` |

Release evidence comes from npm's `version`, `gitHead`, `engines`, and `dist.integrity`; `package-lock.json` fixes the installed tree. The canonical repository is [earendil-works/pi](https://github.com/earendil-works/pi); the earlier name redirects. Do not mix old `@mariozechner/pi-coding-agent` examples with this course's main packages. Historical names on individual helper dependencies do not change the main API namespace.

## Read the source for this release

- [Pi README](https://github.com/earendil-works/pi/blob/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent/README.md)
- [Native extension API](https://github.com/earendil-works/pi/blob/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent/docs/extensions.md)
- [SDK](https://github.com/earendil-works/pi/blob/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent/docs/sdk.md)
- [RPC protocol](https://github.com/earendil-works/pi/blob/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent/docs/rpc.md)
- [Compaction](https://github.com/earendil-works/pi/blob/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent/docs/compaction.md)
- [Containerization](https://github.com/earendil-works/pi/blob/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent/docs/containerization.md)
- [Official MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)

Installed copies live in `node_modules/@earendil-works/pi-coding-agent/docs/` and `examples/extensions/`. Reading them avoids accidental drift to newer online APIs.

## Official examples and course extensions

All Pi links below target the same release commit. The course follows these public patterns while reorganizing around shared workspace policy, bilingual explanations, and deterministic experiments.

| Official example | Course connection | Difference |
| --- | --- | --- |
| [plan-mode](https://github.com/earendil-works/pi/tree/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent/examples/extensions/plan-mode) | Modes and active tools | Shared policy across chapters |
| [todo.ts](https://github.com/earendil-works/pi/blob/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent/examples/extensions/todo.ts) | Task management | Workspace snapshots and corruption recovery |
| [permission-gate.ts](https://github.com/earendil-works/pi/blob/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent/examples/extensions/permission-gate.ts) | Approval | Fail-closed, independently tested gate |
| [protected-paths.ts](https://github.com/earendil-works/pi/blob/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent/examples/extensions/protected-paths.ts) | Path policy | Canonicalization, alias refusal, protected metadata |
| [subagent](https://github.com/earendil-works/pi/tree/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent/examples/extensions/subagent) | Read-only child sessions | Fixed roles, fresh guards, explicit budgets |
| [git-checkpoint.ts](https://github.com/earendil-works/pi/blob/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent/examples/extensions/git-checkpoint.ts) | Sample checkpoints | Marked directories, private index, bounded restore |

Pi and its examples use the MIT license, with copyright held by Mario Zechner and respective contributors. See `THIRD_PARTY_NOTICES.md`. This is not an official Pi, OpenAI, or Anthropic course, nor a claim to have invented these extension patterns.

## Product-comparison sources

Comparisons use public documentation, not speculation about proprietary internals, accessed on the date above: [Codex sandboxing](https://learn.chatgpt.com/docs/sandboxing), [Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents), [Codex MCP](https://learn.chatgpt.com/docs/extend/mcp), [Claude Code permissions](https://code.claude.com/docs/en/permissions), and [Claude Code subagents](https://code.claude.com/docs/en/sub-agents). Behavior varies by release, platform, and account; the [comparison page](./comparison) limits each claim to a specific concept.
