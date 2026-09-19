# Compare designs, not whole products

This page compares public mechanisms with course trade-offs, checked on 2026-09-19. Matching feature names do not imply matching implementations, completeness, or security guarantees.

| Design question | Public product reference | learn-pi choice |
| --- | --- | --- |
| Avoid changes while exploring | Claude Code offers planning mode | Human-controlled states; no shell or source mutation during planning |
| Separate authorization from sandboxing | Codex documents sandboxing; Claude Code distinguishes permissions from sandboxes | Application admission hooks; container as a separate experiment |
| Connect external tools | Codex supports MCP | One fixed local stdio catalog, no general server manager |
| Reduce research noise in parent context | Both document subagent workflows | Two read-only roles, fresh sessions, two concurrent children |
| Establish that a repair works | Use observable engineering evidence here | Fixed sample tests, diffs, and task statuses recorded separately |
| Recover operations | No inference about product internals | Sample Git checkpoints distinct from Pi conversation branches |

Sources for the first four rows: [Claude Code permissions](https://code.claude.com/docs/en/permissions), [Codex sandboxing](https://learn.chatgpt.com/docs/sandboxing), [Codex MCP](https://learn.chatgpt.com/docs/extend/mcp), [Claude Code subagents](https://code.claude.com/docs/en/sub-agents), and [Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents). The final rows describe this course, not claims about product internals.

## Why keep these simplifications?

Disabling shell during planning makes read-only behavior easier to test. A fixed MCP service keeps authentication and deployment from overwhelming the protocol lesson. Read-only children avoid concurrent writes and merging. A dedicated fixture makes restoration scope explicit. Each simplification has a cost; none should be presented as a complete product feature.

## Explicit exclusions

This course does not implement enterprise policy, general command-risk classification, remote MCP OAuth, distributed scheduling, process-level sandboxes, full session-recovery UI, or arbitrary-repository automatic merging. Pi's native functionality extends beyond the course interface; consult its documentation rather than treating our host as the entire product.

Before adding a capability, formulate a testable question and choose between an extension, SDK composition, service, or execution boundary. Feature count is not the acceptance criterion. Explainability, executability, and falsifiability are.
