import { cp, readdir, realpath } from 'node:fs/promises';
import { CheckpointStore } from '../src/core/checkpoints.ts';
const root = '/workspace';
if (await realpath(root) !== root || (await readdir(root)).length) throw new Error('/workspace must be a fresh empty mounted directory');
await cp('/opt/learn-pi/examples/fixtures/todo', root, { recursive: true });
await CheckpointStore.initialize(root);
console.log('Container exercise initialized at /workspace. Host fixture markers cannot be reused after moving paths.');
