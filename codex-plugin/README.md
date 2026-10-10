# Search1API for Codex

Give Codex live access to the public web. Search1API lets Codex search the
web, read full pages, follow the news, explore a site's links, and see what is
trending on GitHub and Hacker News, then answer with citable sources.

## What's inside

- **Search1API MCP server**: the remote server at
  `https://mcp.search1api.com/mcp`, with six read-only tools: `search`,
  `ask`, `news`, `crawl`, `sitemap`, and `trending`.
- **`search1api` skill**: tells Codex when to search versus read a link, how
  to tune the number of results, recency, source, and site filters to the
  request, and how to cite sources in the answer.

## Use it

1. Add the marketplace and install the plugin:

   ```bash
   codex plugin marketplace add superagents-lab/search1api-mcp
   codex plugin add search1api@superagents-lab
   ```

2. Sign in with your Search1API account when prompted. New accounts at
   https://s1.dev include 100 free credits, no credit card required.
3. Ask things like:
   - "Research the latest changes to the MCP spec and cite your sources."
   - "Read https://modelcontextprotocol.io and summarize it."
   - "What AI news came out this week?"
   - "What's trending on GitHub right now?"

## Data

When Codex calls a tool, the plugin sends the tool's arguments (your search
query, filters, or the URL to read) to Search1API at `mcp.search1api.com` over
HTTPS, authenticated with your Search1API account through OAuth. Search1API
fetches public web content to answer and charges the request to your account's
credits. The tools only read public web content; they never post, change, or
delete anything. The plugin itself runs no local code and stores nothing.

Privacy policy: https://s1.dev/privacy · Docs:
https://s1.dev/docs/integrations/mcp · Support: sys@search1api.com

## License

MIT
