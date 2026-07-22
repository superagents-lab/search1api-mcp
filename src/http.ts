#!/usr/bin/env node
import { createHash, randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import express from "express";
import { createMcpServer } from "./server.js";
import { log } from "./utils.js";

const app = express();

const API_BASE_URL =
  process.env.SEARCH1API_API_URL || "https://api.search1api.com";
const AUTHORIZATION_SERVER = "https://clerk.search1api.com";
const MCP_RESOURCE = "https://mcp.search1api.com/mcp";
const MCP_RESOURCE_METADATA =
  "https://mcp.search1api.com/.well-known/oauth-protected-resource/mcp";

type AuthenticatedCredential = {
  credential: string;
  principal: string;
};

type UsageIdentity = {
  credential_type?: "api_key" | "oauth";
  user_id?: string | null;
  client_id?: string | null;
};

type McpSession = {
  transport: StreamableHTTPServerTransport;
  server: Server;
  principal: string;
  credential: { current: string };
};

// The service root is documentation, not an MCP transport endpoint. Keep
// query parameters so bookmarked campaign/support links remain attributable.
app.get("/", (req, res) => {
  const target = new URL("https://www.search1api.com/docs/integrations/mcp");
  for (const [key, value] of Object.entries(req.query)) {
    if (typeof value === "string") {
      target.searchParams.append(key, value);
    }
  }
  res.redirect(301, target.toString());
});

const protectedResourceMetadata = {
  resource: MCP_RESOURCE,
  authorization_servers: [AUTHORIZATION_SERVER],
  bearer_methods_supported: ["header"],
  scopes_supported: ["openid", "offline_access"],
  resource_documentation: "https://www.search1api.com/auth.md",
};

app.get(
  [
    "/.well-known/oauth-protected-resource",
    "/.well-known/oauth-protected-resource/mcp",
  ],
  (_req, res) => {
    res.type("application/json").json(protectedResourceMetadata);
  }
);

app.get("/.well-known/oauth-authorization-server", (_req, res) => {
  res.redirect(
    302,
    `${AUTHORIZATION_SERVER}/.well-known/oauth-authorization-server`
  );
});

app.use(express.json());

// Session storage: sessionId -> MCP transport, server, and authenticated
// principal. The credential itself is mutable so a refreshed OAuth access
// token can continue the same session after it is validated.
const sessions = new Map<string, McpSession>();

/** Extract a Bearer credential, retaining the legacy query-key fallback. */
function extractCredential(req: express.Request): string | undefined {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    return auth.slice(7).trim() || undefined;
  }
  const queryKey = req.query.apiKey;
  if (typeof queryKey === "string" && queryKey.trim()) {
    return queryKey.trim();
  }
  return undefined;
}

function challenge(
  res: express.Response,
  message: string,
  error?: "invalid_token"
) {
  const errorParameter = error ? `, error="${error}"` : "";
  res.set(
    "WWW-Authenticate",
    `Bearer resource_metadata="${MCP_RESOURCE_METADATA}"${errorParameter}`
  );
  res.status(401).json({
    jsonrpc: "2.0",
    error: { code: -32001, message },
    id: null,
  });
}

/** Validate both Clerk OAuth tokens and legacy Search1API API keys at the API. */
async function validateCredential(
  credential: string
): Promise<AuthenticatedCredential | null> {
  const response = await fetch(`${API_BASE_URL}/usage`, {
    headers: { Authorization: `Bearer ${credential}` },
  });

  if (response.status === 401 || response.status === 403) {
    return null;
  }
  if (!response.ok) {
    throw new Error(
      `Search1API credential validation returned ${response.status}`
    );
  }

  const identity = (await response.json()) as UsageIdentity;
  let principal: string;
  if (
    identity.credential_type === "oauth" &&
    identity.user_id &&
    identity.client_id
  ) {
    principal = `oauth:${identity.user_id}:${identity.client_id}`;
  } else {
    principal = `api-key:${createHash("sha256")
      .update(credential)
      .digest("hex")}`;
  }

  return { credential, principal };
}

async function authenticateMcpRequest(
  req: express.Request,
  res: express.Response,
  expectedPrincipal?: string
): Promise<AuthenticatedCredential | null> {
  const credential = extractCredential(req);
  if (!credential) {
    challenge(
      res,
      "Authentication is required. Use OAuth 2.1 discovery or provide a Search1API API key as a Bearer token."
    );
    return null;
  }

  let authenticated: AuthenticatedCredential | null;
  try {
    authenticated = await validateCredential(credential);
  } catch (error) {
    log("Credential validation failed:", error);
    res.status(503).json({
      jsonrpc: "2.0",
      error: {
        code: -32002,
        message: "Search1API authentication is temporarily unavailable.",
      },
      id: null,
    });
    return null;
  }

  if (!authenticated) {
    challenge(res, "The Bearer credential is invalid or expired.", "invalid_token");
    return null;
  }
  if (expectedPrincipal && authenticated.principal !== expectedPrincipal) {
    res.status(403).json({
      jsonrpc: "2.0",
      error: {
        code: -32003,
        message: "The credential does not belong to this MCP session.",
      },
      id: null,
    });
    return null;
  }
  return authenticated;
}

function isInitializeRequest(body: unknown): boolean {
  if (Array.isArray(body)) {
    return body.some(
      (message) =>
        typeof message === "object" &&
        message !== null &&
        (message as Record<string, unknown>).method === "initialize"
    );
  }
  return (
    typeof body === "object" &&
    body !== null &&
    (body as Record<string, unknown>).method === "initialize"
  );
}

// Handle POST /mcp - initialize or route to an existing session.
app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId)!;
    const authenticated = await authenticateMcpRequest(
      req,
      res,
      session.principal
    );
    if (!authenticated) {
      return;
    }
    session.credential.current = authenticated.credential;
    await session.transport.handleRequest(req, res, req.body);
    return;
  }

  if (!sessionId && isInitializeRequest(req.body)) {
    const authenticated = await authenticateMcpRequest(req, res);
    if (!authenticated) {
      return;
    }
    const credential = { current: authenticated.credential };

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => {
        sessions.set(sid, {
          transport,
          server,
          principal: authenticated.principal,
          credential,
        });
        log(`Session created: ${sid}`);
      },
    });

    transport.onclose = () => {
      if (transport.sessionId) {
        sessions.delete(transport.sessionId);
        log(`Session closed: ${transport.sessionId}`);
      }
    };

    const server = createMcpServer(() => credential.current);
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
    return;
  }

  res.status(400).json({
    jsonrpc: "2.0",
    error: {
      code: -32600,
      message: "Bad request: no valid session or not an initialize request",
    },
    id: null,
  });
});

// Handle GET /mcp - SSE stream for an existing session.
app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string;
  if (!sessionId || !sessions.has(sessionId)) {
    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32600, message: "Invalid or missing session ID" },
      id: null,
    });
    return;
  }

  const session = sessions.get(sessionId)!;
  const authenticated = await authenticateMcpRequest(
    req,
    res,
    session.principal
  );
  if (!authenticated) {
    return;
  }
  session.credential.current = authenticated.credential;
  await session.transport.handleRequest(req, res);
});

// Handle DELETE /mcp - authenticated session termination.
app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"] as string;
  if (sessionId && sessions.has(sessionId)) {
    const session = sessions.get(sessionId)!;
    const authenticated = await authenticateMcpRequest(
      req,
      res,
      session.principal
    );
    if (!authenticated) {
      return;
    }
    await session.transport.handleRequest(req, res);
    await session.server.close();
    sessions.delete(sessionId);
    log(`Session terminated: ${sessionId}`);
    return;
  }

  res.status(400).json({
    jsonrpc: "2.0",
    error: { code: -32600, message: "Invalid or missing session ID" },
    id: null,
  });
});

const PORT = parseInt(process.env.PORT || "3000", 10);

app.listen(PORT, () => {
  log(`Search1API MCP HTTP server listening on http://localhost:${PORT}/mcp`);
});

process.on("uncaughtException", (error) => {
  log("Uncaught exception:", error);
});

process.on("unhandledRejection", (reason) => {
  log("Unhandled rejection:", reason);
});
