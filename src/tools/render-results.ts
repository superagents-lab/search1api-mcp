import { INVALID_PARAMS, ProtocolError, type CallToolResult, type Tool } from "@modelcontextprotocol/server";

export const RENDER_INPUT_SCHEMA: Tool["inputSchema"] = {
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "title": {
      "type": "string",
      "minLength": 1,
      "maxLength": 120,
      "description": "Heading shown above the cards, such as the research topic"
    },
    "results": {
      "type": "array",
      "minItems": 0,
      "maxItems": 50,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "id": {
            "type": "string",
            "minLength": 1,
            "maxLength": 2048,
            "description": "The id from the original search result; the server falls back to the URL when there is none"
          },
          "title": {
            "type": "string",
            "minLength": 1,
            "maxLength": 300,
            "description": "Source title exactly as the search returned it; never invent or rewrite it"
          },
          "url": {
            "type": "string",
            "format": "uri",
            "pattern": "^https?://",
            "maxLength": 2048,
            "description": "Link to the source as the search returned it, never one carrying credentials"
          },
          "text": {
            "type": "string",
            "maxLength": 2000,
            "description": "Snippet or faithful excerpt from the source, not a full page or a model-written answer"
          },
          "metadata": {
            "type": "object",
            "additionalProperties": true,
            "description": "Metadata from the original result, such as the publication date; never credentials or UI details"
          }
        },
        "required": [
          "title",
          "url"
        ]
      },
      "description": "Already retrieved results, in the order to display. No new search is performed."
    }
  },
  "required": [
    "results"
  ]
};

export const RENDER_OUTPUT_SCHEMA: NonNullable<Tool["outputSchema"]> = {
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "title": {
      "type": "string",
      "minLength": 1,
      "maxLength": 120
    },
    "total": {
      "type": "integer",
      "minimum": 0,
      "maximum": 50,
      "description": "Number of results in this rendered list, not a provider-wide search total."
    },
    "results": {
      "type": "array",
      "minItems": 0,
      "maxItems": 50,
      "items": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "id": {
            "type": "string",
            "minLength": 1,
            "maxLength": 2048,
            "description": "The id from the original search result; the server falls back to the URL when there is none"
          },
          "title": {
            "type": "string",
            "minLength": 1,
            "maxLength": 300,
            "description": "Source title exactly as the search returned it; never invent or rewrite it"
          },
          "url": {
            "type": "string",
            "format": "uri",
            "pattern": "^https?://",
            "maxLength": 2048,
            "description": "Link to the source as the search returned it, never one carrying credentials"
          },
          "text": {
            "type": "string",
            "maxLength": 2000,
            "description": "Snippet or faithful excerpt from the source, not a full page or a model-written answer"
          },
          "metadata": {
            "type": "object",
            "additionalProperties": true,
            "description": "Metadata from the original result, such as the publication date; never credentials or UI details"
          }
        },
        "required": [
          "id",
          "title",
          "url"
        ]
      }
    }
  },
  "required": [
    "title",
    "total",
    "results"
  ]
};

type RenderResult = { id: string; title: string; url: string; text?: string; metadata?: Record<string, unknown> };

function invalid(field: string, message: string): never {
  throw new ProtocolError(INVALID_PARAMS, `${field}: ${message}`);
}
function object(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid(field, "must be an object");
  return value as Record<string, unknown>;
}
function string(value: unknown, field: string, max: number, allowEmpty = false): string {
  if (typeof value !== "string") invalid(field, "must be a string");
  if (!allowEmpty && !value.trim()) invalid(field, "must not be blank");
  if ([...value].length > max) invalid(field, `must be at most ${max} characters`);
  return value;
}
function keys(value: Record<string, unknown>, allowed: string[], field: string): void {
  if (Object.keys(value).some(key => !allowed.includes(key))) invalid(field, "contains an unsupported field");
}

/** Pure presentation: no URL fetches, storage, searches or balance charges. */
export async function handleRenderResults(args: unknown): Promise<CallToolResult> {
  const input = object(args, "arguments");
  keys(input, ["title", "results"], "arguments");
  let serialized: string;
  try { serialized = JSON.stringify(input); } catch { invalid("arguments", "must contain JSON data"); }
  if (Buffer.byteLength(serialized, "utf8") > 65_536) invalid("arguments", "must be at most 65536 UTF-8 bytes");
  const title = input.title === undefined ? "Results" : string(input.title, "title", 120);
  if (!Array.isArray(input.results)) invalid("results", "must be an array");
  if (input.results.length > 50) invalid("results", "must contain at most 50 results");
  const results: RenderResult[] = input.results.map((value, index) => {
    const field = `results[${index}]`;
    const item = object(value, field);
    keys(item, ["id", "title", "url", "text", "metadata"], field);
    const title = string(item.title, `${field}.title`, 300);
    const url = string(item.url, `${field}.url`, 2048);
    let parsed: URL;
    try { parsed = new URL(url); } catch { invalid(`${field}.url`, "must be an absolute HTTP(S) URL without credentials"); }
    if (!/^https?:\/\//.test(url) || !parsed.hostname || parsed.username || parsed.password || /\s|[\u0000-\u001f\u007f]/u.test(url)) {
      invalid(`${field}.url`, "must be an absolute HTTP(S) URL without credentials or whitespace");
    }
    const id = item.id === undefined ? url : string(item.id, `${field}.id`, 2048);
    const text = item.text === undefined ? undefined : string(item.text, `${field}.text`, 2000, true);
    const metadata = item.metadata === undefined ? undefined : object(item.metadata, `${field}.metadata`);
    return { id, title, url, ...(text !== undefined && { text }), ...(metadata !== undefined && { metadata }) };
  });
  const text = results.length
    ? `${title}\n\n${results.map((item, index) => `${index + 1}. ${item.title}\nURL: ${item.url}${item.text ? `\nSnippet: ${item.text}` : ""}`).join("\n\n")}`
    : `${title}\n\nNo results to display.`;
  return { isError: false, structuredContent: { title, total: results.length, results }, content: [{ type: "text", text }] };
}
