import { cp, mkdir, realpath, rename, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CheckpointStore } from '../src/core/checkpoints.ts';
const repo = fileURLToPath(new URL('..', import.meta.url));
const parent = resolve(repo, 'examples/workspaces');
await mkdir(parent, { recursive: true });
if (await realpath(parent) !== parent) throw new Error('Workspace parent must not be a symlink');
const target = join(parent, 'todo');
try {
  await stat(target);
  const backup = `${target}-backup-${Date.now()}`;
  await rename(target, backup);
  console.log(`Previous exercise preserved: ${backup}`);
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
}
await cp(resolve(repo, 'examples/fixtures/todo'), target, { recursive: true });
const checkpoints = await CheckpointStore.initialize(target);
console.log(`Exercise ready: ${target}`);
console.log('The fixture intentionally has two failing tests. Ask the agent to fix addTodo.');
