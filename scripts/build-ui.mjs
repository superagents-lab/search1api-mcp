// Builds the MCP Apps view into ui/dist, which the server reads at runtime.
// ui/ has its own lockfile; install it on first build so `npm ci && npm run
// build` keeps working in CI, release, and deploys. Dev deps are included
// because vite is one, even when NODE_ENV=production.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ui = fileURLToPath(new URL("../ui/", import.meta.url));

function run(args) {
  const result = spawnSync("npm", args, {
    cwd: ui,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

if (!existsSync(join(ui, "node_modules/.package-lock.json"))) {
  run(["ci", "--include=dev", "--no-audit", "--no-fund"]);
}
run(["run", "build"]);
