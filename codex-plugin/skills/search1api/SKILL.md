---
name: search1api
description: >
  Live web research through the Search1API MCP server: search the web, read a page, find recent news, explore a site's links, and see what is trending, then answer with cited sources. Use whenever the user wants to search the web, look something up, research a topic, fact-check a claim, read or summarize a URL, check current news, explore a site, or see what is popular on GitHub or Hacker News. Trigger on phrases like "search for", "look up", "find out about", "what's happening with", "any news on", "latest on", "what does this link say", "read this page", "summarize this URL", "what's trending", "搜一下", "查一下", "最新消息", "总结这个链接", or when the user shares a bare URL.
---

# Search1API

Live web research through the Search1API MCP server bundled with this plugin.

## Tools

The Search1API MCP server exposes six read-only tools. The host may prefix
their names (for example `mcp__search1api__search`); the final names are:

| User intent | Tool |
|---|---|
| Search the web | `search` |
| Find the best sources when you don't know where to look | `ask` |
| Find recent news or coverage | `news` |
| Read a page the user shared, or the full page behind a result | `crawl` |
| Explore the links on a site or page | `sitemap` |
| See what is popular right now on GitHub or Hacker News | `trending` |

If none of these tools are available, Search1API is not connected yet. Ask
the user to sign in to Search1API from this plugin (in Codex, `/mcp` shows
whether the server is connected) with their Search1API account. New accounts
at https://s1.dev include free credits.

## Read a link, or search?

- The user shares a URL, or asks what a page says → `crawl` that URL and
  answer from its text. Don't search first.
- The user asks a question without a URL → `search` (or `news` for current
  events), then `crawl` the most relevant results when snippets aren't enough.
- The user asks how a site is organized or what pages it has → `sitemap`.

## Search or ask?

- You know the engine and keywords (a plain web lookup, "on Reddit", "GitHub
  repos") → `search`. It costs 1 credit and returns that engine's ranking.
- The question spans communities or sources and you would otherwise run several
  searches ("what are developers saying about X this month", "recent papers and
  discussion on Y") → `ask` with the user's request in natural language. It
  picks up to five engines and a time window, drops off-topic results, and
  returns at most 10. It costs 5 credits, so don't use it for a quick lookup.
  `intent` in the result shows which engines and window were used.

## Tune the parameters to the request

Don't call every tool with defaults. Match the request:

- **Quick lookup** ("what is X", "search for X") → `max_results: 5`, no crawling.
- **Research** ("research X", "compare", "comprehensive") → `max_results: 10–15`,
  then `crawl` the 3–5 most relevant results before answering.
- **User asks for a number** ("find 10 articles") → set `max_results` to it.
- **Recency** ("latest", "this week", "today") → `time_range: "day"`,
  `"week"`, or `"month"`. For breaking news use `news` with `time_range: "day"`.
- **Source intent** ("on Reddit", "GitHub repos", "papers", "videos") → set
  `search_service` to `reddit`, `github`, `arxiv`, `youtube`, and so on. Leave
  it unset otherwise.
- **Site scope** ("only from arxiv.org", "not from Medium") → `include_sites` /
  `exclude_sites` with bare domains.
- **Chinese queries** → `google` or `bing` for general results, `bingcn` for
  mainland-China web results, `wechat` for WeChat articles, `bilibili` for
  Bilibili videos.
- **Russian-language queries** → `yandex`.
- **Encyclopedia lookups** → `wikipedia`, or `grokipedia` with an English
  query. When the answer uses Grokipedia results, note "Powered by xAI".
- **More results from the same engine** → `page: 2` and up, on `bing`, `bingcn`,
  `baidu`, and `grokipedia` only.

`search_service` values for `search`: google, bing, bingcn, duckduckgo, yahoo,
yandex, x, reddit, github, youtube, arxiv, wechat, bilibili, imdb, wikipedia,
grokipedia.
For `news`: google, bing, duckduckgo, yahoo, hackernews.
For `trending`: github, hackernews.

### Credits

Each `search` or `news` call costs 1 credit, plus 1 per page when
`crawl_results` is above 0. Each `crawl` costs 1 credit. Each `ask` costs 5
credits. Prefer a few targeted
`crawl` calls on the best results over a large `crawl_results` value.

## Answer with sources

1. Synthesize what the pages say; don't paste raw tool output.
2. Cite every factual claim with the result's URL, using its title as the link
   text.
3. Say when sources disagree, and prefer primary sources (official docs,
   papers, the project's own site) over aggregators.
4. For time-sensitive topics, state how recent the sources are; results carry
   `published_date` in their metadata when the source exposes one.
5. If the results don't answer the question, say so and suggest a narrower or
   differently worded search instead of guessing.

## Errors

- **Authentication required or expired** → ask the user to sign in to
  Search1API again from this plugin.
- **Insufficient credits** → tell the user their Search1API credits have run
  out and stop. Retrying returns the same error.
- **A page can't be read** (blocked, paywalled, or empty) → say which page
  failed and continue with the other sources.
