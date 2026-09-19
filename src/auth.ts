import { existsSync } from 'node:fs';
import { InMemoryCredentialStore, InMemoryModelsStore } from '@earendil-works/pi-ai';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { ModelRuntime } from '@earendil-works/pi-coding-agent';
/** Course auth lives in this repository, never silently creates ~/.pi. API-key env works too. */
export const courseAgentDir = fileURLToPath(new URL('../.cache/pi-agent/', import.meta.url));
export async function liveModelRuntime() {
  const authPath = join(courseAgentDir, 'auth.json');
  return ModelRuntime.create({ ...(existsSync(authPath) ? { authPath } : { credentials: new InMemoryCredentialStore() }), modelsPath: null,
    modelsStore: new InMemoryModelsStore(), allowModelNetwork: false,
    signal: AbortSignal.timeout(15_000) });
}
