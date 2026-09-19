import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile, readdir, chmod } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { test } from "node:test";
import { ApprovalGate, WorkspacePolicy, canonicalizePath, type ToolRequest } from "../src/core/policy.js";
import { AuditLog, type AuditEvent } from "../src/core/audit.js";
import { TaskStore } from "../src/core/tasks.js";
import { CheckpointStore } from "../src/core/checkpoints.js";

const exec = promisify(execFile);
const project = fileURLToPath(new URL("..", import.meta.url));
const cache = path.join(project, ".cache", "core-tests");

async function fixture(t: { after: (fn: () => Promise<void>) => void }): Promise<string> {
  await mkdir(cache, { recursive: true });
  const root = await mkdtemp(path.join(cache, "case-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test("plan permits workspace exploration and task metadata but blocks mutation and unknown tools", async (t) => {
  const root = await fixture(t);
  await writeFile(path.join(root, "hello.txt"), "hello");
  const policy = new WorkspacePolicy({ root, additionalReadOnlyTools: ["catalog_search"] });
  for (const request of [
    { name: "read", input: { path: "hello.txt" } },
    { name: "ls", input: { path: "." } },
    { name: "grep", input: { pattern: "hello" } },
    { name: "task_add", input: { text: "Understand the module" } },
    { name: "catalog_search", input: { query: "extensions" } },
  ]) assert.equal((await policy.evaluate(request)).allowed, true);
  for (const name of ["write", "edit", "bash", "arbitrary_plugin"]) {
    const decision = await policy.evaluate({ name, input: { path: "hello.txt", command: "echo unsafe" } });
    assert.equal(decision.allowed, false, name);
  }
  assert.equal(await readFile(path.join(root, "hello.txt"), "utf8"), "hello");
  assert.throws(() => policy.setMode("unknown" as "plan"), /Invalid agent mode/);
  assert.throws(() => new WorkspacePolicy({ root, mode: "invalid" as "plan" }), /Invalid agent mode/);
  assert.throws(() => new WorkspacePolicy({ root, additionalReadOnlyTools: ["bash"] }), /must not override/);
});

test("path policy rejects sibling prefixes, traversal, secrets and aliases into protected metadata", async (t) => {
  const parent = await fixture(t);
  const root = path.join(parent, "workspace");
  const sibling = path.join(parent, "workspace-extra");
  await mkdir(root);
  await mkdir(sibling);
  await writeFile(path.join(root, ".env"), "TOKEN=should-not-be-read");
  await mkdir(path.join(root, ".git"));
  await writeFile(path.join(root, ".git", "config"), "secret config");
  await symlink(path.join(root, ".env"), path.join(root, "innocent.txt"));
  await symlink(path.join(root, ".git"), path.join(root, "metadata"));
  const policy = new WorkspacePolicy({ root, mode: "execute" });
  for (const file of ["../workspace-extra/a", path.join(sibling, "file"), "../../escape", ".env", ".env.local", ".git/config", ".learn-pi/tasks.json", "innocent.txt", "metadata/config", "nested/.env"]) {
    assert.equal((await policy.evaluate({ name: "read", input: { path: file } })).allowed, false, file);
  }
  assert.equal((await policy.evaluate({ name: "write", input: { path: "." } })).reason, "workspace_root_mutation");
  assert.equal((await policy.evaluate({ name: "read", input: { path: "invalid\0path" } })).reason, "invalid_path");
});

test("missing descendants behind symlinks and dangling symlinks cannot bypass containment", async (t) => {
  const parent = await fixture(t);
  const root = path.join(parent, "workspace");
  const outside = path.join(parent, "outside");
  await mkdir(root);
  await mkdir(outside);
  await symlink(outside, path.join(root, "escape"));
  await symlink(path.join(outside, "not-created"), path.join(root, "dangling"));
  await mkdir(path.join(root, "safe"));
  await symlink(path.join(root, "safe"), path.join(root, "internal"));
  const policy = new WorkspacePolicy({ root, mode: "execute" });
  assert.equal((await policy.evaluate({ name: "write", input: { path: "escape/new/deep/file" } })).reason, "outside_workspace");
  assert.equal((await policy.evaluate({ name: "write", input: { path: "dangling/file" } })).reason, "path_resolution_failed");
  const allowed = await policy.evaluate({ name: "write", input: { path: "internal/new/file" } });
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.canonicalPath, path.join(root, "safe", "new", "file"));
  assert.equal(await canonicalizePath(path.join(root, "new", "file")), path.join(root, "new", "file"));
});

test("path policy rejects Pi normalization aliases and unchecked missing-file read fallbacks", async (t) => {
  const root = await fixture(t);
  const policy = new WorkspacePolicy({ root, mode: "execute" });
  for (const supplied of ["@.env", "~/private", "file:///private/file", "space\u00a0link/file", "wide\u3000space"]) {
    assert.equal((await policy.evaluate({ name: "read", input: { path: supplied } })).reason, "ambiguous_path_alias");
    assert.equal((await policy.evaluate({ name: "write", input: { path: supplied } })).reason, "ambiguous_path_alias");
  }
  assert.equal((await policy.evaluate({ name: "read", input: { path: "nonexistent.txt" } })).reason, "read_target_missing");
  assert.equal((await policy.evaluate({ name: "write", input: { path: "new-file.txt" } })).allowed, true);
  const ambiguousRoot = path.join(root, "wide\u00a0root");
  await mkdir(ambiguousRoot);
  assert.equal((await new WorkspacePolicy({ root: ambiguousRoot }).evaluate({ name: "ls", input: {} })).reason, "ambiguous_path_alias");
});

test("approval gates deny missing UI, headless, rejection and callback failures before executor runs", async (t) => {
  const root = await fixture(t);
  const policy = new WorkspacePolicy({ root, mode: "execute", additionalMutationTools: ["checkpoint_restore", "verify_project"] });
  const request: ToolRequest = { name: "write", input: { path: "result.txt", content: "changed" } };
  const decision = await policy.evaluate(request);
  let executions = 0;
  const execute = async (gate: ApprovalGate) => {
    if (await gate.authorize(request, decision)) {
      executions++;
      await writeFile(path.join(root, "result.txt"), "changed");
    }
  };
  for (const gate of [
    new ApprovalGate(),
    new ApprovalGate({ headless: true, confirm: () => true }),
    new ApprovalGate({ confirm: () => false }),
    new ApprovalGate({ confirm: () => { throw new Error("UI closed"); } }),
  ]) await execute(gate);
  assert.equal(executions, 0);
  await assert.rejects(readFile(path.join(root, "result.txt")), { code: "ENOENT" });
  await execute(new ApprovalGate({ confirm: (approved) => approved.decision.canonicalPath === path.join(root, "result.txt") }));
  assert.equal(executions, 1);
  for (const name of ["checkpoint_restore", "verify_project", "bash"]) {
    assert.equal((await policy.evaluate({ name, input: {} })).requiresApproval, true);
  }
  policy.setMode("plan");
  const blocked = await policy.evaluate(request);
  assert.equal(await new ApprovalGate({ confirm: () => true }).authorize(request, blocked), false);
  assert.equal((await policy.evaluate({ name: "verify_project", input: {} })).allowed, false);
});

test("audit serializes valid JSONL without retaining extra inputs, prompts or paths", async (t) => {
  const root = await fixture(t);
  const file = path.join(root, ".learn-pi", "audit.jsonl");
  const audit = new AuditLog(file);
  const event = { tool: "write", outcome: "denied", mode: "execute", reasonCode: "user_denied", input: { content: "secret-token-123" }, prompt: "private prompt", path: "/private/user" };
  await Promise.all(Array.from({ length: 8 }, () => audit.record(event as AuditEvent)));
  const content = await readFile(file, "utf8");
  const records = content.trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(records.length, 8);
  assert.equal(records[0].reasonCode, "user_denied");
  assert.doesNotMatch(content, /secret-token|private prompt|\/private\/user|"input"/);
  await assert.rejects(audit.record({ tool: "write", outcome: "denied", mode: "execute", reasonCode: "secret token goes here" }), /stable codes/);
});

test("task transitions survive new instances and enforce one active task without corrupting state", async (t) => {
  const root = await fixture(t);
  const file = path.join(root, "tasks.json");
  const store = new TaskStore(file);
  const first = await store.add("Read the failing test");
  const second = await store.add("Implement the fix");
  await store.update(first.id, "in_progress");
  await assert.rejects(store.update(second.id, "in_progress"), /Only one/);
  const reopened = new TaskStore(file);
  assert.equal((await reopened.list()).find((task) => task.id === first.id)?.status, "in_progress");
  await reopened.update(first.id, "done");
  await reopened.update(second.id, "in_progress");
  assert.deepEqual((await store.list()).map((task) => task.status), ["done", "in_progress"]);
  await assert.rejects(store.update("nonexistent", "done"), /Unknown task/);
  await assert.rejects(store.add("   "), /Task text/);
  await assert.rejects(store.add("text\0secret"), /Task text/);
  await assert.rejects(store.update(first.id, "invented" as "done"), /Invalid task status/);
  const state = await store.load();
  assert.equal(state.revision, 5);
  state.tasks[0]!.text = "mutated externally";
  assert.equal((await store.list())[0]!.text, "Read the failing test");
});

test("task backup recovers a corrupt snapshot, preserving the last committed good state", async (t) => {
  const root = await fixture(t);
  const file = path.join(root, "tasks.json");
  const store = new TaskStore(file);
  const first = await store.add("Persist this task");
  await store.update(first.id, "in_progress");
  await writeFile(file, '{"version":1,"tasks":[');
  const recovered = await new TaskStore(file).load();
  assert.equal(recovered.revision, 1);
  assert.equal(recovered.tasks[0]?.status, "pending");
  assert.equal(JSON.parse(await readFile(file, "utf8")).revision, 1);
  await writeFile(file, "broken");
  await writeFile(`${file}.bak`, "also broken");
  await assert.rejects(store.load(), /no valid backup/);
});

test("same-process TaskStore instances serialize writes and leave no temporary files", async (t) => {
  const root = await fixture(t);
  const file = path.join(root, "tasks.json");
  await Promise.all(Array.from({ length: 12 }, (_, index) => new TaskStore(file).add(`Task ${index}`)));
  const state = await new TaskStore(file).load();
  assert.equal(state.tasks.length, 12);
  assert.equal(state.revision, 12);
  assert.equal(new Set(state.tasks.map((task) => task.id)).size, 12);
  assert.deepEqual((await readdir(root)).sort(), ["tasks.json", "tasks.json.bak"]);
});

test("invalid task schemas and duplicate active tasks fail closed on recovery", async (t) => {
  const root = await fixture(t);
  const file = path.join(root, "tasks.json");
  const store = new TaskStore(file);
  const now = new Date().toISOString();
  for (const state of [
    { version: 2, revision: 0, tasks: [] },
    { version: 1, revision: -1, tasks: [] },
    { version: 1, revision: 1, tasks: ["invalid"] },
    { version: 1, revision: 1, tasks: [
      { id: "a", text: "A", status: "in_progress", createdAt: now, updatedAt: now },
      { id: "b", text: "B", status: "in_progress", createdAt: now, updatedAt: now },
    ] },
  ]) {
    await writeFile(file, JSON.stringify(state));
    await assert.rejects(store.load(), /no valid backup/);
  }
});

test("real Git checkpoints recover tracked and untracked sample files without touching parent or metadata", async (t) => {
  const parent = await fixture(t);
  await exec("git", ["init", "--quiet", parent]);
  const parentFile = path.join(parent, "parent.txt");
  await writeFile(parentFile, "parent stays unchanged");
  await exec("git", ["-C", parent, "add", "parent.txt"]);
  const parentIndexBefore = await readFile(path.join(parent, ".git", "index"));
  const root = path.join(parent, "lesson");
  await mkdir(path.join(root, "src"), { recursive: true });
  await writeFile(path.join(root, "src", "app.txt"), "before");
  await writeFile(path.join(root, "untracked.bin"), Buffer.from([0, 255, 4, 128]));
  await writeFile(path.join(root, "run.sh"), "echo sample\n");
  await chmod(path.join(root, "run.sh"), 0o755);
  const store = await CheckpointStore.initialize(root);
  await exec("git", ["-C", root, "add", "src/app.txt"]);
  const sampleIndexBefore = await readFile(path.join(root, ".git", "index"));
  await writeFile(path.join(root, ".env"), "do-not-snapshot-this");
  await writeFile(path.join(root, ".learn-pi", "tasks.json"), "task metadata stays");
  const checkpoint = await store.create("Before the exercise");
  assert.equal(checkpoint.fileCount, 3);
  await writeFile(path.join(root, "src", "app.txt"), "after");
  assert.match((await exec("git", ["-C", root, "diff", "--", "src/app.txt"])).stdout, /\+after/);
  await rm(path.join(root, "untracked.bin"));
  await writeFile(path.join(root, "created-after.txt"), "remove during restore");
  await writeFile(path.join(root, ".env"), "new secret stays");
  await assert.rejects(store.restore(checkpoint.commit), /arbitrary Git revisions/);
  await store.restore(checkpoint.id);
  assert.equal(await readFile(path.join(root, "src", "app.txt"), "utf8"), "before");
  assert.deepEqual(await readFile(path.join(root, "untracked.bin")), Buffer.from([0, 255, 4, 128]));
  await assert.rejects(readFile(path.join(root, "created-after.txt")), { code: "ENOENT" });
  assert.equal(await readFile(path.join(root, ".env"), "utf8"), "new secret stays");
  assert.equal(await readFile(path.join(root, ".learn-pi", "tasks.json"), "utf8"), "task metadata stays");
  assert.equal(await readFile(parentFile, "utf8"), "parent stays unchanged");
  assert.deepEqual(await readFile(path.join(parent, ".git", "index")), parentIndexBefore);
  assert.deepEqual(await readFile(path.join(root, ".git", "index")), sampleIndexBefore);
  assert.equal((await new CheckpointStore(root).list()).at(-1)?.id, checkpoint.id);
  assert.equal((await exec("git", ["-C", root, "branch", "--show-current"])).stdout.trim(), "lesson");
});

test("checkpoint restore preflights symbolic links and refuses an unmarked/parent repository", async (t) => {
  const parent = await fixture(t);
  await exec("git", ["init", "--quiet", parent]);
  await assert.rejects(CheckpointStore.initialize(parent), /fresh disposable/);
  await assert.rejects(new CheckpointStore(parent).create("unsafe"));
  const root = path.join(parent, "lesson");
  await mkdir(root);
  await writeFile(path.join(root, "sample.txt"), "before");
  const store = await CheckpointStore.initialize(root);
  const checkpoint = await store.create("Snapshot");
  await writeFile(path.join(root, "sample.txt"), "after");
  await writeFile(path.join(parent, "outside.txt"), "never touch");
  await symlink(path.join(parent, "outside.txt"), path.join(root, "outside-link"));
  await assert.rejects(store.restore(checkpoint.id), /symbolic links/);
  await assert.rejects(store.create("No links"), /symbolic links/);
  assert.equal(await readFile(path.join(root, "sample.txt"), "utf8"), "after");
  assert.equal(await readFile(path.join(parent, "outside.txt"), "utf8"), "never touch");
});

test("restore preflight preserves secrets when a file became a directory, then handles safe shape changes", async (t) => {
  const parent = await fixture(t);
  const root = path.join(parent, "lesson");
  await mkdir(root);
  await writeFile(path.join(root, "target"), "original file");
  await writeFile(path.join(root, "other.txt"), "original other");
  const store = await CheckpointStore.initialize(root);
  const checkpoint = (await store.list())[0]!;
  await rm(path.join(root, "target"));
  await mkdir(path.join(root, "target"));
  await writeFile(path.join(root, "target", ".env"), "preserve this secret");
  await writeFile(path.join(root, "other.txt"), "changed other");
  await assert.rejects(store.restore(checkpoint.id), /protected metadata or secrets/);
  assert.equal(await readFile(path.join(root, "target", ".env"), "utf8"), "preserve this secret");
  assert.equal(await readFile(path.join(root, "other.txt"), "utf8"), "changed other");
  await rm(path.join(root, "target", ".env"));
  await writeFile(path.join(root, "target", "temporary.txt"), "remove");
  await store.restore(checkpoint.id);
  assert.equal(await readFile(path.join(root, "target"), "utf8"), "original file");
  assert.equal(await readFile(path.join(root, "other.txt"), "utf8"), "original other");
});
