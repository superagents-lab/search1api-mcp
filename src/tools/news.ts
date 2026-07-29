import { NewsArgs, NewsResponse, isValidNewsArgs } from '../types.js';
import { makeRequest } from '../api.js';
import { formatError, log } from '../utils.js';
import { API_CONFIG } from '../config.js';
import {
  INVALID_PARAMS,
  ProtocolError,
  type CallToolResult,
} from "@modelcontextprotocol/server";

/**
 * Implementation of the news search tool
 */
export async function handleNews(
  args: unknown,
  apiKey?: string
): Promise<CallToolResult> {
  if (!isValidNewsArgs(args)) {
    throw new ProtocolError(INVALID_PARAMS, "Invalid news search arguments");
  }

  log("Processing news search with query:", (args as NewsArgs).query);

  try {
    const response = await makeRequest<NewsResponse>(
      API_CONFIG.ENDPOINTS.NEWS,
      args,
      apiKey
    );
    
    const results = response.results.map((result) => ({
      id: result.link,
      title: result.title,
      url: result.link,
      text: result.content || result.snippet,
      metadata: {
        snippet: result.snippet,
        ...(result.content ? { has_full_content: true } : {}),
      },
    }));
    const structuredContent = { results };

    return {
      structuredContent,
      content: [{
        type: "text",
        text: JSON.stringify(structuredContent)
      }]
    };
  } catch (error) {
    log("News search error:", error);
    return {
      content: [{
        type: "text",
        text: `News API error: ${formatError(error)}`
      }],
      isError: true
    };
  }
}
