import { AsyncLocalStorage } from "node:async_hooks";
import { PACKAGE_VERSION } from "./version.js";

/**
 * Which of our MCP transports a tool call came through, and which MCP client
 * (Claude, Cursor, ...) made it. Sent to the Search1API gateway as
 * `X-Search1API-Client: <transport>/<version>` and `X-Search1API-Client-App`,
 * where it becomes the request channel in the API's analytics. The gateway
 * maps the client name to a fixed list itself, so the raw name is sent.
 * Analytics only: the gateway never bills or authorizes on it.
 */
export type McpTransport = "mcp-remote" | "mcp-local";

export interface ClientChannel {
  transport: McpTransport;
  /** MCP clientInfo.name, else the HTTP User-Agent of the MCP request. */
  app?: string;
}

const current = new AsyncLocalStorage<ClientChannel>();

export function withClientChannel<T>(
  channel: ClientChannel,
  run: () => Promise<T>
): Promise<T> {
  return current.run(channel, run);
}

// Printable ASCII only, so the value is always a valid header.
function headerValue(value: string): string {
  return value.replace(/[^\x20-\x7e]/g, "").trim().slice(0, 100);
}

export function clientChannelHeaders(): Record<string, string> {
  const channel = current.getStore();
  if (!channel) return {};
  const app = channel.app ? headerValue(channel.app) : "";
  return {
    "X-Search1API-Client": `${channel.transport}/${PACKAGE_VERSION}`,
    ...(app ? { "X-Search1API-Client-App": app } : {}),
  };
}
