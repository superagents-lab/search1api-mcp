import { TrendingArgs, TrendingResponse, isValidTrendingArgs } from '../types.js';
import { makeRequest } from '../api.js';
import { formatError } from '../utils.js';
import { API_CONFIG } from '../config.js';
import {
  INVALID_PARAMS,
  ProtocolError,
  type CallToolResult,
} from "@modelcontextprotocol/server";

/**
 * Implementation of the trending tool
 */
export async function handleTrending(
  args: unknown,
  apiKey?: string
): Promise<CallToolResult> {
  if (!isValidTrendingArgs(args)) {
    throw new ProtocolError(INVALID_PARAMS, "Invalid trending arguments");
  }

  try {
    const response = await makeRequest<TrendingResponse>(
      API_CONFIG.ENDPOINTS.TRENDING,
      args,
      apiKey
    );

    const structuredContent = { results: response.results };

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
        text: `Trending API error: ${formatError(error)}`
      }],
      isError: true
    };
  }
}
