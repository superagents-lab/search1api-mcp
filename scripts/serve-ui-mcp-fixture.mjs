// Isolated UI test server. No keys, account data, or outbound API calls.
import express from 'express';
import { McpServer, createMcpHandler, fromJsonSchema } from '@modelcontextprotocol/server';
import { toNodeHandler } from '@modelcontextprotocol/node';
import { SEARCH_UI_URI, SEARCH_UI_META, MCP_APP_MIME_TYPE, readSearchUi } from '../build/ui.js';
import { SEARCH_TOOL, NEWS_TOOL } from '../build/tools/index.js';
const delayMs = Math.min(30_000, Math.max(0, Number(process.env.UI_FIXTURE_DELAY_MS ?? 15_000)));
const record = (event, extra = {}) => console.log(JSON.stringify({ at: new Date().toISOString(), event, ...extra }));
const resultsFor = (kind, count) => Array.from({ length: count }, (_, i) => ({
  id: `fixture-${kind}-${i}`, title: `${kind === 'news' ? 'News' : 'Web'} example ${i + 1}`,
  url: `https://example.com/${kind}/${i + 1}`, text: 'Synthetic UI test result; not a real search.',
  ...(kind === 'news' && i % 3 !== 2 ? { metadata: { published_date: i % 3 === 0 ? '2026-10-12T08:30:00Z' : 'Oct 11, 2026' } } : {}),
}));
const handler = createMcpHandler(() => {
  const server = new McpServer({ name: 'FAT1909 UI fixture', version: '0.2.0' });
  for (const tool of [SEARCH_TOOL, NEWS_TOOL]) {
    const { securitySchemes: _auth, ...meta } = tool._meta;
    server.registerTool(tool.name, {
      title: tool.title,
      description: `UI verification only: synthetic ${tool.name} results after a controlled delay. No real searches, account data, or credits.`,
      inputSchema: fromJsonSchema(tool.inputSchema),
      outputSchema: fromJsonSchema(tool.outputSchema),
      annotations: { title: tool.title, readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: meta,
    }, async ({ max_results = 8 }) => {
      record('tool-start', { tool: tool.name, delayMs });
      await new Promise(resolve => setTimeout(resolve, delayMs));
      const results = resultsFor(tool.name, max_results);
      record('tool-result', { tool: tool.name, count: results.length });
      return { structuredContent: { results }, content: [{ type: 'text', text: JSON.stringify({ results }) }] };
    });
  }
  server.registerTool('preview_search_results', {
    title: 'Preview synthetic source cards',
    description: 'UI verification only. Returns synthetic source cards; it does not search the web or consume credits.',
    inputSchema: fromJsonSchema({ type: 'object', properties: { count: { type: 'integer', minimum: 0, maximum: 50, default: 4 } } }),
    annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
    _meta: { ui: { resourceUri: SEARCH_UI_URI } },
  }, async ({ count = 4 }) => {
    const results = resultsFor('search', count);
    return { structuredContent: { results }, content: [{ type: 'text', text: JSON.stringify({ results }) }] };
  });
  server.registerResource('search-ui', SEARCH_UI_URI, { mimeType: MCP_APP_MIME_TYPE }, async () => {
    record('resource-read', { uri: SEARCH_UI_URI });
    return { contents: [{ uri: SEARCH_UI_URI, mimeType: MCP_APP_MIME_TYPE, text: readSearchUi(), _meta: SEARCH_UI_META }] };
  });
  return server;
});
const app = express();
app.all('/mcp', toNodeHandler(handler));
app.listen(5200, '127.0.0.1', () => record('listening', { url: 'http://127.0.0.1:5200/mcp', delayMs, ui: SEARCH_UI_URI }));
