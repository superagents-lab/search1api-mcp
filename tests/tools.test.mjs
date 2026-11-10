import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from "node:fs";
import http from "node:http";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
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

const { cacheCredentialValidation, createHttpApp } = await import(
  "../build/http.js"
);
const { createMcpServer, unauthenticatedCredential } = await import(
  "../build/server.js"
);
const { handleToolCall } = await import("../build/tools/handlers.js");
const { DEEPCRAWL_POLLING } = await import("../build/tools/deepcrawl.js");
const { ALL_TOOLS } = await import("../build/tools/index.js");
const { RESOURCES } = await import("../build/resources.js");
const { withoutUiMeta } = await import("../build/ui.js");
const ROOT = fileURLToPath(new URL("..", import.meta.url));
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
  "ask",
  "maps",
  "deepcrawl",
  "render_results",
];
const EXPECTED_SERVED_TOOLS = [...EXPECTED_TOOLS, "send_feedback"];

const EXPECTED_ICONS = [{
  src: "https://mcp.search1api.com/assets/icon-square.png",
  mimeType: "image/png",
  sizes: ["512x512"],
}];

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
  assert.deepEqual(client.getServerVersion()?.icons, EXPECTED_ICONS);
  assert.equal(client.getServerVersion()?.version, packageJson.version);
  assert.equal(
    client.getServerVersion()?.description,
    JSON.parse(readFileSync(new URL("../server.json", import.meta.url), "utf8")).description
  );
  assert.deepEqual(
    result.tools.map((tool) => tool.name),
    EXPECTED_SERVED_TOOLS
  );
  assert.deepEqual(
    result.tools.find((tool) => tool.name === "send_feedback").annotations,
    {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    }
  );
  assert.equal(result.tools[0].title, "Web search");
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
    assert.equal(tool.annotations?.openWorldHint, tool.name !== "render_results");
    // Billed tools are not idempotent; only the credit-free renderer is.
    assert.equal(tool.annotations?.idempotentHint, tool.name === "render_results");
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
  assert.deepEqual(client.getServerVersion()?.icons, EXPECTED_ICONS);
  assert.equal(client.getServerVersion()?.version, packageJson.version);
  assert.deepEqual(
    result.tools.map((tool) => tool.name),
    EXPECTED_SERVED_TOOLS
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
  assert.deepEqual(client.getServerVersion()?.icons, EXPECTED_ICONS);
  assert.deepEqual(
    result.tools.map((tool) => tool.name),
    EXPECTED_SERVED_TOOLS
  );
});

test("serves the square implementation icon anonymously without credential validation", async (context) => {
  let validationCalls = 0;
  const testServer = await startTestHttpServer(async () => {
    validationCalls += 1;
    throw new Error("Public icon must not validate credentials");
  });
  context.after(() => testServer.close());

  const card = await (await fetch(new URL("/.well-known/mcp/server-card.json", testServer.url))).json();
  assert.deepEqual(card.icons, EXPECTED_ICONS);
  assert.deepEqual(card.serverInfo.icons, EXPECTED_ICONS);
  const registry = JSON.parse(readFileSync(new URL("../server.json", import.meta.url), "utf8"));
  assert.deepEqual(registry.icons, EXPECTED_ICONS);
  assert.equal(new URL(card.icons[0].src).origin, new URL(card.serverUrl).origin);

  const response = await fetch(new URL(new URL(card.icons[0].src).pathname, testServer.url), { redirect: "manual" });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.equal(response.headers.get("www-authenticate"), null);
  const png = Buffer.from(await response.arrayBuffer());
  assert.deepEqual(png, readFileSync(new URL("../assets/icon-square.png", import.meta.url)));
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(png.readUInt32BE(16), 512);
  assert.equal(png.readUInt32BE(20), 512);
  assert.equal(validationCalls, 0);
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
  assert.match(
    missing.headers.get("www-authenticate") ?? "",
    /scope="offline_access"/
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

test("refuses a rejected credential locally until the cache entry expires", async () => {
  let clock = 0;
  const calls = [];
  const validator = cacheCredentialValidation(
    async (credential) => {
      calls.push(credential);
      if (credential === "outage") {
        throw new Error("validation unavailable");
      }
      return credential.startsWith("dead")
        ? null
        : { credential, principal: `test:${credential}` };
    },
    { rejectedTtlMs: 60_000, maxEntries: 2, now: () => clock }
  );

  assert.equal(await validator("dead-1"), null);
  clock = 59_999;
  assert.equal(await validator("dead-1"), null);
  assert.deepEqual(calls, ["dead-1"]);

  clock = 60_000;
  assert.equal(await validator("dead-1"), null);
  assert.deepEqual(calls, ["dead-1", "dead-1"]);

  // Outages are checked every time.
  await assert.rejects(validator("outage"));
  await assert.rejects(validator("outage"));
  assert.deepEqual(calls.slice(2), ["outage", "outage"]);

  // The oldest entry is evicted once the cache is full.
  await validator("dead-2");
  await validator("dead-3");
  calls.length = 0;
  await validator("dead-1");
  await validator("dead-3");
  assert.deepEqual(calls, ["dead-1"]);
});

test("reuses an accepted credential for its TTL, then checks it again", async () => {
  let clock = 0;
  const calls = [];
  const validator = cacheCredentialValidation(
    async (credential) => {
      calls.push(credential);
      return { credential, principal: `test:${credential}` };
    },
    { acceptedTtlMs: 60_000, now: () => clock }
  );

  assert.deepEqual(await validator("live"), {
    credential: "live",
    principal: "test:live",
  });
  clock = 59_999;
  assert.deepEqual(await validator("live"), {
    credential: "live",
    principal: "test:live",
  });
  assert.deepEqual(calls, ["live"]);

  clock = 60_000;
  await validator("live");
  assert.deepEqual(calls, ["live", "live"]);

  // A different credential is its own entry.
  await validator("other");
  assert.deepEqual(calls, ["live", "live", "other"]);
});

test("re-checks an accepted credential that has since been rejected only after the TTL", async () => {
  let clock = 0;
  let revoked = false;
  const validator = cacheCredentialValidation(
    async (credential) =>
      revoked ? null : { credential, principal: `test:${credential}` },
    { acceptedTtlMs: 60_000, rejectedTtlMs: 60_000, now: () => clock }
  );

  assert.ok(await validator("key"));
  revoked = true;
  clock = 30_000;
  assert.ok(await validator("key"));
  clock = 60_000;
  assert.equal(await validator("key"), null);
});

test("shares one upstream check between concurrent requests for a credential", async () => {
  const calls = [];
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const validator = cacheCredentialValidation(async (credential) => {
    calls.push(credential);
    await gate;
    if (credential === "outage") {
      throw new Error("validation unavailable");
    }
    return { credential, principal: `test:${credential}` };
  });

  const results = Promise.all([validator("live"), validator("live")]);
  const outages = Promise.allSettled([validator("outage"), validator("outage")]);
  release();
  const [first, second] = await results;
  assert.deepEqual(first, second);
  assert.deepEqual(
    (await outages).map((outcome) => outcome.status),
    ["rejected", "rejected"]
  );
  assert.deepEqual(calls, ["live", "outage"]);

  // A shared outage is not cached: the next request checks again.
  await assert.rejects(validator("outage"));
  assert.deepEqual(calls, ["live", "outage", "outage"]);
});

test("validates an accepted credential once across repeated MCP requests", async (context) => {
  const validatedCredentials = [];
  const testServer = await startTestHttpServer(async (credential) => {
    validatedCredentials.push(credential);
    return { credential, principal: `test:${credential}` };
  });
  context.after(() => testServer.close());

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await discoverRequest(testServer.url);
    assert.equal(response.status, 200);
  }
  assert.deepEqual(validatedCredentials, ["test-key"]);
});

test("does not re-validate a rejected credential on every MCP request", async (context) => {
  const validatedCredentials = [];
  const testServer = await startTestHttpServer(async (credential) => {
    validatedCredentials.push(credential);
    return null;
  });
  context.after(() => testServer.close());

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await discoverRequest(testServer.url);
    assert.equal(response.status, 401);
    assert.match(
      response.headers.get("www-authenticate") ?? "",
      /error="invalid_token"/
    );
  }
  assert.deepEqual(validatedCredentials, ["test-key"]);
});

test("advertises only the minimal OAuth scopes", async (context) => {
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
    "https://clerk.s1.dev",
  ]);
  assert.equal(
    response.headers.get("cache-control"),
    "public, max-age=60, s-maxage=60"
  );
  assert.deepEqual(metadata.scopes_supported, ["offline_access"]);
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

test("logs refused MCP requests and connection attempts, not bare pings", async (context) => {
  const testServer = await startTestHttpServer(async () => null);
  const logged = [];
  const originalError = console.error;
  console.error = (...args) => logged.push(args.join(" "));
  context.after(async () => {
    console.error = originalError;
    await testServer.close();
  });

  await discoverRequest(testServer.url, { origin: "https://attacker.example" });
  await rawHttpRequest(testServer.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping" }),
  });
  await rawHttpRequest(testServer.url, {
    method: "POST",
    headers: {
      authorization: "Bearer rejected-token",
      "content-type": "application/json",
      "user-agent": "scanner-test",
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "ping" }),
  });
  await new Promise((resolve) => setImmediate(resolve));

  await discoverRequest(testServer.url, { anonymous: true });
  await new Promise((resolve) => setImmediate(resolve));

  const connections = logged.filter((line) => line.includes("MCP connection"));
  assert.equal(connections.length, 1);
  assert.match(connections[0], /POST 401/);
  assert.match(connections[0], /"rpcMethod":"server\/discover"/);
  assert.match(connections[0], /"client":"search1api-origin-test"/);
  assert.match(connections[0], /"credential":false/);

  const refusals = logged.filter((line) => line.includes("MCP request refused"));
  assert.equal(refusals.length, 2);
  assert.match(refusals[0], /POST 403/);
  assert.match(refusals[0], /attacker\.example/);
  assert.match(refusals[1], /POST 401/);
  assert.match(refusals[1], /"rpcMethod":"ping"/);
  assert.match(refusals[1], /"credential":true/);
  assert.match(refusals[1], /scanner-test/);
  assert.ok(!refusals.join("\n").includes("rejected-token"));
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

test("answers the root with 200 so the widget domain responds, forwarding to the product page", async (context) => {
  const testServer = await startTestHttpServer();

  context.after(() => testServer.close());

  const response = await fetch(new URL("/?utm_source=a&ref=b", testServer.url), { redirect: "manual" });

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /^text\/html/);
  assert.equal(response.headers.get("link"), '<https://s1.dev/mcp-server>; rel="canonical"');
  const body = await response.text();
  assert.match(body, /<meta http-equiv="refresh" content="0; url=https:\/\/s1\.dev\/mcp-server\?utm_source=a&amp;ref=b">/);
});

test("shows browsers setup instructions at the MCP URL but still challenges MCP clients", async (context) => {
  const testServer = await startTestHttpServer();

  context.after(() => testServer.close());

  const mcpUrl = new URL("/mcp", testServer.url);
  const page = await fetch(mcpUrl, { headers: { accept: "text/html,application/xhtml+xml,*/*;q=0.8" } });
  assert.equal(page.status, 200);
  assert.match(page.headers.get("content-type"), /^text\/html/);
  const body = await page.text();
  assert.match(body, /https:\/\/mcp\.search1api\.com\/mcp/);
  assert.match(body, /<code>render_results<\/code>/);

  const stream = await fetch(mcpUrl, { headers: { accept: "text/event-stream" } });
  assert.equal(stream.status, 401);
  assert.match(stream.headers.get("www-authenticate"), /resource_metadata=/);

  const bare = await fetch(mcpUrl);
  assert.equal(bare.status, 401);
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

test("serves the OpenAI domain verification token without a credential", async (context) => {
  const testServer = await startTestHttpServer();

  context.after(() => testServer.close());

  const response = await fetch(
    new URL("/.well-known/openai-apps-challenge", testServer.url)
  );

  assert.equal(response.status, 200);
  assert.equal(
    await response.text(),
    "edGbvSAg00ELU99x45v2SjrDPJNLa1gPwjuvlflUJnM"
  );
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
  // The view URI carries a build hash, so listings carry the tools without it.
  assert.deepEqual(marketplaceManifest.tools, ALL_TOOLS.map(withoutUiMeta));
  assert.doesNotMatch(JSON.stringify(marketplaceManifest), /ui:\/\//);
  assert.deepEqual(marketplaceManifest.resources, RESOURCES);
  assert.match(marketplaceManifest.description, /OAuth 2\.1/);
  assert.doesNotMatch(
    JSON.stringify(marketplaceManifest),
    /reasoning|deepseek/i
  );
});

test("answers malformed request bodies with JSON-RPC, not HTML", async (context) => {
  const testServer = await startTestHttpServer();

  context.after(() => testServer.close());

  const response = await fetch(testServer.url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{ not json",
  });

  assert.equal(response.status, 400);
  assert.match(response.headers.get("content-type") ?? "", /application\/json/);

  const payload = await response.json();
  assert.equal(payload.jsonrpc, "2.0");
  assert.equal(payload.id, null);
  assert.equal(typeof payload.error.code, "number");
});

async function sendFeedbackThrough(context, credential) {
  const sent = [];
  context.mock.method(globalThis, "fetch", async (url, init) => {
    if (String(url) === "https://api.search1api.com/feedback/identity") {
      sent.push({ url: String(url), authorization: init.headers.Authorization });
      return Response.json({ account: "user_123", signature: "a".repeat(64) });
    }
    sent.push({ url: String(url), body: JSON.parse(init.body) });
    return Response.json({ id: "fb_1", status: "new" }, { status: 201 });
  });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const serverHandle = serveStdio(() => createMcpServer(credential), {
    transport: serverTransport,
  });
  const client = new Client(
    { name: "search1api-feedback-test", version: "1.0.0" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } }
  );
  context.after(async () => {
    await client.close();
    await serverHandle.close();
  });
  await client.connect(clientTransport);
  const result = await client.callTool({
    name: "send_feedback",
    arguments: { message: "bingcn returned no results", category: "bug" },
  });
  assert.equal(result.isError, undefined, JSON.stringify(result));
  return sent;
}

test("sends agent feedback under the signed-in Search1API account", async (context) => {
  const sent = await sendFeedbackThrough(context, "test-key");

  assert.deepEqual(sent[0], {
    url: "https://api.search1api.com/feedback/identity",
    authorization: "Bearer test-key",
  });
  assert.match(sent[1].url, /^https:\/\/agentback\.app\/f\/af_[a-f0-9]{64}$/);
  assert.deepEqual(sent[1].body, {
    message: "bingcn returned no results",
    category: "bug",
    agent: { name: "search1api-feedback-test 1.0.0" },
    source: "mcp",
    account: "user_123",
    account_signature: "a".repeat(64),
  });
});

test("sends agent feedback anonymously without a credential", async (context) => {
  const sent = await sendFeedbackThrough(
    context,
    unauthenticatedCredential("SEARCH1API_KEY is not set.")
  );

  assert.equal(sent.length, 1);
  assert.equal(sent[0].body.account, undefined);
  assert.equal(sent[0].body.source, "mcp");
});

test("serves tool metadata over stdio without a configured API key", async (context) => {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const serverHandle = serveStdio(
    () => createMcpServer(unauthenticatedCredential("SEARCH1API_KEY is not set.")),
    { transport: serverTransport }
  );
  const client = new Client(
    { name: "search1api-stdio-no-key-test", version: "1.0.0" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } }
  );

  context.after(async () => {
    await client.close();
    await serverHandle.close();
  });

  await client.connect(clientTransport);

  assert.deepEqual(
    (await client.listTools()).tools.map((tool) => tool.name),
    EXPECTED_SERVED_TOOLS
  );

  // The key is present in this process' environment, so a tool call that
  // reached makeRequest would spend it. It must refuse before that.
  const refused = await client.callTool({
    name: "search",
    arguments: { query: "search1api" },
  });

  assert.equal(
    refused.isError,
    true,
    `expected a refusal, got ${JSON.stringify(refused)}`
  );
  assert.match(JSON.stringify(refused), /SEARCH1API_KEY is not set/);
});

test("links only render_results to the readable MCP Apps view", async (context) => {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const serverHandle = serveStdio(
    () => createMcpServer(unauthenticatedCredential("SEARCH1API_KEY is not set.")),
    { transport: serverTransport }
  );
  const client = new Client(
    { name: "search1api-ui-test", version: "1.0.0" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } }
  );

  context.after(async () => {
    await client.close();
    await serverHandle.close();
  });

  await client.connect(clientTransport);

  const { tools } = await client.listTools();
  const search = tools.find((tool) => tool.name === "search");
  const news = tools.find((tool) => tool.name === "news");
  const renderer = tools.find((tool) => tool.name === "render_results");
  const uri = renderer._meta.ui.resourceUri;
  assert.match(uri, /^ui:\/\/search1api\/web-search-[0-9a-f]{10}\.html$/);
  assert.deepEqual(renderer._meta.ui.visibility, ["model", "app"]);
  assert.equal(search._meta?.ui, undefined);
  assert.equal(news._meta?.ui, undefined);
  assert.equal(tools.filter(tool => tool._meta?.ui?.resourceUri).length, 1);
  assert.equal(tools.find((tool) => tool.name === "crawl")._meta?.ui, undefined);

  const [content] = (await client.readResource({ uri })).contents;
  assert.equal(content.mimeType, "text/html;profile=mcp-app");
  assert.match(content.text, /<div id="root">/);
  assert.equal("domain" in content._meta.ui, false, "Portable metadata must not force ChatGPT's sandbox origin on Claude");
  assert.equal(content._meta["openai/widgetDomain"], "https://mcp.search1api.com");
  assert.equal(content._meta["openai/widgetMinFrameHeight"], 0);
  assert.equal(content._meta["openai/widgetHeightHint"], 154);
  assert.deepEqual(content._meta["openai/ui"].availableDisplayModes, ["inline"]);
  assert.match(content.text, /Copyright \(c\) 2026 Swami Malode/);
  assert.doesNotMatch(content.text, /<script[^>]+src=|<link[^>]+rel="stylesheet"/);
  const oldUri = "ui://search1api/web-search-135d050d9e.html";
  assert.notEqual(uri, oldUri, "Sandbox metadata changes must invalidate resource caches");
  const [oldContent] = (await client.readResource({ uri: oldUri })).contents;
  assert.equal(oldContent.uri, oldUri);
  assert.equal(oldContent.text, content.text);
  assert.deepEqual(oldContent._meta, content._meta, "Cached tool definitions must receive the corrected metadata too");
  const listed = (await client.listResources()).resources.find(resource => resource.uri === uri);
  assert.equal("domain" in listed._meta.ui, false);
  assert.equal(listed._meta["openai/widgetDomain"], "https://mcp.search1api.com");
});

// No UI extension is negotiated by these clients. Both protocol eras must
// receive usable rendering text without a query preference or another search.
for (const mode of [{ pin: "2026-07-28" }, "legacy"]) {
  test(`on-demand rendering uses the default HTTP endpoint (${JSON.stringify(mode)})`, async (context) => {
    const originalFetch = globalThis.fetch;
    const apiCalls = [];
    context.mock.method(globalThis, "fetch", async (url, init) => {
      if (String(url).startsWith("https://api.search1api.com/")) {
        apiCalls.push({ url: String(url), body: JSON.parse(init.body) });
        return new Response(JSON.stringify({ results: [{
          title: "Example", link: "https://example.com/", snippet: "A result",
          published_date: "2026-10-13T08:30:00Z",
        }] }), { headers: { "Content-Type": "application/json" } });
      }
      return originalFetch(url, init);
    });
    const testServer = await startTestHttpServer();
    const clients = [];
    context.after(async () => {
      await Promise.all(clients.map(client => client.close()));
      await testServer.close();
    });
    const connect = async (query = "") => {
      const client = new Client({ name: "headless-render-test", version: "1.0.0" }, { versionNegotiation: { mode } });
      clients.push(client);
      const url = new URL(testServer.url); url.search = query;
      await client.connect(query.includes("apiKey=") ? new StreamableHTTPClientTransport(url) : createAuthenticatedTransport(url));
      return client;
    };
    const client = await connect();
    const { tools } = await client.listTools();
    assert.deepEqual(tools.map(tool => tool.name), EXPECTED_SERVED_TOOLS);
    const uri = tools.find(tool => tool.name === "render_results")._meta.ui.resourceUri;
    assert.equal(tools.filter(tool => tool._meta?.ui?.resourceUri).length, 1);
    assert.ok((await client.listResources()).resources.some(resource => resource.uri === uri));
    assert.match((await client.readResource({ uri })).contents[0].text, /<div id="root">/);
    for (const name of ["search", "news"]) {
      assert.equal(tools.find(tool => tool.name === name)._meta?.ui, undefined);
      const result = await client.callTool({ name, arguments: { query: "MCP", max_results: 1 } });
      assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
      const rendered = await client.callTool({ name: "render_results", arguments: { title: "Selected sources", results: result.structuredContent.results } });
      assert.equal(rendered.isError, false);
      assert.deepEqual(rendered.structuredContent.results, result.structuredContent.results);
      assert.equal(rendered.structuredContent.total, 1);
      assert.match(rendered.content[0].text, /Selected sources/);
      assert.match(rendered.content[0].text, /https:\/\/example.com\//);
      assert.match(rendered.content[0].text, /A result/);
      assert.equal("rendered" in rendered.structuredContent, false);
    }
    assert.equal(apiCalls.length, 2, "rendering must not perform an API request");
    for (const query of ["?ui=true", "?ui=false", "?apiKey=test-key"]) {
      const other = await connect(query);
      assert.deepEqual((await other.listTools()).tools, tools, "URL UI parameters have no effect");
      assert.ok((await other.readResource({ uri })).contents[0].text);
    }
    const empty = await client.callTool({ name: "render_results", arguments: { results: [] } });
    assert.deepEqual(empty.structuredContent, { title: "Results", total: 0, results: [] });
    assert.match(empty.content[0].text, /No results to display/);
    const anonymous = await anonymousRequest(testServer.url, { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "render_results", arguments: { results: [] } } });
    assert.equal(anonymous.status, 401);
    assert.match(anonymous.headers.get("www-authenticate"), /resource_metadata=/);
  });
}

test("advertises no view when the UI has not been built", async (context) => {
  // A copy of the build with no ui/dist beside it. It lives inside the repo so
  // its imports still resolve against the repo's node_modules.
  const copy = mkdtempSync(join(ROOT, ".test-no-ui-"));
  context.after(() => rmSync(copy, { recursive: true, force: true }));
  cpSync(join(ROOT, "build"), join(copy, "build"), { recursive: true });
  cpSync(join(ROOT, "package.json"), join(copy, "package.json"));

  const load = (path) => import(pathToFileURL(join(copy, "build", path)).href);
  const { SEARCH_UI_URI } = await load("ui.js");
  const { SEARCH_TOOL, NEWS_TOOL, RENDER_RESULTS_TOOL } = await load("tools/index.js");
  const { createMcpServer: createBareServer, unauthenticatedCredential: bare } =
    await load("server.js");

  assert.equal(SEARCH_UI_URI, undefined);
  assert.equal(SEARCH_TOOL._meta.ui, undefined);
  assert.equal(SEARCH_TOOL._meta["ui/resourceUri"], undefined);
  assert.equal(NEWS_TOOL._meta.ui, undefined);
  assert.equal(NEWS_TOOL._meta["ui/resourceUri"], undefined);
  assert.equal(RENDER_RESULTS_TOOL._meta.ui, undefined);

  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const serverHandle = serveStdio(
    () => createBareServer(bare("SEARCH1API_KEY is not set.")),
    { transport: serverTransport }
  );
  const client = new Client(
    { name: "search1api-no-ui-test", version: "1.0.0" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } }
  );
  context.after(async () => {
    await client.close();
    await serverHandle.close();
  });
  await client.connect(clientTransport);

  const { resources } = await client.listResources();
  assert.equal(
    resources.some((resource) => resource.uri.startsWith("ui://")),
    false
  );
});

test("packs the built view with the server", () => {
  // Scripts are skipped so this checks the files list, not another build.
  const [pack] = JSON.parse(
    execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      shell: process.platform === "win32",
    })
  );
  const files = pack.files.map((file) => file.path);

  assert.ok(files.includes("ui/dist/index.html"));
  assert.ok(files.includes("build/ui.js"));
  assert.ok(files.includes("assets/icon-square.png"));
  assert.ok(files.includes("THIRD_PARTY_NOTICES.md"));
  assert.equal(
    files.some((file) => file.startsWith("ui/src/") || file.startsWith("ui/node_modules/")),
    false
  );
});

test("challenges every unauthenticated request, including discovery", async (context) => {
  let validationCalls = 0;
  const testServer = await startTestHttpServer(async (credential) => {
    validationCalls += 1;
    return { credential, principal: `test:${credential}` };
  });

  context.after(() => testServer.close());

  // The 401 + WWW-Authenticate challenge on the first unauthenticated request
  // is the trigger for the client-side OAuth flow; no method may answer
  // anonymously, or clients that equate "tools listed" with "signed in" would
  // never start authorizing.
  for (const body of [
    {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "directory-scanner", version: "1.0.0" },
      },
    },
    { jsonrpc: "2.0", id: 2, method: "tools/list" },
    {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "search", arguments: { query: "search1api" } },
    },
  ]) {
    const response = await anonymousRequest(testServer.url, body);
    assert.equal(response.status, 401, `status for ${body.method}`);
    assert.match(
      response.headers.get("www-authenticate") ?? "",
      /resource_metadata=/,
      `challenge for ${body.method}`
    );
    const payload = await readRpcPayload(response);
    assert.equal(payload.error.code, -32001, `error body for ${body.method}`);
  }

  // An unauthenticated exchange must never cost an upstream credential check.
  assert.equal(validationCalls, 0);
});

test("keeps an unauthenticated batch behind authentication", async (context) => {
  const testServer = await startTestHttpServer();

  context.after(() => testServer.close());

  const mixedBatch = await anonymousRequest(testServer.url, [
    { jsonrpc: "2.0", id: 1, method: "tools/list" },
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "search", arguments: { query: "search1api" } },
    },
  ]);

  assert.equal(mixedBatch.status, 401);
  assert.match(mixedBatch.headers.get("www-authenticate") ?? "", /resource_metadata=/);
});

test("serves the 2026-07-28 discovery method only with a credential", async (context) => {
  const testServer = await startTestHttpServer();

  context.after(() => testServer.close());

  const challenged = await discoverRequest(testServer.url, { anonymous: true });
  assert.equal(challenged.status, 401);
  assert.match(
    challenged.headers.get("www-authenticate") ?? "",
    /resource_metadata=/
  );

  const authenticated = await discoverRequest(testServer.url);

  assert.equal(authenticated.status, 200);
});

function anonymousRequest(url, body, headers = {}) {
  return fetch(url, {
    method: "POST",
    headers: {
      accept: "application/json, text/event-stream",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

/** Read one JSON-RPC payload from either a JSON or an SSE-framed response. */
async function readRpcPayload(response) {
  const body = await response.text();
  if ((response.headers.get("content-type") ?? "").includes("text/event-stream")) {
    const data = body.split("\n").find((line) => line.startsWith("data:"));
    assert.ok(data, `no SSE data frame in: ${body}`);
    return JSON.parse(data.slice("data:".length).trim());
  }
  return JSON.parse(body);
}

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

function discoverRequest(url, { origin, anonymous } = {}) {
  return fetch(url, {
    method: "POST",
    headers: {
      ...(anonymous ? {} : { authorization: "Bearer test-key" }),
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

function stubFetch(context, body) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), body: JSON.parse(init.body) });
    return new Response(JSON.stringify(body), {
      headers: { "Content-Type": "application/json" },
    });
  };
  context.after(() => {
    globalThis.fetch = original;
  });
  return calls;
}

test("ask sends only the query and returns citable results with intent", async (context) => {
  const calls = stubFetch(context, {
    query: "What are developers saying about Bun 1.3 this month?",
    intent: {
      search_query: "Bun 1.3",
      sources: ["reddit", "hackernews"],
      time_range: "month",
    },
    results: [
      {
        title: "Bun 1.3 thoughts",
        link: "https://news.ycombinator.com/item?id=1",
        snippet: "Discussion",
        source: "hackernews",
        relevance: 0.91,
        published_date: "2026-10-01",
      },
    ],
    errors: [{ source: "reddit", message: "timeout" }],
  });

  const result = await handleToolCall("ask", {
    query: "What are developers saying about Bun 1.3 this month?",
    time_range: "week",
  });

  assert.equal(calls[0].url, "https://api.search1api.com/ask");
  assert.deepEqual(calls[0].body, {
    query: "What are developers saying about Bun 1.3 this month?",
  });
  assert.equal(result.isError, undefined);
  assert.deepEqual(result.structuredContent, {
    intent: {
      search_query: "Bun 1.3",
      sources: ["reddit", "hackernews"],
      time_range: "month",
    },
    results: [
      {
        id: "https://news.ycombinator.com/item?id=1",
        title: "Bun 1.3 thoughts",
        url: "https://news.ycombinator.com/item?id=1",
        text: "Discussion",
        metadata: {
          source: "hackernews",
          relevance: 0.91,
          published_date: "2026-10-01",
        },
      },
    ],
    errors: [{ source: "reddit", message: "timeout" }],
  });
});

test("maps forwards location and paging and returns places as citable results", async (context) => {
  const calls = stubFetch(context, {
    searchParameters: {
      query: "coffee shops",
      country: "us",
      language: "en",
      location: { latitude: 40.7455, longitude: -74.0083, zoom: 15 },
      page: 2,
      max_results: 5,
    },
    results: [
      {
        position: 21,
        name: "Example Coffee",
        place_id: "ChIJ123",
        maps_url: "https://www.google.com/maps/search/?api=1&query=Example+Coffee&query_place_id=ChIJ123",
        address: "210 Spring St, New York, NY 10012",
        category: "Coffee shop",
        rating: 4.6,
        review_count: 822,
        coordinates: { latitude: 40.7253, longitude: -74.0037 },
        open_state: "Open · Closes 12 AM",
        thumbnail: "https://lh3.googleusercontent.com/example",
      },
    ],
  });

  const result = await handleToolCall("maps", {
    query: "coffee shops",
    location: { latitude: 40.7455, longitude: -74.0083, zoom: 15 },
    page: 2,
    max_results: 5,
  });

  assert.equal(calls[0].url, "https://api.search1api.com/maps");
  assert.deepEqual(calls[0].body, {
    query: "coffee shops",
    location: { latitude: 40.7455, longitude: -74.0083, zoom: 15 },
    page: 2,
    max_results: 5,
  });
  assert.equal(result.isError, undefined);
  assert.deepEqual(result.structuredContent, {
    results: [
      {
        id: "ChIJ123",
        title: "Example Coffee",
        url: "https://www.google.com/maps/search/?api=1&query=Example+Coffee&query_place_id=ChIJ123",
        text: "Coffee shop · 4.6★ (822 reviews) · 210 Spring St, New York, NY 10012 · Open · Closes 12 AM",
        metadata: {
          position: 21,
          place_id: "ChIJ123",
          address: "210 Spring St, New York, NY 10012",
          category: "Coffee shop",
          rating: 4.6,
          review_count: 822,
          coordinates: { latitude: 40.7253, longitude: -74.0037 },
          open_state: "Open · Closes 12 AM",
        },
      },
    ],
  });
});

test("maps rejects invalid arguments before making an API request", async () => {
  for (const args of [
    { query: "  " },
    { query: "pizza", page: 2 },
    { query: "pizza", max_results: 21 },
    { query: "pizza", location: { latitude: 91, longitude: 0 } },
    { query: "pizza", country: "usa" },
  ]) {
    await assert.rejects(
      handleToolCall("maps", args),
      (error) => error instanceof ProtocolError && error.code === INVALID_PARAMS
    );
  }
});

const DEEPCRAWL_TASK = "task_123";
const DEEPCRAWL_STATUS_URL = `https://api.search1api.com/deepcrawl/status/${DEEPCRAWL_TASK}`;

/**
 * Answer POST /deepcrawl with `start` and each status check with the next
 * entry of `statuses` (the last one repeats). Polling runs on a millisecond
 * clock so a "still running" answer arrives quickly.
 */
function stubDeepcrawl(context, { start = { status: 202, body: { taskId: DEEPCRAWL_TASK, status: "queued" } }, statuses = [] } = {}) {
  const calls = [];
  // A test may stub several times; always restore what was there before the first.
  const original = globalThis.fetch.deepcrawlOriginal ?? {
    fetch: globalThis.fetch,
    polling: { ...DEEPCRAWL_POLLING },
  };
  DEEPCRAWL_POLLING.intervalMs = 1;
  DEEPCRAWL_POLLING.timeoutMs = 50;
  let next = 0;
  const stub = async (url, init) => {
    calls.push({
      url: String(url),
      method: init.method,
      ...(init.body !== undefined && { body: JSON.parse(init.body) }),
    });
    const answer = init.method === "POST"
      ? start
      : statuses[Math.min(next++, statuses.length - 1)];
    if (answer instanceof Error) {
      throw answer;
    }
    return Response.json(answer.body, { status: answer.status ?? 200 });
  };
  stub.deepcrawlOriginal = original;
  globalThis.fetch = stub;
  context.after(() => {
    globalThis.fetch = original.fetch;
    Object.assign(DEEPCRAWL_POLLING, original.polling);
  });
  return calls;
}

const processing = { body: { taskId: DEEPCRAWL_TASK, status: "processing", message: "Workflow is currently running." } };

test("deepcrawl starts a JSON task, polls it and returns the pages as citable results", async (context) => {
  const calls = stubDeepcrawl(context, {
    statuses: [
      processing,
      {
        body: {
          taskId: DEEPCRAWL_TASK,
          status: "completed",
          success: true,
          message: "Crawled 2 of 2 pages.",
          format: "json",
          stats: { discovered: 40, matched: 3, skipped: 0, crawled: 2, failed: 1 },
          failed: [{ url: "https://hono.dev/docs/broken", error: "HTTP 500" }],
          resultUrl: "https://files.example.com/deepcrawl/task_123.json",
          pages: [
            { url: "https://hono.dev/docs/", title: "Hono docs", content: "# Hono\n\nUltrafast." },
            { url: "https://hono.dev/docs/api", title: null, content: "# API" },
          ],
        },
      },
    ],
  });

  const result = await handleToolCall("deepcrawl", {
    url: "https://hono.dev/docs/",
    include_paths: ["/docs/"],
    exclude_paths: ["/docs/changelog"],
  });

  assert.deepEqual(calls[0], {
    url: "https://api.search1api.com/deepcrawl",
    method: "POST",
    body: {
      url: "https://hono.dev/docs/",
      max_pages: 10,
      include_paths: ["/docs/"],
      exclude_paths: ["/docs/changelog"],
      format: "json",
    },
  });
  assert.deepEqual(calls.slice(1), [
    { url: DEEPCRAWL_STATUS_URL, method: "GET" },
    { url: DEEPCRAWL_STATUS_URL, method: "GET" },
  ]);
  assert.equal(result.isError, undefined);
  assert.deepEqual(result.structuredContent, {
    task_id: DEEPCRAWL_TASK,
    status: "completed",
    message: "Crawled 2 of 2 pages.",
    results: [
      {
        id: "https://hono.dev/docs/",
        title: "Hono docs",
        url: "https://hono.dev/docs/",
        text: "# Hono\n\nUltrafast.",
        metadata: { source: "search1api", position: 1 },
      },
      {
        id: "https://hono.dev/docs/api",
        title: "https://hono.dev/docs/api",
        url: "https://hono.dev/docs/api",
        text: "# API",
        metadata: { source: "search1api", position: 2 },
      },
    ],
    stats: { discovered: 40, matched: 3, skipped: 0, crawled: 2, failed: 1 },
    failed: [{ url: "https://hono.dev/docs/broken", error: "HTTP 500" }],
    result_url: "https://files.example.com/deepcrawl/task_123.json",
    truncated: false,
  });
  assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent);
});

test("deepcrawl bounds page text and points to result_url for the rest", async (context) => {
  const pages = Array.from({ length: 12 }, (_, index) => ({
    url: `https://example.com/docs/${index + 1}`,
    title: `Page ${index + 1}`,
    content: "x".repeat(9_000),
  }));
  stubDeepcrawl(context, {
    statuses: [{
      body: {
        taskId: DEEPCRAWL_TASK,
        status: "completed",
        message: "Crawled 12 pages.",
        resultUrl: "https://files.example.com/deepcrawl/task_123.json",
        pages,
      },
    }],
  });

  const result = await handleToolCall("deepcrawl", { url: "https://example.com/docs/", max_pages: 12, type: "all" });
  const { results, truncated, note, result_url } = result.structuredContent;

  assert.equal(results.length, 12);
  assert.equal(truncated, true);
  assert.equal(result_url, "https://files.example.com/deepcrawl/task_123.json");
  assert.match(note, /result_url/);
  for (const page of results.slice(0, 10)) {
    assert.equal(page.text.length, 8_000);
    assert.deepEqual(page.metadata, {
      source: "search1api",
      position: page.metadata.position,
      truncated: true,
      content_length: 9_000,
    });
  }
  // The 80,000-character budget is spent; later pages keep their title and URL.
  assert.equal(results[10].text, undefined);
  assert.equal(results[11].metadata.truncated, true);
  assert.equal(results.reduce((sum, page) => sum + (page.text?.length ?? 0), 0), 80_000);
});

test("deepcrawl sends type and max_pages and explains a crawl that found nothing", async (context) => {
  const calls = stubDeepcrawl(context, {
    statuses: [{
      body: {
        taskId: DEEPCRAWL_TASK,
        status: "completed",
        message: "No URLs matched include_paths.",
        stats: { discovered: 12, matched: 0, skipped: 0, crawled: 0, failed: 0 },
      },
    }],
  });

  const result = await handleToolCall("deepcrawl", {
    url: "https://example.com",
    type: "all",
    max_pages: 50,
    include_paths: ["/nothing/*"],
  });

  assert.deepEqual(calls[0].body, {
    url: "https://example.com",
    type: "all",
    max_pages: 50,
    include_paths: ["/nothing/*"],
    format: "json",
  });
  assert.deepEqual(result.structuredContent, {
    task_id: DEEPCRAWL_TASK,
    status: "completed",
    message: "No URLs matched include_paths.",
    results: [],
    stats: { discovered: 12, matched: 0, skipped: 0, crawled: 0, failed: 0 },
    failed: [],
    truncated: false,
    note: "The crawl finished without pages; message says why.",
  });
});

test("deepcrawl hands back a task_id when the crawl outlasts the wait, and the follow-up only checks status", async (context) => {
  const calls = stubDeepcrawl(context, { statuses: [processing] });

  const running = await handleToolCall("deepcrawl", { url: "https://example.com" });

  assert.equal(running.isError, undefined);
  assert.equal(running.structuredContent.task_id, DEEPCRAWL_TASK);
  assert.equal(running.structuredContent.status, "running");
  assert.deepEqual(running.structuredContent.results, []);
  assert.match(running.structuredContent.note, /deepcrawl again with \{"task_id": "task_123"\}/);
  assert.match(running.structuredContent.note, /costs no credits/);
  assert.equal(calls.filter((call) => call.method === "POST").length, 1);
  assert.ok(calls.filter((call) => call.method === "GET").length >= 2);

  const followUp = stubDeepcrawl(context, {
    statuses: [{ body: { taskId: DEEPCRAWL_TASK, status: "completed", pages: [{ url: "https://example.com/", title: "Example", content: "Hello" }] } }],
  });
  // url and crawl options are ignored when task_id is given.
  const done = await handleToolCall("deepcrawl", { task_id: DEEPCRAWL_TASK, url: "https://example.com", max_pages: 5 });

  assert.deepEqual(followUp, [{ url: DEEPCRAWL_STATUS_URL, method: "GET" }]);
  assert.equal(done.structuredContent.status, "completed");
  assert.equal(done.structuredContent.results[0].text, "Hello");
});

test("deepcrawl keeps polling through transient status errors", async (context) => {
  stubDeepcrawl(context, {
    statuses: [
      new TypeError("fetch failed"),
      { status: 502, body: { error: "Bad Gateway", message: "Upstream deepcrawl service failed to report task status" } },
      { body: { taskId: DEEPCRAWL_TASK, status: "completed", pages: [] } },
    ],
  });

  const result = await handleToolCall("deepcrawl", { url: "https://example.com" });

  assert.equal(result.isError, undefined);
  assert.equal(result.structuredContent.status, "completed");
});

test("deepcrawl reports start errors, failed tasks and unknown task ids as tool errors", async (context) => {
  stubDeepcrawl(context, {
    start: { status: 402, body: { error: "Payment Required", message: "Insufficient credits" } },
  });
  const unpaid = await handleToolCall("deepcrawl", { url: "https://example.com" });
  assert.equal(unpaid.isError, true);
  assert.equal(unpaid.content[0].text, "Deepcrawl API error: API error: 402 Insufficient credits");

  // A failed task arrives as HTTP 500 with the task payload.
  stubDeepcrawl(context, {
    statuses: [{ status: 500, body: { taskId: DEEPCRAWL_TASK, status: "failed", message: "Workflow errored.", error: "No links found for https://example.com" } }],
  });
  const failed = await handleToolCall("deepcrawl", { url: "https://example.com" });
  assert.equal(failed.isError, true);
  assert.equal(failed.content[0].text, "Deepcrawl task task_123 failed: No links found for https://example.com");

  stubDeepcrawl(context, {
    statuses: [{ status: 404, body: { taskId: "gone", status: "not_found", error: "Not Found", message: "Task not found: gone" } }],
  });
  const missing = await handleToolCall("deepcrawl", { task_id: "gone" });
  assert.equal(missing.isError, true);
  assert.match(missing.content[0].text, /^Deepcrawl task gone was not found/);

  const unauthorized = stubDeepcrawl(context, {
    statuses: [{ status: 401, body: { error: "Unauthorized", message: "Invalid API key" } }],
  });
  const rejected = await handleToolCall("deepcrawl", { task_id: DEEPCRAWL_TASK });
  assert.equal(rejected.isError, true);
  assert.equal(rejected.content[0].text, "Deepcrawl API error: API error: 401 Invalid API key (task_id task_123)");
  assert.equal(unauthorized.length, 1);
});

test("deepcrawl results satisfy the advertised output schema over MCP", async (context) => {
  stubDeepcrawl(context, {
    statuses: [{
      body: {
        taskId: DEEPCRAWL_TASK,
        status: "completed",
        message: "Crawled 1 page.",
        stats: { discovered: 1, matched: 1, skipped: 0, crawled: 1, failed: 0 },
        failed: [],
        resultUrl: "https://files.example.com/deepcrawl/task_123.json",
        pages: [{ url: "https://example.com/", title: "Example", content: "Hello" }],
      },
    }],
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const serverHandle = serveStdio(() => createMcpServer("test-key"), { transport: serverTransport });
  const client = new Client(
    { name: "search1api-deepcrawl-test", version: "1.0.0" },
    { versionNegotiation: { mode: { pin: "2026-07-28" } } }
  );
  context.after(async () => {
    await client.close();
    await serverHandle.close();
  });
  await client.connect(clientTransport);

  const tool = (await client.listTools()).tools.find((candidate) => candidate.name === "deepcrawl");
  assert.equal(tool.inputSchema.properties.max_pages.maximum, 50);
  assert.equal(tool.inputSchema.properties.max_pages.default, 10);
  assert.match(tool.description, /20 credits per started task/);
  assert.match(tool.description, /at no cost/);

  const result = await client.callTool({ name: "deepcrawl", arguments: { url: "https://example.com" } });
  assert.equal(result.isError, undefined);
  assert.equal(result.structuredContent.results[0].url, "https://example.com/");
});

test("deepcrawl rejects invalid arguments before making an API request", async () => {
  for (const args of [
    {},
    { url: "  " },
    { task_id: "  " },
    { url: "https://example.com", max_pages: 51 },
    { url: "https://example.com", max_pages: 0 },
    { url: "https://example.com", max_pages: 2.5 },
    { url: "https://example.com", type: "full" },
    { url: "https://example.com", include_paths: "/docs" },
    { url: "https://example.com", include_paths: [""] },
    { url: "https://example.com", exclude_paths: Array.from({ length: 21 }, (_, index) => `/p${index}`) },
  ]) {
    await assert.rejects(
      handleToolCall("deepcrawl", args),
      (error) => error instanceof ProtocolError && error.code === INVALID_PARAMS
    );
  }
});

test("ask rejects an empty query before making an API request", async () => {
  await assert.rejects(
    handleToolCall("ask", { query: "  " }),
    (error) => error instanceof ProtocolError && error.code === INVALID_PARAMS
  );
});

test("news remains readable over MCP without UI capabilities and retains optional publication dates", async (context) => {
  const calls = stubFetch(context, {
    results: [
      { title: "Dated story", link: "https://example.com/news/1", snippet: "First story", published_date: "2026-10-12T08:30:00Z" },
      { title: "Undated story", link: "https://example.com/news/2", snippet: "Second story" },
    ],
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const serverHandle = serveStdio(() => createMcpServer("news-test-key"), { transport: serverTransport });
  const client = new Client({ name: "text-only-news-client", version: "1.0.0" });
  context.after(async () => { await client.close(); await serverHandle.close(); });
  await client.connect(clientTransport);
  const response = await client.callTool({ name: "news", arguments: { query: "MCP", max_results: 2 } });
  assert.equal(calls.length, 1);
  assert.deepEqual(JSON.parse(response.content[0].text), response.structuredContent);
  assert.equal(response.structuredContent.results[0].metadata.published_date, "2026-10-12T08:30:00Z");
  assert.equal(response.structuredContent.results[1].metadata.published_date, undefined);
  assert.equal(response.structuredContent.results[1].text, "Second story");
});

test("search accepts new engines and pagination and keeps source fields", async (context) => {
  const calls = stubFetch(context, {
    searchParameters: { query: "bun", search_service: "github", max_results: 1 },
    results: [
      {
        title: "oven-sh/bun",
        link: "https://github.com/oven-sh/bun",
        snippet: "Incredibly fast JavaScript runtime",
        published_date: "2021-04-14T00:00:00Z",
        metadata: {
          kind: "repo",
          stars: 80000,
          language: "Zig",
        },
      },
    ],
  });

  for (const search_service of ["bingcn", "yandex", "grokipedia"]) {
    await handleToolCall("search", { query: "bun", search_service, page: 2 });
  }
  const result = await handleToolCall("search", {
    query: "bun",
    search_service: "github",
    time_range: "week",
  });

  assert.deepEqual(
    calls.map((call) => call.body.search_service),
    ["bingcn", "yandex", "grokipedia", "github"]
  );
  assert.equal(calls[0].body.page, 2);
  assert.deepEqual(result.structuredContent.results[0].metadata, {
    snippet: "Incredibly fast JavaScript runtime",
    published_date: "2021-04-14T00:00:00Z",
    kind: "repo",
    stars: 80000,
    language: "Zig",
  });
  await assert.rejects(
    handleToolCall("search", { query: "bun", page: 0 }),
    (error) => error instanceof ProtocolError && error.code === INVALID_PARAMS
  );
});

test("news flattens API metadata into MCP metadata without losing zeros or dates", async (context) => {
  stubFetch(context, {
    searchParameters: { query: "q", search_service: "hackernews" },
    results: [
      {
        title: "Thread",
        link: "https://news.ycombinator.com/item?id=1",
        snippet: "Discussion",
        content: "Full discussion",
        published_date: "2026-10-12",
        metadata: {
          points: 0,
          num_comments: 0,
          story_url: "https://example.com/article",
          future_field: true,
        },
      },
      { title: "Plain", link: "https://example.com/", snippet: "No metadata" },
    ],
  });
  const result = await handleToolCall("news", { query: "q", search_service: "hackernews" });
  assert.deepEqual(result.structuredContent.results[0].metadata, {
    points: 0,
    num_comments: 0,
    story_url: "https://example.com/article",
    future_field: true,
    snippet: "Discussion",
    has_full_content: true,
    published_date: "2026-10-12",
  });
  assert.deepEqual(result.structuredContent.results[1].metadata, { snippet: "No metadata" });
});
