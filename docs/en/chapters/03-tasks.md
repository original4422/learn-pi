# 03 · Make the task list recoverable

<p class="eyebrow">STAGE 03 / CONTEXT MAY SHRINK; WORK MUST NOT DISAPPEAR</p>

A long task should not exist only in a paragraph the model just wrote. This chapter adds a persistent task list with stable IDs, explicit states, and a versioned snapshot. The list records progress; it does not prove the work actually succeeded.

## No-key stage experiment

This runs real Pi with a scripted provider in a fresh exercise workspace and asserts this stage’s behavior. It makes no remote model request.

```sh
npm run stage -- --stage 3
```

## Pi's persistence, and why we still store tasks

Pi already persists sessions. Extensions can also store custom entries with `appendEntry()`, as official examples demonstrate. We choose a different teaching boundary: a structured workspace snapshot that survives across sessions and supports independent corruption and concurrency tests. The conversation explains what was said; the task list describes what remains.

This has a cost: switching or branching a Pi session does not rewind the task file. Tasks belong to the workspace rather than a conversation branch. Keep those lifecycles distinct.

## Run stage 3

```sh
npm run agent -- --stage 3 --workspace examples/workspaces/todo
```

Ask for three tasks: “read the tests,” “repair the implementation,” and “verify and review the diff.” Enter `/tasks`, exit, and restart in the same workspace. IDs and states should remain.

Planning may update task metadata. Source edits still require execution mode and approval. Ask the model to put the first task `in_progress`, then activate the second simultaneously. The store rejects a second active task. This course constraint keeps the main agent's focus explicit; it is not a claim that every task system must be serial.

## Data model and storage responsibility

Read `TaskState` in `src/core/tasks.ts`:

```ts
export interface TaskState {
  version: 1;
  revision: number;
  tasks: Task[];
}
```

`version` enables future format migrations; `revision` counts successful changes; `id` identifies a task independently of ordering. An array index is not a stable ID.

A mutation reads and validates the old snapshot, calculates the next one, saves the old snapshot as backup, and atomically replaces the primary file. `atomicWrite()` uses a temporary file, synchronization, and rename so readers do not see partial JSON. A per-path queue prevents overlapping writes from instances within one process. **There is no cross-process lock**: do not run independent writers against one task file.

```ts
const task = await store.add("Inspect failing tests");
await store.update(task.id, "in_progress");
await store.update(task.id, "done");
```

These are the actual `TaskStore` methods. The tool layer maps model arguments onto them; business rules stay in the store, where both tools and tests exercise them.

## Recovery must not conceal failure

When the primary snapshot is unreadable, the store validates `.bak` and restores the last readable state. That backup may be one change behind; this is not a zero-data-loss guarantee. If neither file is valid, the store fails explicitly instead of returning an empty list that could look like completed work.

Likewise, `done` means the status mutation was accepted. Passing tests, reviewing a diff, and checking behavior require separate evidence. Chapter 07 connects those observations to the workflow.

## Experiments and failures

Run `npm test`, concentrating on task recovery, invalid data, duplicate active tasks, and concurrent in-process changes. Tests corrupt temporary fixtures; you do not need to damage your own workspace state.

For a manual recovery check, create a task, record its ID, exit, and reopen `/tasks`. Ask the agent which tasks are verified and what evidence supports them. If it has only statuses and no test results, the correct answer acknowledges that gap.

**Completion criterion:** recover after restart; reject invalid states; recover a damaged primary from a valid backup; fail clearly when no valid snapshot exists.

## Design connection

A task panel can make an agent appear organized. This course examines the contract behind that panel: stable identity, validated transitions, and explicit persistence. It addresses the progress-management need of coding agents without claiming to reproduce Codex or Claude Code's internal task format.

## A crash after the effect: reconcile before continuing

```sh
npm run recovery:demo
```

This no-key experiment starts two independent processes on macOS / Linux, using the **official scripted model with real Pi 0.85.1**. Exercise files, conversations, and fictional receipts live in a new `.cache/recovery/pi-*/` directory. It sends no real messages and calls no remote model. Read `scripts/recovery-lab.ts` and its child process, `scripts/recovery-worker.ts`.

The setup creates one `done` task and one `in_progress` task. Pi's first fixed `bash` operation rejects a fictional delivery with exit code 7; the actual tool error is saved in the conversation. The second operation appends a `delivery-001` receipt and changes `draft.txt` to `delivered`. It is deliberately **non-idempotent**: replaying it would append another receipt.

After that operation finishes, a `message_end` subscriber sends `SIGKILL` to its own Pi process when it receives the successful tool result. The pinned [AgentSession source](https://github.com/earendil-works/pi/blob/d981de1229ef899957bbe968bc8dcda02a21f477/packages/coding-agent/src/core/agent-session.ts) notifies subscribers before calling `sessionManager.appendMessage()`. The experiment also inspects the JSONL actually written to disk instead of trusting that source ordering alone:

| Evidence after the crash | Observation | What it establishes |
| --- | --- | --- |
| Task snapshot | `done`, `in_progress` | Progress survives without adjudicating the operation |
| Failed tool result | `isError: true` | The first invocation failed |
| Conversation for the successful invocation | A `toolCall`, but no matching `toolResult` | The conversation alone cannot establish completion |
| Separate fictional receipt | Exactly one `delivery-001` | This local effect already happened |

In the recovery process, the host reads and verifies the receipt, then passes that fact to the scripted model in a new user message. The process continues the same conversation using the SDK mechanism behind `--resume`, retains the default `plan` mode, and only calls `task_update` to mark the task `done`. Assertions check that the receipt count remains 1 and the actual executed-tool list is exactly `task_update`. Production `TaskStore` still has only `pending / in_progress / done`: tool failure and effect evidence live in the tool result and receipt, without inventing a task `failed` status.

Finally the host restores the initial file checkpoint. `draft.txt` returns to `pending`, while the tasks remain `done` and neither the conversation nor the receipt rewinds. Receipts live in checkpoint-excluded `.learn-pi/recovery/` to model an independent business fact. The model's `read` tool still cannot access course metadata. Restoring files does not undo a delivery that already happened.

This is a **fixture-specific receipt reconciliation policy**, not a general Pi exactly-once guarantee. The fault is process termination, not a power failure; a fixed local script produces the receipt. If an operation has no verifiable result, a missing tool result should remain unresolved rather than authorize a blind replay. Raw conversations stay in the ignored exercise directory; the public summary contains assertions and counts.
