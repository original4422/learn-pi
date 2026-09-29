# learn-pi v1 local acceptance

Date: 2026-09-19. **The course, progressive implementation, final agent, bilingual site, and offline/real-Pi integration checks pass. Remote-model behavior and container execution remain explicitly unverified.** Scripted responses, configuration files, and CLI startup are not counted as successful live-model tasks.

[中文报告](ACCEPTANCE.md) · [Machine-readable results](acceptance.json) · [Version evidence](version-lock.json)

2026-09-30 resume update: explicit `--resume` uses Pi's native session API to continue the most recently active conversation in the current workspace. On Node 24.16.0, `npm run verify` (48/48 tests), `npm run demo`, and the CLI help check passed. See the [resume verification record](session-resume.json).

## Delivery

Independent repository: `/Users/original/Project/github/personal_project/learn-pi`. Project edits and experiments stay within this directory. No edits to `learn-codex`, `learn-claude-code`, or workspace-wide settings; no remote, push, public deployment, or social publication.

- One TypeScript native-extension implementation on real `@earendil-works/pi-coding-agent@0.85.1`, assembled by `src/runtime.ts` / `src/cli.ts`.
- Ten complete chapter pairs (00–09), including TypeScript essentials for Python readers; 19 pages per language with experiments, architecture, sources, contribution guidance, and advanced Python RPC.
- Nine independently runnable no-key stages: `npm run stage -- --stage 1` through `9`. Each creates a new `.cache/stages/` workspace and `.learn-pi/stage-report.json`.
- A complete coding fixture, real stdio MCP server, read-only child Pi sessions, planning/execution, durable tasks, approval/path policy, audit, real tests, and Git checkpoints.
- Editable SVG/Vue/CSS diagrams and layout. Chinese is the default; English switching and local full-text search work.

## Environment and version

| Item | Observed value |
| --- | --- |
| OS | Darwin 24.6.0 arm64 |
| Final Node | 24.16.0 (`.nvmrc`) |
| npm | 11.16.0 |
| Git | 2.39.5 (Apple Git-154) |
| Pi / pi-ai | 0.85.1, exact dependencies and lockfile |
| npm `gitHead` | `d981de1229ef899957bbe968bc8dcda02a21f477` |
| MCP SDK / TypeBox | 1.30.0 / 1.3.7 |
| VitePress | 1.6.4 |

Registry metadata, matching source package/docs, installed packages, and lockfile integrity were checked. `npm run version:check` repeats the local check. Initial installation successfully added 481 packages with `npm install --ignore-scripts`; reproduce with `npm ci --ignore-scripts`. Global Node/Pi settings were not changed. This machine's default shell uses unsupported Node 20: select `nvm use` in this repository or another Node >=22.19.0 before running commands.

## Actual results

| Command / check | Result | Evidence |
| --- | --- | --- |
| `npm run verify` | **PASS** | Version, TypeScript, complete tests, site build, links |
| `npm test` within verify | **45/45 PASS, 0 skipped** | Includes the aggregate test executing all nine stages |
| `npm run docs:build` | **PASS** | 39 generated pages: 38 content pages plus 404 |
| `npm run docs:check` | **PASS** | 19 Chinese + 19 English; 1,280 local links/anchors; default `zh-CN` |
| `npm run demo` | **PASS** | Actual Pi dispatch: initial failure → edit → 4 passing fixture tests → diff → original restored |
| `npm run stage -- --stage 9` | **PASS** | 11 scripted model responses, repair, verification, task update, restore |
| Native Pi CLI / RPC | **PASS** | Native `.ts` loading, tool/command registration, offline RPC startup; no model requests |
| Python RPC reference | **PASS** | Actual `get_state`, `messageCount=0`; not a second agent implementation |
| Browser checks | **PASS** | Chinese/English home, same-chapter language switch, Chinese MCP search, no horizontal overflow at 390px |
| `npm run model:smoke` | **SKIPPED** | No matching authenticated provider available |
| Docker build / isolation probe | **NOT RUN** | Docker CLI exists; daemon unavailable |

Raw output: [verification](verification.txt), [final site build](docs.txt), [offline workflow](demo.txt), [Python RPC](python-rpc.txt), [model status](model-smoke.json). Structured and browser evidence: [acceptance.json](acceptance.json).

Tests cover plan-mode refusal, missing UI/refused/throwing approval, traversal and symlinks, Pi aliases/read fallback, redirected session storage, atomic tasks and corrupt-state recovery, real MCP requests/process cleanup, child failure/timeouts/cancellation/concurrency, actual child Pi reads, model/tool budgets, isolated Git restore, inherited Git environment, and fsmonitor suppression. Integration failures were fixed through real runtime regressions, not policy mocks alone.

## Local review

Running preview: <http://127.0.0.1:4173/>; English: <http://127.0.0.1:4173/en/>. The Chinese home is open in the app. The server depends on its local process lifetime; restart if needed:

```sh
cd /Users/original/Project/github/personal_project/learn-pi
nvm use
npm run docs:dev -- --port 4173
```

In another terminal:

```sh
nvm use
npm run stage -- --stage 6
npm run demo
npm run verify
```

For live use, configure provider environment variables or repository-local `.cache/pi-agent/` login as described in [quickstart](../docs/en/guide/quickstart.md). Then run `npm run lab:reset` and `npm run agent -- --stage 9 --workspace examples/workspaces/todo`.

## Limits and unverified behavior

1. **Models:** official fauxProvider scripts model messages; Pi, tools, MCP, filesystem, and Git execute for real. No API credentials were available, so live repair quality, real provider requests, and online compaction quality remain unverified. A bounded `model:smoke` path is supplied.
2. **Execution:** approval/path policy is application-level and has a check/use race window. Approved shell/test code retains host privileges. `--approve-fixture` automatically approves selected tool names, including execution of model-modified code; it is not a sandbox. Container configuration and exact probes are supplied, but no daemon was available to run them.
3. **Children:** separate context and read-only tools share the Node process/filesystem. The final SDK shares the model runtime with children. Native `pi -e` children do not inherit parent OAuth/custom-provider configuration; environment-backed built-in providers work. Native loading also lacks the SDK's complete model-call/deadline envelope.
4. **Persistence:** task coordination is within one process, not a cross-process transaction. Task status is not completion evidence. Git restore accepts only marked disposable workspaces and known IDs; it does not rewind conversations/tasks/protected files, does not record empty directories, and refuses symlinks. After preflight, file copying is not crash-atomic.
5. **Host scope:** `--resume` continues the most recently active conversation in the current workspace; Pi's native interface provides history selection and branching. Pi's broader native Skills are distinct from course resource defaults. The supplied verification command targets the Todo fixture; general projects need their own verifier.
6. **Other environments:** Linux containers, other OSes, all providers, and all models have not been tested. Sources and comparisons are version/date bounded; the course does not promise complete Codex/Claude Code replication.

## Local commits

- `930cf65`: progressive agent, policies, real integration tests.
- `8143cb6`: complete bilingual course/site and nine offline stages.
- Acceptance evidence is committed separately; inspect `git log --oneline` for the complete history. No remote is configured.
