// Smoke-test the search MCP App over real stdio: tool metadata, UI resource, live call.
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const client = new Client({ name: "smoke", version: "0.0.0" });
await client.connect(
  new StdioClientTransport({ command: "node", args: ["build/index.js"], stderr: "ignore" })
);

const { tools } = await client.listTools();
const search = tools.find((tool) => tool.name === "search");
console.log("search _meta:", JSON.stringify(search?._meta));
const news = tools.find((tool) => tool.name === "news");
if (news?._meta?.ui?.resourceUri !== search?._meta?.ui?.resourceUri) throw new Error("News and search must share the result view");
console.log("news shares search UI:", !!news?._meta?.ui?.resourceUri);

const { resources } = await client.listResources();
console.log("resources:", resources.map((r) => `${r.uri} ${r.mimeType}`));

const ui = await client.readResource({ uri: search._meta.ui.resourceUri });
const [content] = ui.contents;
console.log("ui resource:", content.mimeType, content.text.length, "chars", JSON.stringify(content._meta));

if (process.argv[2]) {
  const result = await client.callTool({
    name: "search",
    arguments: { query: process.argv[2], max_results: 6 },
  });
  const results = result.structuredContent?.results ?? [];
  console.log("isError:", !!result.isError, "results:", results.length);
  for (const item of results) console.log(" -", item.title, item.url);
}
await client.close();
