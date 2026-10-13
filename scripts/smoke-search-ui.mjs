// Read metadata/resources and render supplied synthetic sources without paid calls.
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
const client = new Client({ name: "render-smoke", version: "1.0.0" });
await client.connect(new StdioClientTransport({ command: "node", args: ["build/index.js"], stderr: "ignore", env: { ...process.env, SEARCH1API_KEY: "local-render-smoke" } }));
try {
  const { tools } = await client.listTools();
  const renderer = tools.find(tool => tool.name === "render_results");
  if (tools.filter(tool => tool._meta?.ui?.resourceUri).length !== 1) throw new Error("Only render_results should link to UI");
  const [resource] = (await client.readResource({ uri: renderer._meta.ui.resourceUri })).contents;
  console.log(JSON.stringify({ tool: renderer.name, uri: resource.uri, mimeType: resource.mimeType, bytes: resource.text.length }));
  const result = await client.callTool({ name: "render_results", arguments: { results: [{ title: "Synthetic source", url: "https://example.com/source" }] } });
  if (result.isError || result.structuredContent?.total !== 1 || !result.content[0].text.includes("https://example.com/source")) throw new Error("Rendering fallback failed");
  console.log("Synthetic rendering and text fallback passed; no search executed.");
} finally { await client.close(); }
