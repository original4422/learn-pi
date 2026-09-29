import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, rename, rm, symlink, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { createCourseSession } from '../src/runtime.ts';
import { scriptedModel, fauxAssistantMessage as message, fauxToolCall as call } from '../src/testing/scripted-model.ts';

async function workspace(t: { after: (fn: () => Promise<void>) => void }) {
  const cache = resolve('.cache/test-sessions');
  await mkdir(cache, { recursive: true });
  const cwd = await mkdtemp(join(cache, 'pi-'));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  await writeFile(join(cwd, 'file.txt'), 'observed source');
  return cwd;
}

test('real Pi resumes conversation and appends to the same file while applying current host policy', async (t) => {
  const cwd = await workspace(t);
  const model = await scriptedModel([
    message(call('read', { path: 'file.txt' })),
    message(call('task_add', { text: 'Review the observed source' })),
    message('Observation saved; next step is review.'),
  ]);
  const first = await createCourseSession({ cwd, stage: 3, mode: 'execute', persistSession: true, ...model });
  const sessionId = first.session.sessionId;
  const sessionFile = first.session.sessionFile!;
  try { await first.prompt('Remember the source for our next conversation turn.'); }
  finally { first.close(); }
  const saved = await readFile(sessionFile, 'utf8');

  // A fresh model runtime proves the context comes from the saved Pi session.
  const next = await scriptedModel([context => {
    const history = JSON.stringify(context.messages);
    assert.match(history, /Remember the source/);
    assert.match(history, /observed source/);
    assert.match(history, /Observation saved/);
    assert.match(history, /Continue the review/);
    assert.deepEqual(context.tools?.map(tool => tool.name), ['read', 'ls']);
    return message('The resumed model request received the previous observations.');
  }]);
  const resumed = await createCourseSession({ cwd, stage: 1, resumeSession: true, ...next });
  try {
    assert.equal(resumed.session.sessionId, sessionId);
    assert.equal(resumed.session.sessionFile, sessionFile);
    assert.equal(resumed.controller.policy.getMode(), 'plan');
    assert.equal((await resumed.controller.tasks.list())[0]?.text, 'Review the observed source');
    await resumed.prompt('Continue the review.');
    const updated = await readFile(sessionFile, 'utf8');
    assert.ok(updated.startsWith(saved), 'Resume must append without replacing the transcript');
    assert.match(updated, /The resumed model request/);
    assert.equal(await readFile(join(cwd, 'file.txt'), 'utf8'), 'observed source');
  } finally { resumed.close(); }

  const fresh = await createCourseSession({ cwd, stage: 1, persistSession: true, ...next });
  try {
    assert.notEqual(fresh.session.sessionId, sessionId);
    assert.equal(fresh.session.messages.length, 0, 'The default remains a new conversation');
  } finally { fresh.close(); }
});

test('resume selects the most recently active session belonging to the current workspace', async (t) => {
  const cwd = await workspace(t);
  const foreign = await workspace(t);
  const timestamp = Date.now();
  const saved: Array<{ id: string; file: string }> = [];
  // Create the older conversation last to distinguish activity from file order.
  for (const [root, offset] of [[cwd, 10_000], [cwd, 5_000], [foreign, 20_000]] as const) {
    const model = await scriptedModel([message(`Conversation ${offset}`, { timestamp: timestamp + offset })]);
    const app = await createCourseSession({ cwd: root, stage: 1, persistSession: true, ...model });
    try {
      await app.prompt('Save this conversation.');
      saved.push({ id: app.session.sessionId, file: app.session.sessionFile! });
    } finally { app.close(); }
  }
  await cp(saved[2]!.file, join(cwd, '.learn-pi', 'sessions', 'foreign.jsonl'));
  const model = await scriptedModel([]);
  const resumed = await createCourseSession({ cwd, stage: 1, resumeSession: true, ...model });
  try { assert.equal(resumed.session.sessionId, saved[0]!.id); }
  finally { resumed.close(); }
});

test('resume reports a missing conversation and rejects a linked transcript', async (t) => {
  const cwd = await workspace(t);
  const model = await scriptedModel([message('Saved observation')]);
  await assert.rejects(createCourseSession({ cwd, resumeSession: true, ...model }), /No saved session.*without --resume/);
  const app = await createCourseSession({ cwd, stage: 1, persistSession: true, ...model });
  const sessionFile = app.session.sessionFile!;
  try { await app.prompt('Save an observation.'); }
  finally { app.close(); }
  const external = join(cwd, 'outside-sessions.jsonl');
  await rename(sessionFile, external);
  await symlink(external, sessionFile);
  const before = await readFile(external, 'utf8');
  await assert.rejects(createCourseSession({ cwd, resumeSession: true, ...model }), /symbolic link/);
  assert.equal(await readFile(external, 'utf8'), before);
});
