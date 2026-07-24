import { Tool } from "@modelcontextprotocol/sdk/types.js";

// Search tool definition
export const SEARCH_TOOL: Tool = {
  name: "search",
  description: "Web search tool",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query, be simple and concise"
      },
      max_results: {
        type: "number",
        description: "Maximum number of results to return",
        default: 10
      },
      search_service: {
        type: "string",
        description: "Specify the search engine to use. Choose based on your specific needs",
        default: "google",
        enum: ["google", "bing", "duckduckgo", "yahoo", "x", "reddit", "github", "youtube", "arxiv", "wechat", "bilibili", "imdb", "wikipedia"]
      },
      crawl_results: {
        type: "number",
        description: "Number of top results to crawl for full webpage content. Each successfully crawled page adds 1 credit to the base 1-credit search request",
        default: 0
      },
      include_sites: {
        type: "array",
        items: {
          type: "string"
        },
        description: "List of sites to include in search. Only use when you need special results from sites not available in search_service",
        default: []
      },
      exclude_sites: {
        type: "array",
        items: {
          type: "string"
        },
        description: "List of sites to exclude from search. Only use when you need to explicitly filter out specific domains from results",
        default: []
      },
      time_range: {
        type: "string",
        description: "Time range for search results, only use when specific time constraints are required",
        enum: ["day", "month", "year"]
      }
    },
    required: ["query"]
  }
};

// News tool definition
export const NEWS_TOOL: Tool = {
  name: "news",
  description: "News search tool",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query, be simple and concise"
      },
      max_results: {
        type: "number",
        description: "Maximum number of results to return",
        default: 10
      },
      search_service: {
        type: "string",
        description: "Specify the news engine to use. Choose based on your specific needs",
        default: "bing",
        enum: ["google", "bing", "duckduckgo", "yahoo", "hackernews"]
      },
      crawl_results: {
        type: "number",
        description: "Number of top results to crawl for full webpage content. Each successfully crawled page adds 1 credit to the base 1-credit news request",
        default: 0
      },
      include_sites: {
        type: "array",
        items: {
          type: "string"
        },
        description: "List of sites to include in search. Only use when you need special results from sites not available in search_service",
        default: []
      },
      exclude_sites: {
        type: "array",
        items: {
          type: "string"
        },
        description: "List of sites to exclude from search. Only use when you need to explicitly filter out specific domains from results",
        default: []
      },
      time_range: {
        type: "string",
        description: "Time range for search results, only use when specific time constraints are required",
        enum: ["day", "month", "year"]
      }
    },
    required: ["query"]
  }
};

// Crawl tool definition
export const CRAWL_TOOL: Tool = {
  name: "crawl",
  description: "Extract content from URL",
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "URL to crawl"
      }
    },
    required: ["url"]
  }
};

// Sitemap tool definition
export const SITEMAP_TOOL: Tool = {
  name: "sitemap",
  description: "Get all related links from a URL",
  inputSchema: {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "URL to get sitemap"
      }
    },
    required: ["url"]
  }
};

// Trending tool definition
export const TRENDING_TOOL: Tool = {
  name: "trending",
  description: "Get trending topics from popular platforms",
  inputSchema: {
    type: "object",
    properties: {
      search_service: {
        type: "string",
        description: "Specify the platform to get trending topics from",
        enum: ["github", "hackernews"],
        default: "github"
      },
      max_results: {
        type: "number",
        description: "Maximum number of trending items to return",
        default: 10
      }
    },
    required: ["search_service"]
  }
};

// Export all tools
export const ALL_TOOLS = [
  SEARCH_TOOL,
  NEWS_TOOL,
  CRAWL_TOOL,
  SITEMAP_TOOL,
  TRENDING_TOOL
];
