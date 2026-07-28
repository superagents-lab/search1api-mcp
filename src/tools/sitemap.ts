import { SitemapArgs, SitemapResponse, isValidSitemapArgs } from '../types.js';
import { makeRequest } from '../api.js';
import { formatError } from '../utils.js';
import { API_CONFIG } from '../config.js';
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

/**
 * Implementation of the sitemap tool
 */
export async function handleSitemap(args: unknown, apiKey?: string) {
  if (!isValidSitemapArgs(args)) {
    throw new McpError(
      ErrorCode.InvalidParams,
      "Invalid sitemap arguments"
    );
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
        mimeType: "application/json",
        text: JSON.stringify(structuredContent)
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: "text",
        mimeType: "text/plain",
        text: `Sitemap API error: ${formatError(error)}`
      }],
      isError: true
    };
  }
}
