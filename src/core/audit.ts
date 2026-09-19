import { mkdir, open } from "node:fs/promises";
import path from "node:path";
import type { AgentMode } from "./policy.js";

export interface AuditEvent {
  tool: string;
  outcome: "allowed" | "denied" | "error" | "completed";
  mode: AgentMode;
  reasonCode?: string;
}

/** An allowlist of fields prevents raw arguments, prompts, output, or secrets from leaking. */
export class AuditLog {
  private pending: Promise<void> = Promise.resolve();
  constructor(readonly file: string) {}

  record(event: AuditEvent): Promise<void> {
    if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,79}$/u.test(event.tool)) return Promise.reject(new Error("Invalid audit tool name"));
    if (!["allowed", "denied", "error", "completed"].includes(event.outcome)) return Promise.reject(new Error("Invalid audit outcome"));
    if (event.mode !== "plan" && event.mode !== "execute") return Promise.reject(new Error("Invalid audit mode"));
    if (event.reasonCode !== undefined && !/^[a-z][a-z0-9_]{0,63}$/u.test(event.reasonCode)) {
      return Promise.reject(new Error("Audit reasons must be stable codes, not free text"));
    }
    const record = {
      version: 1,
      at: new Date().toISOString(),
      tool: event.tool,
      outcome: event.outcome,
      mode: event.mode,
      ...(event.reasonCode ? { reasonCode: event.reasonCode } : {}),
    };
    const write = async () => {
      await mkdir(path.dirname(this.file), { recursive: true });
      const handle = await open(this.file, "a", 0o600);
      try {
        await handle.writeFile(`${JSON.stringify(record)}\n`, "utf8");
        await handle.sync();
      } finally { await handle.close(); }
    };
    const result = this.pending.then(write, write);
    this.pending = result.catch(() => undefined);
    return result;
  }
}
