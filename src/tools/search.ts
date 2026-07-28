import { SearchArgs, SearchResponse, isValidSearchArgs } from '../types.js';
import { makeRequest } from '../api.js';
import { formatError } from '../utils.js';
import { API_CONFIG } from '../config.js';
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

/**
 * Implementation of the search tool
 */
export async function handleSearch(args: unknown, apiKey?: string) {
  if (!isValidSearchArgs(args)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Invalid search arguments"
    );
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
        mimeType: "application/json",
        text: JSON.stringify(structuredContent)
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        mimeType: "text/plain",
        text: `Search API error: ${formatError(error)}`
      }],
      isError: true
    };
  }
}
