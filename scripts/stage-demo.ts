import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import { CheckpointStore } from '../src/core/checkpoints.ts';
import { createCourseSession } from '../src/runtime.ts';
import { STAGES, stageTools } from '../src/stages.ts';
import { scriptedModel, fauxAssistantMessage as message, fauxToolCall as call } from '../src/testing/scripted-model.ts';
import { verifyProject } from '../src/verification.ts';

const project = fileURLToPath(new URL('..', import.meta.url));
const fix = "  text = text.trim();\n  if (!text) throw new Error('blank todo');\n  const nextId";

export interface StageReport {
  kind: 'real-pi-scripted-model-stage';
  piVersion: '0.85.1';
  stage: number;
  title: string;
  workspace: string;
  reportPath: string;
  realRuntime: true;
  remoteModel: false;
  model: 'official Pi faux provider';
  modelRequests: number;
  toolNames: string[];
  checks: string[];
  evidence: Record<string, unknown>;
  finalWorkspace: 'unchanged fixture' | 'fixed fixture' | 'restored original fixture';
}

/**
 * Each call makes a new inspectable lesson directory. Only the provider's
 * responses are scripted: Pi dispatch, guards, tools, MCP, child sessions,
 * persisted state, Git, and fixture test processes all execute for real.
 */
export async function runStage(stage: number): Promise<StageReport> {
  stageTools(stage); // Reject invalid stages before creating anything.
  const cache = join(project, '.cache', 'stages');
  await mkdir(cache, { recursive: true });
  const cwd = await mkdtemp(join(cache, `stage-${stage}-`));
  await cp(join(project, 'examples', 'fixtures', 'todo'), cwd, { recursive: true });
  await CheckpointStore.initialize(cwd);
  const original = await readFile(join(cwd, 'todo.ts'), 'utf8');
  const model = await scriptedModel([]);
  const approveMutations = stage !== 4;
  let approvalRequests = 0;
  let app = await createCourseSession({
    cwd, stage, ...model,
    approve: request => {
      approvalRequests++;
      return approveMutations && ['edit', 'write', 'verify_project', 'checkpoint_create', 'checkpoint_restore'].includes(request.name);
    },
  });
  const report: StageReport = {
    kind: 'real-pi-scripted-model-stage', piVersion: '0.85.1', stage,
    title: STAGES[stage - 1]!.name, workspace: cwd,
    reportPath: join(cwd, '.learn-pi', 'stage-report.json'),
    realRuntime: true, remoteModel: false, model: 'official Pi faux provider',
    modelRequests: 0, toolNames: [], checks: [], evidence: {}, finalWorkspace: 'unchanged fixture',
  };
  const collectTools = () => app.session.subscribe(event => {
    if (event.type === 'tool_execution_start') report.toolNames.push(event.toolName);
  });
  collectTools();
  const results = () => app.session.messages.filter(item => item.role === 'toolResult');
  const resultText = (toolName: string) => {
    const result = results().findLast(item => item.toolName === toolName);
    assert.ok(result, `Missing real Pi tool result: ${toolName}`);
    assert.equal(result.isError, false, `Tool failed: ${toolName}`);
    return result.content.filter(item => item.type === 'text').map(item => item.text).join('\n');
  };
  const edit = () => message(call('edit', { path: 'todo.ts', oldText: '  const nextId', newText: fix }));
  const run = async (steps: Parameters<typeof model.fake.setResponses>[0], prompt: string) => {
    model.fake.setResponses(steps);
    await app.prompt(prompt);
    assert.equal(model.fake.getPendingResponseCount(), 0, 'All intended scripted steps must be consumed');
  };

  try {
    if (stage === 1) {
      await run([message(call('read', { path: 'todo.ts' })), message('The real read result contains addTodo.')], 'Inspect the fixture without editing it.');
      assert.match(resultText('read'), /export function addTodo/);
      assert.deepEqual(app.session.getActiveToolNames(), ['read', 'ls']);
      report.checks.push('Pi dispatched its real read tool and returned fixture source.', 'Only read and ls are active.');
    } else if (stage === 2) {
      await run([edit(), message('The plan-mode edit was blocked.')], 'Try the edit while still in plan mode.');
      assert.equal(results().at(-1)?.isError, true);
      assert.equal(await readFile(join(cwd, 'todo.ts'), 'utf8'), original);
      assert.equal(approvalRequests, 0, 'Policy rejection must precede approval');
      // This is the human/controller channel, never a model tool.
      app.controller.setMode('execute');
      await run([edit(), message('The explicitly approved edit is now present.')], 'Apply the same edit in execute mode.');
      assert.equal(approvalRequests, 1);
      assert.equal(await readFile(join(cwd, 'todo.ts'), 'utf8'), original.replace('  const nextId', fix));
      report.finalWorkspace = 'fixed fixture';
      report.checks.push('Plan mode blocked a real edit before approval.', 'A human/controller mode switch plus approval allowed the real edit.');
      report.evidence.approvalRequests = approvalRequests;
    } else if (stage === 3) {
      await run([
        message(call('task_add', { text: 'Inspect and fix whitespace validation' })),
        message(call('task_list', {})), message('A durable task now exists.'),
      ], 'Record a plan in the task store.');
      const before = await app.controller.tasks.list();
      assert.equal(before.length, 1);
      const taskId = before[0]!.id;
      app.close();
      app = await createCourseSession({ cwd, stage, ...model });
      collectTools();
      await run([
        message(call('task_update', { id: taskId, status: 'in_progress' })),
        message(call('task_list', {})), message('The new Pi session recovered and started the same task.'),
      ], 'Recover the saved task after restarting the session.');
      const recovered = await app.controller.tasks.list();
      assert.equal(recovered[0]?.id, taskId);
      assert.equal(recovered[0]?.status, 'in_progress');
      report.checks.push('Real task tools wrote versioned state.', 'A newly created Pi session recovered the same task ID and updated its status.');
      report.evidence.tasks = recovered;
    } else if (stage === 4) {
      const secret = 'stage-secret-must-never-be-returned';
      await writeFile(join(cwd, '.env'), secret);
      app.controller.setMode('execute');
      await run([
        message(call('read', { path: '@.env' })),
        message(call('write', { path: 'todo.ts', content: 'UNAPPROVED WRITE' })),
        message('The alias and rejected mutation were both blocked.'),
      ], 'Exercise path denial and an explicit approval rejection.');
      assert.ok(results().every(result => result.isError));
      assert.ok(!JSON.stringify(results()).includes(secret));
      assert.equal(await readFile(join(cwd, 'todo.ts'), 'utf8'), original);
      assert.equal(approvalRequests, 1);
      const audit = await readFile(join(cwd, '.learn-pi', 'audit.jsonl'), 'utf8');
      assert.match(audit, /ambiguous_path_alias/);
      assert.match(audit, /approval_denied/);
      assert.doesNotMatch(audit, /stage-secret|UNAPPROVED WRITE/);
      report.checks.push('Pi path-alias request was denied without exposing the secret.', 'Rejected approval prevented a real write.', 'JSONL audit recorded reasons without raw content.');
      report.evidence.audit = audit.trim().split('\n').map(line => JSON.parse(line));
    } else if (stage === 5) {
      await run([message(call('catalog_search', { query: 'approval' })), message('The MCP response is data, not a new instruction.')], 'Search the local course catalog through MCP.');
      const catalog = JSON.parse(resultText('catalog_search')) as { matches: unknown[] };
      assert.ok(catalog.matches.length > 0);
      const details = results().find(item => item.toolName === 'catalog_search')?.details as { transport?: string } | undefined;
      assert.equal(details?.transport, 'stdio');
      report.checks.push('Pi called the registered MCP bridge.', 'A real local MCP subprocess answered a JSON-RPC request over stdio.');
      report.evidence.catalog = catalog;
      report.evidence.transport = 'real stdio';
    } else if (stage === 6) {
      await run([
        message(call('delegate_readonly', { tasks: [{ role: 'researcher', task: 'Read todo.ts and identify the validation gap.' }] })),
        // One child consumes the shared scripted provider queue between the
        // parent's tool request and its final response. This is a real session.
        message(call('read', { path: 'todo.ts' })),
        message('todo.ts: addTodo currently stores untrimmed text and accepts blank input.'),
        message('The parent received one bounded read-only child result.'),
      ], 'Delegate one read-only investigation and summarize its result.');
      const children = JSON.parse(resultText('delegate_readonly')) as Array<{ status: string; text: string; toolCalls: number; turns: number }>;
      assert.equal(children.length, 1);
      assert.equal(children[0]?.status, 'fulfilled');
      assert.equal(children[0]?.toolCalls, 1);
      assert.equal(children[0]?.turns, 2);
      assert.match(children[0]!.text, /todo\.ts/);
      assert.equal(model.fake.state.callCount, 4, 'Parent and child both used the actual provider queue');
      report.checks.push('Parent Pi dispatched delegate_readonly.', 'A distinct real child Pi session read the file and returned a structured result.', 'The sample files remained unchanged.');
      report.evidence.children = children;
      report.evidence.isolation = 'Separate transcript and tool allowlist; shared host process, not an OS sandbox.';
    } else if (stage === 7 || stage === 9) {
      const before = await verifyProject(cwd);
      assert.equal(before.passed, false, 'The delivered exercise must initially fail');
      if (stage === 9) {
        await run([
          message(call('read', { path: 'todo.ts' })),
          message(call('task_add', { text: 'Trim todo text, reject blank input, verify, and inspect diff' })),
          message(call('catalog_search', { query: 'checkpoint' })),
          message('The plan and catalog evidence are ready for execution.'),
        ], 'Explore, record the plan, and consult the local catalog.');
        assert.ok(JSON.parse(resultText('catalog_search')).matches.length > 0);
      }
      app.controller.setMode('execute');
      await run([
        message(call('checkpoint_create', { label: 'Before the validation fix' })),
        edit(), message(call('verify_project', {})),
        message('The real fixture tests and Git diff are available for review.'),
      ], 'Checkpoint, apply the small fix, run the actual tests, and inspect diff.');
      const verified = JSON.parse(resultText('verify_project')) as { passed: boolean; output: string; diff: string; status: string };
      assert.equal(verified.passed, true);
      assert.match(verified.diff, /text\.trim/);
      const checkpoint = (await app.controller.checkpoints.list()).find(item => item.label === 'Before the validation fix');
      assert.ok(checkpoint);
      report.finalWorkspace = 'fixed fixture';
      report.checks.push('The original fixture failed its actual Node tests.', 'Pi created a Git checkpoint, edited source, and ran the real tests.', 'The fixed fixture passed and Git diff contains the intended change.');
      report.evidence.initialTestsPassed = false;
      report.evidence.fixedTestsPassed = true;
      report.evidence.verification = verified;
      report.evidence.checkpointId = checkpoint.id;
      if (stage === 9) {
        const task = (await app.controller.tasks.list())[0]!;
        await run([
          message(call('task_update', { id: task.id, status: 'done' })),
          message(call('checkpoint_restore', { id: checkpoint.id })),
          message('The file checkpoint was restored; the completed task record remains.'),
        ], 'Record completion, then demonstrate file-only checkpoint recovery.');
        assert.equal(await readFile(join(cwd, 'todo.ts'), 'utf8'), original);
        assert.equal((await app.controller.tasks.list())[0]?.status, 'done');
        report.finalWorkspace = 'restored original fixture';
        report.checks.push('Pi restored sample files while durable task completion remained unchanged.');
        report.evidence.restoreVerified = true;
        report.evidence.tasks = await app.controller.tasks.list();
      }
    } else if (stage === 8) {
      await run([
        message(call('read', { path: 'todo.ts' })),
        message(call('task_add', { text: 'Preserve goal, relevant paths, and verification evidence across context changes' })),
        message('The transcript contains a file observation and durable task state.'),
      ], 'Inspect a small amount of context and retain an explicit task.');
      const stats = app.session.getSessionStats();
      const contextUsage = app.session.getContextUsage() ?? null;
      assert.equal(stats.userMessages, 1);
      assert.equal(stats.toolCalls, 2);
      assert.equal(stats.toolResults, 2);
      assert.ok(stats.totalMessages >= 6);
      report.checks.push('Pi reports actual session message and tool counts.', 'Context usage is read from the real Pi API; faux-provider token metadata is not live billing.', 'Online compaction was not run or simulated.');
      // Normalize optional undefined properties for the persisted JSON report.
      report.evidence.sessionStats = JSON.parse(JSON.stringify(stats));
      report.evidence.contextUsage = contextUsage;
      report.evidence.compaction = { executed: false, reason: 'Use the authenticated CLI /compact command to verify model-generated summarization.' };
      report.evidence.isolation = 'The separate container experiment remains a distinct environment check, not something this demo claims to validate.';
    }
    if (report.finalWorkspace === 'unchanged fixture') assert.equal(await readFile(join(cwd, 'todo.ts'), 'utf8'), original);
    report.modelRequests = model.fake.state.callCount;
    assert.ok(report.modelRequests > 0);
    await writeFile(report.reportPath, `${JSON.stringify(report, null, 2)}\n`);
    return report;
  } finally { app.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const { values } = parseArgs({ options: { stage: { type: 'string', default: '1' }, help: { type: 'boolean', short: 'h' } } });
    if (values.help) {
      console.log('Usage: node --import tsx scripts/stage-demo.ts --stage 1..9\nEach run creates a fresh .cache/stages workspace. No provider key is required.');
    } else {
      console.log('SCRIPTED MODEL / REAL PI — official faux responses; real tools and integrations; no remote model reasoning validation.');
      const report = await runStage(Number(values.stage));
      console.log(`Stage ${report.stage}: ${report.title}\nWorkspace: ${report.workspace}`);
      for (const check of report.checks) console.log(`PASS · ${check}`);
      console.log(`Model requests: ${report.modelRequests}\nFinal workspace: ${report.finalWorkspace}\nReport: ${report.reportPath}`);
      if (report.stage === 8) console.log(JSON.stringify({ sessionStats: report.evidence.sessionStats, contextUsage: report.evidence.contextUsage, compaction: report.evidence.compaction }, null, 2));
    }
  } catch (error) {
    console.error(`Stage demo failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
