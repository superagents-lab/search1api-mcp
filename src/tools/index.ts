import type { Tool } from "@modelcontextprotocol/server";
import { SEARCH_UI_URI } from "../ui.js";
import { RENDER_INPUT_SCHEMA, RENDER_OUTPUT_SCHEMA } from "./render-results.js";

type OAuthTool = Tool & {
  securitySchemes: Array<{
    type: "oauth2";
    scopes: string[];
  }>;
};

const AUTHENTICATED_READ_ONLY_WEB: Pick<
  OAuthTool,
  "_meta" | "annotations" | "securitySchemes"
> = {
  // Authentication is required, but the API does not enforce a
  // resource-specific OAuth scope for these tools.
  securitySchemes: [
    {
      type: "oauth2",
      scopes: [],
    },
  ],
  _meta: {
    securitySchemes: [
      {
        type: "oauth2",
        scopes: [],
      },
    ],
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    // Every call is billed in credits, so a repeat is not free of effects.
    idempotentHint: false,
    openWorldHint: true,
  },
};

const CITABLE_RESULT_SCHEMA = {
  type: "object",
  properties: {
    id: {
      type: "string",
      description: "Stable identifier for this result; for web results this is the canonical URL",
    },
    title: {
      type: "string",
      description: "Human-readable result title",
    },
    url: {
      type: "string",
      format: "uri",
      description: "Canonical URL that clients can cite and users can open",
    },
    text: {
      type: "string",
      description: "Result snippet or extracted page text when available",
    },
    metadata: {
      type: "object",
      description: "Additional source metadata",
      additionalProperties: true,
    },
  },
  required: ["id", "title", "url"],
};

const SEARCH_OUTPUT_SCHEMA: NonNullable<Tool["outputSchema"]> = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: CITABLE_RESULT_SCHEMA,
    },
  },
  required: ["results"],
};

// Search tool definition
export const SEARCH_TOOL: OAuthTool = {
  name: "search",
  title: "Web search",
  description:
    "Search the live public web when the user needs current information, sources, or research. Returns citable results with id, title, URL, and text. Each result includes a URL that can be read in full.",
  ...AUTHENTICATED_READ_ONLY_WEB,
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Short, focused search query",
      },
      max_results: {
        type: "number",
        minimum: 1,
        maximum: 50,
        description: "How many results to return; keep it small unless the user wants a broad survey",
        default: 10,
      },
      search_service: {
        type: "string",
        description: "Search engine to use; choose one only when it matches the user's source intent",
        default: "google",
        enum: ["google", "bing", "bingcn", "duckduckgo", "yahoo", "yandex", "x", "reddit", "github", "youtube", "arxiv", "wechat", "bilibili", "imdb", "wikipedia", "grokipedia"],
      },
      page: {
        type: "number",
        minimum: 1,
        maximum: 100,
        description: "Fetch later pages of the same query; only bing, bingcn, baidu, and grokipedia paginate, other engines ignore it",
        default: 1,
      },
      crawl_results: {
        type: "number",
        minimum: 0,
        description: "How many top results to also read in full, so their text holds the whole page. Each successful page retrieval adds 1 credit to the base 1-credit search request",
        default: 0,
      },
      include_sites: {
        type: "array",
        items: {
          type: "string",
        },
        description: "Domains to include when the user explicitly scopes the search",
        default: [],
      },
      exclude_sites: {
        type: "array",
        items: {
          type: "string",
        },
        description: "Domains to exclude from the search",
        default: [],
      },
      time_range: {
        type: "string",
        description: "Optional recency window for time-sensitive searches",
        enum: ["day", "week", "month", "year"],
      },
    },
    required: ["query"],
  },
  outputSchema: SEARCH_OUTPUT_SCHEMA,
  _meta: {
    ...AUTHENTICATED_READ_ONLY_WEB._meta,
    "openai/toolInvocation/invoking": "Searching the web…",
    "openai/toolInvocation/invoked": "Search results",
  },
};

// News tool definition
export const NEWS_TOOL: OAuthTool = {
  name: "news",
  title: "News search",
  description:
    "Search current news when the user asks about recent events, announcements, or coverage. Returns citable article results with title, URL, snippet, and optional extracted text.",
  ...AUTHENTICATED_READ_ONLY_WEB,
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Short, focused news query",
      },
      max_results: {
        type: "number",
        minimum: 1,
        maximum: 50,
        description: "How many articles to return; keep it small unless the user wants broad coverage",
        default: 10,
      },
      search_service: {
        type: "string",
        description: "News engine to use; hackernews returns Hacker News discussions instead of publisher articles",
        default: "bing",
        enum: ["google", "bing", "duckduckgo", "yahoo", "hackernews"],
      },
      crawl_results: {
        type: "number",
        minimum: 0,
        description: "Number of top articles to retrieve as full pages. Each successful retrieval adds 1 credit to the base 1-credit news request",
        default: 0,
      },
      include_sites: {
        type: "array",
        items: {
          type: "string",
        },
        description: "News domains to include",
        default: [],
      },
      exclude_sites: {
        type: "array",
        items: {
          type: "string",
        },
        description: "News domains to exclude",
        default: [],
      },
      time_range: {
        type: "string",
        description: "Only return articles published within this window; use day for breaking news",
        enum: ["day", "week", "month", "year"],
      },
    },
    required: ["query"],
  },
  outputSchema: SEARCH_OUTPUT_SCHEMA,
  _meta: {
    ...AUTHENTICATED_READ_ONLY_WEB._meta,
    "openai/toolInvocation/invoking": "Searching news…",
    "openai/toolInvocation/invoked": "News results",
  },
};

// Crawl tool definition
export const CRAWL_TOOL: OAuthTool = {
  name: "crawl",
  title: "Read a web page",
  description:
    "Read a public web page supplied by the user or returned by search. Returns its title, URL, and main content as text, so you can answer from the full page instead of a snippet.",
  ...AUTHENTICATED_READ_ONLY_WEB,
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        format: "uri",
        description: "Address of the page to read, such as a link the user shared or a URL from search results",
      },
    },
    required: ["url"],
  },
  outputSchema: {
    type: "object",
    properties: {
      result: CITABLE_RESULT_SCHEMA,
    },
    required: ["result"],
  },
};

// Sitemap tool definition
export const SITEMAP_TOOL: OAuthTool = {
  name: "sitemap",
  title: "Discover links on a site",
  description:
    "Discover related public links from a page or domain when the user wants to explore a site's structure or available pages. Returns a list of absolute URLs found on that site, which can then be read with crawl.",
  ...AUTHENTICATED_READ_ONLY_WEB,
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        format: "uri",
        description: "Public page or domain URL whose links should be discovered",
      },
    },
    required: ["url"],
  },
  outputSchema: {
    type: "object",
    properties: {
      links: {
        type: "array",
        description: "Absolute URLs discovered on the site, without titles or page content",
        items: {
          type: "string",
          format: "uri",
        },
      },
    },
    required: ["links"],
  },
};

// Trending tool definition
export const TRENDING_TOOL: OAuthTool = {
  name: "trending",
  title: "Explore trending topics",
  description:
    "List currently trending repositories or stories from GitHub or Hacker News when the user asks what is popular now. Returns each item's title, URL, and a short description when the platform provides one.",
  ...AUTHENTICATED_READ_ONLY_WEB,
  inputSchema: {
    type: "object",
    properties: {
      search_service: {
        type: "string",
        description: "github for trending repositories, hackernews for top stories",
        enum: ["github", "hackernews"],
        default: "github",
      },
      max_results: {
        type: "number",
        minimum: 1,
        maximum: 50,
        description: "How many trending items to return",
        default: 10,
      },
    },
    required: ["search_service"],
  },
  outputSchema: {
    type: "object",
    properties: {
      results: {
        type: "array",
        description: "Trending items reported by the platform",
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "Repository name or story headline" },
            url: { type: "string", format: "uri", description: "Link to the repository or story" },
            description: { type: "string", description: "Repository summary or story context, when available" },
          },
          required: ["title", "url"],
        },
      },
    },
    required: ["results"],
  },
};

// Ask tool definition
export const ASK_TOOL: OAuthTool = {
  name: "ask",
  title: "Ask across the right sources",
  description:
    "Describe what you are looking for in natural language when you do not know which source to search. Search1API picks up to five engines (web, Hacker News, Reddit, GitHub, X, arXiv, Wikipedia, and more), infers a time window from phrases such as \"this week\", and returns at most 10 relevant results ranked by relevance. Costs 5 credits; use search when you already know the engine.",
  ...AUTHENTICATED_READ_ONLY_WEB,
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        maxLength: 500,
        description: "The request in natural language; platform hints (\"on Reddit\", \"papers\") and time hints (\"this week\") steer the search",
      },
    },
    required: ["query"],
  },
  outputSchema: {
    type: "object",
    properties: {
      intent: {
        type: "object",
        description: "Keywords, engines, and time window that were used",
        properties: {
          search_query: { type: "string" },
          sources: { type: "array", items: { type: "string" } },
          time_range: {
            type: ["string", "null"],
            enum: ["day", "week", "month", "year", null],
          },
        },
        required: ["search_query", "sources", "time_range"],
      },
      results: {
        type: "array",
        items: CITABLE_RESULT_SCHEMA,
      },
      errors: {
        type: "array",
        description: "Engines that failed while others completed",
        items: {
          type: "object",
          properties: {
            source: { type: "string" },
            message: { type: "string" },
          },
          required: ["source", "message"],
        },
      },
    },
    required: ["intent", "results", "errors"],
  },
};

export const RENDER_RESULTS_TOOL: OAuthTool = {
  name: "render_results",
  title: "Render the results",
  description: "Present already retrieved source results as source cards when the host supports UI, with a complete readable text list otherwise. Use when the user wants to browse sources or a visual list helps the task. Pass existing results in the desired order; never invent source URLs or factual titles. Does not search, crawl, fetch URLs, verify sources, or consume search credits. Do not call for intermediate research results or when a text answer is sufficient.",
  ...AUTHENTICATED_READ_ONLY_WEB,
  annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false, idempotentHint: true },
  inputSchema: RENDER_INPUT_SCHEMA,
  outputSchema: RENDER_OUTPUT_SCHEMA,
  _meta: {
    ...AUTHENTICATED_READ_ONLY_WEB._meta,
    "openai/toolInvocation/invoking": "Preparing results…",
    "openai/toolInvocation/invoked": "Results ready",
    ...(SEARCH_UI_URI && { ui: { resourceUri: SEARCH_UI_URI, visibility: ["model", "app"] } }),
  },
};

export const ALL_TOOLS = [
  SEARCH_TOOL,
  NEWS_TOOL,
  CRAWL_TOOL,
  SITEMAP_TOOL,
  TRENDING_TOOL,
  ASK_TOOL,
  RENDER_RESULTS_TOOL,
];
