#!/usr/bin/env node
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { API_KEY } from "./config.js";
import { createMcpServer } from "./server.js";
import { log } from "./utils.js";

function main() {
  if (!API_KEY) {
    log("SEARCH1API_KEY environment variable is not set");
    process.exit(1);
  }

  log("Starting Search1API MCP server (stdio mode)");
  const handle = serveStdio(() => createMcpServer(API_KEY), {
    legacy: "serve",
    onerror: (error) => log("MCP stdio error:", error),
  });
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
