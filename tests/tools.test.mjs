import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { ErrorCode, McpError } from "@modelcontextprotocol/sdk/types.js";

process.env.SEARCH1API_KEY = "test-key";

const { createMcpServer } = await import("../build/server.js");
const { handleToolCall } = await import("../build/tools/handlers.js");
const { ALL_TOOLS } = await import("../build/tools/index.js");
const { RESOURCES } = await import("../build/resources.js");
const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
);
const marketplaceManifest = JSON.parse(
  readFileSync(new URL("../lhm.plugin.json", import.meta.url), "utf8")
);

test("exports only supported public tools", () => {
  assert.deepEqual(
    ALL_TOOLS.map((tool) => tool.name),
    ["search", "fetch", "news", "crawl", "sitemap", "trending"]
  );
  assert.equal(
    existsSync(new URL("../build/tools/reasoning.js", import.meta.url)),
    false
  );
});

test("lists the supported tools over MCP", async (context) => {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createMcpServer("test-key");
  const client = new Client({ name: "search1api-mcp-test", version: "1.0.0" });

  context.after(async () => {
    await client.close();
    await server.close();
  });

  await server.connect(serverTransport);
  await client.connect(clientTransport);

  const result = await client.listTools();
  assert.equal(client.getServerVersion()?.version, packageJson.version);
  assert.deepEqual(
    result.tools.map((tool) => tool.name),
    ["search", "fetch", "news", "crawl", "sitemap", "trending"]
  );
  assert.equal(result.tools[0].title, "Search the web");
  assert.deepEqual(result.tools[0]._meta.securitySchemes, [
    { type: "oauth2", scopes: ["openid", "offline_access"] },
  ]);
  assert.deepEqual(result.tools[0].outputSchema.required, ["results"]);
});

test("advertises directory-ready metadata and search/fetch compatibility", () => {
  for (const tool of ALL_TOOLS) {
    assert.equal(typeof tool.title, "string");
    assert.equal(tool.annotations?.readOnlyHint, true);
    assert.equal(tool.annotations?.destructiveHint, false);
    assert.equal(tool.annotations?.openWorldHint, true);
    assert.deepEqual(tool.securitySchemes, [
      { type: "oauth2", scopes: ["openid", "offline_access"] },
    ]);
    assert.deepEqual(tool._meta.securitySchemes, tool.securitySchemes);
    assert.equal(tool.outputSchema?.type, "object");
  }

  const search = ALL_TOOLS.find((tool) => tool.name === "search");
  const fetch = ALL_TOOLS.find((tool) => tool.name === "fetch");
  assert.deepEqual(search.inputSchema.required, ["query"]);
  assert.deepEqual(search.outputSchema.required, ["results"]);
  assert.deepEqual(fetch.inputSchema.required, ["id"]);
  assert.deepEqual(fetch.outputSchema.required, [
    "id",
    "title",
    "text",
    "url",
  ]);
});

test("rejects retired or unknown tools before making an API request", async () => {
  await assert.rejects(
    handleToolCall("reasoning", {}),
    (error) =>
      error instanceof McpError &&
      error.code === ErrorCode.InvalidParams &&
      error.message.includes("Unknown tool: reasoning")
  );
});

test("keeps the LobeHub marketplace manifest aligned with the server", () => {
  assert.equal(
    marketplaceManifest.identifier,
    "fatwang2-search1api-mcp"
  );
  assert.equal(marketplaceManifest.version, packageJson.version);
  assert.deepEqual(marketplaceManifest.tools, ALL_TOOLS);
  assert.deepEqual(marketplaceManifest.resources, RESOURCES);
  assert.match(marketplaceManifest.description, /OAuth 2\.1/);
  assert.doesNotMatch(
    JSON.stringify(marketplaceManifest),
    /reasoning|deepseek/i
  );
});
