import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import { createCourseSession } from '../src/runtime.ts';
import { scriptedModel, fauxAssistantMessage as message, fauxToolCall as call } from '../src/testing/scripted-model.ts';
import { CheckpointStore } from '../src/core/checkpoints.ts';
import { verifyProject } from '../src/verification.ts';

const exec = promisify(execFile);
const project = fileURLToPath(new URL('..', import.meta.url));
const cache = path.join(project, '.cache', 'review-tests');
async function fixture(t: { after: (fn: () => Promise<void>) => void }) {
  await mkdir(cache, { recursive: true });
  const parent = await mkdtemp(path.join(cache, 'case-'));
  const cwd = path.join(parent, 'workspace');
  await mkdir(cwd);
  t.after(() => rm(parent, { recursive: true, force: true }));
  return { parent, cwd };
}

test('real Pi read dispatch cannot reinterpret path aliases to expose protected or outside files', async (t) => {
  const { parent, cwd } = await fixture(t);
  const secret = 'REVIEW_SECRET_MUST_NOT_APPEAR';
  await writeFile(path.join(cwd, '.env'), secret);
  const outside = path.join(parent, 'outside.txt');
  await writeFile(outside, secret);
  await symlink(parent, path.join(cwd, 'space link'));
  await symlink(outside, path.join(cwd, 'curly’quote.txt'));
  const inputs = [
    '@.env',
    `@${outside}`,
    pathToFileURL(outside).href,
    'space\u00a0link/outside.txt',
    "curly'quote.txt",
  ];
  const model = await scriptedModel([...inputs.map(p => message(call('read', { path: p }))), message('Finished alias attempts')]);
  const app = await createCourseSession({ cwd, stage: 1, ...model });
  try {
    await app.prompt('Attempt aliases; protected contents must not become tool results');
    const results = app.session.messages.filter(m => m.role === 'toolResult');
    assert.equal(results.length, inputs.length);
    for (let i = 0; i < results.length; i++) {
      assert.doesNotMatch(JSON.stringify(results[i]), new RegExp(secret), `Pi reinterpreted path ${inputs[i]}`);
      assert.equal(results[i]?.isError, true, `Unsafe read must fail: ${inputs[i]}`);
    }
  } finally { app.close(); }
});

test('headless real Pi mutations require an explicit approval callback', async (t) => {
  const { cwd } = await fixture(t);
  await writeFile(path.join(cwd, 'file.txt'), 'original');
  const model = await scriptedModel([message(call('write', { path: 'file.txt', content: 'unauthorized' })), message('Denied')]);
  const app = await createCourseSession({ cwd, stage: 4, mode: 'execute', ...model });
  try {
    await app.prompt('Try a write without an interactive UI or approval callback');
    assert.equal(await readFile(path.join(cwd, 'file.txt'), 'utf8'), 'original');
    assert.match(await readFile(path.join(cwd, '.learn-pi', 'audit.jsonl'), 'utf8'), /approval_denied/);
  } finally { app.close(); }
});

test('persistent session storage rejects a symlink out of course metadata before writing transcripts', async (t) => {
  const { parent, cwd } = await fixture(t);
  const outside = path.join(parent, 'outside-sessions');
  await mkdir(outside);
  await mkdir(path.join(cwd, '.learn-pi'));
  await symlink(outside, path.join(cwd, '.learn-pi', 'sessions'));
  const model = await scriptedModel([message('A private response')]);
  await assert.rejects(async () => {
    const app = await createCourseSession({ cwd, stage: 1, ...model, persistSession: true });
    try { await app.prompt('A private prompt'); }
    finally { app.close(); }
  }, /symbolic link|metadata|workspace/i);
});

test('tool budget exhaustion is surfaced as failure instead of a successful partial answer', async (t) => {
  const { cwd } = await fixture(t);
  await writeFile(path.join(cwd, 'file.txt'), 'bounded');
  const model = await scriptedModel(Array.from({ length: 4 }, () => message(call('read', { path: 'file.txt' }))));
  const app = await createCourseSession({ cwd, stage: 1, ...model, maxToolCalls: 1 });
  try {
    await assert.rejects(app.prompt('Read repeatedly'), /tool-call budget/i);
    assert.equal(model.fake.state.callCount, 2);
  } finally { app.close(); }
});

test('verification refuses an unmarked root before executing fixture code', async (t) => {
  const { cwd } = await fixture(t);
  const effect = path.join(cwd, 'must-not-run.txt');
  await writeFile(path.join(cwd, 'todo.ts'), 'export const todo = 1;\n');
  await writeFile(path.join(cwd, 'todo.test.ts'), `import {writeFileSync} from 'node:fs'; writeFileSync(${JSON.stringify(effect)}, 'ran');\n`);
  await assert.rejects(verifyProject(cwd));
  await assert.rejects(readFile(effect), { code: 'ENOENT' });
});

test('verification ignores inherited Git overrides and disables local fsmonitor execution', async (t) => {
  const { parent, cwd } = await fixture(t);
  await writeFile(path.join(cwd, 'todo.ts'), 'export const todo = 1;\n');
  await writeFile(path.join(cwd, 'todo.test.ts'), "import test from 'node:test'; test('fixture passes', () => {});\n");
  await CheckpointStore.initialize(cwd);
  const foreign = path.join(parent, 'foreign');
  await mkdir(foreign);
  await exec('git', ['init', '--quiet', foreign]);
  await writeFile(path.join(foreign, 'outside-private.txt'), 'foreign content');
  const effect = path.join(parent, 'fsmonitor-ran');
  const hook = path.join(parent, 'fsmonitor.sh');
  await writeFile(hook, `#!/bin/sh\nprintf ran > '${effect.replaceAll("'", "'\\''")}'\n`, { mode: 0o755 });
  await exec('git', ['-C', cwd, 'config', 'core.fsmonitor', hook]);
  const previous = { GIT_DIR: process.env.GIT_DIR, GIT_WORK_TREE: process.env.GIT_WORK_TREE };
  process.env.GIT_DIR = path.join(foreign, '.git');
  process.env.GIT_WORK_TREE = foreign;
  try {
    await writeFile(path.join(cwd, 'todo.ts'), 'export const todo = 2;\n');
    const result = await verifyProject(cwd);
    assert.equal(result.passed, true);
    assert.match(result.diff, /todo = 2/);
    assert.doesNotMatch(result.status, /outside-private/);
    await assert.rejects(readFile(effect), { code: 'ENOENT' });
  } finally {
    for (const key of ['GIT_DIR', 'GIT_WORK_TREE'] as const) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  }
});
