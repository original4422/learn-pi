# 07 · Edit, verify, review, then recover

<p class="eyebrow">STAGE 07 / MAKE COMPLETION VISIBLE IN FILES AND TESTS</p>

The agent can plan, track tasks, and delegate research. Now we close the coding loop with an intentionally defective Todo module: read, edit, test, review the diff, and recover files.

## No-key stage experiment

This runs real Pi with a scripted provider in a fresh exercise workspace and asserts this stage’s behavior. It makes no remote model request.

```sh
npm run stage -- --stage 7
```

## What we add beyond native tools

Pi already provides `read`, `write`, `edit`, and `bash`. We add `verify_project`, which runs fixed sample-test arguments and returns Git evidence, plus checkpoints restricted to marked disposable workspaces. Pi has an official Git-checkpoint example; our implementation emphasizes explicit directory, metadata, and restoration checks.

Even a fixed test command executes project code. It still requires execution mode and approval. A tool named “verify” is not automatically a harmless read.

## Observe the intentional failure

```sh
npm run lab:reset
npm run agent -- --stage 7 --workspace examples/workspaces/todo
```

The sample's `addTodo()` neither trims text nor rejects blank input. `todo.test.ts` expresses both requirements. Preserve the public API and do not change tests to conceal the defect.

During planning, ask the agent to inspect implementation and tests, explain the failure, and propose the smallest fix. Then enter:

```text
/mode execute
/checkpoint before-trim-fix
```

Record the returned checkpoint ID. Ask the agent to run `verify_project` before editing, repair the implementation, rerun verification, and inspect the diff. Expect normalization and an empty-input check, not new dependencies, API changes, or deleted tests.

## Follow three evidence paths

`src/verification.ts` uses `execFile` with fixed arguments, not a constructed shell command. It returns `passed`, bounded output, diff, and status. Failed test output must remain available to the model instead of disappearing behind an exception.

`src/core/checkpoints.ts` verifies a course marker, canonical workspace root, and independent `.git` directory, and rejects arbitrary Git revisions. Snapshots use a private index and `refs/learn-pi/` references without moving ordinary `HEAD`. Restoration accepts only an ID recorded in the manifest.

```ts
const before = await checkpoints.create("Before repair");
// Editing and verification happen here; restore is separately authorized.
await checkpoints.restore(before.id);
```

These are the actual store methods. Restore replaces the sample's ordinary file tree, including removing ordinary files added after the snapshot. Keep personal files out of the exercise directory. Course metadata, protected credential paths, and repository metadata are excluded from ordinary sample restoration.

The third path is `src/extensions/course.ts`: model-invoked checkpoint operations still pass policy and approval. A human `/restore ID` command also confirms its scope explicitly.

## Three meanings of recovery

| Operation | Changes | Does not automatically change |
| --- | --- | --- |
| Pi conversation branch/switch | Active conversation history | Project files or task snapshots |
| Context compaction | What the model sees next | Workspace files |
| Course checkpoint restore | Ordinary disposable sample files | Conversation, tasks, parent repository |

After file recovery, the model may still remember a successful repair. Read the files and rerun tests. Filesystem rollback does not repair model memory automatically.

## Failure experiments

Inspect `npm test` cases for added/deleted files, unknown IDs, symbolic links, parent-repository preservation, and protected paths. Checkpoints are not a general backup system: concurrent external writes, crashes during multi-file recovery, and disk damage are outside an atomic transaction guarantee.

After repairing the sample, enter `/restore` followed by the actual earlier ID. Confirm, then verify again. The two intentional tests should fail once more. This demonstrates file restoration rather than a change to a task checkbox.

**Completion criterion:** show the full chain: failure → minimal fix → passing tests → justified diff → restored failure.

## Design connection

A coding agent must ultimately produce reviewable changes. Tests and diffs are acceptance evidence; checkpoints are an experimental recovery mechanism. This mirrors the needs of mature coding workflows without claiming a complete undo, backup, or multi-agent merge system.
