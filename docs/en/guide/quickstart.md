# Quickstart

Start without a key to establish that tools and runtime work, then connect a live model. Run commands from the `learn-pi` repository root; exercise data is generated separately.

## 1. Prepare the environment

Install Node.js **22.19.0 or newer**, npm, and Git. Node 24 LTS is a good baseline; Node 20 is unsupported.

```sh
node --version
npm --version
git --version
# With nvm, first run nvm install && nvm use (24.16.0 from .nvmrc).
npm ci --ignore-scripts
```

`package-lock.json` locks direct and transitive dependencies. `--ignore-scripts` skips dependency installation scripts; the validated text-tool and documentation workflows do not depend on optional native clipboard/image features. Pi is pinned to `0.85.1`; no separate global installation is needed.

## 2. Run real Pi without a key

```sh
npm run check
npm test
npm run test:integration
npm run stage -- --stage 1
npm run demo
```

The demo should show real Pi dispatching reading, tasks, MCP, checkpoint, editing, and verification tools. It reports initially failing tests, a passing repair, and restoration of the original files. The workspace and JSON report live under `.cache/demos/`; the script prints the exact location.

::: tip What “real” means here
Pi sessions, extension loading, tool execution, local MCP subprocesses, and Git operations are real. Model responses are scripted with the official test provider. No remote reasoning occurs, and this does not prove a live model completed the task.
:::

Some tests deliberately trigger errors and assert that they are handled correctly. The test suite should still pass. The Todo exercise also starts with intentional failures; those are not installation failures.

## 3. Open the documentation

```sh
npm run docs:dev
```

Open the local address printed by the terminal, typically `http://127.0.0.1:5173`. Chinese is the default; the language menu switches to the corresponding English page. To inspect the production build:

```sh
npm run docs:build
npm run docs:check
npm run docs:preview
```

The server binds only to loopback and does not publish the site. If the port is occupied, use the address the terminal actually reports.

## 4. Configure model credentials

The course CLI uses provider environment variables and a repository-local `.cache/pi-agent/` authentication directory. It does not automatically read global Pi credentials. Never put keys into source, prompts, or committed files.

For Pi's interactive login, run from the repository root:

```sh
PI_CODING_AGENT_DIR="$PWD/.cache/pi-agent" npm exec pi --
```

Enter `/login`, follow the provider's supported flow, then exit. Alternatively configure the provider environment variable securely in your local shell, such as `ANTHROPIC_API_KEY`. Availability depends on the pinned release and your account; the course does not assume everyone has the same model.

## 5. Start the complete agent

```sh
npm run lab:reset
npm run agent -- --stage 9 --workspace examples/workspaces/todo
```

`lab:reset` creates a marked disposable workspace. Running it again resets that exercise; keep personal files elsewhere. The agent starts in `plan` mode. Ask it to inspect code and tests and propose a plan, enter `/mode execute` yourself, and approve concrete operations.

| Command | Purpose |
| --- | --- |
| `/status` | Stage, mode, session statistics |
| `/mode plan` / `/mode execute` | Human-controlled mode switch |
| `/tasks` | Workspace task list |
| `/checkpoint before-fix` | Sample checkpoint from stage 7 |
| `/restore ACTUAL-ID` | Confirm and restore ordinary sample files |
| `/compact` | Invoke Pi compaction from stage 8 |
| `/quit` | Exit and dispose the session |

Select an available model with `--provider` and `--model`, and a lesson with `--stage 1` through `--stage 9`. `--prompt` runs a single noninteractive request; mutations needing approval are denied by default.

`--approve-fixture` accepts only marked course directories and automatically approves a finite set of write, verification, and checkpoint tools. **Verification executes model-modified code with host privileges and inherited environment credentials. It is not a safe shell substitute.** Use the container experiment to constrain execution.

## Troubleshooting

**No matching model.** Check provider environment configuration or local Pi login without displaying credential files. All no-key experiments remain available.

**Tests fail initially.** The fixture intentionally contains two defects. Course tests should pass; chapter 07 repairs the exercise.

**Execution still denied.** Check stage availability, protected paths, and whether an approval UI exists. Execution mode does not override path policy or approval.

**Restore rejected.** Use a recorded checkpoint inside its original generated directory. Copying it to a new absolute path or container requires a fresh marker there.

Continue to the [learning route](./route) or [TypeScript prelude](../chapters/00-typescript).
