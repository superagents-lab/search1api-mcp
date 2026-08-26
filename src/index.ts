#!/usr/bin/env node
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { API_KEY } from "./config.js";
import { createMcpServer, unauthenticatedCredential } from "./server.js";
import { log } from "./utils.js";

function main() {
  // Serve even without a key: clients and directory tooling routinely probe a
  // freshly installed package for its tool list before any credential is
  // configured, and exiting here leaves them with a dead pipe rather than an
  // answer. Tool calls still refuse until SEARCH1API_KEY is set.
  if (!API_KEY) {
    log(
      "SEARCH1API_KEY is not set; serving tool metadata only. Set it to run searches."
    );
  }

  log("Starting Search1API MCP server (stdio mode)");
  const handle = serveStdio(
    () =>
      createMcpServer(
        API_KEY ??
          unauthenticatedCredential(
            "SEARCH1API_KEY is not set. Set it in the server environment to call Search1API tools."
          )
      ),
    {
      legacy: "serve",
      onerror: (error) => log("MCP stdio error:", error),
    }
  );
  log("Server started successfully");

  let closing = false;
  const exitHandler = async () => {
    if (closing) {
      return;
    }
    closing = true;
    log("Shutting down server...");
    await handle.close();
    process.exit(0);
  };

  process.once("SIGINT", exitHandler);
  process.once("SIGTERM", exitHandler);
  process.once("SIGUSR1", exitHandler);
  process.once("SIGUSR2", exitHandler);
}

process.on("uncaughtException", (error) => {
  log("Uncaught exception:", error);
});

process.on("unhandledRejection", (reason) => {
  log("Unhandled rejection:", reason);
});

try {
  main();
} catch (error) {
  log("Failed to start server:", error);
  process.exit(1);
}
