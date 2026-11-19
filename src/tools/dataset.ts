import {
  DatasetQueryResponse,
  isValidDatasetQueryArgs,
} from '../types.js';
import { makeRequest } from '../api.js';
import { formatError } from '../utils.js';
import { API_CONFIG } from '../config.js';
import {
  INVALID_PARAMS,
  ProtocolError,
  type CallToolResult,
} from "@modelcontextprotocol/server";

/**
 * Implementation of the query_dataset tool: POST /dataset, with each fact
 * returned as a citable result (title = fact, url = its best source).
 */
export async function handleQueryDataset(
  args: unknown,
  apiKey?: string
): Promise<CallToolResult> {
  if (!isValidDatasetQueryArgs(args)) {
    throw new ProtocolError(INVALID_PARAMS, "Invalid query_dataset arguments");
  }

  try {
    const response = await makeRequest<DatasetQueryResponse>(
      API_CONFIG.ENDPOINTS.DATASET,
      {
        dataset: args.dataset,
        query: args.query,
        ...(args.max_results !== undefined && { max_results: args.max_results }),
      },
      apiKey
    );

    const results = response.results.map((fact) => ({
      id: fact.id,
      title: fact.fact,
      ...(fact.sources[0] && { url: fact.sources[0].url }),
      text: fact.contested && fact.conflicting_claims.length > 0
        ? `${fact.fact} (contested; other sources say: ${fact.conflicting_claims.join(" / ")})`
        : fact.fact,
      metadata: {
        question: fact.question,
        relevance: fact.relevance,
        confidence: fact.confidence,
        corroborated_by: fact.corroborated_by,
        contested: fact.contested,
        conflicting_claims: fact.conflicting_claims,
        sources: fact.sources,
        attributes: fact.attributes,
        updated_at: fact.updated_at,
      },
    }));
    const structuredContent = {
      dataset: response.dataset,
      found: response.found,
      ...(response.query_en && { query_en: response.query_en }),
      results,
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
        text: `Dataset API error: ${formatError(error)}`
      }],
      isError: true
    };
  }
}
