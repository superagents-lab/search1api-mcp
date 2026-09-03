# Search1API MCP Server

[![smithery badge](https://smithery.ai/badge/superagents-lab/search1api-mcp)](https://smithery.ai/servers/superagents-lab/search1api-mcp)
[![Glama](https://img.shields.io/badge/Glama-listed-6C5CE7)](https://glama.ai/mcp/servers/superagents-lab/search1api-mcp)

[中文文档](./README_zh.md)

The official MCP server for [Search1API](https://s1.dev/?utm_source=mcp) — web search, news, page retrieval, sitemap discovery, and trending topics in one API.

## Authentication

- OAuth-aware clients can connect to the Remote MCP URL directly, then sign in and approve access in the browser.
- Existing integrations can continue to use an API key from the [Search1API dashboard](https://dashboard.search1api.com).
- Every MCP request — including tool discovery (`initialize`, `tools/list`) — requires a credential. Unauthenticated requests draw the OAuth challenge, which is how clients trigger sign-in; pre-connect inspection is served by the static [server card](https://mcp.search1api.com/.well-known/mcp/server-card.json) instead.

## Quick Start (Remote MCP)

No installation required. Configure your MCP client with the remote URL. Use OAuth when the client supports it, or provide an API key.

### Authentication

Three methods are supported — use whichever your client supports:

| Method | Format |
|--------|--------|
| OAuth 2.1 | Connect to `https://mcp.search1api.com/mcp` without a key and follow the client sign-in flow |
| Authorization Header | `Authorization: Bearer YOUR_SEARCH1API_KEY` |
| URL Query Parameter (legacy) | `https://mcp.search1api.com/mcp?apiKey=YOUR_SEARCH1API_KEY` |

Prefer OAuth or the Authorization header. Query-parameter credentials can be exposed in URLs, logs, and shell history.

### Claude Desktop

```json
{
  "mcpServers": {
    "search1api": {
      "url": "https://mcp.search1api.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_SEARCH1API_KEY"
      }
    }
  }
}
```

### Claude.ai (Web)

Settings > Connectors > Add custom connector:

```
https://mcp.search1api.com/mcp?apiKey=YOUR_SEARCH1API_KEY
```

### Cursor

Install as a Cursor plugin (recommended): this repo includes Agent Plugins `plugin.json` + `mcp.json` (portable) and `.cursor-plugin/plugin.json` (Cursor Marketplace metadata / logo) for Remote MCP with OAuth. Submit or install from [cursor.directory](https://cursor.directory) / the Cursor Marketplace, then sign in when prompted.

For local testing, copy the plugin files into `~/.cursor/plugins/local/search1api` (`plugin.json`, `.cursor-plugin/`, `mcp.json`, `assets/`). Do not symlink from outside that directory — Cursor rejects external symlink targets.

Or configure manually:

```json
{
  "mcpServers": {
    "search1api": {
      "url": "https://mcp.search1api.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_SEARCH1API_KEY"
      }
    }
  }
}
```

### VS Code

```json
{
  "servers": {
    "search1api": {
      "type": "http",
      "url": "https://mcp.search1api.com/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_SEARCH1API_KEY"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add --transport http search1api https://mcp.search1api.com/mcp \
  --header "Authorization: Bearer YOUR_SEARCH1API_KEY"
```

### Windsurf

```json
{
  "mcpServers": {
    "search1api": {
      "serverUrl": "https://mcp.search1api.com/mcp?apiKey=YOUR_SEARCH1API_KEY"
    }
  }
}
```

## Agent Skill

The Agent Skill has moved to [search1api-cli](https://github.com/superagents-lab/search1api-cli). Install it with:

```bash
npm install -g search1api-cli
npx skills add superagents-lab/search1api-cli
```

## Local Mode (stdio)

If you prefer to run the server locally, use Node.js 20 or newer with npx — no cloning required:

```json
{
  "mcpServers": {
    "search1api": {
      "command": "npx",
      "args": ["-y", "search1api-mcp"],
      "env": {
        "SEARCH1API_KEY": "YOUR_SEARCH1API_KEY"
      }
    }
  }
}
```

For self-hosted HTTP deployments behind a proxy, add any internal hostnames
that reach the Node.js process to the comma-separated `MCP_ALLOWED_HOSTS`
environment variable. `mcp.search1api.com` and localhost addresses are allowed
by default. Browser-based clients that send an `Origin` header must also have
their trusted origin hostnames added to the comma-separated
`MCP_ALLOWED_ORIGINS` variable. Requests from server-side MCP clients normally
omit `Origin` and do not require an entry.

## Tools

### search
Search the web using Search1API. Results include a citable
`id`/`title`/`url` structure. Pass a result URL to `crawl` when you need the
full page.

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `query` | Yes | - | Search query |
| `max_results` | No | 10 | Number of results |
| `search_service` | No | google | google, bing, duckduckgo, yahoo, x, reddit, github, youtube, arxiv, wechat, bilibili, imdb, wikipedia |
| `crawl_results` | No | 0 | Number of top results to crawl for full content; each successful crawl adds 1 credit to the base 1-credit search request |
| `include_sites` | No | [] | Sites to include |
| `exclude_sites` | No | [] | Sites to exclude |
| `time_range` | No | - | day, month, year |

### news
Search for news articles.

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `query` | Yes | - | Search query |
| `max_results` | No | 10 | Number of results |
| `search_service` | No | bing | google, bing, duckduckgo, yahoo, hackernews |
| `crawl_results` | No | 0 | Number of top results to crawl for full content; each successful crawl adds 1 credit to the base 1-credit news request |
| `include_sites` | No | [] | Sites to include |
| `exclude_sites` | No | [] | Sites to exclude |
| `time_range` | No | - | day, month, year |

### crawl
Extract content from a URL.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `url` | Yes | URL to crawl |

### sitemap
Get all related links from a URL.

| Parameter | Required | Description |
|-----------|----------|-------------|
| `url` | Yes | URL to get sitemap |

### trending
Get trending topics from popular platforms.

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `search_service` | Yes | - | github, hackernews |
| `max_results` | No | 10 | Number of items |

## Version History

- v0.6.1: Bug fix — MCP discovery (`initialize`, `tools/list`, `resources/*`, `prompts/list`, `server/discover`) requires a credential again. Serving it anonymously made clients that equate "tools listed" with "signed in" show a connected state with no way to trigger the OAuth flow; the 401 challenge now answers every unauthenticated request, restoring OAuth sign-in at connect time. Directory visibility is unchanged via the static server card and registry metadata
- v0.6.0: MCP discovery (`initialize`, `tools/list`, `resources/*`, `prompts/list`, `server/discover`) is served without a credential so clients and directories can enumerate tools before signing in; tool calls still require OAuth or an API key. Stdio mode starts without `SEARCH1API_KEY` and serves tool metadata, refusing only at call time. Malformed requests answer as JSON-RPC instead of an HTML error page
- v0.5.4: OAuth issuer moved to `clerk.s1.dev` and is configurable with `OAUTH_AUTHORIZATION_SERVER`; MCP server card published at `/.well-known/mcp/server-card.json`; OAuth discovery documents now send cache headers
- v0.5.3: OAuth resource and tool metadata no longer require OIDC session scopes; Smithery and Glama registry badges added
- v0.5.2: MCP `Origin` validation now runs before request parsing and authentication; self-hosted HTTP deployments can configure trusted browser origins with `MCP_ALLOWED_ORIGINS`
- v0.5.1: Documentation, LobeHub manifest, and MCP Registry metadata synchronized; `robots.txt` served on the transport host
- v0.5.0: MCP 2026-07-28 support with automatic protocol negotiation; stateless compatibility for 2025-era HTTP clients; request-level authentication
- v0.4.0: Structured output schemas, OAuth security schemes, safety annotations, and Official MCP Registry metadata
- v0.3.1: OAuth 2.1 support for Remote MCP; retired reasoning tool removed
- v0.3.0: Remote MCP support via Streamable HTTP; per-session API key authentication
- v0.2.0: Fallback `.env` support for LibreChat integration
- v0.1.8: X (Twitter) and Reddit search services
- v0.1.7: Trending tool for GitHub and Hacker News
- v0.1.6: Wikipedia search service
- v0.1.5: New search parameters and services (arxiv, wechat, bilibili, imdb)
- v0.1.3: News search
- v0.1.2: Sitemap
- v0.1.1: Web crawling
- v0.1.0: Initial release

## License

MIT
