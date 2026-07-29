import {
  INVALID_PARAMS,
  ProtocolError,
  type CallToolResult,
} from "@modelcontextprotocol/server";
import { log } from "../utils.js";
import { handleSearch } from "./search.js";
import { handleCrawl } from "./crawl.js";
import { handleSitemap } from "./sitemap.js";
import { handleNews } from "./news.js";
import { handleTrending } from "./trending.js";
import {
  SEARCH_TOOL,
  CRAWL_TOOL,
  SITEMAP_TOOL,
  NEWS_TOOL,
  TRENDING_TOOL,
} from "./index.js";

/**
 * Dispatch request based on tool name
 * @param toolName Name of the tool
 * @param args Tool parameters
 * @param apiKey Optional request credential
 * @returns Tool processing result
 */
export async function handleToolCall(
  toolName: string,
  args: unknown,
  apiKey?: string
): Promise<CallToolResult> {
  log(`Handling tool call: ${toolName}`);

  switch (toolName) {
    case SEARCH_TOOL.name:
      return await handleSearch(args, apiKey);

    case CRAWL_TOOL.name:
      return await handleCrawl(args, apiKey);

    case SITEMAP_TOOL.name:
      return await handleSitemap(args, apiKey);

    case NEWS_TOOL.name:
      return await handleNews(args, apiKey);

    case TRENDING_TOOL.name:
      return await handleTrending(args, apiKey);

    default:
      log(`Unknown tool: ${toolName}`);
      throw new ProtocolError(INVALID_PARAMS, `Unknown tool: ${toolName}`);
  }
}
