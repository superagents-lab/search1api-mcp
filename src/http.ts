#!/usr/bin/env node
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import type { Server as HttpServer } from "node:http";
import {
  hostHeaderValidation,
  originValidation,
  toNodeHandler,
} from "@modelcontextprotocol/node";
import {
  createMcpHandler,
  type AuthInfo,
  type McpHttpHandler,
} from "@modelcontextprotocol/server";
import express from "express";
import { createMcpServer } from "./server.js";
import { formatError, log } from "./utils.js";

const API_BASE_URL =
  process.env.SEARCH1API_API_URL || "https://api.search1api.com";
const DEFAULT_AUTHORIZATION_SERVER = "https://clerk.s1.dev";
const OAUTH_DISCOVERY_CACHE_CONTROL = "public, max-age=60, s-maxage=60";
const MCP_RESOURCE = "https://mcp.search1api.com/mcp";
const MCP_RESOURCE_METADATA =
  "https://mcp.search1api.com/.well-known/oauth-protected-resource/mcp";

export type AuthenticatedCredential = {
  credential: string;
  principal: string;
};

type UsageIdentity = {
  credential_type?: "api_key" | "oauth";
  user_id?: string | null;
  client_id?: string | null;
};

export type CredentialValidator = (
  credential: string
) => Promise<AuthenticatedCredential | null>;

export type HttpAppOptions = {
  validateCredential?: CredentialValidator;
  authorizationServer?: string;
  allowedHostnames?: string[];
  allowedOriginHostnames?: string[];
};

export type Search1ApiHttpApp = {
  app: express.Express;
  mcpHandler: McpHttpHandler;
  close(): Promise<void>;
};

/**
 * Validate both Clerk OAuth tokens and legacy Search1API API keys at the API.
 */
export async function validateCredential(
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

/**
 * Build the HTTP application without starting a listener.
 *
 * A single v2 handler serves the 2026-07-28 protocol and the SDK's default
 * stateless 2025 fallback. Authentication is validated for every exchange,
 * so no credential or principal is retained in a server-side MCP session.
 */
export function createHttpApp(options: HttpAppOptions = {}): Search1ApiHttpApp {
  const app = express();
  const credentialValidator = options.validateCredential ?? validateCredential;
  const authorizationServer = normalizeAuthorizationServer(
    options.authorizationServer ??
      process.env.OAUTH_AUTHORIZATION_SERVER ??
      DEFAULT_AUTHORIZATION_SERVER
  );
  const allowedHostnames =
    options.allowedHostnames ?? configuredAllowedHostnames();
  const allowedOriginHostnames =
    options.allowedOriginHostnames ?? configuredAllowedOriginHostnames();
  const validateHost = hostHeaderValidation(allowedHostnames);
  const validateOrigin = originValidation(allowedOriginHostnames);

  const mcpHandler = createMcpHandler(
    ({ authInfo }) => createMcpServer(authInfo?.token),
    {
      legacy: "stateless",
      onerror: (error) => log("MCP handler error:", error),
    }
  );
  const nodeHandler = toNodeHandler(mcpHandler, {
    onerror: (error) => log("MCP Node adapter error:", error),
  });

  app.use((req, res, next) => {
    if (!validateHost(req, res)) {
      return;
    }
    next();
  });

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

  // /mcp is a transport endpoint that answers unauthenticated crawlers with
  // 401, so search engines gain nothing from walking this host. Keep the OAuth
  // discovery documents reachable for agents.
  app.get("/robots.txt", (_req, res) => {
    res
      .type("text/plain")
      .send(
        ["User-agent: *", "Disallow: /", "Allow: /.well-known/", ""].join("\n")
      );
  });

  // OIDC scopes such as openid and offline_access belong to the client/AS
  // exchange; this resource does not require any resource-specific scope.
  const protectedResourceMetadata = {
    resource: MCP_RESOURCE,
    authorization_servers: [authorizationServer],
    bearer_methods_supported: ["header"],
    resource_documentation: "https://www.search1api.com/auth.md",
  };

  app.get(
    [
      "/.well-known/oauth-protected-resource",
      "/.well-known/oauth-protected-resource/mcp",
    ],
    (_req, res) => {
      res
        .set("Cache-Control", OAUTH_DISCOVERY_CACHE_CONTROL)
        .type("application/json")
        .json(protectedResourceMetadata);
    }
  );

  app.get("/.well-known/oauth-authorization-server", (_req, res) => {
    res
      .set("Cache-Control", OAUTH_DISCOVERY_CACHE_CONTROL)
      .redirect(
        302,
        `${authorizationServer}/.well-known/oauth-authorization-server`
      );
  });

  app.use("/mcp", (req, res, next) => {
    if (!validateOrigin(req, res)) {
      return;
    }
    next();
  });

  app.use(express.json());

  app.all("/mcp", async (req, res) => {
    const authenticated = await authenticateMcpRequest(
      req,
      res,
      credentialValidator
    );
    if (!authenticated) {
      return;
    }

    const authInfo: AuthInfo = {
      token: authenticated.credential,
      clientId: authenticated.principal,
      scopes: [],
    };
    (req as express.Request & { auth?: AuthInfo }).auth = authInfo;

    await nodeHandler(req, res, req.body);
  });

  return {
    app,
    mcpHandler,
    close: () => mcpHandler.close(),
  };
}

function normalizeAuthorizationServer(value: string): string {
  const url = new URL(value.trim());
  const isHttpsOrigin =
    url.protocol === "https:" &&
    !url.username &&
    !url.password &&
    url.pathname === "/" &&
    !url.search &&
    !url.hash;

  if (!isHttpsOrigin) {
    throw new Error(
      "OAUTH_AUTHORIZATION_SERVER must be a valid HTTPS origin"
    );
  }

  return url.origin;
}

function configuredAllowedHostnames(): string[] {
  const configured = (process.env.MCP_ALLOWED_HOSTS ?? "")
    .split(",")
    .map((hostname) => hostname.trim())
    .filter(Boolean);

  return [
    ...new Set([
      "mcp.search1api.com",
      "localhost",
      "127.0.0.1",
      "[::1]",
      ...configured,
    ]),
  ];
}

function configuredAllowedOriginHostnames(): string[] {
  const configured = (process.env.MCP_ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((hostname) => hostname.trim())
    .filter(Boolean);

  return [
    ...new Set([
      "mcp.search1api.com",
      "localhost",
      "127.0.0.1",
      "[::1]",
      ...configured,
    ]),
  ];
}

/** Start the production HTTP listener. */
export function startHttpServer(
  port = Number.parseInt(process.env.PORT || "3000", 10)
): Search1ApiHttpApp & { httpServer: HttpServer } {
  const httpApp = createHttpApp();
  const httpServer = httpApp.app.listen(port, () => {
    log(
      `Search1API MCP HTTP server listening on http://localhost:${port}/mcp`
    );
  });

  let closing = false;
  const shutdown = async () => {
    if (closing) {
      return;
    }
    closing = true;
    log("Shutting down HTTP server...");
    await httpApp.close();
    if (httpServer.listening) {
      await new Promise<void>((resolve, reject) => {
        httpServer.close((error) => (error ? reject(error) : resolve()));
      });
    }
  };

  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);

  return { ...httpApp, httpServer, close: shutdown };
}

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

async function authenticateMcpRequest(
  req: express.Request,
  res: express.Response,
  credentialValidator: CredentialValidator
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
    authenticated = await credentialValidator(credential);
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
    challenge(
      res,
      "The Bearer credential is invalid or expired.",
      "invalid_token"
    );
    return null;
  }
  return authenticated;
}

function installGlobalErrorLogging() {
  process.on("uncaughtException", (error) => {
    log("Uncaught exception:", error);
  });

  process.on("unhandledRejection", (reason) => {
    log("Unhandled rejection:", reason);
  });
}

const isMain =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  installGlobalErrorLogging();
  startHttpServer();
}
