# 09 · Assemble the teaching agent with the SDK

<p class="eyebrow">STAGE 09 / TURN CAPABILITIES INTO AN ACCEPTABLE WHOLE</p>

The final chapter adds no giant tool. It checks that models, resources, tools, policy, state, and human interaction compose around the same workspace—and clean up correctly on failure.

## No-key stage experiment

This runs real Pi with a scripted provider in a fresh exercise workspace and asserts this stage’s behavior. It makes no remote model request.

```sh
npm run stage -- --stage 9
```

## Why discuss the SDK last?

The examples have used the real Pi SDK since chapter 01. Only now do we study the entire assembly. First learn the extension's responsibilities, then how a host composes them. The SDK is the host entry point; the native extension carries the main capabilities. They are not separate agents.

`createCourseSession()` in `src/runtime.ts` creates the controller, prepares state, selects the model runtime, limits resource loading, loads extensions, creates the Pi session, binds events, and returns `prompt()` and `close()`. Extension loading errors must fail startup rather than silently removing a guard.

## Assembly map

```text
src/cli.ts ─── human commands, model selection, per-operation approval
    │
    ▼
src/runtime.ts ─── createAgentSession + resources/sessions/budgets
    │
    ▼
src/extensions/course.ts ─── tool registration and tool_call admission
    ├── core/policy.ts       mode, paths, approval
    ├── core/tasks.ts        workspace task snapshots
    ├── core/audit.ts        bounded operation records
    ├── core/checkpoints.ts  sample file recovery
    ├── integrations/mcp.ts  fixed local MCP service
    ├── integrations/subagents.ts  read-only child sessions
    └── verification.ts     fixed tests and Git evidence
```

`src/stages.ts` accumulates capabilities. The final stage does not copy a second “complete” implementation. Fixes to shared policy improve every stage.

## Complete the final task

```sh
npm run lab:reset
npm run agent -- --stage 9 --workspace examples/workspaces/todo
```

Start in planning mode:

```text
Fix addTodo to store trimmed text and reject blank input while preserving its API.
Read workspace instructions, implementation, and tests. Create a task list.
If useful, delegate implementation research and test review to the two read-only roles.
Propose a minimal plan and wait for me to switch to execution mode.
```

After reviewing the plan, enter `/mode execute`. Ask for a checkpoint, baseline verification, the edit, verification again, and diff review. Approve concrete operations. The final answer should identify changed files, test results, the diff, and remaining uncertainty; checked task boxes do not replace evidence.

Without a key, `npm run demo` executes a scripted repair through the same real Pi integration and asserts resulting files and test states. It verifies assembly, not natural-language planning quality.

## Native extension and SDK entry points

```sh
# Course CLI: explicit workspace, host commands, credential selection
npm run agent -- --stage 9 --workspace examples/workspaces/todo

# Official Pi CLI: load the same native extension
COURSE_ROOT="$PWD"
(
  cd "$COURSE_ROOT/examples/workspaces/todo"
  PI_CODING_AGENT_DIR="$COURSE_ROOT/.cache/pi-agent" LESSON_STAGE=9 \
    "$COURSE_ROOT/node_modules/.bin/pi" --no-extensions -e "$COURSE_ROOT/src/extensions/course.ts"
)
```

The second command enters the generated exercise in a subshell and loads the extension by absolute path. On exit, your original shell remains at the repository root. Checkpoints accept generated exercise workspaces, never the course repository root. The course extension registers `/mode` and `/tasks`; the SDK CLI separately implements `/status`, `/checkpoint`, `/restore`, and a `/compact` wrapper. The official Pi CLI already has its own built-in `/compact`; compaction is not a course invention.

These entry points share capability modules but differ in lifecycle and authentication composition. The SDK passes the same `ModelRuntime` to children. Direct `-e` loading does not automatically forward parent OAuth or custom-provider runtime configuration; environment-backed built-in providers remain usable. `--no-extensions` disables discovery, not trusted Pi built-ins such as `/llama`, and does not mean no host code runs.

## Lifecycle and budgets are behavior too

SDK-hosted prompts have model-call and time budgets; children have independent limits. Direct native `-e` loading does not pass through the SDK's parent-prompt budget wrapper. Errors must reach the host rather than masquerading as empty success. Session disposal, MCP shutdown, and cancellation belong to failure paths as well as successful ones.

## Continue a conversation after exiting

```sh
npm run agent -- --stage 9 --workspace examples/workspaces/todo --resume
```

The SDK creates a new session by default. Explicit `--resume` uses Pi's `SessionManager.list(cwd, sessionDir)` to select the most recently active record for the current workspace, then passes `SessionManager.open()` to `createAgentSession()`. Pi restores user messages, assistant messages, and tool results; new messages append to the same file. If no saved conversation exists, startup reports an error and asks you to start a new conversation first. The CLI prints the session ID and file for inspection.

The session supplies conversation context. The current launch configures the stage, model, mode, and approval callback, defaulting to `plan`; workspace files, tasks, and checkpoints retain their current state. Skip `lab:reset` before resuming because it generates a new exercise directory. This entry point selects the most recently active session; history selection and conversation branching remain available through Pi's native interface.

`tests/sessions.test.ts` uses real Pi with the official scripted model to read a file, record a task, close the session, and resume with a new model runtime. It asserts that old messages and tool results reach the next model request, the same file receives appended messages, and the current stage and plan mode apply. It also checks fresh conversations by default, recent-session selection, exclusion of other workspaces' records, missing-session errors, and symlink rejection. Run `npm run test:integration` to reproduce.

## Final acceptance

```sh
npm run verify
npm run test:integration
npm run demo
npm run model:smoke
```

The first three need no commercial model key. `model:smoke` records a real-model check or a skip reason according to credential availability. Consult the repository acceptance report for actual outcomes; an available entry point is not a passed test. Preview the site with `npm run docs:dev`.

**Completion criterion:** run a real Pi coding workflow from a fresh exercise directory, explain the source of each capability, demonstrate important failures, and state the boundaries of application policy, model behavior, and the execution environment.

## What to extend next

Choose a small, verifiable improvement: another read-only tool, cross-process task locking, child-process isolation, or a history-selection interface. Change one responsibility at a time, with bilingual explanation and a matching failure experiment. A teaching v1 is not a promise to reproduce every product feature.
