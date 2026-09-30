import assert from 'node:assert/strict';
import { readFile, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { test } from 'node:test';
import type { Consumer } from '../examples/partial-results/contracts.ts';
import { decide as starter } from '../examples/partial-results/starter.ts';
import { initializeExercise, runPartialResults } from '../scripts/partial-results-lab.ts';

test('real Pi parent consumes complete, rejected and truncated child results', async t => {
  const report = await runPartialResults();
  t.after(() => rm(report.directory, { recursive: true, force: true }));
  assert.equal(report.passed, true);
  assert.deepEqual(report.cases.map(c => c.reads), [[], ['todo.test.ts'], ['todo.ts']]);
  assert.deepEqual(report.cases.map(c => c.parentTools), [
    ['delegate_readonly'], ['delegate_readonly', 'read'], ['delegate_readonly', 'read'],
  ]);
  assert.ok(report.cases.every(c => !c.topLevelIsError && c.fixtureUnchanged));
  assert.match(report.cases[1]!.answer.preserved[0], /addTodo stores untrimmed text/);
  assert.deepEqual(JSON.parse(await readFile(`${report.directory}/report.json`, 'utf8')), report);
});

test('starter and constant decisions cannot pass all cases', async t => {
  const policies: [string, Consumer, boolean[]][] = [
    ['starter', starter, [true, false, false]],
    ['always summarize', () => ({ action: 'summarize', roles: [] }), [true, false, false]],
    ['always inspect', () => ({ action: 'inspect', roles: ['researcher', 'reviewer'] }), [false, false, false]],
  ];
  for (const [name, policy, expected] of policies) {
    await t.test(name, async t => {
      const report = await runPartialResults(policy);
      t.after(() => rm(report.directory, { recursive: true, force: true }));
      assert.equal(report.passed, false);
      assert.deepEqual(report.cases.map(c => c.passed), expected);
    });
  }
});

test('initializing another exercise preserves the previous learner file', async t => {
  const first = await initializeExercise();
  await writeFile(first, '// learner work\n');
  const second = await initializeExercise();
  t.after(async () => {
    await rm(dirname(first), { recursive: true, force: true });
    await rm(dirname(second), { recursive: true, force: true });
  });
  assert.notEqual(first, second);
  assert.match(await readFile(second, 'utf8'), /observation.isError/);
  assert.equal(await readFile(first, 'utf8'), '// learner work\n');
});
