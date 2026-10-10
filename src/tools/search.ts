import { SearchResponse, SearchResult, isValidSearchArgs } from '../types.js';
import { makeRequest } from '../api.js';
import { formatError } from '../utils.js';
import { API_CONFIG } from '../config.js';
import {
  INVALID_PARAMS,
  ProtocolError,
  type CallToolResult,
} from "@modelcontextprotocol/server";

// Source fields the API adds for some engines (dates, GitHub and Hacker News
// details). Only fields the result actually carries are copied.
const OPTIONAL_RESULT_FIELDS = [
  "published_date",
  "kind",
  "stars",
  "language",
  "num_comments",
  "points",
  "story_url",
] as const;

export function resultMetadata(result: SearchResult): Record<string, unknown> {
  const metadata: Record<string, unknown> = { snippet: result.snippet };
  if (result.content) metadata.has_full_content = true;
  for (const field of OPTIONAL_RESULT_FIELDS) {
    if (result[field] !== undefined && result[field] !== "") {
      metadata[field] = result[field];
    }
  }
  return metadata;
}

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
      metadata: resultMetadata(result),
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
