import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, cp, readFile, writeFile, rm, symlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createCourseSession, assistantText } from '../src/runtime.ts';
import { scriptedModel, fauxAssistantMessage as message, fauxToolCall as call } from '../src/testing/scripted-model.ts';
import { CheckpointStore } from '../src/core/checkpoints.ts';
import { stageTools } from '../src/stages.ts';
import { verifyProject } from '../src/verification.ts';
const temp = resolve('.cache/test-runtime');
async function workspace() {
  await mkdir(temp, { recursive: true });
  const cwd = await mkdtemp(join(temp, 'pi-'));
  await cp(resolve('examples/fixtures/todo'), cwd, { recursive: true });
  await CheckpointStore.initialize(cwd);
  return cwd;
}

test('every stage is a strict cumulative composition and rejects invalid stage', () => {
  assert.deepEqual(stageTools(1), ['read', 'ls']);
  for (let n = 2; n <= 9; n++) for (const tool of stageTools(n - 1)) assert.ok(stageTools(n).includes(tool));
  assert.ok(stageTools(9).includes('catalog_search'));
  for (const n of [0, 10, NaN, 1.5]) assert.throws(() => stageTools(n));
});

test('real Pi session: plan mode blocks write, then a denied approval still blocks', async () => {
  const cwd = await workspace();
  const model = await scriptedModel([message(call('write', { path: 'todo.ts', content: 'BAD' })), message('Plan refused')]);
  let approvals = 0;
  const app = await createCourseSession({ cwd, stage: 4, ...model, approve: () => { approvals++; return false; } });
  try {
    const original = await readFile(join(cwd, 'todo.ts'), 'utf8');
    await app.prompt('Try a write in plan mode');
    assert.equal(await readFile(join(cwd, 'todo.ts'), 'utf8'), original);
    assert.equal(approvals, 0);
    assert.ok(app.session.messages.some(m => m.role === 'toolResult' && m.isError));
    app.controller.setMode('execute');
    model.fake.setResponses([message(call('write', { path: 'todo.ts', content: 'BAD' })), message('Denied')]);
    await app.prompt('Try a write without human consent');
    assert.equal(approvals, 1);
    assert.equal(await readFile(join(cwd, 'todo.ts'), 'utf8'), original);
    const audit = await readFile(join(cwd, '.learn-pi/audit.jsonl'), 'utf8');
    assert.match(audit, /plan_is_read_only/);
    assert.match(audit, /approval_denied/);
    assert.doesNotMatch(audit, /BAD/);
  } finally { app.close(); await rm(cwd, { recursive: true, force: true }); }
});

test('real Pi tool dispatch: traversal rejected, tasks persist and MCP performs a request', async () => {
  const cwd = await workspace();
  const model = await scriptedModel([
    message(call('read', { path: '../outside-secret' })),
    message(call('task_add', { text: 'Verify trim handling' })),
    message(call('catalog_search', { query: 'plan' })), message('Explored'),
  ]);
  const app = await createCourseSession({ cwd, stage: 5, ...model });
  try {
    await app.prompt('Explore then add a task and search catalog');
    const results = app.session.messages.filter(m => m.role === 'toolResult');
    assert.equal(results.length, 3);
    assert.ok(results[0]?.isError);
    assert.equal(results[2]?.isError, false);
    assert.equal((await app.controller.tasks.list())[0]?.text, 'Verify trim handling');
    assert.equal(assistantText(app.session), 'Explored');
  } finally { app.close(); }
  const model2 = await scriptedModel([message('Resumed')]);
  const resumed = await createCourseSession({ cwd, stage: 3, ...model2 });
  try { assert.equal((await resumed.controller.tasks.list()).length, 1); }
  finally { resumed.close(); await rm(cwd, { recursive: true, force: true }); }
});

test('real Pi coding loop edits, runs actual tests, inspects diff and restores checkpoint', async () => {
  const cwd = await workspace();
  const before = await readFile(join(cwd, 'todo.ts'), 'utf8');
  const fixed = before.replace('  const nextId', "  text = text.trim();\n  if (!text) throw new Error('blank todo');\n  const nextId");
  const model = await scriptedModel([
    message(call('read', { path: 'todo.ts' })),
    message(call('checkpoint_create', { label: 'before trim fix' })),
    message(call('edit', { path: 'todo.ts', oldText: '  const nextId', newText: "  text = text.trim();\n  if (!text) throw new Error('blank todo');\n  const nextId" })),
    message(call('verify_project', {})), message('Fixed and verified'),
  ]);
  const app = await createCourseSession({ cwd, stage: 9, mode: 'execute', ...model, approve: () => true });
  try {
    const initially = await verifyProject(cwd);
    assert.equal(initially.passed, false);
    await app.prompt('Fix the todo validation exercise');
    assert.equal(await readFile(join(cwd, 'todo.ts'), 'utf8'), fixed);
    const verification = app.session.messages.find(m => m.role === 'toolResult' && m.toolName === 'verify_project');
    assert.ok(verification?.role === 'toolResult');
    const details = JSON.parse(verification.content.filter(c => c.type === 'text').map(c => c.text).join(''));
    assert.equal(details.passed, true);
    assert.match(details.diff, /text\.trim/);
    const checkpoints = await app.controller.checkpoints.list();
    const id = checkpoints.find(c => c.label === 'before trim fix')?.id;
    assert.ok(id);
    await app.controller.checkpoints.restore(id);
    assert.equal(await readFile(join(cwd, 'todo.ts'), 'utf8'), before);
  } finally { app.close(); await rm(cwd, { recursive: true, force: true }); }
});

test('real model-call budget stops runaway turns before another provider request', async () => {
  const cwd = await workspace();
  const model = await scriptedModel(Array.from({ length: 4 }, () => message(call('read', { path: 'todo.ts' }))));
  const app = await createCourseSession({ cwd, stage: 1, ...model, maxModelCalls: 2 });
  try {
    await assert.rejects(app.prompt('keep reading'), /budget/);
    assert.equal(model.fake.state.callCount, 2);
  } finally { app.close(); await rm(cwd, { recursive: true, force: true }); }
});

test('metadata symlinks fail before log or task writes', async () => {
  const cwd = await workspace();
  const outside = join(temp, `audit-target-${Date.now()}`);
  await writeFile(outside, 'untouched');
  await symlink(outside, join(cwd, '.learn-pi/audit.jsonl'));
  try {
    await assert.rejects(createCourseSession({ cwd }), /symbolic link/);
    assert.equal(await readFile(outside, 'utf8'), 'untouched');
  } finally { await rm(cwd, { recursive: true, force: true }); await rm(outside); }
});
