import { mkdir, mkdtemp, cp, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { CheckpointStore } from '../src/core/checkpoints.ts';
import { createCourseSession, assistantText } from '../src/runtime.ts';
import { scriptedModel, fauxAssistantMessage as message, fauxToolCall as call } from '../src/testing/scripted-model.ts';
import { verifyProject } from '../src/verification.ts';

await mkdir('.cache/demos', { recursive: true });
const cwd = await mkdtemp(resolve('.cache/demos/todo-'));
await cp(resolve('examples/fixtures/todo'), cwd, { recursive: true });
await CheckpointStore.initialize(cwd);
const original = await readFile(join(cwd, 'todo.ts'), 'utf8');
const model = await scriptedModel([
  message(call('read', { path: 'todo.ts' })),
  message(call('task_add', { text: 'Trim todo text and reject blank input' })),
  message(call('catalog_search', { query: 'approval' })),
  message(call('checkpoint_create', { label: 'before change' })),
  message(call('edit', { path: 'todo.ts', oldText: '  const nextId', newText: "  text = text.trim();\n  if (!text) throw new Error('blank todo');\n  const nextId" })),
  message(call('verify_project', {})), message('The scripted tool sequence is complete. Inspect the actual test result and diff below.'),
]);
const app = await createCourseSession({ cwd, stage: 9, mode: 'execute', ...model, approve: req => ['edit', 'checkpoint_create', 'verify_project'].includes(req.name) });
console.log('OFFLINE DEMO — real Pi 0.85.1 + scripted model responses; no remote model or reasoning validation.');
console.log(`Workspace: ${cwd}`);
const before = await verifyProject(cwd);
try {
  app.session.subscribe(event => { if (event.type === 'tool_execution_start') console.log(`Pi dispatch → ${event.toolName}`); });
  await app.prompt('Complete the todo exercise using the scripted tool sequence.');
  const after = await verifyProject(cwd);
  if (before.passed || !after.passed || !after.diff.includes('text.trim')) throw new Error('Demo did not achieve the expected failing→passing transition');
  const task = (await app.controller.tasks.list())[0];
  if (task) await app.controller.tasks.update(task.id, 'done');
  const checkpoint = (await app.controller.checkpoints.list()).find(c => c.label === 'before change');
  if (!checkpoint) throw new Error('Missing checkpoint');
  await app.controller.checkpoints.restore(checkpoint.id);
  const restored = await readFile(join(cwd, 'todo.ts'), 'utf8') === original;
  if (!restored) throw new Error('Restore verification failed');
  const report = { kind: 'real-pi-scripted-model', pi: '0.85.1', at: new Date().toISOString(), workspace: cwd,
    initialTestsPassed: before.passed, fixedTestsPassed: after.passed, restoreVerified: restored, modelRequests: model.fake.state.callCount,
    mcpTransport: 'real stdio', remoteModel: false, finalWorkspace: 'restored original intentionally failing fixture', diff: after.diff };
  await writeFile(join(cwd, 'demo-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(assistantText(app.session));
  console.log(after.output);
  console.log(after.diff);
  console.log(`PASS: failing → fixed → 4 passing tests → original restored.\nReport: ${join(cwd, 'demo-report.json')}`);
} finally { app.close(); }
