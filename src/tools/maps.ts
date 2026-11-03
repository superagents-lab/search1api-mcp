import { MapsPlace, MapsResponse, isValidMapsArgs } from '../types.js';
import { makeRequest } from '../api.js';
import { formatError } from '../utils.js';
import { API_CONFIG } from '../config.js';
import {
  INVALID_PARAMS,
  ProtocolError,
  type CallToolResult,
} from "@modelcontextprotocol/server";

const PLACE_DETAIL_FIELDS = [
  "address",
  "phone",
  "website",
  "category",
  "rating",
  "review_count",
  "coordinates",
  "opening_hours",
  "open_state",
  "price",
] as const;

/** One readable line per place, for clients that only show `text`. */
function placeSummary(place: MapsPlace): string | undefined {
  const parts = [
    place.category,
    place.rating !== undefined
      ? `${place.rating}★${place.review_count !== undefined ? ` (${place.review_count} reviews)` : ""}`
      : undefined,
    place.address,
    place.open_state,
    place.description,
  ].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join(" · ") : undefined;
}

/**
 * Implementation of the maps tool
 */
export async function handleMaps(
  args: unknown,
  apiKey?: string
): Promise<CallToolResult> {
  if (!isValidMapsArgs(args)) {
    throw new ProtocolError(INVALID_PARAMS, "Invalid maps arguments");
  }

  try {
    const response = await makeRequest<MapsResponse>(
      API_CONFIG.ENDPOINTS.MAPS,
      {
        query: args.query,
        ...(args.country !== undefined && { country: args.country }),
        ...(args.language !== undefined && { language: args.language }),
        ...(args.location !== undefined && { location: args.location }),
        ...(args.page !== undefined && { page: args.page }),
        ...(args.max_results !== undefined && { max_results: args.max_results }),
      },
      apiKey
    );

    const results = response.results.map((place) => {
      const metadata: Record<string, unknown> = {
        position: place.position,
        place_id: place.place_id,
      };
      for (const field of PLACE_DETAIL_FIELDS) {
        if (place[field] !== undefined) {
          metadata[field] = place[field];
        }
      }
      const text = placeSummary(place);
      return {
        id: place.place_id,
        title: place.name,
        url: place.maps_url,
        ...(text && { text }),
        metadata,
      };
    });
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
        text: `Maps API error: ${formatError(error)}`
      }],
      isError: true
    };
  }
}
