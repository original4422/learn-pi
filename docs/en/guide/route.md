# Learning route

You do not begin by writing a toy agent loop. The course starts with real Pi and progressively enables one TypeScript implementation. For each chapter, run a successful case, a failure case, and explain the design.

| Chapter | New understanding | Stage | Main source |
| --- | --- | --- | --- |
| [00 TypeScript](../chapters/00-typescript) | Types, async, events, runtime validation | `npm run check` | `src/core/tasks.ts` |
| [01 Pi](../chapters/01-pi) | Native loop and extension boundary | `--stage 1` | `src/runtime.ts` |
| [02 Planning](../chapters/02-plan) | Mode as state and policy | `--stage 2` | `src/core/policy.ts` |
| [03 Tasks](../chapters/03-tasks) | Recoverable state versus evidence | `--stage 3` | `src/core/tasks.ts` |
| [04 Approval](../chapters/04-policy) | Fail-closed checks, real paths, audit | `--stage 4` | `src/core/policy.ts` |
| [05 MCP](../chapters/05-mcp) | Protocol, process, trust | `--stage 5` | `src/integrations/mcp.ts` |
| [06 Subagents](../chapters/06-subagents) | Delegation, isolation, budgets, convergence | `--stage 6` | `src/integrations/subagents.ts` |
| [07 Coding](../chapters/07-coding) | Tests, diffs, file recovery | `--stage 7` | `src/core/checkpoints.ts` |
| [08 Context](../chapters/08-context) | Resource loading versus execution isolation | `--stage 8` | `src/runtime.ts` |
| [09 SDK](../chapters/09-sdk) | Composition and acceptance | `--stage 9` | `src/cli.ts` |

Each no-key lab uses `npm run stage -- --stage N`, driving real Pi with a scripted provider. The interactive command is always `npm run agent -- --stage N --workspace examples/workspaces/todo`. Stages 4 and 8 deepen engineering decisions behind existing mechanisms rather than duplicating code to manufacture novelty. Stage 9 composes everything.

## Choose an entry point

Start at 00 if TypeScript is unfamiliar; otherwise use the quickstart and chapter 01. To evaluate the project quickly, run the no-key demo and read chapters 04 and 07: write denial and file recovery reveal concrete boundaries.

After each chapter, record what Pi provides, what the course adds, and what remains unguaranteed. Explaining those three things matters more than memorizing method names.

## Scope of the finished work

The result is a local teaching agent that plans, tracks tasks, requests approval, queries a catalog, delegates read-only research, edits and verifies code, reviews diffs, and restores sample checkpoints. It is not a standalone commercial product or a full Codex/Claude Code reproduction. Both languages cover equivalent chapters, experiments, and limits; translation does not introduce a second runtime.
