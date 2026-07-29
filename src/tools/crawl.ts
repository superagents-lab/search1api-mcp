import { CrawlArgs, CrawlResponse, isValidCrawlArgs } from '../types.js';
import { makeRequest } from '../api.js';
import { formatError, log } from '../utils.js';
import { API_CONFIG } from '../config.js';
import {
  INVALID_PARAMS,
  ProtocolError,
  type CallToolResult,
} from "@modelcontextprotocol/server";

/**
 * Implementation of the crawl tool
 */
export async function handleCrawl(
  args: unknown,
  apiKey?: string
): Promise<CallToolResult> {
  if (!isValidCrawlArgs(args)) {
    throw new ProtocolError(INVALID_PARAMS, "Invalid crawl arguments");
  }

  const { url } = args;

  log("Starting crawl for:", url);

  try {
    const startTime = Date.now();
    const response = await makeRequest<CrawlResponse>(
      API_CONFIG.ENDPOINTS.CRAWL,
      { url },
      apiKey
    );
    const endTime = Date.now();
    log(`Crawl completed successfully in ${endTime - startTime}ms`);

    const result = {
      id: response.results.link || url,
      title: response.results.title,
      url: response.results.link || url,
      text: response.results.content,
      metadata: {
        source: "search1api",
      },
    };
    const structuredContent = { result };

    return {
      structuredContent,
      content: [{
        type: "text",
        text: JSON.stringify(structuredContent)
      }]
    };
  } catch (error) {
    log("Crawl error:", error);
    return {
      content: [{
        type: "text",
        text: `Crawl API error: ${formatError(error)}`
      }],
      isError: true
    };
  }
}
