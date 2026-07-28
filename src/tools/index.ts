import { Tool } from "@modelcontextprotocol/sdk/types.js";

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
  securitySchemes: [
    {
      type: "oauth2",
      scopes: ["openid", "offline_access"],
    },
  ],
  _meta: {
    securitySchemes: [
      {
        type: "oauth2",
        scopes: ["openid", "offline_access"],
      },
    ],
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
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

const FETCH_OUTPUT_SCHEMA: NonNullable<Tool["outputSchema"]> = {
  type: "object",
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    text: { type: "string" },
    url: { type: "string", format: "uri" },
    metadata: {
      type: "object",
      additionalProperties: true,
    },
  },
  required: ["id", "title", "text", "url"],
};

// Search tool definition
export const SEARCH_TOOL: OAuthTool = {
  name: "search",
  title: "Search the web",
  description:
    "Search the live public web when the user needs current information, sources, or research. Returns citable results with id, title, URL, and text. Pass a result id to fetch to retrieve the full page.",
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
        description: "Maximum number of results to return",
        default: 10,
      },
      search_service: {
        type: "string",
        description: "Search engine to use; choose one only when it matches the user's source intent",
        default: "google",
        enum: ["google", "bing", "duckduckgo", "yahoo", "x", "reddit", "github", "youtube", "arxiv", "wechat", "bilibili", "imdb", "wikipedia"],
      },
      crawl_results: {
        type: "number",
        minimum: 0,
        description: "Number of top results to retrieve as full pages. Each successful page retrieval adds 1 credit to the base 1-credit search request",
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
        enum: ["day", "month", "year"],
      },
    },
    required: ["query"],
  },
  outputSchema: SEARCH_OUTPUT_SCHEMA,
};

// Fetch tool definition for ChatGPT deep research and company knowledge.
export const FETCH_TOOL: OAuthTool = {
  name: "fetch",
  title: "Fetch a search result",
  description:
    "Retrieve the full readable contents of a result returned by search. Pass the result id, which is the canonical page URL. Returns id, title, full text, URL, and metadata.",
  ...AUTHENTICATED_READ_ONLY_WEB,
  inputSchema: {
    type: "object",
    properties: {
      id: {
        type: "string",
        description: "Result id returned by search; for web results this is the canonical URL",
      },
    },
    required: ["id"],
  },
  outputSchema: FETCH_OUTPUT_SCHEMA,
};

// News tool definition
export const NEWS_TOOL: OAuthTool = {
  name: "news",
  title: "Search current news",
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
        description: "Maximum number of articles to return",
        default: 10,
      },
      search_service: {
        type: "string",
        description: "News search engine to use",
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
        description: "Optional recency window; use day for breaking news",
        enum: ["day", "month", "year"],
      },
    },
    required: ["query"],
  },
  outputSchema: SEARCH_OUTPUT_SCHEMA,
};

// Crawl tool definition
export const CRAWL_TOOL: OAuthTool = {
  name: "crawl",
  title: "Read a web page",
  description:
    "Extract the readable title and full text from a specific public URL supplied by the user. Use fetch instead when following a result returned by search.",
  ...AUTHENTICATED_READ_ONLY_WEB,
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        format: "uri",
        description: "Public HTTP or HTTPS URL to retrieve",
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
    "Discover related public links from a page or domain when the user wants to explore a site's structure or available pages.",
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
    "List currently trending repositories or stories from GitHub or Hacker News when the user asks what is popular now.",
  ...AUTHENTICATED_READ_ONLY_WEB,
  inputSchema: {
    type: "object",
    properties: {
      search_service: {
        type: "string",
        description: "Platform whose trending items should be returned",
        enum: ["github", "hackernews"],
        default: "github",
      },
      max_results: {
        type: "number",
        minimum: 1,
        maximum: 50,
        description: "Maximum number of trending items to return",
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
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            url: { type: "string", format: "uri" },
            description: { type: "string" },
          },
          required: ["title", "url"],
        },
      },
    },
    required: ["results"],
  },
};

export const ALL_TOOLS = [
  SEARCH_TOOL,
  FETCH_TOOL,
  NEWS_TOOL,
  CRAWL_TOOL,
  SITEMAP_TOOL,
  TRENDING_TOOL,
];
