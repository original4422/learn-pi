import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile, symlink } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { InMemoryCredentialStore, InMemoryModelsStore } from "@earendil-works/pi-ai";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
import { CatalogMcpClient, createCatalogTool } from "../src/integrations/mcp.js";
import {
  createReadOnlyChildSession, createSubagentTool, runSubagents,
  type ChildTask,
} from "../src/integrations/subagents.js";
import { scriptedModel, fauxAssistantMessage, fauxToolCall } from "../src/testing/scripted-model.js";

const cwd = fileURLToPath(new URL("../", import.meta.url));
const tasks: ChildTask[] = Array.from({ length: 6 }, (_, index) => ({
  role: index % 2 ? "reviewer" : "researcher", task: `task ${index}`,
}));

test("real MCP stdio: initialize, list, call, and subprocess shutdown", async () => {
  const client = new CatalogMcpClient();
  let pid: number | null = null;
  try {
    const listed = await client.listTools();
    assert.equal(listed.tools.length, 1);
    assert.equal(listed.tools[0]?.name, "catalog_search");
    assert.deepEqual(listed.tools[0]?.inputSchema.required, ["query"]);
    assert.equal(listed.tools[0]?.annotations?.readOnlyHint, true);
    pid = client.processId;
    assert.ok(pid && pid > 0);
    const result = await client.search("MCP");
    assert.equal(result.isError, false);
    assert.match(JSON.stringify(result.content), /Model Context Protocol/u);
  } finally { await client.close(); }
  await client.close();
  assert.equal(client.processId, null);
  assert.throws(() => process.kill(pid!, 0), { code: "ESRCH" });
  await assert.rejects(client.search("Pi"), /closed/u);
});

test("real MCP server validates calls even when a client bypasses its local schema", async () => {
  const client = new Client({ name: "learn-pi-test", version: "1" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", import.meta.resolve("tsx"), join(cwd, "examples/mcp-server.ts")],
    cwd, stderr: "pipe",
  });
  transport.stderr?.on("data", () => {});
  try {
    await client.connect(transport, { timeout: 5_000 });
    for (const args of [{ query: "" }, { query: 9 }, { query: "Pi", path: "/etc/passwd" }]) {
      const result = await client.callTool({ name: "catalog_search", arguments: args });
      assert.equal(result.isError, true);
    }
    const unknown = await client.callTool({ name: "execute_shell", arguments: {} });
    assert.equal(unknown.isError, true);
  } finally {
    await client.close();
    await transport.close();
  }
});

test("MCP rejects invalid input, pre-cancellation, and an expired startup deadline", async () => {
  const client = new CatalogMcpClient();
  await assert.rejects(client.search(" "), /query/u);
  const controller = new AbortController();
  controller.abort(new Error("test cancelled"));
  await assert.rejects(client.search("Pi", controller.signal), /test cancelled/u);
  assert.equal(client.processId, null);
  await client.close();
  const impatient = new CatalogMcpClient({ timeoutMs: 1 });
  try { await assert.rejects(impatient.listTools()); }
  finally { await impatient.close(); }
  assert.equal(impatient.processId, null);
});

test("Pi MCP bridge is a real tool definition with a bounded schema", () => {
  const tool = createCatalogTool();
  assert.equal(tool.name, "catalog_search");
  assert.equal(tool.parameters.properties.query.maxLength, 200);
  assert.equal(createSubagentTool({ cwd }).name, "delegate_readonly");
});

test("children collect all outcomes in input order and never exceed two runners", async () => {
  let active = 0;
  let peak = 0;
  const result = await runSubagents(tasks, {
    cwd,
    runner: async (task) => {
      active++;
      peak = Math.max(peak, active);
      try {
        await new Promise((resolve) => setTimeout(resolve, 5));
        if (task.task === "task 1") throw new Error("review failed");
        return { text: task.task, turns: 1, toolCalls: 1 };
      } finally { active--; }
    },
  });
  assert.equal(peak, 2);
  assert.equal(active, 0);
  assert.deepEqual(result.map((entry) => entry.task), tasks.map((entry) => entry.task));
  assert.equal(result[1]?.status, "rejected");
  assert.match(result[1]?.error ?? "", /review failed/u);
  assert.equal(result.filter((entry) => entry.status === "fulfilled").length, 5);
});

test("child output truncation is explicit and runtime validation rejects excess tasks", async () => {
  const result = await runSubagents([tasks[0]!], {
    cwd, maxOutputChars: 16, runner: async () => ({ text: "x".repeat(100) }),
  });
  assert.equal(result[0]?.text?.length, 16);
  assert.equal(result[0]?.truncated, true);
  const shouldNotRun = async () => { assert.fail("invalid input launched a child"); };
  await assert.rejects(runSubagents([...tasks, tasks[0]!], { cwd, runner: shouldNotRun }), /1 and 6/u);
  await assert.rejects(runSubagents(tasks, { cwd, concurrency: 3 }), /concurrency/u);
  await assert.rejects(runSubagents([{ role: "researcher", task: " " }], { cwd }), /blank/u);
  await assert.rejects(runSubagents([{ role: "writer", task: "modify" }] as unknown as ChildTask[], { cwd }), /role/u);
});

test("timeouts retire their worker slots, including runners that ignore abort", async () => {
  let launched = 0;
  const result = await runSubagents(tasks, {
    cwd, timeoutMs: 10,
    runner: async () => { launched++; return new Promise(() => {}); },
  });
  assert.equal(launched, 2);
  assert.equal(result.filter((entry) => entry.status === "rejected").length, 2);
  assert.equal(result.filter((entry) => entry.status === "cancelled").length, 4);
  assert.match(result[0]?.error ?? "", /deadline exceeded/u);
});

test("parent cancellation reaches running children and cancels queued tasks", async () => {
  const controller = new AbortController();
  let started = 0;
  let sawAbort = 0;
  const running = runSubagents(tasks, {
    cwd, signal: controller.signal,
    runner: async (_task, context) => {
      started++;
      return new Promise((_resolve, reject) => {
        context.signal.addEventListener("abort", () => {
          sawAbort++;
          reject(context.signal.reason);
        }, { once: true });
      });
    },
  });
  await new Promise((resolve) => setTimeout(resolve, 5));
  controller.abort(new Error("Parent cancelled"));
  const result = await running;
  assert.equal(started, 2);
  assert.equal(sawAbort, 2);
  assert.ok(result.every((entry) => entry.status === "cancelled"));
});

test("real Pi child setup: clean resources, own path hooks, no write/bash or recursive tools", async () => {
  await mkdir(join(cwd, ".cache"), { recursive: true });
  const fixture = await mkdtemp(join(cwd, ".cache", "child-test-"));
  let session: Awaited<ReturnType<typeof createReadOnlyChildSession>>["session"] | undefined;
  try {
    await mkdir(join(fixture, ".pi/extensions"), { recursive: true });
    await writeFile(join(fixture, ".pi/extensions/untrusted.ts"), 'throw new Error("untrusted extension executed");');
    await writeFile(join(fixture, "AGENTS.md"), "UNTRUSTED_CONTEXT_MARKER");
    await writeFile(join(fixture, ".pi/SYSTEM.md"), "UNTRUSTED_SYSTEM_MARKER");
    await writeFile(join(fixture, ".pi/APPEND_SYSTEM.md"), "UNTRUSTED_APPEND_MARKER");
    await writeFile(join(fixture, "sample.ts"), "export const answer = 42;");
    await writeFile(join(fixture, ".env"), "FAKE_TEST_SECRET=do-not-read");
    await symlink(resolve(fixture, ".."), join(fixture, "escape"));
    const modelRuntime = await ModelRuntime.create({
      credentials: new InMemoryCredentialStore(), modelsStore: new InMemoryModelsStore(),
      modelsPath: null, allowModelNetwork: false,
    });
    const child = await createReadOnlyChildSession(tasks[0]!, {
      cwd: fixture, modelRuntime, signal: new AbortController().signal, maxToolCalls: 6, maxTurns: 2,
    });
    session = child.session;
    assert.deepEqual(session.getActiveToolNames().sort(), ["ls", "read"]);
    assert.deepEqual(child.resourceLoader.getAgentsFiles().agentsFiles, []);
    assert.deepEqual(child.resourceLoader.getSkills().skills, []);
    assert.deepEqual(child.resourceLoader.getPrompts().prompts, []);
    assert.equal(child.resourceLoader.getExtensions().extensions.length, 1);
    assert.doesNotMatch(session.agent.state.systemPrompt, /UNTRUSTED/u);
    assert.equal(session.sessionFile, undefined);
    const hook = session.agent.beforeToolCall;
    assert.ok(hook);
    const check = (name: string, path: string) => hook({
      toolCall: { type: "toolCall", id: "test", name, arguments: { path } }, args: { path },
      assistantMessage: {
        role: "assistant", content: [], api: "anthropic-messages", provider: "anthropic", model: "test-fixture",
        stopReason: "toolUse", timestamp: 0,
        usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      },
      context: { systemPrompt: session!.agent.state.systemPrompt, messages: [], tools: session!.agent.state.tools },
    });
    assert.equal(await check("read", "sample.ts"), undefined);
    assert.equal((await check("read", "../outside"))?.block, true);
    assert.equal((await check("read", ".env"))?.block, true);
    assert.equal((await check("ls", "escape"))?.block, true);
    assert.equal((await check("write", "sample.ts"))?.block, true);
    assert.equal((await check("grep", "."))?.block, true);
    assert.equal((await check("read", "sample.ts"))?.block, true);
    assert.equal(child.usage.toolCalls, 6);
  } finally {
    session?.dispose();
    await rm(fixture, { recursive: true, force: true });
  }
});

test("real Pi child runner performs a read with a scripted provider (not a live model)", async () => {
  const model = await scriptedModel([
    fauxAssistantMessage(fauxToolCall("read", { path: "PROJECT_BRIEF.md", limit: 3 })),
    fauxAssistantMessage("The project teaches extending real Pi with TypeScript."),
  ]);
  const results = await runSubagents([{ role: "researcher", task: "Read the project brief" }], {
    cwd, ...model,
  });
  assert.equal(results[0]?.status, "fulfilled");
  assert.equal(results[0]?.toolCalls, 1);
  assert.equal(results[0]?.turns, 2);
  assert.match(results[0]?.text ?? "", /real Pi/u);
  assert.equal(model.fake.state.callCount, 2);
});

test("real Pi child model-call and tool-call budgets stop scripted runaway loops", async () => {
  for (const limit of ["model", "tool"] as const) {
    const model = await scriptedModel(Array.from({ length: 4 }, () =>
      fauxAssistantMessage(fauxToolCall("read", { path: "PROJECT_BRIEF.md", limit: 1 })),
    ));
    const results = await runSubagents([{ role: "reviewer", task: "Keep reading" }], {
      cwd, ...model, maxTurns: limit === "model" ? 2 : 6, maxToolCalls: limit === "tool" ? 1 : 12,
    });
    assert.equal(results[0]?.status, "rejected");
    assert.match(results[0]?.error ?? "", new RegExp(`Child ${limit}-call budget exhausted`, "u"));
    assert.equal(model.fake.state.callCount, 2);
  }
});

test("real Pi child tool dispatch blocks traversal before reading outside content", async () => {
  let inspectedDenial = false;
  const model = await scriptedModel([
    fauxAssistantMessage(fauxToolCall("read", { path: "../AGENTS.md" })),
    (context) => {
      const result = context.messages.findLast((entry) => entry.role === "toolResult");
      assert.ok(result?.role === "toolResult");
      assert.equal(result.isError, true);
      assert.match(JSON.stringify(result.content), /outside_workspace/u);
      assert.doesNotMatch(JSON.stringify(result.content), /项目协作约定/u);
      inspectedDenial = true;
      return fauxAssistantMessage("The requested path was outside my workspace and was blocked.");
    },
  ]);
  const result = await runSubagents([{ role: "reviewer", task: "Try the parent AGENTS.md" }], { cwd, ...model });
  assert.equal(result[0]?.status, "fulfilled");
  assert.ok(inspectedDenial);
  assert.equal(result[0]?.toolCalls, 1);
});

test("delegate tool rejects overlapping batches until timed-out runners settle", async () => {
  let finish: ((value: { text: string }) => void) | undefined;
  const tool = createSubagentTool({
    cwd, timeoutMs: 10, runner: () => new Promise((resolve) => { finish = resolve; }),
  });
  // This direct unit test supplies only the ExtensionContext field the tool
  // consumes. Real SDK construction and tool dispatch are tested above.
  const context = { model: undefined } as Parameters<typeof tool.execute>[4];
  const invoke = () => tool.execute("test", { tasks: [tasks[0]!] }, undefined, undefined, context);
  const first = invoke();
  await assert.rejects(invoke(), /still running/u);
  await first;
  await assert.rejects(invoke(), /still running/u);
  assert.ok(finish);
  finish({ text: "late result discarded" });
  await new Promise((resolve) => setImmediate(resolve));
});
