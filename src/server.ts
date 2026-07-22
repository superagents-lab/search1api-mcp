import {
  Server
} from "@modelcontextprotocol/sdk/server/index.js";
import {
  McpError,
  ErrorCode,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListToolsRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import { handleToolCall } from "./tools/handlers.js";
import { log, formatError } from "./utils.js";
import { handleListResources, handleReadResource } from "./resources.js";
import { ALL_TOOLS } from "./tools/index.js";

/**
 * Create and configure MCP server
 * @param credential Optional per-session credential or mutable credential
 * provider (used in HTTP mode so refreshed OAuth tokens can replace expired
 * access tokens without changing the MCP session principal)
 * @returns Server instance ready to be connected to a transport
 */
export function createMcpServer(
  credential?: string | (() => string | undefined)
): Server {
  log("Creating Search1API MCP server");

  const server = new Server({
    name: "search1api-server",
    version: "1.0.0"
  }, {
    capabilities: {
      resources: {},
      tools: {}
    }
  });

  setupRequestHandlers(server, credential);

  return server;
}

/**
 * Helper function to handle errors uniformly
 */
function handleError(context: string, error: unknown): never {
  log(`Error ${context}:`, error);

  if (error instanceof McpError) {
    throw error;
  }

  throw new McpError(
    ErrorCode.InternalError,
    `${context}: ${formatError(error)}`
  );
}

/**
 * Set up server request handlers
 */
function setupRequestHandlers(
  server: Server,
  credential?: string | (() => string | undefined)
) {
  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const toolName = request.params.name;
      const toolArgs = request.params.arguments;

      log(`Tool call received: ${toolName}`);
      const bearerCredential =
        typeof credential === "function" ? credential() : credential;
      return await handleToolCall(toolName, toolArgs, bearerCredential);
    } catch (error) {
      handleError("handling tool call", error);
    }
  });

  // Handle resource listing
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    try {
      return { resources: handleListResources() };
    } catch (error) {
      handleError("listing resources", error);
    }
  });

  // Handle resource reading
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    try {
      const resourceUri = request.params.uri;
      const resource = handleReadResource(resourceUri);

      return {
        contents: [{
          uri: resourceUri,
          mimeType: resource.mimeType || "application/json",
          text: JSON.stringify(resource)
        }]
      };
    } catch (error) {
      handleError("reading resource", error);
    }
  });

  // Handle tool listing
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return { tools: ALL_TOOLS };
  });
}
