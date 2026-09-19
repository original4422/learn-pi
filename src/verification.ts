import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, realpath } from 'node:fs/promises';
import { join } from 'node:path';
import { CheckpointStore } from './core/checkpoints.ts';
const exec = promisify(execFile);
/** Fixed argv; still executes workspace code with host permissions. Approval required. */
export async function verifyProject(cwd: string, signal?: AbortSignal) {
  const root = await realpath(cwd);
  await new CheckpointStore(root).list();
  // A nested Node test must not inherit its parent's test-runner IPC state.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('NODE_TEST_') && !key.startsWith('GIT_') && key !== 'NODE_OPTIONS'));
  Object.assign(env, { GIT_DIR: join(root, '.git'), GIT_WORK_TREE: root, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null' });
  for (const name of ['todo.ts', 'todo.test.ts']) {
    const file = await realpath(join(root, name));
    if (file !== join(root, name)) throw new Error('Verification refuses symlinked fixture files');
    await readFile(file, 'utf8');
  }
  let tests: { passed: boolean; output: string };
  try {
    const result = await exec(process.execPath, ['--import', import.meta.resolve('tsx'), '--test', 'todo.test.ts'], { cwd: root, env, signal, timeout: 30_000, maxBuffer: 256_000 });
    tests = { passed: true, output: result.stdout + result.stderr };
  } catch (error) {
    const e = error as Error & { stdout?: string; stderr?: string };
    tests = { passed: false, output: (e.stdout ?? '') + (e.stderr ?? '') || e.message };
  }
  const diff = await exec('git', ['-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', '--no-pager', 'diff', '--no-ext-diff', '--no-textconv', '--', '.'], { cwd: root, env, signal, timeout: 10_000, maxBuffer: 256_000 });
  const status = await exec('git', ['-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=/dev/null', 'status', '--short', '--', '.', ':!.learn-pi'], { cwd: root, env, signal, timeout: 10_000, maxBuffer: 64_000 });
  return { ...tests, output: tests.output.slice(0, 16_000), diff: diff.stdout.slice(0, 16_000), status: status.stdout };
}
