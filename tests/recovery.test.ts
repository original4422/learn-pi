import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import test from 'node:test';
import { runRecoveryLab } from '../scripts/recovery-lab.ts';

test('real Pi reconciles one committed effect after SIGKILL without replay; checkpoint only restores files', { skip: process.platform === 'win32' }, async (t) => {
  const report = await runRecoveryLab();
  t.after(() => rm(report.workspace, { recursive: true, force: true }));
  assert.deepEqual(JSON.parse(await readFile(report.reportPath, 'utf8')), report);
  assert.equal(report.crashSignal, 'SIGKILL');
  assert.equal(report.failedOperationResultPersisted, true);
  assert.equal(report.successfulOperationResultPersistedBeforeResume, false);
  assert.deepEqual(report.resumeTools, ['task_update']);
  assert.equal(report.receiptsAfterResume, 1);
});
