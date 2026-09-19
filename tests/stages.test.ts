import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import { test } from 'node:test';
import { runStage, type StageReport } from '../scripts/stage-demo.ts';

test('all nine stage demos execute their actual Pi integration and verify their teaching outcome', async (t) => {
  const reports: StageReport[] = [];
  t.after(async () => {
    for (const report of reports) await rm(report.workspace, { recursive: true, force: true });
  });
  for (let stage = 1; stage <= 9; stage++) {
    const report = await runStage(stage);
    reports.push(report);
    assert.equal(report.stage, stage);
    assert.equal(report.realRuntime, true);
    assert.equal(report.remoteModel, false);
    assert.ok(report.modelRequests > 0);
    assert.ok(report.checks.length >= 2);
    assert.deepEqual(JSON.parse(await readFile(report.reportPath, 'utf8')), report);
  }
  assert.equal(new Set(reports.map(report => report.workspace)).size, 9);
  assert.deepEqual(reports[0]!.toolNames, ['read']);
  assert.equal(reports[1]!.finalWorkspace, 'fixed fixture');
  assert.ok(reports[2]!.toolNames.includes('task_update'));
  assert.equal(reports[3]!.finalWorkspace, 'unchanged fixture');
  assert.equal(reports[4]!.evidence.transport, 'real stdio');
  assert.deepEqual(reports[5]!.toolNames, ['delegate_readonly']);
  assert.equal(reports[5]!.modelRequests, 4);
  assert.equal(reports[6]!.evidence.fixedTestsPassed, true);
  assert.equal((reports[7]!.evidence.compaction as { executed: boolean }).executed, false);
  assert.equal(reports[8]!.evidence.restoreVerified, true);
  assert.equal(reports[8]!.finalWorkspace, 'restored original fixture');
});

test('stage demos reject invalid stages before starting a model session', async () => {
  for (const stage of [0, 10, -1, 1.5, NaN]) await assert.rejects(runStage(stage), /Stage must be/);
});
