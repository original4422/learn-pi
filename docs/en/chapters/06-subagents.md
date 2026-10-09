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

## Exercise: consume partial results in the parent

```sh
npm run partial:demo
npm run partial:init
# Edit the printed .cache/partial-results/exercise-*/consumer.ts file.
# Then run the printed npm run partial:demo -- --consumer … command.
```

`partial:demo` runs `examples/partial-results/reference.ts` by default. Each `partial:init` creates a fresh exercise directory with the starter and type contract, preserving earlier work. The starter checks only top-level `isError` and should pass 1/3 cases; inspecting individual results should pass 3/3. Failed acceptance exits with code 1. The report is in the printed `.cache/partial-results/run-*/report.json`.

| Actual delegation result | Parent's next step | Meaning of the evidence |
| --- | --- | --- |
| Both `fulfilled`, neither truncated | Summarize directly | Both child results are complete |
| Researcher succeeds, reviewer is `rejected` | `read todo.test.ts` | Preserve the success and inspect the failed item's file |
| Researcher is `fulfilled` and `truncated` | `read todo.ts` | Successful status can still lose evidence |

Top-level `isError` is `false` in all three cases. Delegation returns structured data normally; a child's failure does not throw from the whole tool. `details.failed` counts failed items but misses successful, truncated items. The parent Provider callback parses the actual received `toolResult.content`, calls your `decide(observation)`, then emits its next tool request. A fixed role mapping owns fallback paths; child output grants no path authority.

This exercise uses real Pi 0.85.1 parent/child sessions, real file reads, and the official scripted model. A scripted Provider error produces the child failure; the existing delegation tool performs the 8,000-character truncation. After fallback reads, the report still marks delegation incomplete and preserves successful evidence. This checks consumer logic and Pi delivery, not remote-model decision quality.

Acceptance checks the actual parent tool sequence, corresponding read contents, completeness claim, and before/after hashes of fixture source, tests, and instructions. Always summarizing or always inspecting both roles fails. The fixture tests are not executed. The exercise function is local TypeScript running in the host process, like repository tests. See `scripts/partial-results-lab.ts` and `tests/partial-results.test.ts` for the implementation and counterexamples.

The pinned [tool return contract](https://github.com/earendil-works/pi/blob/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent/docs/extensions.md) distinguishes return values from thrown errors: returned `content` enters model context; throwing during execution sets the tool error flag.
