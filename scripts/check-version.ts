import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const json = async (file: string) => JSON.parse(await readFile(file, 'utf8'));
const report = await json('reports/version-lock.json');
const manifest = await json('package.json');
const lock = await json('package-lock.json');
for (const name of ['@earendil-works/pi-coding-agent', '@earendil-works/pi-ai']) {
  const installed = await json(`node_modules/${name}/package.json`);
  assert.equal(installed.version, report.version, `${name} runtime drift`);
  assert.equal(manifest.dependencies[name], report.version, `${name} dependency must be exact`);
  assert.equal(lock.packages[`node_modules/${name}`].version, report.version, `${name} lock drift`);
}
assert.equal(lock.packages['node_modules/@earendil-works/pi-coding-agent'].integrity, report.integrity);
assert.match(report.sourceCommit, /^[a-f0-9]{40}$/);
console.log(`PASS: published Pi ${report.version}, source ${report.sourceCommit}, installed packages and lockfile integrity agree.`);
