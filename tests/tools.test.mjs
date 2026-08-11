import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import http from "node:http";
import test from "node:test";
import {
  Client,
  InMemoryTransport,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import {
  INVALID_PARAMS,
  ProtocolError,
} from "@modelcontextprotocol/server";
import { serveStdio } from "@modelcontextprotocol/server/stdio";

process.env.SEARCH1API_KEY = "test-key";

const { createHttpApp } = await import("../build/http.js");
const { createMcpServer } = await import("../build/server.js");
const { handleToolCall } = await import("../build/tools/handlers.js");
const { ALL_TOOLS } = await import("../build/tools/index.js");
const { RESOURCES } = await import("../build/resources.js");
const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
);
const marketplaceManifest = JSON.parse(
  readFileSync(new URL("../lhm.plugin.json", import.meta.url), "utf8")
);

const EXPECTED_TOOLS = [
  "search",
  "news",
  "crawl",
  "sitemap",
  "trending",
];

test("exports only supported public tools", () => {
  assert.deepEqual(
    ALL_TOOLS.map((tool) => tool.name),
    EXPECTED_TOOLS
  );
  assert.equal(
    existsSync(new URL("../build/tools/reasoning.js", import.meta.url)),
    false
  );
});

test("serves MCP 2026-07-28 clients over HTTP", async (context) => {
  const testServer = await startTestHttpServer();
  const client = new Client(
    { name: "search1api-modern-test", version: "1.0.0" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } }
  );
  const transport = createAuthenticatedTransport(testServer.url);

  context.after(async () => {
    await client.close();
    await testServer.close();
  });

  await client.connect(transport);
  const result = await client.listTools();

  assert.equal(client.getProtocolEra(), "modern");
  assert.equal(client.getNegotiatedProtocolVersion(), "2026-07-28");
  assert.equal(client.getServerVersion()?.version, packageJson.version);
  assert.deepEqual(
    result.tools.map((tool) => tool.name),
    EXPECTED_TOOLS
  );
  assert.equal(result.tools[0].title, "Search the web");
  assert.deepEqual(result.tools[0]._meta.securitySchemes, [
    { type: "oauth2", scopes: [] },
  ]);
  assert.deepEqual(result.tools[0].outputSchema.required, ["results"]);
});

test("advertises directory-ready metadata and structured outputs", () => {
  for (const tool of ALL_TOOLS) {
    assert.equal(typeof tool.title, "string");
    assert.equal(tool.annotations?.readOnlyHint, true);
    assert.equal(tool.annotations?.destructiveHint, false);
    assert.equal(tool.annotations?.openWorldHint, true);
    assert.deepEqual(tool.securitySchemes, [
      { type: "oauth2", scopes: [] },
    ]);
    assert.deepEqual(tool._meta.securitySchemes, tool.securitySchemes);
    assert.equal(tool.outputSchema?.type, "object");
  }

  const search = ALL_TOOLS.find((tool) => tool.name === "search");
  assert.deepEqual(search.inputSchema.required, ["query"]);
  assert.deepEqual(search.outputSchema.required, ["results"]);
});

test("keeps 2025-era clients working through the stateless fallback", async (context) => {
  const testServer = await startTestHttpServer();
  const client = new Client(
    { name: "search1api-legacy-test", version: "1.0.0" },
    { versionNegotiation: { mode: "legacy" } }
  );
  const transport = createAuthenticatedTransport(testServer.url);

  context.after(async () => {
    await client.close();
    await testServer.close();
  });

  await client.connect(transport);
  const result = await client.listTools();

  assert.equal(client.getProtocolEra(), "legacy");
  assert.equal(client.getServerVersion()?.version, packageJson.version);
  assert.deepEqual(
    result.tools.map((tool) => tool.name),
    EXPECTED_TOOLS
  );
});

test("serves MCP 2026-07-28 clients over the stdio entry", async (context) => {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const serverHandle = serveStdio(() => createMcpServer("test-key"), {
    transport: serverTransport,
  });
  const client = new Client(
    { name: "search1api-stdio-test", version: "1.0.0" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } }
  );

  context.after(async () => {
    await client.close();
    await serverHandle.close();
  });

  await client.connect(clientTransport);
  const result = await client.listTools();

  assert.equal(client.getProtocolEra(), "modern");
  assert.deepEqual(
    result.tools.map((tool) => tool.name),
    EXPECTED_TOOLS
  );
});

test("authenticates every MCP HTTP request before protocol handling", async (context) => {
  const validatedCredentials = [];
  const testServer = await startTestHttpServer(async (credential) => {
    validatedCredentials.push(credential);
    if (credential === "invalid") {
      return null;
    }
    if (credential === "outage") {
      throw new Error("validation unavailable");
    }
    return { credential, principal: `test:${credential}` };
  });

  context.after(() => testServer.close());

  const request = (authorization) =>
    fetch(testServer.url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(authorization ? { authorization } : {}),
      },
      body: "{}",
    });

  const missing = await request();
  assert.equal(missing.status, 401);
  assert.match(
    missing.headers.get("www-authenticate") ?? "",
    /resource_metadata=/
  );

  const invalid = await request("Bearer invalid");
  assert.equal(invalid.status, 401);
  assert.match(
    invalid.headers.get("www-authenticate") ?? "",
    /error="invalid_token"/
  );

  const unavailable = await request("Bearer outage");
  assert.equal(unavailable.status, 503);
  assert.deepEqual(validatedCredentials, ["invalid", "outage"]);
});

test("does not advertise OIDC session scopes as MCP resource scopes", async (context) => {
  const testServer = await startTestHttpServer();

  context.after(() => testServer.close());

  const metadataUrl = new URL(
    "/.well-known/oauth-protected-resource/mcp",
    testServer.url
  );
  const response = await fetch(metadataUrl);
  const metadata = await response.json();

  assert.equal(response.status, 200);
  assert.equal(metadata.resource, "https://mcp.search1api.com/mcp");
  assert.deepEqual(metadata.authorization_servers, [
    "https://clerk.search1api.com",
  ]);
  assert.equal(
    response.headers.get("cache-control"),
    "public, max-age=60, s-maxage=60"
  );
  assert.equal("scopes_supported" in metadata, false);
});

test("supports a coordinated OAuth issuer cutover", async (context) => {
  const testServer = await startTestHttpServer(undefined, {
    authorizationServer: "https://clerk.s1.dev/",
  });

  context.after(() => testServer.close());

  const metadataResponse = await fetch(
    new URL("/.well-known/oauth-protected-resource/mcp", testServer.url)
  );
  const metadata = await metadataResponse.json();
  assert.deepEqual(metadata.authorization_servers, ["https://clerk.s1.dev"]);

  const redirectResponse = await fetch(
    new URL("/.well-known/oauth-authorization-server", testServer.url),
    { redirect: "manual" }
  );
  assert.equal(redirectResponse.status, 302);
  assert.equal(
    redirectResponse.headers.get("location"),
    "https://clerk.s1.dev/.well-known/oauth-authorization-server"
  );
  assert.equal(
    redirectResponse.headers.get("cache-control"),
    "public, max-age=60, s-maxage=60"
  );
});

test("rejects invalid OAuth authorization server origins", () => {
  for (const authorizationServer of [
    "http://clerk.s1.dev",
    "https://user:password@clerk.s1.dev",
    "https://clerk.s1.dev/oauth",
    "https://clerk.s1.dev?tenant=search1api",
    "https://clerk.s1.dev#oauth",
  ]) {
    assert.throws(
      () => createHttpApp({ authorizationServer }),
      /must be a valid HTTPS origin/
    );
  }
});

test("rejects DNS rebinding attempts before MCP handling", async (context) => {
  let validationCalls = 0;
  const testServer = await startTestHttpServer(async (credential) => {
    validationCalls += 1;
    return { credential, principal: `test:${credential}` };
  });

  context.after(() => testServer.close());

  const response = await rawHttpRequest(testServer.url, {
    method: "POST",
    headers: {
      authorization: "Bearer test-key",
      "content-type": "application/json",
      host: "attacker.example",
    },
    body: "{}",
  });

  assert.equal(response.statusCode, 403);
  assert.equal(validationCalls, 0);
});

test("rejects untrusted Origins before authentication", async (context) => {
  let validationCalls = 0;
  const testServer = await startTestHttpServer(async (credential) => {
    validationCalls += 1;
    return { credential, principal: `test:${credential}` };
  });

  context.after(() => testServer.close());

  const response = await discoverRequest(testServer.url, {
    origin: "https://attacker.example",
  });
  const malformedResponse = await rawHttpRequest(testServer.url, {
    method: "POST",
    headers: {
      authorization: "Bearer test-key",
      "content-type": "application/json",
      origin: "https://attacker.example",
    },
    body: "{",
  });

  assert.equal(response.status, 403);
  assert.equal(malformedResponse.statusCode, 403);
  assert.equal(validationCalls, 0);
});

test("allows non-browser MCP requests without an Origin", async (context) => {
  let validationCalls = 0;
  const testServer = await startTestHttpServer(async (credential) => {
    validationCalls += 1;
    return { credential, principal: `test:${credential}` };
  });

  context.after(() => testServer.close());

  const response = await discoverRequest(testServer.url);

  assert.equal(response.status, 200);
  assert.equal(validationCalls, 1);
});

test("allows explicitly trusted Origins", async (context) => {
  let validationCalls = 0;
  const testServer = await startTestHttpServer(
    async (credential) => {
      validationCalls += 1;
      return { credential, principal: `test:${credential}` };
    },
    { allowedOriginHostnames: ["trusted.example"] }
  );

  context.after(() => testServer.close());

  const response = await discoverRequest(testServer.url, {
    origin: "https://trusted.example",
  });

  assert.equal(response.status, 200);
  assert.equal(validationCalls, 1);
});

test("tells crawlers to skip the transport host", async (context) => {
  const testServer = await startTestHttpServer();

  context.after(() => testServer.close());

  const response = await fetch(new URL("/robots.txt", testServer.url));

  assert.equal(response.status, 200);

  const body = await response.text();

  assert.match(body, /^User-agent: \*$/m);
  assert.match(body, /^Disallow: \/$/m);
  assert.match(body, /^Allow: \/\.well-known\/$/m);
});

test("rejects retired or unknown tools before making an API request", async () => {
  for (const toolName of ["fetch", "reasoning"]) {
    await assert.rejects(
      handleToolCall(toolName, {}),
      (error) =>
        error instanceof ProtocolError &&
        error.code === INVALID_PARAMS &&
        error.message.includes(`Unknown tool: ${toolName}`)
    );
  }
});

test("keeps the LobeHub marketplace manifest aligned with the server", () => {
  assert.equal(
    marketplaceManifest.identifier,
    "fatwang2-search1api-mcp"
  );
  assert.equal(marketplaceManifest.version, packageJson.version);
  assert.deepEqual(marketplaceManifest.tools, ALL_TOOLS);
  assert.deepEqual(marketplaceManifest.resources, RESOURCES);
  assert.match(marketplaceManifest.description, /OAuth 2\.1/);
  assert.doesNotMatch(
    JSON.stringify(marketplaceManifest),
    /reasoning|deepseek/i
  );
});

function createAuthenticatedTransport(url) {
  return new StreamableHTTPClientTransport(url, {
    requestInit: {
      headers: { authorization: "Bearer test-key" },
    },
  });
}

async function startTestHttpServer(
  validateCredential = async (credential) => ({
    credential,
    principal: `test:${credential}`,
  }),
  options = {}
) {
  const httpApp = createHttpApp({ validateCredential, ...options });
  const httpServer = await new Promise((resolve, reject) => {
    const server = httpApp.app.listen(0, "127.0.0.1", () => resolve(server));
    server.on("error", reject);
  });
  const address = httpServer.address();
  if (!address || typeof address === "string") {
    throw new Error("Test HTTP server did not expose a TCP address");
  }

  return {
    url: new URL(`http://127.0.0.1:${address.port}/mcp`),
    async close() {
      await new Promise((resolve, reject) => {
        httpServer.close((error) => (error ? reject(error) : resolve()));
      });
      await httpApp.close();
    },
  };
}

function discoverRequest(url, { origin } = {}) {
  return fetch(url, {
    method: "POST",
    headers: {
      authorization: "Bearer test-key",
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      "mcp-protocol-version": "2026-07-28",
      "mcp-method": "server/discover",
      ...(origin ? { origin } : {}),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "server/discover",
      params: {
        _meta: {
          "io.modelcontextprotocol/protocolVersion": "2026-07-28",
          "io.modelcontextprotocol/clientInfo": {
            name: "search1api-origin-test",
            version: "1.0.0",
          },
          "io.modelcontextprotocol/clientCapabilities": {},
        },
      },
    }),
  });
}

function rawHttpRequest(url, { method, headers, body }) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        method,
        headers,
      },
      (response) => {
        response.resume();
        response.on("end", () => resolve(response));
      }
    );
    request.on("error", reject);
    request.end(body);
  });
}
