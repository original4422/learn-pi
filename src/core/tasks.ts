import { randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";

export type TaskStatus = "pending" | "in_progress" | "done";
export interface Task {
  id: string;
  text: string;
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}
export interface TaskState {
  version: 1;
  revision: number;
  tasks: Task[];
}

const queues = new Map<string, Promise<unknown>>();
const STATUSES: TaskStatus[] = ["pending", "in_progress", "done"];

function validateText(text: unknown): asserts text is string {
  if (typeof text !== "string" || !text.trim() || text.length > 1000 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(text)) {
    throw new Error("Task text must contain 1–1000 characters and no control characters");
  }
}

function validateState(input: unknown): TaskState {
  if (!input || typeof input !== "object") throw new Error("Invalid task state");
  const state = input as TaskState;
  if (state.version !== 1) throw new Error("Unsupported task state version");
  if (!Number.isSafeInteger(state.revision) || state.revision < 0 || !Array.isArray(state.tasks) || state.tasks.length > 10_000) {
    throw new Error("Invalid task state structure");
  }
  const ids = new Set<string>();
  let active = 0;
  const tasks = state.tasks.map((task) => {
    if (!task || typeof task !== "object" || typeof task.id !== "string" || !/^[a-zA-Z0-9-]{1,80}$/u.test(task.id) || ids.has(task.id)) {
      throw new Error("Task IDs must be valid and unique");
    }
    ids.add(task.id);
    validateText(task.text);
    if (!STATUSES.includes(task.status)) throw new Error("Invalid task status");
    if (task.status === "in_progress") active++;
    for (const timestamp of [task.createdAt, task.updatedAt]) {
      if (typeof timestamp !== "string" || !Number.isFinite(Date.parse(timestamp))) throw new Error("Invalid task timestamp");
    }
    return { id: task.id, text: task.text, status: task.status, createdAt: task.createdAt, updatedAt: task.updatedAt };
  });
  if (active > 1) throw new Error("Only one task may be in progress");
  return { version: 1, revision: state.revision, tasks };
}

/** Atomic rename plus file and directory fsync: readers see a whole JSON document. */
export async function atomicWrite(file: string, content: string): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  const handle = await open(temporary, "wx", 0o600);
  try {
    await handle.writeFile(content, "utf8");
    await handle.sync();
  } catch (error) {
    await handle.close();
    await rm(temporary, { force: true });
    throw error;
  }
  await handle.close();
  try {
    await rename(temporary, file);
    const directory = await open(path.dirname(file), "r");
    try { await directory.sync(); } finally { await directory.close(); }
  } finally { await rm(temporary, { force: true }); }
}

/**
 * One persisted snapshot and one last-good backup. Calls across instances in
 * this process are serialized; concurrent independent processes are unsupported.
 * Corrupt data with no valid backup fails explicitly instead of erasing tasks.
 */
export class TaskStore {
  readonly file: string;
  constructor(file: string) { this.file = path.resolve(file); }

  private serialize<T>(work: () => Promise<T>): Promise<T> {
    const previous = queues.get(this.file) ?? Promise.resolve();
    const result = previous.then(work, work);
    const settled = result.catch(() => undefined);
    queues.set(this.file, settled);
    void settled.finally(() => { if (queues.get(this.file) === settled) queues.delete(this.file); });
    return result;
  }

  private async readState(): Promise<TaskState> {
    let primaryError: unknown;
    try { return validateState(JSON.parse(await readFile(this.file, "utf8"))); }
    catch (error) { primaryError = error; }
    try {
      const recovered = validateState(JSON.parse(await readFile(`${this.file}.bak`, "utf8")));
      await atomicWrite(this.file, `${JSON.stringify(recovered, null, 2)}\n`);
      return recovered;
    } catch (backupError) {
      if ((primaryError as NodeJS.ErrnoException).code === "ENOENT" && (backupError as NodeJS.ErrnoException).code === "ENOENT") {
        return { version: 1, revision: 0, tasks: [] };
      }
      throw new Error("Task state is unreadable and no valid backup is available", { cause: primaryError });
    }
  }

  private async save(previous: TaskState, next: TaskState): Promise<void> {
    validateState(next);
    await atomicWrite(`${this.file}.bak`, `${JSON.stringify(previous, null, 2)}\n`);
    await atomicWrite(this.file, `${JSON.stringify(next, null, 2)}\n`);
  }

  load(): Promise<TaskState> { return this.serialize(() => this.readState()); }
  async list(): Promise<Task[]> { return (await this.load()).tasks; }

  add(text: string): Promise<Task> {
    return this.serialize(async () => {
      validateText(text);
      const previous = await this.readState();
      const now = new Date().toISOString();
      const task: Task = { id: randomUUID(), text: text.trim(), status: "pending", createdAt: now, updatedAt: now };
      const next: TaskState = { version: 1, revision: previous.revision + 1, tasks: [...previous.tasks, task] };
      await this.save(previous, next);
      return { ...task };
    });
  }

  update(id: string, status: TaskStatus): Promise<Task> {
    return this.serialize(async () => {
      if (!STATUSES.includes(status)) throw new Error("Invalid task status");
      const previous = await this.readState();
      const target = previous.tasks.find((task) => task.id === id);
      if (!target) throw new Error("Unknown task ID");
      if (status === "in_progress" && previous.tasks.some((task) => task.id !== id && task.status === "in_progress")) {
        throw new Error("Only one task may be in progress");
      }
      if (target.status === status) return { ...target };
      const updated = { ...target, status, updatedAt: new Date().toISOString() };
      const next: TaskState = {
        version: 1,
        revision: previous.revision + 1,
        tasks: previous.tasks.map((task) => task.id === id ? updated : task),
      };
      await this.save(previous, next);
      return { ...updated };
    });
  }
}
