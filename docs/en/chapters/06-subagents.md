# 06 · Delegate work and converge results

<p class="eyebrow">STAGE 06 / SEPARATE CONTEXTS ARE NOT SEPARATE MACHINES</p>

A subagent is useful when a bounded task with explicit inputs and a deliverable benefits from its own context, then returns evidence. Merely running two model calls at once is not a collaboration design. This chapter provides two read-only roles: `researcher` and `reviewer`.

## No-key stage experiment

This runs real Pi with a scripted provider in a fresh exercise workspace and asserts this stage’s behavior. It makes no remote model request.

```sh
npm run stage -- --stage 6
```

## Pi's capabilities and our additions

The SDK can create multiple real sessions, and Pi includes an official subagent example. We add a constrained pool: 1–6 tasks, at most 2 concurrent, with deadlines and tool-call, model-turn, and output budgets. Failures remain structured results without discarding successful siblings.

`src/integrations/subagents.ts` contains the boundaries: `createReadOnlyChildSession()` constructs a real session, `runPiChild()` drives it, `runSubagents()` schedules work, and `createSubagentTool()` exposes it to the parent model.

## What context isolation actually means

Each child gets a fresh in-memory transcript and its role prompt, plus the assigned task. It does not automatically inherit the parent conversation, event hooks, project extensions, Skills, or instruction files. Parent path policy is **not inherited automatically**, so child construction installs a new policy explicitly. Children have only `read` and `ls`: no writing, shell, or further delegation.

```ts
export interface ChildTask {
  role: "researcher" | "reviewer";
  task: string;
}
```

Children still share the parent's Node process and filesystem. This is context and tool-surface isolation, not process, container, or OS isolation. The parent can change a file while a child reads it; concurrent reads do not constitute a consistent snapshot.

## Run stage 6

```sh
npm run agent -- --stage 6 --workspace examples/workspaces/todo
```

Give the parent a concrete assignment:

```text
Use delegate_readonly for two independent tasks:
1. A researcher reads todo.ts and reports behavior and input boundaries with paths.
2. A reviewer reads todo.test.ts and identifies missing edge cases.
Combine agreements, conflicts, and unverified hypotheses. Do not modify files.
```

The researcher reports the current behavior, the reviewer identifies concrete risks, and the parent integrates both. Asking two agents to “fix everything” usually duplicates work instead of clarifying responsibility.

## Budgets and failure convergence

Defaults are 60 seconds, 12 tool calls, 6 model calls, and 8,000 returned characters per child. Exhaustion must appear as a failure or explicit truncation marker.

`runSubagents()` returns `fulfilled`, `rejected`, or `cancelled` outcomes in input order. An ordinary failure preserves successful siblings. Parent cancellation propagates through `AbortSignal`. A timed-out worker retires instead of immediately launching another task, preventing an uncooperative runner from silently exceeding the concurrency limit.

Cancellation is cooperative; it does not forcibly terminate arbitrary host code. A test runner can ignore its signal, and a host extension can misbehave. Strong termination requires another process or container boundary.

## Separate deterministic and live-model evidence

`npm test` uses a controlled runner to test concurrency, errors, cancellation, and truncation. `npm run test:integration` creates actual Pi child sessions to verify resource and tool boundaries. A scripted provider can drive real child reads, but cannot validate research or review quality.

With a live model, also inspect unsupported claims, nonexistent paths, and assertions that unavailable tests were run. Agreement between two agents does not replace evidence.

**Completion criterion:** at most two children run concurrently; failures remain visible without losing successes; children lack write and shell tools; the parent labels unverified conclusions.

## Design connection

Claude Code and Codex publicly document delegated work and separate contexts. We use the same responsibility-separation idea but implement only two read-only roles and fixed limits, not product-level team messaging, persistent background workers, or permission systems. [Claude Code subagents](https://code.claude.com/docs/en/sub-agents), [Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)
