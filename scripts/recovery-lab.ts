import assert from 'node:assert/strict';
import type { Message } from '@earendil-works/pi-ai';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CheckpointStore } from '../src/core/checkpoints.ts';
import { TaskStore } from '../src/core/tasks.ts';

const operationSource = `import { appendFileSync, writeFileSync, openSync, fsyncSync, closeSync } from 'node:fs';
const action = process.argv[2];
if (action === 'fail') { console.error('Fixture delivery rejected before any side effect'); process.exit(7); }
if (action !== 'deliver') throw new Error('Unknown fixture action');
// Deliberately non-idempotent: replay would append a second receipt.
const fd = openSync('.learn-pi/recovery/receipts.jsonl', 'a');
try {
  appendFileSync(fd, JSON.stringify({ operationId: 'delivery-001', result: 'delivered' }) + '\\n');
  fsyncSync(fd);
} finally { closeSync(fd); }
writeFileSync('draft.txt', 'delivered\\n');
console.log('delivery-001 delivered');
`;

function worker(mode: 'crash' | 'resume', cwd: string): Promise<{ code: number | null; signal: NodeJS.Signals | null }> {
  return new Promise((resolveResult, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', resolve('scripts/recovery-worker.ts'), mode, cwd], {
      stdio: ['ignore', 'pipe', 'pipe'],
      // The official faux provider needs no credentials or global Pi settings.
      env: { PATH: process.env.PATH, HOME: join(cwd, '.learn-pi/home'), TMPDIR: process.env.TMPDIR },
    });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    const timeout = setTimeout(() => child.kill('SIGKILL'), 30_000);
    child.on('error', error => { clearTimeout(timeout); reject(error); });
    child.on('close', (code, signal) => {
      clearTimeout(timeout);
      if ((mode === 'crash' && signal === 'SIGKILL') || (mode === 'resume' && code === 0)) resolveResult({ code, signal });
      else reject(new Error(`Recovery worker ${mode} exited ${code}/${signal}: ${output}`));
    });
  });
}

function messages(jsonl: string): Message[] {
  return jsonl.trim().split('\n').map(line => JSON.parse(line)).filter(entry => entry.type === 'message').map(entry => entry.message);
}

export async function runRecoveryLab() {
  if (process.platform === 'win32') throw new Error('This process-signal lab runs on macOS and Linux.');
  await mkdir(resolve('.cache/recovery'), { recursive: true });
  const cwd = await mkdtemp(resolve('.cache/recovery/pi-'));
  await writeFile(join(cwd, 'operation.mjs'), operationSource);
  await writeFile(join(cwd, 'draft.txt'), 'pending\n');
  const checkpoints = await CheckpointStore.initialize(cwd);
  const checkpoint = (await checkpoints.list())[0]!;
  const metadata = join(cwd, '.learn-pi/recovery');
  await mkdir(metadata);
  const tasks = new TaskStore(join(cwd, '.learn-pi/tasks.json'));
  const prepared = await tasks.add('Prepare the local draft');
  await tasks.update(prepared.id, 'done');
  const delivery = await tasks.add('Deliver the fictional draft');
  await tasks.update(delivery.id, 'in_progress');
  const beforeTasks = await tasks.list();
  const crash = await worker('crash', cwd);
  const boundary = JSON.parse(await readFile(join(metadata, 'boundary.json'), 'utf8'));
  const beforeResume = await readFile(boundary.sessionFile, 'utf8');
  const history = messages(beforeResume);
  assert.ok(history.some(item => item.role === 'toolResult' && item.toolCallId === 'failed-delivery' && item.isError));
  assert.ok(history.some(item => item.role === 'assistant' && item.content.some(part => part.type === 'toolCall' && part.id === 'committed-delivery')));
  assert.ok(!history.some(item => item.role === 'toolResult' && item.toolCallId === 'committed-delivery'));
  const receiptFile = join(metadata, 'receipts.jsonl');
  const receipt = await readFile(receiptFile, 'utf8');
  assert.equal(receipt, '{"operationId":"delivery-001","result":"delivered"}\n');
  assert.deepEqual(await tasks.list(), beforeTasks);
  assert.equal(await readFile(join(cwd, 'draft.txt'), 'utf8'), 'delivered\n');
  await worker('resume', cwd);
  const resumed = JSON.parse(await readFile(join(metadata, 'resumed.json'), 'utf8'));
  assert.notEqual(resumed.pid, boundary.pid);
  assert.equal(resumed.sessionId, boundary.sessionId);
  assert.equal(resumed.sessionFile, boundary.sessionFile);
  const afterResume = await readFile(boundary.sessionFile, 'utf8');
  assert.ok(afterResume.startsWith(beforeResume));
  assert.equal(await readFile(receiptFile, 'utf8'), receipt);
  const afterTasks = await tasks.list();
  assert.deepEqual(afterTasks.map(task => task.status), ['done', 'done']);
  assert.deepEqual(afterTasks[0], beforeTasks[0]);
  await checkpoints.restore(checkpoint.id);
  assert.equal(await readFile(join(cwd, 'draft.txt'), 'utf8'), 'pending\n');
  assert.equal(await readFile(receiptFile, 'utf8'), receipt);
  assert.equal(await readFile(boundary.sessionFile, 'utf8'), afterResume);
  assert.deepEqual(await tasks.list(), afterTasks);
  const report = { kind: 'real-pi-scripted-model-process-recovery', pi: '0.85.1', remoteModel: false,
    workspace: cwd, reportPath: join(metadata, 'report.json'),
    crashSignal: crash.signal, distinctProcesses: true, failedOperationResultPersisted: true,
    successfulOperationCallPersisted: true, successfulOperationResultPersistedBeforeResume: false,
    receiptsBeforeResume: 1, receiptsAfterResume: 1, resumeTools: resumed.executed,
    sameConversation: true, resumedMode: resumed.mode,
    taskStatesBeforeResume: beforeTasks.map(task => task.status), taskStatesAfterResume: afterTasks.map(task => task.status),
    checkpoint: { draftRestored: true, receiptUnchanged: true, tasksUnchanged: true, conversationUnchanged: true },
  };
  await writeFile(report.reportPath, JSON.stringify(report, null, 2) + '\n');
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  console.log('SCRIPTED MODEL / REAL PI — process kill, receipt reconciliation, conversation resume, file checkpoint.');
  console.log(JSON.stringify(await runRecoveryLab(), null, 2));
}
