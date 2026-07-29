import {
  INVALID_PARAMS,
  ProtocolError,
  type CallToolResult,
} from "@modelcontextprotocol/server";
import { makeRequest } from "../api.js";
import { API_CONFIG } from "../config.js";
import {
  CrawlResponse,
  FetchArgs,
  isValidFetchArgs,
} from "../types.js";
import { formatError, log } from "../utils.js";

/**
 * ChatGPT-compatible fetch implementation. Search result IDs are canonical
 * URLs, so fetch can pass the ID directly to the crawl endpoint.
 */
export async function handleFetch(
  args: unknown,
  apiKey?: string
): Promise<CallToolResult> {
  if (!isValidFetchArgs(args)) {
    throw new ProtocolError(INVALID_PARAMS, "Invalid fetch arguments");
  }

  const { id } = args as FetchArgs;
  log("Fetching search result:", id);

  try {
    const response = await makeRequest<CrawlResponse>(
      API_CONFIG.ENDPOINTS.CRAWL,
      { url: id },
      apiKey
    );
    const result = {
      id,
      title: response.results.title,
      text: response.results.content,
      url: response.results.link || id,
      metadata: {
        source: "search1api",
      },
    };

    return {
      structuredContent: result,
      content: [
        {
          type: "text",
          text: JSON.stringify(result),
        },
      ],
    };
  } catch (error) {
    log("Fetch error:", error);
    return {
      content: [
        {
          type: "text",
          text: `Fetch API error: ${formatError(error)}`,
        },
      ],
      isError: true,
    };
  }
}
