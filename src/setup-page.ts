import { ALL_TOOLS } from "./tools/index.js";

const MCP_URL = "https://mcp.search1api.com/mcp";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * Human-readable setup instructions served when a browser opens the MCP URL.
 * MCP clients never see this page: they POST, or GET with text/event-stream,
 * and still receive the 401 challenge that starts OAuth.
 */
export function renderSetupPage(): string {
  const tools = ALL_TOOLS.map(
    (tool) => `<li><code>${escapeHtml(tool.name)}</code> ${escapeHtml(tool.title ?? "")}</li>`
  ).join("");
  const cursorConfig = escapeHtml(
    JSON.stringify({ mcpServers: { search1api: { url: MCP_URL } } }, null, 2)
  );

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Search1API MCP Server: setup</title>
<link rel="canonical" href="https://s1.dev/mcp-server">
<style>
body{font:16px/1.6 system-ui,sans-serif;max-width:720px;margin:0 auto;padding:24px 16px;color:#111;background:#fff}
pre,code{font-family:ui-monospace,monospace;font-size:14px}
pre{background:#f4f4f5;padding:12px;border-radius:8px;overflow-x:auto}
a{color:#1d4ed8}
@media (prefers-color-scheme:dark){body{color:#eee;background:#111}pre{background:#222}a{color:#93c5fd}}
</style>
</head>
<body>
<h1>Search1API MCP Server</h1>
<p>This is a remote MCP endpoint for AI clients, not a web page. Add this URL to your MCP client:</p>
<pre>${MCP_URL}</pre>
<h2>Sign in</h2>
<p>Connect without a key and your client will open the Search1API sign-in (OAuth). Or send an API key from <a href="https://app.s1.dev">your dashboard</a> as <code>Authorization: Bearer YOUR_SEARCH1API_KEY</code>.</p>
<h2>Clients</h2>
<p><strong>Claude.ai</strong>: install Search1API from the <a href="https://claude.ai/directory/search1api">Claude directory</a> and click Connect.</p>
<p><strong>Claude Code</strong>:</p>
<pre>claude mcp add --transport http search1api ${MCP_URL}</pre>
<p><strong>Cursor, Windsurf, Claude Desktop and other clients</strong> (mcp.json):</p>
<pre>${cursorConfig}</pre>
<h2>Tools</h2>
<ul>${tools}</ul>
<p>Full guide: <a href="https://s1.dev/mcp-server">s1.dev/mcp-server</a></p>
</body>
</html>`;
}
