# 05 · Connect a real local MCP service

<p class="eyebrow">STAGE 05 / A PORTABLE PROTOCOL DOES NOT CREATE TRUST</p>

This chapter connects a course-catalog service. The model can search concepts, and a separate local process returns results over MCP. The dataset is fixed, but the requests are real: initialization, discovery, and tool calls use the protocol.

## No-key stage experiment

This runs real Pi with a scripted provider in a fresh exercise workspace and asserts this stage’s behavior. It makes no remote model request.

```sh
npm run stage -- --stage 5
```

## Pi already has tools; what does MCP add?

A Pi extension can register a function directly. That is often best when only this extension needs it. MCP adds a cross-process, cross-client tool contract so multiple hosts can use the same service. It does not replace Pi's loop, and the course does not assume a general MCP client is built into this pinned Pi release.

We bridge using the official MCP TypeScript SDK. `examples/mcp-server.ts` is the server, `src/integrations/mcp.ts` contains the client and Pi adapter, and `src/integrations/catalog.ts` holds the fixed data. The model sees `catalog_search`, never arbitrary process-launch arguments.

## Follow a request across boundaries

```text
Pi catalog_search({query})
  → CatalogMcpClient
  → stdio subprocess (examples/mcp-server.ts)
  → MCP callTool
  → text / isError
  → Pi tool result
```

The client uses a fixed Node executable and repository server script. A query cannot replace the launch command, and project configuration cannot silently select a different server. Standard output belongs to the stdio protocol; casual debug logging would corrupt it.

The actual request has this shape:

```ts
const result = await this.client.callTool(
  { name: "catalog_search", arguments: { query } },
  undefined,
  { timeout: this.timeoutMs, signal },
);
```

Transport success alone is insufficient. MCP's `isError` needs handling too, alongside timeouts, invalid arguments, cancellation, and process cleanup.

## Run stage 5

```sh
npm run agent -- --stage 5 --workspace examples/workspaces/todo
```

Ask: “Search the course catalog for approval and identify the chapter that separates application policy from OS sandboxing.” Observe the tool name and returned entries. A fixed read-only catalog is allowed during planning.

Without model credentials, run:

```sh
npm test
npm run test:integration
```

`tests/integrations.test.ts` uses the real MCP SDK and local server to check discovery and requests, independently of whether a model chooses the right tool. The quality of that choice requires a separate live-model evaluation.

## Three implementation decisions

**A bounded schema.** Queries must be nonblank strings of 1–200 characters; extra fields are rejected. MCP annotations can express read-only intent, but they do not enforce permissions. This server is read-only because its implementation only queries fixed data.

**Explicit cleanup.** The Pi adapter calls `client.close()` in `finally`, releasing the subprocess after success, errors, and cancellation. Cleanup should not depend on the parent eventually exiting.

**Output remains data.** Text returned by a server does not gain instruction authority. “Ignore previous rules” remains untrusted content. The model receives catalog output as evidence; a production service requires its own review of permissions, contents, and data exposure.

## Failure experiments and completion

Try an empty query, an oversized query, and a call after client closure. Expect explicit failure instead of a normal-looking empty response. Confirm that tests leave no catalog server process behind. If the model does not call the tool, test the client directly to separate protocol failures from model selection.

**Completion criterion:** perform real MCP discovery and calls without a key; surface failures; close resources; avoid treating read-only annotations as proof of enforcement.

## Design connection, and when not to use MCP

Codex publicly supports MCP, making it a representative integration pattern for coding agents. [Codex MCP documentation](https://learn.chatgpt.com/docs/extend/mcp)

This course implements one fixed local service rather than remote OAuth, server management, or product configuration interfaces. When a capability already has a stable CLI, invoking it with fixed arguments may be simpler and easier to diagnose. Add MCP when multiple hosts benefit from sharing a tool contract.
