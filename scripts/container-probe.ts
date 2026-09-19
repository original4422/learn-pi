import assert from 'node:assert/strict';
import { writeFile, rm, readFile } from 'node:fs/promises';
import { createConnection } from 'node:net';
await writeFile('/workspace/.probe', 'writable sample');
assert.equal(await readFile('/workspace/.probe', 'utf8'), 'writable sample');
await rm('/workspace/.probe');
await assert.rejects(writeFile('/opt/learn-pi/should-not-write', 'blocked'));
await assert.rejects(readFile('/host-secret'));
await assert.rejects(new Promise((resolve, reject) => {
  const socket = createConnection({ host: '1.1.1.1', port: 443 });
  socket.setTimeout(2000, () => { socket.destroy(); reject(new Error('Network timed out')); });
  socket.on('connect', () => { socket.destroy(); resolve(true); });
  socket.on('error', reject);
}));
console.log('PASS: mounted sample writable; image read-only; host secret unmounted; outbound network blocked.');
