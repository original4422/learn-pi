# 04 · Approvals and path boundaries

<p class="eyebrow">STAGE 04 / ONE APPROVAL IS NOT UNIVERSAL PERMISSION</p>

This chapter opens up the protection layer already used in earlier stages: admitting a request, deciding whether approval is needed, applying that decision, and leaving inspectable records. Protections are active from the start; progression is not an excuse to run early lessons without safeguards.

## No-key stage experiment

This runs real Pi with a scripted provider in a fresh exercise workspace and asserts this stage’s behavior. It makes no remote model request.

```sh
npm run stage -- --stage 4
```

## Pi mechanisms and course responsibilities

Pi's `tool_call` event can block execution, and its interactive UI can ask the user. Official examples already demonstrate permission prompts and protected paths. We compose these ideas: `WorkspacePolicy` evaluates requests, `ApprovalGate` authorizes them, `src/core/audit.ts` records limited metadata, and the extension returns the decision to Pi.

All of this runs inside the host process. **It is not an operating-system sandbox.** Trusted extensions retain host privileges; approved shell commands can execute arbitrary host code; concurrent path replacement remains possible between checking and opening a file. See [chapter 08](./08-context) for stronger isolation.

## Why path checks need more than startsWith

If the workspace is `/tmp/lab`, `/tmp/lab-secret` has the same prefix without being inside it. Parent traversal, absolute paths, and symbolic links defeat naive string checks too.

`src/core/policy.ts` checks lexical containment and then resolves real paths. For a new file, it walks to an existing ancestor, resolves that location, and appends the missing components. This catches `inside/link/new.txt` when `link` points outside. Dangling symlinks are not treated as ordinary nonexistent directories.

```ts
export function isContained(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" ||
    (!relative.startsWith(`..${path.sep}`) && relative !== ".." &&
     !path.isAbsolute(relative));
}
```

To avoid disagreement between Pi and policy path parsing, the course conservatively rejects aliases using `@`, `~`, `file://`, or Unicode spaces, and requires read targets to exist. Execution uses the checked canonical path.

Protected names include `.git`, `.learn-pi`, `.env`, and common credential directories, including nested occurrences. This protects the course tool entry points; it does not identify every possible secret file. Recursive searches can expose protected descendants, so the main course does not expose general `grep` or `find` tools.

## Approval fails closed

`ApprovalGate.authorize()` has a simple contract: approval cannot override a policy denial; reads needing no approval may proceed; required approval is denied when the callback is absent, the host is headless, the callback throws, or the answer is no.

```ts
if (!decision.allowed) return false;
if (!decision.requiresApproval) return true;
if (this.options.headless || !this.options.confirm) return false;
```

An “approve everything” callback is short but changes the system's authorization meaning. `--approve-fixture` is limited to marked, disposable course workspaces and a finite set of request-specific operations. It is not automatic permission for arbitrary directories, and never automatically approves a general shell. However, `verify_project` runs model-modified code with host privileges and inherited environment credentials, so this flag is not a safe shell substitute.

## Run the approval experiment

```sh
npm run agent -- --stage 4 --workspace examples/workspaces/todo
```

Enter `/mode execute` yourself and request a small edit. Deny the first approval and inspect the unchanged file. Approve the next concrete request and confirm the resulting diff matches. Then request `../outside.txt`, `.git/config`, or `.env`: policy should deny these without offering a bypass dialog.

Run `npm test` for escaping paths, symbolic links, protected names, refusal, and missing-UI cases. Run `npm run test:integration` to show that denial reaches Pi's actual loop. Unit tests alone cannot prove the host installed the hook correctly.

## What belongs in an audit record

Time, tool, decision, and stable reason codes help explain why an operation did not run. Avoid indiscriminately logging file bodies, secrets, or arbitrary tool output. This is a local diagnostic log, not a tamper-proof security ledger; host-privileged people or extensions can change it.

After a denial, the model should explain the limit or choose an allowed approach, not repeatedly rephrase the same request to bypass protection. Failure messages should be useful without exposing protected content.

**Completion criterion:** observe allowed reads, pending approval, human refusal, and direct policy denial; demonstrate that rejected writes have no corresponding file side effect.

## Design connection

Codex documents OS-level filesystem and network restrictions. Claude Code also distinguishes permission rules from shell sandboxing. Our event hook is application-level admission control and cannot inherit those products' sandbox guarantees. [Codex sandboxing](https://learn.chatgpt.com/docs/sandboxing), [Claude Code permissions](https://code.claude.com/docs/en/permissions)

The reusable design lesson is to separate policy admission, human approval, and execution-environment restrictions.
