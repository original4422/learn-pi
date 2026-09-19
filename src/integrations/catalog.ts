/** A deliberately small, immutable dataset. The MCP server never accepts file paths. */
export const COURSE_CATALOG = [
  { id: "pi-core", title: "Pi built-in tools", topic: "runtime", summary: "Pi already supplies the model/tool loop, sessions, streaming, and read/write/edit/bash." },
  { id: "plan-execute", title: "Plan and execute", topic: "planning", summary: "The course adds a mode switch and a tool allowlist. A plan is not permission to write." },
  { id: "path-policy", title: "Paths and approvals", topic: "safety", summary: "Canonical path checks and approval hooks reduce mistakes. They are not an OS sandbox." },
  { id: "mcp", title: "Model Context Protocol", topic: "integration", summary: "A fixed, local stdio server exposes this read-only catalog using the official MCP TypeScript SDK." },
  { id: "subagents", title: "Read-only child sessions", topic: "agents", summary: "Researchers and reviewers use fresh Pi sessions, with at most two concurrent children and bounded budgets." },
  { id: "git-checkpoints", title: "Git checkpoints", topic: "coding", summary: "A Git checkpoint can restore sample files; a Pi conversation branch only changes conversation history." },
] as const;

export function searchCatalog(query: unknown) {
  if (typeof query !== "string" || query.trim().length === 0 || query.length > 200) {
    throw new Error("query must contain 1–200 characters and must not be blank");
  }
  const needle = query.trim().toLowerCase();
  return COURSE_CATALOG.filter((entry) => JSON.stringify(entry).toLowerCase().includes(needle));
}
