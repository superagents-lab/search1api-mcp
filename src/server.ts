import {
  INTERNAL_ERROR,
  McpServer,
  ProtocolError,
  fromJsonSchema,
  type JsonSchemaType,
} from "@modelcontextprotocol/server";
import { handleReadResource, RESOURCES } from "./resources.js";
import { handleToolCall } from "./tools/handlers.js";
import { ALL_TOOLS } from "./tools/index.js";
import { formatError, log } from "./utils.js";
import { PACKAGE_VERSION } from "./version.js";

export type CredentialProvider = string | (() => string | undefined);

/** JSON-RPC error code this server uses for a missing or rejected credential. */
export const UNAUTHENTICATED = -32001;

/**
 * Build a credential provider that refuses instead of resolving.
 *
 * Both entry points serve tool metadata without a credential, so a tool handler
 * can be reached with nothing to spend. Refusing here keeps makeRequest from
 * falling back to the operator's own SEARCH1API_KEY and billing an
 * unauthenticated caller's search to us.
 */
export function unauthenticatedCredential(message: string): CredentialProvider {
  return () => {
    throw new ProtocolError(UNAUTHENTICATED, message);
  };
}

/**
 * Create one transport-neutral MCP server instance.
 *
 * The v2 serving entries call this factory once per modern HTTP exchange,
 * once per stateless legacy HTTP request, or once per stdio connection.
 */
export function createMcpServer(credential?: CredentialProvider): McpServer {
  log("Creating Search1API MCP server");

  const server = new McpServer({
    name: "search1api-server",
    version: PACKAGE_VERSION,
  });

  for (const tool of ALL_TOOLS) {
    const inputSchema = fromJsonSchema<Record<string, unknown>>(
      tool.inputSchema as JsonSchemaType
    );
    const outputSchema = tool.outputSchema
      ? fromJsonSchema<Record<string, unknown>>(
          tool.outputSchema as JsonSchemaType
        )
      : undefined;

    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema,
        ...(outputSchema ? { outputSchema } : {}),
        annotations: tool.annotations,
        _meta: tool._meta,
      },
      async (args) => {
        try {
          const bearerCredential =
            typeof credential === "function" ? credential() : credential;
          log(`Tool call received: ${tool.name}`);
          return await handleToolCall(tool.name, args, bearerCredential);
        } catch (error) {
          throw normalizeProtocolError(`handling tool call ${tool.name}`, error);
        }
      }
    );
  }

  for (const resource of RESOURCES) {
    server.registerResource(
      resource.name,
      resource.uri,
      {
        description: resource.description,
        mimeType: resource.mimeType,
      },
      async (uri) => {
        try {
          const result = handleReadResource(uri.href);
          return {
            contents: [
              {
                uri: uri.href,
                mimeType: result.mimeType || "application/json",
                text: JSON.stringify(result),
              },
            ],
          };
        } catch (error) {
          throw normalizeProtocolError("reading resource", error);
        }
      }
    );
  }

  return server;
}

function normalizeProtocolError(context: string, error: unknown): ProtocolError {
  log(`Error ${context}:`, error);

  if (error instanceof ProtocolError) {
    return error;
  }

  return new ProtocolError(
    INTERNAL_ERROR,
    `${context}: ${formatError(error)}`
  );
}
