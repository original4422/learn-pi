import { parseArgs } from 'node:util';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { resolve, join } from 'node:path';
import { homedir } from 'node:os';
import { liveModelRuntime } from './auth.ts';
import { createCourseSession, assistantText } from './runtime.ts';
import type { ApprovalRequest } from './core/policy.ts';
import { CheckpointStore } from './core/checkpoints.ts';

const { values } = parseArgs({ options: {
  stage: { type: 'string', default: '9' }, workspace: { type: 'string', default: 'examples/workspaces/todo' },
  provider: { type: 'string' }, model: { type: 'string' }, prompt: { type: 'string' },
  mode: { type: 'string', default: 'plan' }, 'approve-fixture': { type: 'boolean', default: false },
  resume: { type: 'boolean', default: false },
  help: { type: 'boolean', short: 'h' },
} });
if (values.help) {
  console.log('learn-pi\n--stage 1..9 --workspace PATH --provider PROVIDER --model MODEL [--prompt TEXT] [--mode plan|execute] [--resume] [--approve-fixture]\n--resume continues the most recently active saved conversation in this workspace. Omit it to start a new conversation.\nInteractive: /mode plan|execute, /tasks, /checkpoint LABEL, /restore ID, /status, /compact, /quit\nMutations require interactive approval. --approve-fixture autoapproves file edits, checkpoint restore, and execution of model-modified code on the HOST in a marked workspace. It is not a sandbox; it does not approve the bash tool.');
  process.exit(0);
}
if (values.mode !== 'plan' && values.mode !== 'execute') throw new Error('--mode must be plan or execute');
const cwd = resolve(values.workspace);
const interactive = !values.prompt && !!stdin.isTTY;
if (!values.prompt && !interactive) throw new Error('Use --prompt in a noninteractive terminal, or npm run demo for the no-key exercise.');
const rl = interactive ? createInterface({ input: stdin, output: stdout }) : undefined;
const approvedFixtureTools = new Set(['write', 'edit', 'verify_project', 'checkpoint_create', 'checkpoint_restore']);
if (values['approve-fixture']) await new CheckpointStore(cwd).list(); // validates marker and exact root
const approve = async (request: ApprovalRequest): Promise<boolean> => {
  if (values['approve-fixture'] && approvedFixtureTools.has(request.name)) return true;
  if (!rl) return false;
  console.log(`\nApproval · ${request.name}\n${JSON.stringify(request.input, null, 2)}\nThis operation runs with host permissions.`);
  return (await rl.question('Allow this operation? [y/N] ')).trim().toLowerCase() === 'y';
};
let app: Awaited<ReturnType<typeof createCourseSession>> | undefined;
try {
  const modelRuntime = await liveModelRuntime();
  const available = await modelRuntime.getAvailable(values.provider, { signal: AbortSignal.timeout(15_000) });
  const model = available.find(m => (!values.model || m.id === values.model) && (!values.provider || m.provider === values.provider));
  if (!model) throw new Error('No matching authenticated model. Configure a provider API key or log in using the pinned Pi CLI. npm run demo needs no key.');
  app = await createCourseSession({ cwd, stage: Number(values.stage), mode: values.mode, approve, model, modelRuntime, persistSession: true, resumeSession: values.resume });
  console.log(`learn-pi · stage ${values.stage} · ${model.provider}/${model.id} · ${values.mode}\nWorkspace: ${cwd}`);
  console.log(`${values.resume ? 'Resumed' : 'New'} session: ${app.session.sessionId}\nSession file: ${app.session.sessionFile}`);
  app.session.subscribe(event => {
    if (event.type === 'message_update' && event.assistantMessageEvent.type === 'text_delta') stdout.write(event.assistantMessageEvent.delta);
    if (event.type === 'tool_execution_start') console.log(`\n→ ${event.toolName}`);
  });
  const run = async (text: string) => { await app!.prompt(text); console.log(); };
  if (values.prompt) await run(values.prompt);
  else while (rl) {
    const input = (await rl.question('\npi> ')).trim();
    if (!input) continue;
    if (input === '/quit' || input === '/exit') break;
    try {
      if (input.startsWith('/mode ')) { const mode = input.slice(6).trim(); if (mode !== 'plan' && mode !== 'execute') throw new Error('Usage: /mode plan|execute'); app.controller.setMode(mode); console.log(mode); }
      else if (input === '/tasks') console.log(await app.controller.tasks.list());
      else if (input === '/status') console.log({ ...await app.controller.status(), context: app.session.getContextUsage(), stats: app.session.getSessionStats() });
      else if (input === '/compact') { if (app.controller.stage < 8) throw new Error('Compaction lab begins at stage 8'); await app.session.compact('Preserve goal, decisions, task IDs, paths and test results.'); console.log('Context compacted; files unchanged.'); }
      else if (input.startsWith('/checkpoint')) { if (app.controller.stage < 7) throw new Error('Checkpoints begin at stage 7'); if (app.controller.policy.getMode() !== 'execute') throw new Error('Switch to /mode execute first'); console.log(await app.controller.checkpoints.create(input.slice(11).trim() || 'manual')); }
      else if (input.startsWith('/restore ')) { if (app.controller.stage < 7) throw new Error('Checkpoints begin at stage 7'); if (app.controller.policy.getMode() !== 'execute') throw new Error('Switch to /mode execute first'); const id = input.slice(9).trim(); if ((await rl.question(`Restore all sample files to ${id}? [y/N] `)).toLowerCase() === 'y') { await app.controller.checkpoints.restore(id); console.log('Sample files restored. Session/tasks unchanged.'); } }
      else if (input.startsWith('/')) console.log('Commands: /mode plan|execute /tasks /checkpoint LABEL /restore ID /status /compact /quit');
      else await run(input);
    } catch (error) { console.error((error as Error).message); }
  }
} catch (error) {
  console.error((error as Error).message); process.exitCode = 1;
} finally { app?.close(); rl?.close(); }
