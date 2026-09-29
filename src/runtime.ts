import { join, resolve } from 'node:path';
import { lstat, readFile } from 'node:fs/promises';
import { InMemoryCredentialStore, InMemoryModelsStore, type Model, type Api } from '@earendil-works/pi-ai';
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager, type AgentSession } from '@earendil-works/pi-coding-agent';
import { CourseController, type CourseOptions } from './extensions/course.ts';
import { stageTools } from './stages.ts';

export interface RuntimeOptions extends CourseOptions {
  model?: Model<Api>;
  persistSession?: boolean;
  resumeSession?: boolean;
  maxModelCalls?: number;
  timeoutMs?: number;
}
/** Explicit resources keep global/project packages and instructions out of the lesson. */
export async function createCourseSession(options: RuntimeOptions) {
  const cwd = resolve(options.cwd);
  const controller = new CourseController({ ...options, cwd });
  await controller.prepare();
  const sessionDir = join(cwd, '.learn-pi', 'sessions');
  let sessionManager: SessionManager;
  if (options.resumeSession) {
    const [recent] = await SessionManager.list(cwd, sessionDir);
    if (!recent) throw new Error('No saved session in this workspace. Start without --resume first.');
    if (!(await lstat(recent.path)).isFile()) throw new Error('Saved session must be a regular file, not a symbolic link');
    sessionManager = SessionManager.open(recent.path, sessionDir);
  } else {
    sessionManager = options.persistSession ? SessionManager.create(cwd, sessionDir) : SessionManager.inMemory(cwd);
  }
  const agentDir = join(cwd, '.learn-pi', 'runtime');
  const modelRuntime = options.modelRuntime ?? await ModelRuntime.create({ credentials: new InMemoryCredentialStore(), modelsPath: null, modelsStore: new InMemoryModelsStore(), allowModelNetwork: false });
  // Pass the same credential runtime to real child sessions, without parent hooks.
  controller.options.modelRuntime = modelRuntime;
  const settingsManager = SettingsManager.inMemory({
    compaction: { enabled: false }, retry: { enabled: false, provider: { maxRetries: 0 } },
    defaultProjectTrust: 'never',
  });
  let instructions = '';
  const check = await controller.policy.evaluate({ name: 'read', input: { path: 'AGENTS.md' } });
  if (check.allowed) {
    try { instructions = (await readFile(join(cwd, 'AGENTS.md'), 'utf8')).slice(0, 16_000); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
  }
  const loader = new DefaultResourceLoader({
    cwd, agentDir, settingsManager, noExtensions: true, noSkills: true,
    noPromptTemplates: true, noThemes: true, noContextFiles: true,
    systemPrompt: `You are the learn-pi teaching coding agent. Work on one small verified change. Distinguish observations from assumptions. Explain tool failures.\n\nWorkspace instructions (subordinate to the course guardrails):\n${instructions}`,
    appendSystemPrompt: [], extensionFactories: [controller.extension()],
  });
  await loader.reload();
  const extensionErrors = loader.getExtensions().errors;
  if (extensionErrors.length) throw new Error(`Extension failed to load: ${JSON.stringify(extensionErrors)}`);
  const { session } = await createAgentSession({
    cwd, agentDir, modelRuntime, model: options.model, thinkingLevel: 'off',
    tools: stageTools(controller.stage), resourceLoader: loader, settingsManager,
    sessionManager,
  });
  await session.bindExtensions({ mode: 'print', onError: error => { throw new Error(`Course extension error: ${error.error}`); } });
  session.agent.toolExecution = 'sequential'; // deterministic order for tasks/checkpoints
  const originalStream = session.agent.streamFunction;
  let modelCalls = 0;
  session.agent.streamFunction = (...args) => {
    if (++modelCalls > (options.maxModelCalls ?? 20)) throw new Error('Course model-call budget exhausted');
    const [model, context, streamOptions] = args;
    return originalStream(model, context, { ...streamOptions, maxTokens: 4096 });
  };
  async function prompt(text: string) {
    modelCalls = 0;
    let expired = false;
    const timer = setTimeout(() => { expired = true; void session.abort(); }, options.timeoutMs ?? 180_000);
    try {
      await session.prompt(text, { expandPromptTemplates: false });
      if (controller.limitError) throw new Error(controller.limitError);
      if (expired) throw new Error('Course prompt deadline exceeded');
      const last = session.messages.at(-1);
      if (last?.role === 'assistant' && (last.stopReason === 'error' || last.stopReason === 'aborted')) {
        throw new Error(last.errorMessage ?? `Model ${last.stopReason}`);
      }
    } finally { clearTimeout(timer); }
  }
  return { session, controller, modelRuntime, prompt, close: () => session.dispose() };
}
export function assistantText(session: AgentSession): string {
  const message = [...session.messages].reverse().find(m => m.role === 'assistant');
  return message?.role === 'assistant' ? message.content.filter(c => c.type === 'text').map(c => c.text).join('\n') : '';
}
