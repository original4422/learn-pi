import { lstat, realpath, stat } from "node:fs/promises";
import path from "node:path";

export type AgentMode = "plan" | "execute";
export interface ToolRequest {
  name: string;
  input: Record<string, unknown>;
}
export interface PolicyDecision {
  allowed: boolean;
  requiresApproval: boolean;
  /** A stable, non-sensitive code, suitable for an audit record. */
  reason: string;
  canonicalPath?: string;
}
export interface WorkspacePolicyOptions {
  root: string;
  mode?: AgentMode;
  additionalReadOnlyTools?: string[];
  additionalMutationTools?: string[];
}

const READ_TOOLS = new Set(["read", "ls", "find", "grep"]);
const WRITE_TOOLS = new Set(["write", "edit"]);
const TASK_TOOLS = new Set(["task_list", "task_add", "task_update"]);
// Pi 0.85.1 normalizes these characters before its built-in file operations.
// Reject aliases rather than letting a checked path mean something else later.
const PI_UNICODE_SPACES = /[\u00a0\u2000-\u200a\u202f\u205f\u3000]/u;

export function isContained(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

/** Protect the same names at any depth; a nested .git must not bypass the check. */
export function isProtectedRelativePath(relative: string): boolean {
  return relative.split(/[\\/]/u).some((part) =>
    part === ".git" || part === ".learn-pi" || part === ".env" || part.startsWith(".env.") ||
    part === ".ssh" || part === ".aws" || part === ".npmrc" || part === ".netrc",
  );
}

/**
 * Resolve an existing ancestor before appending missing components. Unlike a
 * lexical prefix check this handles `inside/link/new/file` when link escapes.
 * lstat deliberately sees dangling links: an unresolvable link is an error,
 * not a nonexistent ordinary directory.
 */
export async function canonicalizePath(candidate: string): Promise<string> {
  let ancestor = path.resolve(candidate);
  const missing: string[] = [];
  while (true) {
    try {
      await lstat(ancestor);
      return path.resolve(await realpath(ancestor), ...missing);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      // A dangling symlink lstat succeeds, but realpath returns ENOENT.
      try {
        const entry = await lstat(ancestor);
        if (entry.isSymbolicLink()) throw new Error("Unresolvable symbolic link");
      } catch (lstatError) {
        if ((lstatError as NodeJS.ErrnoException).code !== "ENOENT") throw lstatError;
      }
      const parent = path.dirname(ancestor);
      if (parent === ancestor) throw error;
      missing.unshift(path.basename(ancestor));
      ancestor = parent;
    }
  }
}

function deny(reason: string): PolicyDecision {
  return { allowed: false, requiresApproval: false, reason };
}

/**
 * Application-level admission policy, NOT an OS sandbox. The caller must keep
 * this hook installed for every tool call. Recursive tools must additionally
 * filter their results; approved bash can access the entire host. A concurrent
 * symlink replacement between this check and tool execution remains possible.
 */
export class WorkspacePolicy {
  readonly root: string;
  private mode: AgentMode;
  private readonly extraRead: Set<string>;
  private readonly extraWrite: Set<string>;

  constructor(options: WorkspacePolicyOptions) {
    this.root = path.resolve(options.root);
    this.mode = options.mode ?? "plan";
    this.setMode(this.mode);
    this.extraRead = new Set(options.additionalReadOnlyTools ?? []);
    this.extraWrite = new Set(options.additionalMutationTools ?? []);
    for (const name of [...this.extraRead, ...this.extraWrite]) {
      if (READ_TOOLS.has(name) || WRITE_TOOLS.has(name) || TASK_TOOLS.has(name) || name === "bash" || (this.extraRead.has(name) && this.extraWrite.has(name))) {
        throw new Error("Custom policy tools must not override built-in tools or have conflicting classifications");
      }
    }
  }

  getMode(): AgentMode { return this.mode; }

  setMode(mode: AgentMode): void {
    if (mode !== "plan" && mode !== "execute") throw new Error("Invalid agent mode");
    this.mode = mode;
  }

  async evaluate(request: ToolRequest): Promise<PolicyDecision> {
    const { name, input } = request;
    if (!input || typeof input !== "object" || Array.isArray(input)) return deny("invalid_input");
    if (TASK_TOOLS.has(name)) return { allowed: true, requiresApproval: false, reason: "task_metadata" };
    if (this.extraRead.has(name)) return { allowed: true, requiresApproval: false, reason: "registered_read_only" };
    if (this.mode === "plan" && (WRITE_TOOLS.has(name) || name === "bash" || this.extraWrite.has(name))) {
      return deny("plan_is_read_only");
    }
    if (name === "bash") return { allowed: true, requiresApproval: true, reason: "shell_requires_approval" };
    if (this.extraWrite.has(name)) return { allowed: true, requiresApproval: true, reason: "mutation_requires_approval" };
    if (!READ_TOOLS.has(name) && !WRITE_TOOLS.has(name)) return deny("unknown_tool");

    const supplied = input.path ?? (name === "ls" || name === "find" || name === "grep" ? "." : undefined);
    if (typeof supplied !== "string" || supplied.length === 0 || supplied.includes("\0")) return deny("invalid_path");
    if (supplied.startsWith("@") || supplied.startsWith("~") || supplied.startsWith("file://") || PI_UNICODE_SPACES.test(supplied)) {
      return deny("ambiguous_path_alias");
    }
    try {
      const root = await realpath(this.root);
      if (PI_UNICODE_SPACES.test(this.root) || PI_UNICODE_SPACES.test(root)) return deny("ambiguous_path_alias");
      if (!(await stat(root)).isDirectory()) return deny("invalid_workspace");
      const lexical = path.resolve(this.root, supplied);
      if (!isContained(this.root, lexical)) return deny("outside_workspace");
      if (isProtectedRelativePath(path.relative(this.root, lexical))) return deny("protected_path");
      const canonical = await canonicalizePath(lexical);
      if (PI_UNICODE_SPACES.test(canonical)) return deny("ambiguous_path_alias");
      if (!isContained(root, canonical)) return deny("outside_workspace");
      if (isProtectedRelativePath(path.relative(root, canonical))) return deny("protected_path");
      // Pi read guesses NFD/curly-quote/screenshot spellings for missing files.
      // Requiring the checked target to exist prevents those fallback guesses
      // from finding an unchecked symlink or protected filename.
      if (name === "read") {
        try { await lstat(canonical); }
        catch { return deny("read_target_missing"); }
      }
      if (WRITE_TOOLS.has(name) && canonical === root) return deny("workspace_root_mutation");
      return {
        allowed: true,
        requiresApproval: WRITE_TOOLS.has(name),
        reason: WRITE_TOOLS.has(name) ? "mutation_requires_approval" : "workspace_read",
        canonicalPath: canonical,
      };
    } catch {
      return deny("path_resolution_failed");
    }
  }
}

export interface ApprovalRequest extends ToolRequest {
  decision: PolicyDecision;
}
export interface ApprovalOptions {
  headless?: boolean;
  confirm?: (request: ApprovalRequest) => Promise<boolean> | boolean;
}

/** Missing UI, a rejected prompt, or an exception must never grant permission. */
export class ApprovalGate {
  constructor(private readonly options: ApprovalOptions = {}) {}

  async authorize(request: ToolRequest, decision: PolicyDecision): Promise<boolean> {
    if (!decision.allowed) return false;
    if (!decision.requiresApproval) return true;
    if (this.options.headless || !this.options.confirm) return false;
    try {
      return (await this.options.confirm({ ...request, decision })) === true;
    } catch {
      return false;
    }
  }
}
