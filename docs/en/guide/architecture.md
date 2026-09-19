# Architecture and code map

There is one TypeScript implementation. Both the course CLI and official Pi CLI can load the extension. Stage selection changes exposed capabilities rather than copying the runtime.

![Boundaries between the Pi session, course extension, and modules](/architecture.svg)

Editable SVG source lives in `docs/public/architecture.svg`. The dashed boundary is the host, not a sandbox. MCP has a separate subprocess; subagents are different Pi sessions in the same Node process.

## Find the owner of each responsibility

| Path | Owns | Does not own |
| --- | --- | --- |
| `src/cli.ts` | Arguments, commands, per-operation approval | A replacement tool loop |
| `src/auth.ts` | Repository-local auth and provider environment | Displaying or committing secrets |
| `src/runtime.ts` | Pi SDK sessions, resources, budgets | A simulated Pi runtime |
| `src/stages.ts` | Cumulative stages 1–9 | Separate implementations |
| `src/extensions/course.ts` | Tools, events, status | OS enforcement |
| `src/core/policy.ts` | Modes, paths, admission | Containing arbitrary host code |
| `src/core/tasks.ts` | Versioned snapshots and recovery | Proof of completed work |
| `src/core/audit.ts` | Bounded operation records | Tamper-proof security logs |
| `src/core/checkpoints.ts` | Git snapshots of marked samples | General user-repository rollback |
| `src/integrations/mcp.ts` | Fixed service transport and adapter | An arbitrary server platform |
| `src/integrations/subagents.ts` | Read-only children and bounded concurrency | Process isolation |
| `src/verification.ts` | Sample tests, diff, status | A universal build system |
| `src/testing/scripted-model.ts` | Official scripted-provider adapter | Model-quality evidence |
| `examples/fixtures/todo/` | Immutable defective source fixture | Daily editing workspace |
| `examples/workspaces/todo/` | Resettable practice copy | Personal file storage |

## Four kinds of state, four lifecycles

Model context belongs to a Pi session; task snapshots live in workspace `.learn-pi`; sample files live in the worktree; checkpoints live in dedicated Git objects and a manifest. An operation may change only one. Recovering tasks does not recover source; file rollback does not rewind conversation; compaction does not complete tasks.

The SDK disables automatic resource discovery and loads explicit extensions and workspace guidance. The native Pi loader has its own behavior. Read supplied configuration as carefully as API names.

## Recommended reading order

Start with `stages.ts`, then policy decisions, extension event wiring, and finally SDK resource loading and lifecycle. MCP, subagents, and checkpoints can be studied independently with their chapters.

Tests are a second interface document: `tests/core.test.ts` describes storage and paths, `tests/integrations.test.ts` describes MCP and delegation, and `tests/runtime.test.ts` verifies actual Pi wiring. Actual outcomes live under `reports/`; see [labs](./labs) for commands and manual experiments.
