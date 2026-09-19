/**
 * Real MCP stdio server. stdout is reserved for JSON-RPC, never logging.
 * Run: node --import tsx examples/mcp-server.ts
 * This trusted course server serves immutable data; it has no filesystem tool.
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { searchCatalog } from "../src/integrations/catalog.js";

const server = new Server(
  { name: "learn-pi-catalog", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: "catalog_search",
    description: "Search the immutable learn-pi course catalog (read-only, no network or filesystem access).",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", minLength: 1, maxLength: 200 } },
      required: ["query"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    if (request.params.name !== "catalog_search") throw new Error("Unknown catalog tool");
    const args = request.params.arguments;
    if (!args || Object.keys(args).some((key) => key !== "query")) {
      throw new Error("Expected only the query argument");
    }
    const matches = searchCatalog(args.query);
    return { content: [{ type: "text", text: JSON.stringify({ matches }) }], isError: false };
  } catch (error) {
    return {
      content: [{ type: "text", text: error instanceof Error ? error.message : "Invalid catalog request" }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
// StdioServerTransport reacts to input; close explicitly on stdin EOF as well.
process.stdin.once("end", () => { void server.close(); });
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => { void server.close().finally(() => process.exit(0)); });
}
