/** Never print credentials. Explicitly report SKIPPED if this machine has no provider auth. */
import { mkdir, mkdtemp, cp, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { liveModelRuntime } from '../src/auth.ts';
import { CheckpointStore } from '../src/core/checkpoints.ts';
import { createCourseSession, assistantText } from '../src/runtime.ts';
import { verifyProject } from '../src/verification.ts';
await mkdir('.cache/live', { recursive: true });
const cwd = await mkdtemp(resolve('.cache/live/todo-'));
await cp(resolve('examples/fixtures/todo'), cwd, { recursive: true });
await CheckpointStore.initialize(cwd);
const runtime = await liveModelRuntime();
const available = await runtime.getAvailable(process.env.PI_PROVIDER, { signal: AbortSignal.timeout(15_000) });
const model = available.find(m => !process.env.PI_MODEL || m.id === process.env.PI_MODEL);
const destination = resolve('reports/model-smoke.json');
await mkdir('reports', { recursive: true });
if (!model) {
  const report = { status: 'SKIPPED', reason: 'No matching authenticated provider is available', at: new Date().toISOString(), remoteModelVerified: false };
  await writeFile(destination, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
} else {
  const app = await createCourseSession({ cwd, stage: 9, mode: 'execute', model, modelRuntime: runtime,
    maxModelCalls: 12, timeoutMs: 180_000, approve: req => ['write', 'edit', 'verify_project', 'checkpoint_create'].includes(req.name) });
  try {
    await app.prompt('Fix addTodo in this sample project: trim text and reject blank input without changing tests. Read source, checkpoint, edit, use verify_project, review the returned diff and report evidence. Do not use bash or delegate.');
    const verification = await verifyProject(cwd);
    const report = { status: verification.passed ? 'PASS' : 'FAIL', at: new Date().toISOString(), provider: model.provider, model: model.id, workspace: cwd, remoteModelVerified: true, testsPassed: verification.passed, response: assistantText(app.session), diff: verification.diff };
    await writeFile(destination, JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify(report, null, 2));
    if (!verification.passed) process.exitCode = 1;
  } catch (error) {
    await writeFile(destination, JSON.stringify({ status: 'FAIL', at: new Date().toISOString(), provider: model.provider, model: model.id, remoteModelVerified: false, reason: (error as Error).message }, null, 2) + '\n');
    throw error;
  } finally { app.close(); }
}
