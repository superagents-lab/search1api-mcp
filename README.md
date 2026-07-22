# Search1API MCP Server

[中文文档](./README_zh.md)

The official MCP server for [Search1API](https://www.search1api.com/?utm_source=mcp) — web search, news, crawling, and more in one API.

## Authentication

- OAuth-aware clients can connect to the Remote MCP URL directly, then sign in and approve access in the browser.
- Existing integrations can continue to use an API key from the [Search1API dashboard](https://dashboard.search1api.com).

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

If you prefer to run the server locally, use npx — no cloning required:

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

## Tools

### search
Search the web using Search1API.

| Parameter | Required | Default | Description |
|-----------|----------|---------|-------------|
| `query` | Yes | - | Search query |
| `max_results` | No | 10 | Number of results |
| `search_service` | No | google | google, bing, duckduckgo, yahoo, x, reddit, github, youtube, arxiv, wechat, bilibili, imdb, wikipedia |
| `crawl_results` | No | 0 | Number of results to crawl for full content |
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
| `crawl_results` | No | 0 | Number of results to crawl for full content |
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
