# learn-pi

**Know a little Python? Use TypeScript to extend real Pi and build a coding agent one chapter at a time.**

[简体中文](README.md) · [Quickstart](docs/en/guide/quickstart.md) · [Learning route](docs/en/guide/route.md) · [Versions and sources](docs/en/reference/sources.md) · [Acceptance report](reports/ACCEPTANCE.en.md)

Start with Pi's model/tool loop, add planning, recoverable tasks, approval and path policy, real local MCP, read-only subagents, tests, and Git checkpoints, then assemble the local application with the SDK. There is one TypeScript implementation. Python appears only in language comparisons and an advanced RPC reference.

![Course architecture](docs/public/architecture.svg)

## Start in ten minutes

You need Node **>=22.19.0**, npm, and Git; Node 24 LTS is a good baseline. From the repository root:

```sh
# With nvm, first run nvm install && nvm use (24.16.0 from .nvmrc).
npm ci --ignore-scripts
npm run verify
npm run demo
npm run docs:dev
```

The site defaults to Chinese with a complete English version in the language menu. Development preview typically uses `http://127.0.0.1:5173`; follow the terminal's actual address. It binds to loopback only. `npm run docs:build` builds the static site; `npm run docs:preview` serves the result locally.

`demo` **needs no API key**. An official scripted provider drives real Pi through reading, editing, MCP, testing, and checkpoint restoration. This verifies runtime and tool wiring, **not live-model reasoning**.

## Run each chapter

Every stage uses the same implementation:

```sh
# No key: real Pi with stage-specific scripted responses
npm run stage -- --stage 4

# With credentials: interactive stage
npm run lab:reset
npm run agent -- --stage 4 --workspace examples/workspaces/todo
```

| Chapter | Capability and judgment | Code entry |
| --- | --- | --- |
| [00](docs/en/chapters/00-typescript.md) | TypeScript essentials for Python developers | `src/core/tasks.ts` |
| [01](docs/en/chapters/01-pi.md) | Pi foundation, tool loop, sessions | `src/runtime.ts` |
| [02](docs/en/chapters/02-plan.md) | Read-only exploration and human mode switching | `src/core/policy.ts` |
| [03](docs/en/chapters/03-tasks.md) | Tasks, atomic snapshots, recovery | `src/core/tasks.ts` |
| [04](docs/en/chapters/04-policy.md) | Approval, canonical paths, audit | `src/core/policy.ts` |
| [05](docs/en/chapters/05-mcp.md) | Fixed local MCP service | `src/integrations/mcp.ts` |
| [06](docs/en/chapters/06-subagents.md) | Two read-only roles, concurrency, failure convergence | `src/integrations/subagents.ts` |
| [07](docs/en/chapters/07-coding.md) | Edit, test, diff, sample checkpoints | `src/core/checkpoints.ts` |
| [08](docs/en/chapters/08-context.md) | Context, resources, container boundaries | `src/runtime.ts` |
| [09](docs/en/chapters/09-sdk.md) | SDK assembly and a complete coding task | `src/cli.ts` |

## Connect a live model

The course uses provider environment variables and repository-local `.cache/pi-agent/` auth, without automatically reading global Pi login. Authenticate using the pinned CLI:

```sh
PI_CODING_AGENT_DIR="$PWD/.cache/pi-agent" npm exec pi --
# Enter /login in Pi, finish authentication, then exit.
npm run lab:reset
npm run agent -- --stage 9 --workspace examples/workspaces/todo
```

Alternatively configure the appropriate API key environment variable securely, then select an available model with `--provider` / `--model`. The agent starts in `plan`. Read code and tests, review the plan, enter `/mode execute` yourself, and approve concrete operations. Host commands include `/tasks`, `/status`, `/checkpoint LABEL`, `/restore ID`, `/compact`, and `/quit`.

After exiting, run `npm run agent -- --workspace examples/workspaces/todo --resume` to continue the most recently active conversation in that workspace. Conversations live in `.learn-pi/sessions/`; startup prints the session ID and file. Omitting `--resume` starts a new conversation. Resuming uses the current stage, model, and mode options, with `plan` as the default.

`npm run model:smoke` executes a live repair when matching credentials exist; otherwise it explicitly records `SKIPPED` in `reports/model-smoke.json`. The acceptance machine has no usable credentials, so remote-model behavior remains unverified.

## Explicit boundaries

- **Pi native:** model access, loop, built-in tools, events, sessions, compaction, Skills, and more. We reuse them.
- **Official examples:** planning, tasks, approval, subagents, and checkpoints inform the design. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for attribution and MIT notices.
- **Course composition:** shared policy, workspace task recovery, fixed MCP, bounded read-only delegation, disposable checkpoints, bilingual labs.
- Approval hooks and path filters **are not OS sandboxes**. Approved shell/tests run with host privileges; `--approve-fixture` also executes model-modified code with inherited environment. See the [container configuration](containers/README.md); its probe was not run here because no Docker daemon was available.
- Children have separate transcripts and tool surfaces while sharing the Node process and filesystem. Conversation branches, task recovery, and file rollback are distinct operations.

Pi is pinned to `0.85.1`, npm source commit `d981de1229ef899957bbe968bc8dcda02a21f477`, using the `@earendil-works/*` primary namespace. See [version-lock.json](reports/version-lock.json).

## Development and acceptance

```sh
npm run check
npm test
npm run test:integration
npm run docs:build
npm run docs:check
```

[Labs](docs/en/guide/labs.md) distinguish deterministic checks, real Pi/MCP integration, live models, and containers. Use the [code map](docs/en/guide/architecture.md) and [contribution guide](CONTRIBUTING.en.md) to extend the project.

Delivery is limited to an independent local repository, preview, and acceptance report: no public repository, push, deployment, or social publishing. This is neither a complete Codex/Claude Code replica nor a standalone commercial product.

MIT · [License](LICENSE)
