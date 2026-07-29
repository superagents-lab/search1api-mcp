import { SearchArgs, SearchResponse, isValidSearchArgs } from '../types.js';
import { makeRequest } from '../api.js';
import { formatError } from '../utils.js';
import { API_CONFIG } from '../config.js';
import {
  INVALID_PARAMS,
  ProtocolError,
  type CallToolResult,
} from "@modelcontextprotocol/server";

/**
 * Implementation of the search tool
 */
export async function handleSearch(
  args: unknown,
  apiKey?: string
): Promise<CallToolResult> {
  if (!isValidSearchArgs(args)) {
    throw new ProtocolError(INVALID_PARAMS, "Invalid search arguments");
  }

  try {
    const response = await makeRequest<SearchResponse>(
      API_CONFIG.ENDPOINTS.SEARCH,
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
    return {
      content: [{
        type: "text",
        text: `Search API error: ${formatError(error)}`
      }],
      isError: true
    };
  }
}
