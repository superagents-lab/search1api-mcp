# Search1API

Multi-engine web search for Antigravity agents. Search Google, Bing, DuckDuckGo, Yahoo, and specialized sources such as GitHub, Reddit, X, arXiv, Wikipedia, YouTube, WeChat, and Bilibili; read full pages, search current news, discover site links, and see what is trending on GitHub and Hacker News. Results include source URLs for citation.

## Setup

1. Install the plugin and enable it.
2. When the Search1API MCP server first connects, Antigravity opens your browser. Sign in with your Search1API account, or create one at [s1.dev](https://s1.dev).

No API key is needed: the plugin connects to the hosted server at `https://mcp.search1api.com/mcp` and signs in with OAuth.

## What's included

- **MCP server** `search1api`: web search, source-aware search across communities, news, page reading, site link discovery, GitHub and Hacker News trends, and source cards for browsing selected results.
- **Skill** `search1api`: tells the agent when to read a link versus search, how to pick engines and compare sources, and how to cite results. Run it directly with `/search1api`.

## Example prompts

- Compare what GitHub, Reddit, and X say about the best Rust web framework, with sources
- Find this week's top news on AI coding agents and cite each source
- Read https://s1.dev/pricing and summarize the plans

## Pricing and support

Search1API is billed in credits on your Search1API account; see [s1.dev/pricing](https://s1.dev/pricing). Documentation: [s1.dev/docs/integrations/antigravity](https://s1.dev/docs/integrations/antigravity). Support: [s1.dev/contact](https://s1.dev/contact).
