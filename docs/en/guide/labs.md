# Labs and acceptance

A sentence saying “done” is not an experiment. Every conclusion should have a corresponding file, event, process result, or assertion. This matrix distinguishes what each check establishes.

## Verification matrix

| Command | Establishes | Does not establish |
| --- | --- | --- |
| `npm run check` | TypeScript compatibility with pinned APIs | Runtime policy correctness |
| `npm test` | Paths, approval, persistence, recovery, MCP, delegation, runtime tests | Commercial-model planning quality |
| `npm run test:integration` | Actual Pi sessions, extension wiring, local MCP | Remote-model success rates |
| `npm run recovery:demo` | Real Pi SIGKILL, receipt reconciliation, resumed task and file rollback | General exactly-once execution |
| `npm run demo` | Real tool workflow and recovery with scripted responses | Autonomous reasoning quality |
| `npm run docs:build` | Bilingual static build and build-time links | Identical appearance on every device |
| `npm run docs:check` | Page/navigation parity and local links | Perfect translation semantics forever |
| `npm run model:smoke` | Live sample repair when credentials exist | Generalization to every model/project |

## Chapter lab cards

| Stage | Success case | Required failure case | Evidence |
| --- | --- | --- | --- |
| 1 | Read the sample | Request a write | Tool surface, unchanged files |
| 2 | Human switches modes | Write while planning | `plan_is_read_only` |
| 3 | Recover after restart | Invalid state/corrupt snapshot | IDs, revision, recovery or explicit error |
| 4 | Approve a concrete edit | Refusal, escape, symlink | No side effect and reason code |
| 5 | Query catalog | Blank query, closed client | Actual MCP response/error |
| 6 | Two-role research | Child failure or timeout | Ordered outcomes, bounded concurrency |
| 7 | Repair passes tests | Restore original defect | Diff and changing test result |
| 8 | Inspect context/container | Root writes and networking fail | Actual process outcomes |
| 9 | Complete coding task | Missing auth or exhausted budget | Explicit skip/failure, no false success |

## Reproduction sequence

```sh
npm ci --ignore-scripts
npm run verify
npm run test:integration
npm run demo
npm run model:smoke
```

`model:smoke` writes `reports/model-smoke.json`. Without matching credentials it records `SKIPPED`; it does not substitute scripted responses and call them remote success. Demo reports live in the `.cache/demos/` directory printed by the script.

The live smoke test automatically approves a finite tool set in a disposable directory, including execution of model-modified tests with host privileges and environment. Use it with a trusted local exercise environment; use the following configuration when execution needs containment.

## Container isolation experiment

A running Docker Engine is required. From the repository root:

```sh
docker build -f containers/Dockerfile -t learn-pi:local .
mkdir -p examples/workspaces/container
docker run --rm --read-only --network none --cap-drop ALL --security-opt no-new-privileges --pids-limit 128 --memory 1g --cpus 2 --tmpfs /tmp -v "$PWD/examples/workspaces/container:/workspace" learn-pi:local scripts/container-init.ts
docker run --rm --read-only --network none --cap-drop ALL --security-opt no-new-privileges --pids-limit 128 --memory 1g --cpus 2 --tmpfs /tmp -v "$PWD/examples/workspaces/container:/workspace" learn-pi:local scripts/container-probe.ts
```

Initialization requires an empty mount. If you already ran the lab, choose a new disposable directory instead of blindly deleting files. On Linux, allow UID 1000 to write the mount. The probe checks sample writes, read-only image files, absence of a known host path, and blocked outbound TCP. It cannot prove every host file or network path is inaccessible.

The whole Pi process and extensions run inside the container. The offline probe receives no model credentials. Live inference requires explicitly enabling networking and forwarding required variables; that setup is no longer offline and supplies no domain-level allowlist. See `containers/README.md`.

The build machine has Docker CLI but no reachable daemon, so image build and probe execution are **unverified**. Configuration, expectations, and actual outcomes are recorded separately.

## Record your own acceptance

Record the date, Node/Pi versions, commands, exit codes, report paths, and skip reasons. For model experiments, include provider/model IDs, diffs, and test results without secrets. Distinguish type checks, deterministic behavior, real integration, and remote-model task success whenever claiming completion.
