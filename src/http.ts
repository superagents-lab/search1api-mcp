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
  INTERNAL_ERROR,
  PARSE_ERROR,
  type AuthInfo,
  type McpHttpHandler,
} from "@modelcontextprotocol/server";
import express from "express";
import {
  createMcpServer,
  unauthenticatedCredential,
  UNAUTHENTICATED,
} from "./server.js";
import { ALL_TOOLS } from "./tools/index.js";
import { PACKAGE_VERSION } from "./version.js";
import { formatError, log } from "./utils.js";

const API_BASE_URL =
  process.env.SEARCH1API_API_URL || "https://api.search1api.com";
const DEFAULT_AUTHORIZATION_SERVER = "https://clerk.s1.dev";
const OAUTH_DISCOVERY_CACHE_CONTROL = "public, max-age=60, s-maxage=60";
const MCP_RESOURCE = "https://mcp.search1api.com/mcp";
const MCP_RESOURCE_METADATA =
  "https://mcp.search1api.com/.well-known/oauth-protected-resource/mcp";

/**
 * JSON-RPC methods that only return static server metadata.
 *
 * The tool and resource descriptors are already published in the repository
 * manifests, the server card, and the MCP registry, so answering them for an
 * anonymous caller discloses nothing new and lets directory scanners enumerate
 * the server without first completing an OAuth exchange. Every method that
 * spends credits or reaches the Search1API backend is deliberately absent.
 */
const PUBLIC_MCP_METHODS = new Set([
  "initialize",
  "notifications/initialized",
  "ping",
  "server/discover",
  "tools/list",
  "prompts/list",
  "resources/list",
  "resources/templates/list",
  "resources/read",
]);

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
 * stateless 2025 fallback. Every presented credential is validated per
 * exchange, so no credential or principal is retained in a server-side MCP
 * session. An exchange that presents no credential at all reaches only the
 * metadata methods in PUBLIC_MCP_METHODS.
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
    ({ authInfo }) => createMcpServer(toolCredential(authInfo)),
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
    const target = new URL("https://s1.dev/docs/integrations/mcp");
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === "string") {
        target.searchParams.append(key, value);
      }
    }
    res.redirect(301, target.toString());
  });

  // /mcp is a transport endpoint whose only anonymous answers are static
  // descriptors, so search engines gain nothing from walking this host. Keep
  // the OAuth discovery documents reachable for agents.
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
    resource_documentation: "https://s1.dev/auth.md",
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

  // A single static document for directories that read one URL rather than
  // speak MCP. /mcp now answers tools/list anonymously too, so this card is a
  // convenience rather than the only pre-connection description. It is built
  // from ALL_TOOLS, so neither surface can drift from the real tool set.
  app.get("/.well-known/mcp/server-card.json", (_req, res) => {
    res
      .set("Cache-Control", OAUTH_DISCOVERY_CACHE_CONTROL)
      .type("application/json")
      .json({
        name: "Search1API",
        version: PACKAGE_VERSION,
        description:
          "Remote MCP server for Search1API. Exposes live web search, news, page reading, sitemap discovery, and trending topics as tools for AI agents.",
        serverUrl: MCP_RESOURCE,
        tools: ALL_TOOLS.map((tool) => ({
          name: tool.name,
          title: tool.title,
          description: tool.description,
          inputSchema: tool.inputSchema,
          annotations: tool.annotations,
        })),
        serverInfo: {
          name: "Search1API",
          title: "Search1API MCP",
          version: PACKAGE_VERSION,
        },
        protocolVersion: "2025-06-18",
        transport: { type: "streamable-http", endpoint: MCP_RESOURCE },
        capabilities: { tools: {} },
        authentication: {
          type: "oauth2",
          protectedResourceMetadata: MCP_RESOURCE_METADATA,
          authorizationServerMetadata: `${authorizationServer}/.well-known/oauth-authorization-server`,
          legacyApiKey: {
            supported: true,
            method: "Authorization: Bearer SEARCH1API_KEY",
          },
        },
        homepage: "https://s1.dev",
        documentation: "https://s1.dev/docs",
      });
  });

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
    const outcome = await authenticateMcpRequest(
      req,
      res,
      credentialValidator,
      isPublicDiscovery(req)
    );
    if (outcome.status === "handled") {
      return;
    }

    if (outcome.status === "authenticated") {
      const authInfo: AuthInfo = {
        token: outcome.credential.credential,
        clientId: outcome.credential.principal,
        scopes: [],
      };
      (req as express.Request & { auth?: AuthInfo }).auth = authInfo;
    }

    await nodeHandler(req, res, req.body);
  });

  // Express renders an HTML page for anything that fails before a route runs --
  // most often body-parser rejecting a malformed or oversized payload. MCP
  // clients and directory validators only parse JSON-RPC, so shape it here.
  app.use(
    "/mcp",
    (
      error: Error & { status?: number; statusCode?: number },
      _req: express.Request,
      res: express.Response,
      next: express.NextFunction
    ) => {
      if (res.headersSent) {
        next(error);
        return;
      }
      log("MCP request rejected before dispatch:", error);

      const status = error.status ?? error.statusCode ?? 500;
      const clientError = status >= 400 && status < 500;
      res.status(clientError ? status : 500).json({
        jsonrpc: "2.0",
        error: {
          code: clientError ? PARSE_ERROR : INTERNAL_ERROR,
          message: clientError
            ? "The request body is not a valid JSON-RPC message."
            : "The MCP request could not be processed.",
        },
        id: null,
      });
    }
  );

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
    error: { code: UNAUTHENTICATED, message },
    id: null,
  });
}

/**
 * Resolve the credential a tool handler is allowed to spend.
 *
 * Anonymous exchanges only ever reach metadata methods, so no tool handler
 * should observe one. Should a future routing change let a call through, fail
 * loudly here rather than let makeRequest fall back to the operator's own
 * SEARCH1API_KEY and bill an unauthenticated caller to us.
 */
function toolCredential(authInfo?: AuthInfo) {
  if (authInfo?.token) {
    return authInfo.token;
  }
  return unauthenticatedCredential(
    "Authentication is required to call Search1API tools."
  );
}

/**
 * Collect every JSON-RPC method named by one HTTP exchange.
 *
 * The 2026-07-28 transport routes on the mcp-method header while the body
 * repeats the method, and a legacy batch names one per array entry; all of them
 * have to be public for the exchange to be. Returns null when any part of the
 * request names no method, so an unrecognised shape falls through to the
 * authenticated path instead of being mistaken for discovery.
 */
function requestedMcpMethods(req: express.Request): string[] | null {
  const methods: string[] = [];

  const headerMethod = req.headers["mcp-method"];
  if (typeof headerMethod === "string" && headerMethod.trim()) {
    methods.push(headerMethod.trim());
  }

  const entries = Array.isArray(req.body) ? req.body : [req.body];
  for (const entry of entries) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      return null;
    }
    const method = (entry as { method?: unknown }).method;
    if (typeof method !== "string" || !method) {
      return null;
    }
    methods.push(method);
  }

  return methods.length > 0 ? methods : null;
}

/** Whether this exchange may be served without any credential at all. */
function isPublicDiscovery(req: express.Request): boolean {
  if (req.method !== "POST") {
    return false;
  }
  const methods = requestedMcpMethods(req);
  return (
    methods !== null && methods.every((method) => PUBLIC_MCP_METHODS.has(method))
  );
}

type McpAuthOutcome =
  | { status: "authenticated"; credential: AuthenticatedCredential }
  | { status: "anonymous" }
  | { status: "handled" };

async function authenticateMcpRequest(
  req: express.Request,
  res: express.Response,
  credentialValidator: CredentialValidator,
  allowAnonymous: boolean
): Promise<McpAuthOutcome> {
  const credential = extractCredential(req);
  if (!credential) {
    if (allowAnonymous) {
      return { status: "anonymous" };
    }
    challenge(
      res,
      "Authentication is required. Use OAuth 2.1 discovery or provide a Search1API API key as a Bearer token."
    );
    return { status: "handled" };
  }

  // A presented credential is validated even on a discovery method, so an
  // expired token still draws the OAuth challenge when a client reconnects
  // rather than surfacing as a failed tool call later in the session.
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
    return { status: "handled" };
  }

  if (!authenticated) {
    challenge(
      res,
      "The Bearer credential is invalid or expired.",
      "invalid_token"
    );
    return { status: "handled" };
  }
  return { status: "authenticated", credential: authenticated };
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
