import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cp, mkdir, mkdtemp, readFile, realpath, writeFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import type { Context, FauxResponseFactory } from '@earendil-works/pi-ai';
import type { Consumer, Decision, Observation, Role } from '../examples/partial-results/contracts.ts';
import { decide as reference } from '../examples/partial-results/reference.ts';
import { createCourseSession } from '../src/runtime.ts';
import { scriptedModel, fauxAssistantMessage as message, fauxToolCall as call } from '../src/testing/scripted-model.ts';

const project = fileURLToPath(new URL('..', import.meta.url));
const cache = join(project, '.cache', 'partial-results');
const fixture = join(project, 'examples', 'fixtures', 'todo');
const paths = { researcher: 'todo.ts', reviewer: 'todo.test.ts' } as const;
const tasks = [
  { role: 'researcher' as const, task: 'PARTIAL_RESULTS_SOURCE: Read todo.ts and report the validation gap.' },
  { role: 'reviewer' as const, task: 'PARTIAL_RESULTS_TESTS: Read todo.test.ts and report the validation expectations.' },
];
const facts = {
  researcher: 'todo.ts: addTodo stores untrimmed text and accepts blank input.',
  reviewer: 'todo.test.ts: tests expect trimmed text and rejection of blank input.',
};
const cases = ['complete', 'rejected', 'truncated'] as const;
const text = (content: { type: string; text?: string }[]) => content.filter(p => p.type === 'text').map(p => p.text).join('\n');
const latestResult = (context: Context) => context.messages.findLast(m => m.role === 'toolResult');
async function hashes(directory: string) {
  return Promise.all(['todo.ts', 'todo.test.ts', 'AGENTS.md'].map(async name =>
    createHash('sha256').update(await readFile(join(directory, name))).digest('hex')));
}

export async function initializeExercise() {
  await mkdir(cache, { recursive: true });
  const directory = await mkdtemp(join(cache, 'exercise-'));
  await cp(join(project, 'examples', 'partial-results', 'starter.ts'), join(directory, 'consumer.ts'));
  await cp(join(project, 'examples', 'partial-results', 'contracts.ts'), join(directory, 'contracts.ts'));
  return join(directory, 'consumer.ts');
}

export async function runPartialResults(consume: Consumer = reference) {
  await mkdir(cache, { recursive: true });
  const directory = await mkdtemp(join(cache, 'run-'));
  const sourceHashes = await hashes(fixture);
  const reports = [];
  for (const scenario of cases) {
    const cwd = join(directory, scenario);
    await cp(fixture, cwd, { recursive: true });
    let observation: Observation | undefined;
    let decision: Decision | undefined;
    const reads: string[] = [];
    const parentTools: string[] = [];
    let approvalRequests = 0;
    const respond: FauxResponseFactory = context => {
      const user = context.messages.findLast(m => m.role === 'user');
      const prompt = user && (typeof user.content === 'string' ? user.content : text(user.content));
      const child = tasks.find(task => task.task === prompt);
      const result = latestResult(context);
      if (child) {
        if (scenario === 'rejected' && child.role === 'reviewer') {
          return message('', { stopReason: 'error', errorMessage: 'SCRIPTED_REVIEW_FAILURE' });
        }
        if (!result) return message(call('read', { path: paths[child.role] }));
        assert.equal(result.isError, false);
        assert.match(text(result.content), child.role === 'researcher' ? /export function addTodo/ : /rejects blank text/);
        const padding = scenario === 'truncated' && child.role === 'researcher' ? '\n' + '.'.repeat(8_050) + 'TAIL_NOT_DELIVERED' : '';
        return message(facts[child.role] + padding);
      }
      if (!result) return message(call('delegate_readonly', { tasks }));
      if (result.toolName === 'delegate_readonly') {
        observation = { isError: result.isError, results: JSON.parse(text(result.content)) };
        // The consumer sees actual Pi-delivered content, not the case label.
        decision = consume(structuredClone(observation));
        assert.ok(['summarize', 'inspect'].includes(decision.action));
        assert.ok(decision.roles.every(role => Object.hasOwn(paths, role)));
        assert.equal(new Set(decision.roles).size, decision.roles.length);
        assert.equal(decision.action === 'inspect', decision.roles.length > 0);
      } else {
        assert.equal(result.toolName, 'read');
        assert.equal(result.isError, false);
        const role = decision!.roles[reads.length - 1]!;
        assert.match(text(result.content), role === 'researcher' ? /export function addTodo/ : /rejects blank text/);
      }
      assert.ok(observation && decision);
      const next = decision.roles[reads.length];
      if (next) {
        // The fixture owns this mapping; child text never supplies a path.
        reads.push(paths[next]);
        return message(call('read', { path: paths[next] }));
      }
      const preserved = observation.results.filter(r => r.status === 'fulfilled').map(r => r.text?.slice(0, 100));
      return message(JSON.stringify({
        delegationComplete: decision.action === 'summarize',
        preserved, inspected: reads,
        note: decision.action === 'summarize' ? 'Both child results are complete.' : 'Delegation remains incomplete; parent inspected the listed fixture files. Tests were not run.',
      }));
    };
    const model = await scriptedModel(Array.from({ length: 16 }, () => respond));
    const app = await createCourseSession({ cwd, stage: 6, ...model, approve: () => { approvalRequests++; return false; } });
    app.session.subscribe(event => {
      if (event.type === 'tool_execution_start') parentTools.push(event.toolName);
    });
    try {
      await app.prompt('Delegate source and test inspection, then decide whether evidence needs a direct read.');
      assert.ok(observation && decision);
      assert.equal(observation.isError, false);
      assert.equal(observation.results.length, 2);
      assert.equal(approvalRequests, 0);
      assert.deepEqual(await hashes(cwd), sourceHashes);
      const expectedRoles: Role[] = scenario === 'complete' ? [] : [scenario === 'rejected' ? 'reviewer' : 'researcher'];
      const source = observation.results.find(r => r.role === 'researcher')!;
      const review = observation.results.find(r => r.role === 'reviewer')!;
      assert.equal(source.status, 'fulfilled');
      assert.ok(source.text?.startsWith(facts.researcher));
      assert.equal(source.truncated, scenario === 'truncated');
      assert.equal(review.status, scenario === 'rejected' ? 'rejected' : 'fulfilled');
      if (scenario === 'rejected') assert.match(review.error!, /SCRIPTED_REVIEW_FAILURE/);
      else assert.equal(review.text, facts.reviewer);
      if (scenario === 'truncated') {
        assert.equal(source.text?.length, 8_000);
        assert.ok(!source.text.includes('TAIL_NOT_DELIVERED'));
      }
      const final = app.session.messages.findLast(m => m.role === 'assistant')!;
      assert.equal(final.role, 'assistant');
      const answer = JSON.parse(text(final.content));
      const expectedReads = expectedRoles.map(role => paths[role]);
      const passed = JSON.stringify(reads) === JSON.stringify(expectedReads)
        && answer.delegationComplete === (scenario === 'complete')
        && JSON.stringify(parentTools) === JSON.stringify(['delegate_readonly', ...expectedRoles.map(() => 'read')]);
      reports.push({ scenario, passed, topLevelIsError: observation.isError,
        results: observation.results.map(r => ({ role: r.role, status: r.status, truncated: r.truncated ?? false, characters: r.text?.length ?? 0 })),
        decision, parentTools, reads, answer, modelRequests: model.fake.state.callCount,
        fixtureUnchanged: true });
    } finally { app.close(); }
  }
  assert.deepEqual(await hashes(fixture), sourceHashes);
  const report = { kind: 'real-pi-scripted-partial-results', piVersion: '0.85.1', remoteModel: false,
    directory, passed: reports.every(r => r.passed), cases: reports };
  await writeFile(join(directory, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}

async function main() {
  const { values } = parseArgs({ options: { init: { type: 'boolean' }, consumer: { type: 'string' } } });
  if (values.init) {
    const file = await initializeExercise();
    console.log(`Edit ${relative(project, file)}\nRun: npm run partial:demo -- --consumer ${relative(project, file)}`);
    return;
  }
  let consume = reference;
  if (values.consumer) {
    const file = await realpath(resolve(values.consumer));
    const rel = relative(await realpath(join(project, '.cache')), file);
    assert.ok(rel && !rel.startsWith('..') && !rel.startsWith('/'), 'Consumer must be inside this repository .cache');
    consume = (await import(pathToFileURL(file).href)).decide;
    assert.equal(typeof consume, 'function', 'Consumer must export decide');
  }
  const report = await runPartialResults(consume);
  for (const item of report.cases) console.log(`${item.passed ? 'PASS' : 'FAIL'} ${item.scenario}: ${item.parentTools.join(' -> ')} ${item.reads.join(', ')}`);
  console.log(join(report.directory, 'report.json'));
  if (!report.passed) process.exitCode = 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
