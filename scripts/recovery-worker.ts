/** Fixture-only child process. Each invocation creates a fresh real Pi runtime. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
import { join, resolve, relative, sep } from 'node:path';
import { createCourseSession } from '../src/runtime.ts';
import { TaskStore } from '../src/core/tasks.ts';
import { scriptedModel, fauxAssistantMessage as message, fauxToolCall as call } from '../src/testing/scripted-model.ts';

const [mode, directory] = process.argv.slice(2);
assert.ok(mode === 'crash' || mode === 'resume');
assert.ok(directory);
const cwd = resolve(directory);
const local = relative(resolve('.cache/recovery'), cwd);
assert.ok(local && !local.startsWith(`..${sep}`) && local !== '..' && !local.startsWith(sep));
const marker = JSON.parse(await readFile(join(cwd, '.learn-pi/workspace.json'), 'utf8'));
assert.equal(marker.root, cwd);
const metadata = join(cwd, '.learn-pi/recovery');
const tasks = new TaskStore(join(cwd, '.learn-pi/tasks.json'));
const active = (await tasks.list()).find(task => task.status === 'in_progress');
assert.ok(active);
const quote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;
const command = (action: string) => `${quote(process.execPath)} operation.mjs ${action}`;

if (mode === 'crash') {
  const model = await scriptedModel([
    message(call('bash', { command: command('fail') }, { id: 'failed-delivery' })),
    context => {
      assert.ok(context.messages.some(item => item.role === 'toolResult' && item.toolCallId === 'failed-delivery' && item.isError));
      return message(call('bash', { command: command('deliver') }, { id: 'committed-delivery' }));
    },
  ]);
  const app = await createCourseSession({ cwd, stage: 7, mode: 'execute', persistSession: true, ...model,
    approve: request => request.name === 'bash' && [command('fail'), command('deliver')].includes(String(request.input.command)) });
  app.session.subscribe(event => {
    // Pi 0.85.1 notifies session subscribers before appendMessage(message).
    // The parent also inspects the JSONL: the source ordering alone is not proof.
    if (event.type === 'message_end' && event.message.role === 'toolResult' && event.message.toolCallId === 'committed-delivery') {
      assert.equal(event.message.isError, false);
      writeFileSync(join(metadata, 'boundary.json'), JSON.stringify({ sessionId: app.session.sessionId,
        sessionFile: app.session.sessionFile, toolCallId: event.message.toolCallId, pid: process.pid }));
      process.kill(process.pid, 'SIGKILL');
    }
  });
  await app.prompt('Run the fixed failing delivery, then the successful local delivery. Keep its task in progress until reconciled.');
  throw new Error('The injected process termination did not occur');
} else {
  // This is a fixture-specific reconciliation policy owned by the host.
  // A status or a missing tool result alone never authorizes a replay.
  const receipts = (await readFile(join(metadata, 'receipts.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(receipts, [{ operationId: 'delivery-001', result: 'delivered' }]);
  const model = await scriptedModel([
    context => {
      assert.ok(JSON.stringify(context.messages).includes('Verified local receipt: delivery-001 is delivered; count=1.'));
      return message(call('task_update', { id: active.id, status: 'done' }));
    },
    message('The host reconciled the receipt. The task is done; no delivery was replayed.'),
  ]);
  const app = await createCourseSession({ cwd, stage: 7, resumeSession: true, ...model });
  const executed: string[] = [];
  app.session.subscribe(event => { if (event.type === 'tool_execution_start') executed.push(event.toolName); });
  try {
    assert.equal(app.controller.policy.getMode(), 'plan');
    await app.prompt('Verified local receipt: delivery-001 is delivered; count=1. Record completion without rerunning the operation.');
    assert.deepEqual(executed, ['task_update']);
    await writeFile(join(metadata, 'resumed.json'), JSON.stringify({ sessionId: app.session.sessionId,
      sessionFile: app.session.sessionFile, executed, mode: app.controller.policy.getMode(), pid: process.pid }));
  } finally { app.close(); }
}
