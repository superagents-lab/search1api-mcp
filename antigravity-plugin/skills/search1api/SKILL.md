---
name: search1api
description: >
  Multi-engine web research through Search1API. Search general web engines and specialized sources such as GitHub, Reddit, X, arXiv, Wikipedia, YouTube, WeChat, and Bilibili; read pages, find news, explore site links, and answer with cited sources. Use when the user requests web research, a source-specific search, comparison across sources, fact-checking, current news, a URL summary, or GitHub and Hacker News trends.
---

# Search1API

Multi-engine web research through the Search1API MCP server bundled with this plugin.

## Tools

The current Search1API MCP server provides the tools below. Use the tools and
parameter values actually exposed by the connected host; a host may still list
an earlier server version. The host may prefix their names
(Antigravity namespaces them under the plugin's MCP server); the final names are:

| User intent | Tool |
|---|---|
| Search the web | `search` |
| Find the best sources when you don't know where to look | `ask` |
| Find recent news or coverage | `news` |
| Read a page the user shared, or the full page behind a result | `crawl` |
| Explore the links on a site or page | `sitemap` |
| See what is popular right now on GitHub or Hacker News | `trending` |
| Display selected existing sources | `render_results` |

If none of these tools are available, Search1API is not connected yet. Ask
the user to enable the Search1API plugin in Antigravity (**Customizations** >
**Installed**, or `/plugin` in the CLI) and sign in with their Search1API
account when the browser opens. New accounts
can register at https://s1.dev.

## Read a link, or search?

- The user shares a URL, or asks what a page says → `crawl` that URL and
  answer from its text. Don't search first.
- The user asks a question without a URL → `search` (or `news` for current
  events), then `crawl` the most relevant results when snippets aren't enough.
- The user asks how a site is organized or what pages it has → `sitemap`.

## Choose engines and compare sources

Use `search_service` to choose an engine or specialized source for each `search`
call. General web engines and community or content sources serve different
needs: use web engines for broad coverage, GitHub for repositories, Reddit or
X for discussions, arXiv for papers, and YouTube or Bilibili for videos.

For comparisons across sources, run a few targeted searches with different
`search_service` values, then compare and deduplicate the findings while
preserving their original URLs. A single `search` call uses one selected engine;
it does not automatically search every supported source. Only request engine
values present in the connected tool's schema.

## Search or ask?

- You know the engine and keywords (a plain web lookup, "on Reddit", "GitHub
  repos") → `search`. It costs 1 credit and returns that engine's ranking.
- A question that spans communities or sources and would require several
  searches ("what are developers saying about X this month", "recent papers and
  discussion on Y") → use `ask`, if available, with the user's request in natural
  language. It
  picks up to five engines and a time window, drops off-topic results, and
  returns at most 10. It costs 5 credits, so don't use it for a quick lookup.
  `intent` in the result shows which engines and window were used. If `ask` is
  unavailable, use targeted `search` calls across suitable engines instead.

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
  and `grokipedia` only.

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
  Search1API again from the plugin's MCP tab in Antigravity.
- **Insufficient credits** → tell the user their Search1API credits have run
  out and stop. Retrying returns the same error.
- **A page can't be read** (blocked, paywalled, or empty) → say which page
  failed and continue with the other sources.

## Present selected sources

If `render_results` is available, use it when the user wants to browse sources
or a source-card list helps their task. First retrieve and select results, then pass those existing
results in the desired order; combine multiple searches when useful. Copy source
titles and URLs, and use short original snippets rather than full crawled pages.
Rendering and expanding cards do not perform searches or consume search credits.

Skip rendering for intermediate research and when a normal cited answer is
sufficient. If the host does not expose `render_results`, present the selected
sources as a normal cited list. Clients without UI support receive a complete
readable source list from the renderer.
The remote endpoint needs no UI URL parameter. Rendering confirms that results
are prepared, not that the host displayed the UI.
