import { AskResponse, isValidAskArgs } from '../types.js';
import { makeRequest } from '../api.js';
import { formatError } from '../utils.js';
import { API_CONFIG } from '../config.js';
import {
  INVALID_PARAMS,
  ProtocolError,
  type CallToolResult,
} from "@modelcontextprotocol/server";

/**
 * Implementation of the ask tool
 */
export async function handleAsk(
  args: unknown,
  apiKey?: string
): Promise<CallToolResult> {
  if (!isValidAskArgs(args)) {
    throw new ProtocolError(INVALID_PARAMS, "Invalid ask arguments");
  }

  try {
    // The endpoint accepts only `query`; the decision model chooses the rest.
    const response = await makeRequest<AskResponse>(
      API_CONFIG.ENDPOINTS.ASK,
      { query: args.query },
      apiKey
    );

    const results = response.results.map((result) => ({
      id: result.link,
      title: result.title,
      url: result.link,
      text: result.snippet,
      metadata: {
        source: result.source,
        relevance: result.relevance,
        ...(result.published_date ? { published_date: result.published_date } : {}),
      },
    }));
    const structuredContent = {
      intent: response.intent,
      results,
      errors: response.errors ?? [],
    };

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
        text: `Ask API error: ${formatError(error)}`
      }],
      isError: true
    };
  }
}
