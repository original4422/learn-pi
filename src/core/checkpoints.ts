import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { lstat, mkdir, readdir, readFile, realpath, rm, writeFile, chmod } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { atomicWrite } from "./tasks.js";
import { isContained, isProtectedRelativePath } from "./policy.js";

const run = promisify(execFile);
const MARKER = ".learn-pi/workspace.json";
const MANIFEST = ".learn-pi/checkpoints.json";

interface WorkspaceMarker {
  version: 1;
  kind: "learn-pi-disposable-workspace";
  root: string;
  workspaceId: string;
}
export interface Checkpoint {
  id: string;
  label: string;
  createdAt: string;
  commit: string;
  fileCount: number;
}
interface Manifest { version: 1; workspaceId: string; checkpoints: Checkpoint[] }
interface SampleFile { relative: string; absolute: string; executable: boolean }

/** Remove inherited Git overrides so a command can never target a parent repo. */
function gitEnvironment(root: string, overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
  return {
    ...environment,
    GIT_DIR: path.join(root, ".git"),
    GIT_WORK_TREE: root,
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : "/dev/null",
    GIT_AUTHOR_NAME: "learn-pi",
    GIT_AUTHOR_EMAIL: "lesson@localhost",
    GIT_COMMITTER_NAME: "learn-pi",
    GIT_COMMITTER_EMAIL: "lesson@localhost",
    ...overrides,
  };
}

async function git(root: string, args: string[], overrides: NodeJS.ProcessEnv = {}): Promise<string> {
  const result = await run("git", ["-C", root, "-c", "core.hooksPath=/dev/null", "-c", "core.fsmonitor=false", ...args], {
    env: gitEnvironment(root, overrides),
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  return result.stdout;
}

/** git hash-object's stdin is written explicitly; no shell, filter, or hook runs. */
function hashBlob(root: string, data: Uint8Array): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile("git", ["-C", root, "hash-object", "-w", "--stdin"], {
      env: gitEnvironment(root), encoding: "utf8", maxBuffer: 1024 * 1024,
    }, (error, stdout) => error ? reject(error) : resolve(stdout.trim()));
    child.stdin?.on("error", reject);
    child.stdin?.end(data);
  });
}

async function exists(file: string): Promise<boolean> {
  try { await lstat(file); return true; }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return false; throw error; }
}

/** Enumerate the disposable sample tree only; never follow symbolic links. */
async function sampleFiles(root: string, relative = ""): Promise<SampleFile[]> {
  const files: SampleFile[] = [];
  for (const name of (await readdir(path.join(root, relative))).sort()) {
    const child = relative ? `${relative}/${name}` : name;
    if (isProtectedRelativePath(child)) continue;
    const absolute = path.join(root, child);
    const entry = await lstat(absolute);
    if (entry.isSymbolicLink()) throw new Error(`Checkpoint refuses symbolic links: ${child}`);
    if (entry.isDirectory()) files.push(...await sampleFiles(root, child));
    else if (entry.isFile()) files.push({ relative: child, absolute, executable: (entry.mode & 0o111) !== 0 });
    else throw new Error(`Checkpoint refuses special files: ${child}`);
  }
  return files;
}

function validateSnapshotPath(relative: string): void {
  if (!relative || relative.includes("\0") || relative.includes("\\") || path.posix.isAbsolute(relative) ||
      relative.split("/").some((part) => part === ".." || part === "." || !part) || isProtectedRelativePath(relative)) {
    throw new Error("Checkpoint contains an unsafe path");
  }
}

/**
 * A dedicated nested Git repository for disposable lessons. Snapshot commits
 * use a private index and never move HEAD, reset, stash, or touch the parent
 * repository. Restore is file-tree recovery, not Pi conversation branching.
 * The whole marked directory is disposable, except metadata and secret paths.
 * Run one operation at a time; other processes changing this tree are outside
 * the teaching guardrail (this is not a filesystem sandbox).
 */
export class CheckpointStore {
  readonly root: string;
  private pending: Promise<unknown> = Promise.resolve();
  constructor(root: string) { this.root = path.resolve(root); }

  static async initialize(rootPath: string): Promise<CheckpointStore> {
    await mkdir(rootPath, { recursive: true });
    const root = await realpath(rootPath);
    if (await exists(path.join(root, ".git")) || await exists(path.join(root, ".learn-pi"))) {
      throw new Error("Initialize requires a fresh disposable directory with no .git or .learn-pi");
    }
    await sampleFiles(root); // Refuse links before creating any metadata.
    await git(root, ["init", "--quiet", "--template="]);
    await mkdir(path.join(root, ".learn-pi"), { mode: 0o700 });
    const marker: WorkspaceMarker = {
      version: 1,
      kind: "learn-pi-disposable-workspace",
      root,
      workspaceId: randomUUID(),
    };
    await atomicWrite(path.join(root, MARKER), `${JSON.stringify(marker, null, 2)}\n`);
    await atomicWrite(path.join(root, MANIFEST), `${JSON.stringify({ version: 1, workspaceId: marker.workspaceId, checkpoints: [] }, null, 2)}\n`);
    const store = new CheckpointStore(root);
    const baseline = await store.create("Initial lesson workspace");
    await git(root, ["symbolic-ref", "HEAD", "refs/heads/lesson"]);
    await git(root, ["update-ref", "HEAD", baseline.commit]);
    await git(root, ["read-tree", baseline.commit]);
    return store;
  }

  private serialize<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.pending.then(operation, operation);
    this.pending = result.catch(() => undefined);
    return result;
  }

  private async verify(): Promise<WorkspaceMarker> {
    const canonicalRoot = await realpath(this.root);
    const gitDirectory = await lstat(path.join(this.root, ".git"));
    const metadataDirectory = await lstat(path.join(this.root, ".learn-pi"));
    if (gitDirectory.isSymbolicLink() || !gitDirectory.isDirectory() || metadataDirectory.isSymbolicLink() || !metadataDirectory.isDirectory()) {
      throw new Error("Checkpoint requires local .git and .learn-pi directories");
    }
    for (const file of [MARKER, MANIFEST]) {
      if (!(await lstat(path.join(this.root, file))).isFile()) throw new Error("Invalid checkpoint metadata");
    }
    const marker = JSON.parse(await readFile(path.join(this.root, MARKER), "utf8")) as WorkspaceMarker;
    if (marker.version !== 1 || marker.kind !== "learn-pi-disposable-workspace" || marker.root !== canonicalRoot ||
        typeof marker.workspaceId !== "string" || !/^[a-f0-9-]{36}$/u.test(marker.workspaceId)) {
      throw new Error("This is not the original marked disposable workspace");
    }
    const topLevel = (await git(this.root, ["rev-parse", "--show-toplevel"])).trim();
    if (await realpath(topLevel) !== canonicalRoot) throw new Error("Checkpoint Git root mismatch");
    return marker;
  }

  private async manifest(marker: WorkspaceMarker): Promise<Manifest> {
    const data = JSON.parse(await readFile(path.join(this.root, MANIFEST), "utf8")) as Manifest;
    if (data.version !== 1 || data.workspaceId !== marker.workspaceId || !Array.isArray(data.checkpoints)) throw new Error("Invalid checkpoint manifest");
    const seen = new Set<string>();
    for (const checkpoint of data.checkpoints) {
      if (!checkpoint || typeof checkpoint.id !== "string" || !/^cp-[a-f0-9-]{36}$/u.test(checkpoint.id) || seen.has(checkpoint.id) ||
          typeof checkpoint.commit !== "string" || !/^[a-f0-9]{40,64}$/u.test(checkpoint.commit) ||
          typeof checkpoint.label !== "string" || typeof checkpoint.createdAt !== "string" ||
          !Number.isSafeInteger(checkpoint.fileCount) || checkpoint.fileCount < 0) throw new Error("Invalid checkpoint record");
      seen.add(checkpoint.id);
    }
    return data;
  }

  list(): Promise<Checkpoint[]> {
    return this.serialize(async () => (await this.manifest(await this.verify())).checkpoints.map((checkpoint) => ({ ...checkpoint })));
  }

  create(label: string): Promise<Checkpoint> {
    return this.serialize(async () => {
      if (typeof label !== "string" || !label.trim() || label.length > 200 || /[\u0000-\u001f]/u.test(label)) throw new Error("Checkpoint label must contain 1–200 printable characters");
      const marker = await this.verify();
      const manifest = await this.manifest(marker);
      const files = await sampleFiles(this.root);
      const index = path.join(this.root, ".learn-pi", `index-${randomUUID()}`);
      try {
        await git(this.root, ["read-tree", "--empty"], { GIT_INDEX_FILE: index });
        for (const file of files) {
          validateSnapshotPath(file.relative);
          const hash = await hashBlob(this.root, await readFile(file.absolute));
          await git(this.root, ["update-index", "--add", "--cacheinfo", file.executable ? "100755" : "100644", hash, file.relative], { GIT_INDEX_FILE: index });
        }
        const tree = (await git(this.root, ["write-tree"], { GIT_INDEX_FILE: index })).trim();
        const commit = (await git(this.root, ["commit-tree", tree, "-m", `learn-pi: ${label.trim()}`])).trim();
        const checkpoint: Checkpoint = { id: `cp-${randomUUID()}`, label: label.trim(), createdAt: new Date().toISOString(), commit, fileCount: files.length };
        // A private ref keeps unreachable snapshot objects safe from Git GC.
        await git(this.root, ["update-ref", `refs/learn-pi/${checkpoint.id}`, commit]);
        manifest.checkpoints.push(checkpoint);
        await atomicWrite(path.join(this.root, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`);
        return { ...checkpoint };
      } finally { await rm(index, { force: true }); }
    });
  }

  restore(id: string): Promise<Checkpoint> {
    return this.serialize(async () => {
      const marker = await this.verify();
      const manifest = await this.manifest(marker);
      const checkpoint = manifest.checkpoints.find((candidate) => candidate.id === id);
      if (!checkpoint) throw new Error("Unknown checkpoint ID; arbitrary Git revisions are not accepted");
      const refCommit = (await git(this.root, ["rev-parse", `refs/learn-pi/${checkpoint.id}`])).trim();
      if (refCommit !== checkpoint.commit) throw new Error("Checkpoint ref does not match its manifest");
      const tree = await git(this.root, ["ls-tree", "-r", "-z", checkpoint.commit]);
      const snapshot: Array<{ relative: string; data: Buffer; mode: number }> = [];
      for (const line of tree.split("\0").filter(Boolean)) {
        const match = /^(100644|100755) blob ([a-f0-9]{40,64})\t([\s\S]+)$/u.exec(line);
        if (!match) throw new Error("Checkpoint tree contains unsupported entries");
        const relative = match[3]!;
        validateSnapshotPath(relative);
        const { stdout } = await run("git", ["-C", this.root, "cat-file", "blob", match[2]!], {
          env: gitEnvironment(this.root), encoding: "buffer", maxBuffer: 16 * 1024 * 1024,
        });
        snapshot.push({ relative, data: stdout, mode: match[1] === "100755" ? 0o755 : 0o644 });
      }
      if (snapshot.length !== checkpoint.fileCount) throw new Error("Checkpoint file count does not match its manifest");
      // Validate everything before the first mutation, including untracked links.
      const current = await sampleFiles(this.root);
      const containsProtectedEntry = async (directory: string): Promise<boolean> => {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
          const absolute = path.join(directory, entry.name);
          if (isProtectedRelativePath(path.relative(this.root, absolute))) return true;
          if (entry.isDirectory() && await containsProtectedEntry(absolute)) return true;
        }
        return false;
      };
      for (const file of snapshot) {
        const destination = path.join(this.root, file.relative);
        try {
          if ((await lstat(destination)).isDirectory() && await containsProtectedEntry(destination)) {
            throw new Error("Restore would replace a directory containing protected metadata or secrets");
          }
        } catch (error) {
          if (!["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) throw error;
        }
      }
      for (const file of current) await rm(file.absolute);
      // Removing empty directories permits file↔directory transitions. Protected
      // files remain in place, so a nonempty directory is deliberately retained.
      const prune = async (directory: string): Promise<void> => {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
          const absolute = path.join(directory, entry.name);
          if (isProtectedRelativePath(path.relative(this.root, absolute))) continue;
          if (entry.isDirectory()) {
            await prune(absolute);
            if ((await readdir(absolute)).length === 0) await rm(absolute, { recursive: true });
          }
        }
      };
      await prune(this.root);
      for (const file of snapshot) {
        const destination = path.resolve(this.root, file.relative);
        if (!isContained(this.root, destination)) throw new Error("Unsafe checkpoint destination");
        await mkdir(path.dirname(destination), { recursive: true });
        await writeFile(destination, file.data, { mode: file.mode });
        await chmod(destination, file.mode);
      }
      return { ...checkpoint };
    });
  }
}
