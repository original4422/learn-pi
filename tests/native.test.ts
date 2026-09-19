import test from "node:test";
import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, mkdtemp, rm, writeFile, stat, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { stageTools } from "../src/stages.js";

const exec = promisify(execFile);
const root = fileURLToPath(new URL("../", import.meta.url));
const entry = join(root, "src/extensions/course.ts");
const piPackage = join(root, "node_modules/@earendil-works/pi-coding-agent");
const piImport = pathToFileURL(join(piPackage, "dist/index.js")).href;
const cli = join(piPackage, "dist/bundle/cli.js");

async function nativeFixture() {
  const base = join(root, ".cache", "test-native");
  await mkdir(base, { recursive: true });
  const cwd = await mkdtemp(join(base, "pi-"));
  const agentDir = join(cwd, "agent");
  await mkdir(join(agentDir, "extensions"), { recursive: true });
  await mkdir(join(cwd, ".pi", "extensions"), { recursive: true });
  for (const path of [join(agentDir, "extensions", "untrusted.ts"), join(cwd, ".pi", "extensions", "untrusted.ts")]) {
    await writeFile(path, 'throw new Error("UNTRUSTED_EXTENSION_EXECUTED");');
  }
  // Keep provider credentials out of the child environment entirely.
  const env = {
    PATH: process.env.PATH ?? "",
    PI_CODING_AGENT_DIR: agentDir,
    PI_OFFLINE: "1", PI_TELEMETRY: "0", LESSON_STAGE: "9",
  };
  return { cwd, agentDir, env, cleanup: () => rm(cwd, { recursive: true, force: true }) };
}

test("native Pi loader compiles the real .ts entry and registers course tools/hooks/commands", async () => {
  const fixture = await nativeFixture();
  try {
    // This is a new Node process without tsx. Pi's own native extension loader
    // (jiti in 0.85.1) must compile the actual TypeScript file and its imports.
    const script = `
      import { DefaultResourceLoader, SettingsManager } from ${JSON.stringify(piImport)};
      const loader = new DefaultResourceLoader({
        cwd: process.cwd(), agentDir: process.env.PI_CODING_AGENT_DIR,
        settingsManager: SettingsManager.inMemory({ packages: [], defaultProjectTrust: "never" }),
        noExtensions: true, noSkills: true, noPromptTemplates: true,
        noThemes: true, noContextFiles: true,
        systemPrompt: "Native loader test", appendSystemPrompt: [],
        additionalExtensionPaths: [${JSON.stringify(entry)}],
      });
      await loader.reload();
      const result = loader.getExtensions();
      console.log(JSON.stringify({
        errors: result.errors,
        extensions: result.extensions.map(e => ({
          path: e.resolvedPath, tools: [...e.tools.keys()],
          commands: [...e.commands.keys()], hooks: [...e.handlers.keys()],
        })),
        contextFiles: loader.getAgentsFiles().agentsFiles,
        skills: loader.getSkills().skills,
      }));
    `;
    const result = await exec(process.execPath, ["--input-type=module", "--eval", script], {
      cwd: fixture.cwd, env: fixture.env, timeout: 20_000, maxBuffer: 1024 * 1024,
    });
    const loaded = JSON.parse(result.stdout);
    assert.deepEqual(loaded.errors, []);
    assert.equal(loaded.extensions.length, 1);
    assert.equal(loaded.extensions[0].path, entry);
    assert.deepEqual(loaded.extensions[0].tools.sort(), [
      "catalog_search", "checkpoint_create", "checkpoint_list", "checkpoint_restore", "delegate_readonly",
      "task_add", "task_list", "task_update", "verify_project",
    ]);
    assert.deepEqual(loaded.extensions[0].commands.sort(), ["mode", "tasks"]);
    for (const hook of ["session_start", "agent_start", "before_agent_start", "tool_call", "tool_result", "user_bash"]) {
      assert.ok(loaded.extensions[0].hooks.includes(hook));
    }
    assert.deepEqual(loaded.contextFiles, []);
    assert.deepEqual(loaded.skills, []);
    assert.ok((await stat(join(fixture.cwd, ".learn-pi"))).isDirectory());
    assert.doesNotMatch(result.stderr, /UNTRUSTED_EXTENSION_EXECUTED|Failed to load/u);
  } finally { await fixture.cleanup(); }
});

test("native bundled Pi CLI loads explicit extension in offline isolated help mode", async () => {
  const fixture = await nativeFixture();
  try {
    const result = await exec(process.execPath, [
      cli, "--offline", "--no-approve", "--no-session", "--no-extensions", "--no-skills",
      "--no-prompt-templates", "--no-themes", "--no-context-files",
      "--system-prompt", "Native CLI test", "--extension", entry, "--help",
    ], { cwd: fixture.cwd, env: fixture.env, timeout: 20_000, maxBuffer: 1024 * 1024 });
    assert.match(result.stdout, /pi - AI coding assistant/u);
    assert.match(result.stdout, /explicit -e paths still work/u);
    // Extension factory preparation proves help went through native loading.
    assert.ok((await stat(join(fixture.cwd, ".learn-pi"))).isDirectory());
    assert.doesNotMatch(result.stderr, /UNTRUSTED_EXTENSION_EXECUTED|Failed to load|Error:/u);
  } finally { await fixture.cleanup(); }
});

test("native Pi loader reports explicit path errors instead of pretending a stage loaded", async () => {
  const fixture = await nativeFixture();
  try {
    const missing = join(fixture.cwd, "missing-course.ts");
    const script = `
      import { DefaultResourceLoader, SettingsManager } from ${JSON.stringify(piImport)};
      const loader = new DefaultResourceLoader({
        cwd: process.cwd(), agentDir: process.env.PI_CODING_AGENT_DIR,
        settingsManager: SettingsManager.inMemory(),
        noExtensions: true, noSkills: true, noPromptTemplates: true,
        noThemes: true, noContextFiles: true,
        systemPrompt: "Native loader test", appendSystemPrompt: [],
        additionalExtensionPaths: [${JSON.stringify(missing)}],
      });
      await loader.reload();
      const {extensions, errors} = loader.getExtensions();
      console.log(JSON.stringify({count: extensions.length, errors}));
    `;
    const result = await exec(process.execPath, ["--input-type=module", "--eval", script], {
      cwd: fixture.cwd, env: fixture.env, timeout: 20_000,
    });
    const loaded = JSON.parse(result.stdout);
    assert.equal(loaded.count, 0);
    assert.ok(loaded.errors.some((error: { path: string; error: string }) =>
      error.path === missing && /does not exist|Cannot find|not found/u.test(error.error)));
  } finally { await fixture.cleanup(); }
});

test("native Pi RPC startup applies course tool selection and exposes commands without a model call", async () => {
  const fixture = await nativeFixture();
  try {
    const probe = join(fixture.cwd, "native-probe.ts");
    await writeFile(probe, `export default function(pi) {
      pi.on("session_start", () => {
        process.stderr.write("NATIVE_ACTIVE:" + JSON.stringify(pi.getActiveTools()) + "\\n");
      });
    }`);
    const child = spawn(process.execPath, [
      cli, "--offline", "--no-approve", "--no-session", "--no-extensions", "--no-skills",
      "--no-prompt-templates", "--no-themes", "--no-context-files",
      "--system-prompt", "Native CLI test", "--extension", entry, "--extension", probe,
      "--model", "anthropic/claude-opus-4-5", "--mode", "rpc",
    ], { cwd: fixture.cwd, env: fixture.env, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => { stderr += chunk; });
    const responses: { type: string; id?: string; success?: boolean; data?: { commands?: { name: string }[]; messageCount?: number } }[] = [];
    const exited = new Promise<number | null>((resolve, reject) => {
      child.once("error", reject);
      child.once("exit", resolve);
    });
    const deadline = setTimeout(() => child.kill("SIGKILL"), 15_000);
    try {
      child.stdout.on("data", (chunk: string) => {
        stdout += chunk;
        while (stdout.includes("\n")) {
          const end = stdout.indexOf("\n");
          const line = stdout.slice(0, end);
          stdout = stdout.slice(end + 1);
          if (!line.trim()) continue;
          responses.push(JSON.parse(line));
          if (responses.some((item) => item.id === "commands") && responses.some((item) => item.id === "state")) {
            child.stdin.end();
          }
        }
      });
      child.stdin.write(JSON.stringify({ id: "commands", type: "get_commands" }) + "\n");
      child.stdin.write(JSON.stringify({ id: "state", type: "get_state" }) + "\n");
      const code = await exited;
      assert.equal(code, 0, stderr);
      const commands = responses.find((item) => item.id === "commands");
      assert.equal(commands?.success, true, stderr);
      // The CLI always includes Pi's own hidden llama.cpp extension. The course
      // registers mode/tasks; --no-extensions disables discovery, not built-ins.
      assert.deepEqual(commands?.data?.commands?.map((command) => command.name).sort(), ["llama", "mode", "tasks"]);
      const state = responses.find((item) => item.id === "state");
      assert.equal(state?.success, true);
      assert.equal(state?.data?.messageCount, 0);
      const activeLine = stderr.split("\n").find((line) => line.startsWith("NATIVE_ACTIVE:"));
      assert.ok(activeLine, stderr);
      assert.deepEqual(JSON.parse(activeLine.slice("NATIVE_ACTIVE:".length)).sort(), stageTools(9).sort());
      assert.doesNotMatch(stderr, /UNTRUSTED_EXTENSION_EXECUTED|Failed to load/u);
    } finally {
      clearTimeout(deadline);
      if (child.exitCode === null) child.kill("SIGKILL");
    }
  } finally { await fixture.cleanup(); }
});

test("version lock matches installed package and downloaded registry/source evidence", async (t) => {
  // Cached fetch evidence is deliberately not required after a fresh clone.
  const files = [".cache/pi-npm.json", ".cache/pi-source-package.json"];
  try { await Promise.all(files.map((file) => stat(join(root, file)))); }
  catch { t.skip("downloaded registry/source cache is unavailable in this checkout"); return; }
  const [registry, source, locked, installed, packageLock] = await Promise.all([
    ...files, "reports/version-lock.json", "node_modules/@earendil-works/pi-coding-agent/package.json", "package-lock.json",
  ].map(async (file) => JSON.parse(await readFile(join(root, file), "utf8"))));
  assert.equal(locked.package, registry.name);
  assert.equal(locked.version, registry.version);
  assert.equal(locked.version, source.version);
  assert.equal(locked.version, installed.version);
  assert.equal(locked.sourceCommit, registry.gitHead);
  assert.equal(locked.integrity, registry.dist.integrity);
  assert.equal(locked.tarball, registry.dist.tarball);
  assert.equal(locked.integrity, packageLock.packages["node_modules/@earendil-works/pi-coding-agent"].integrity);
  assert.deepEqual(locked.engines, source.engines);
  for (const [file, checksum] of Object.entries(locked.sourceDocuments)) {
    const sourcePath = `.cache/${file}`;
    const actual = createHash("sha256").update(await readFile(join(root, sourcePath))).digest("hex");
    assert.equal(actual, checksum, `${file} differs from recorded source document hash`);
  }
});
