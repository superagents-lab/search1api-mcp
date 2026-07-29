import { SitemapArgs, SitemapResponse, isValidSitemapArgs } from '../types.js';
import { makeRequest } from '../api.js';
import { formatError } from '../utils.js';
import { API_CONFIG } from '../config.js';
import {
  INVALID_PARAMS,
  ProtocolError,
  type CallToolResult,
} from "@modelcontextprotocol/server";

/**
 * Implementation of the sitemap tool
 */
export async function handleSitemap(
  args: unknown,
  apiKey?: string
): Promise<CallToolResult> {
  if (!isValidSitemapArgs(args)) {
    throw new ProtocolError(INVALID_PARAMS, "Invalid sitemap arguments");
  }

  try {
    const response = await makeRequest<SitemapResponse>(
      API_CONFIG.ENDPOINTS.SITEMAP,
      args,
      apiKey
    );
    
    const structuredContent = { links: response.links };

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
        text: `Sitemap API error: ${formatError(error)}`
      }],
      isError: true
    };
  }
}
