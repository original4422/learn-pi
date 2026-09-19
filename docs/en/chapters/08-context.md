# 08 · Manage context and choose isolation

<p class="eyebrow">STAGE 08 / WHAT THE MODEL SEES; WHAT THE PROCESS CAN DO</p>

Context controls information; isolation controls capabilities. These often appear together but are not interchangeable. Reading fewer files reduces noise without revoking privileges. A container constrains some side effects without automatically improving reasoning.

## No-key stage experiment

This runs real Pi with a scripted provider in a fresh exercise workspace and asserts this stage’s behavior. It makes no remote model request. Stage 8 inspects actual context/statistics APIs without faking online compaction.

```sh
npm run stage -- --stage 8
```

## Pi already manages context

Pi provides instruction files, Skills, prompt templates, session trees, and compaction. We reuse them. `src/runtime.ts` constructs an explicit `DefaultResourceLoader`, disables automatic project/global extensions, Skills, templates, themes, and context files, then deliberately reads a workspace `AGENTS.md` after path-policy admission.

That makes the first run explainable: existing machine plugins do not silently alter the lesson. The native Pi entry point still uses Pi's own loading behavior. Course SDK defaults are not product defaults.

## Run the context experiment

```sh
npm run agent -- --stage 8 --workspace examples/workspaces/todo
```

After several read-only exchanges, inspect `/status` for context and session statistics, then run `/compact`. This invokes Pi compaction with guidance to preserve the goal, decisions, task IDs, paths, and test results. A real summary normally requires a model request; no-key checks do not validate summary quality.

Compare files before and after compaction: compaction should not alter them. Ask the agent to restate the goal, remaining tasks, and verified evidence. Recover missing facts from explicit state or sources rather than treating a summary as lossless storage.

## Choose the right customization mechanism

| Need | Prefer | Course example |
| --- | --- | --- |
| Persistent project guidance | Instruction file | Sample `AGENTS.md` |
| Reusable procedural knowledge | Skill | Study Pi's native mechanism; auto-loading is disabled here |
| Tools, event policy, UI behavior | TypeScript extension | `src/extensions/course.ts` |
| Models, resources, sessions, host lifecycle | SDK | `src/runtime.ts` |
| Drive Pi from another language | RPC | [Python reference](../reference/python-rpc) |

Do not launch a process just to store stable instructions, or use a prompt template to enforce approval. Match mechanisms to responsibilities.

## Container experiment: test concrete restrictions

The repository includes container configuration; see [the lab](../guide/labs#container-isolation-experiment) for commands and prerequisites. Verify three concrete properties: sample data is writable, the image root filesystem is read-only, and networking is disabled. Do not expose the host home directory, credentials, or Docker socket as writable mounts.

A container limits code that actually runs inside it. Putting only tests in a container leaves host-side file tools and extensions outside that boundary. The configuration and acceptance report distinguish the processes enclosed and the checks not executed.

Containers also depend on kernel, runtime, and mount configuration. The offline experiment needs no model secrets. A live model requires networking; design that access explicitly rather than removing every restriction.

## Failure and verification

Use `npm run test:integration` to inspect the course loader and read-only child resource configuration. If a container engine is available, run the lab and record exit codes. Otherwise retain the runnable configuration and report it as unexecuted; static configuration review is not a successful isolation test.

Consider a summary saying “all work is complete” while the task file still contains `pending` entries. Recheck state and evidence to resolve that conflict. Shorter text does not have greater authority.

**Completion criterion:** distinguish resource loading, compaction, path policy, and OS isolation, and identify the exact layer each check exercises.

## Design connection

Mature agents configure permissions, context, and execution environments separately because these solve different problems. We preserve that separation. See [design comparisons](../reference/comparison) for bounded product parallels and source dates.
