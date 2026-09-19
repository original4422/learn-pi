/** Deterministic model double ONLY. Pi's real session, tools, hooks and MCP still run. */
import { fauxProvider, fauxAssistantMessage, fauxToolCall, InMemoryCredentialStore, InMemoryModelsStore, type FauxResponseStep } from '@earendil-works/pi-ai';
import { ModelRuntime } from '@earendil-works/pi-coding-agent';
export { fauxAssistantMessage, fauxToolCall };
export async function scriptedModel(responses: FauxResponseStep[]) {
  const fake = fauxProvider({ provider: 'learn-pi-scripted', tokensPerSecond: Infinity });
  const runtime = await ModelRuntime.create({ credentials: new InMemoryCredentialStore(), modelsPath: null, modelsStore: new InMemoryModelsStore(), refreshOnCreate: false });
  runtime.registerNativeProvider(fake.provider);
  fake.setResponses(responses);
  return { fake, modelRuntime: runtime, model: fake.getModel() };
}
