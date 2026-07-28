import { readFileSync, writeFileSync } from "node:fs";

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
);
const manifestUrl = new URL("../lhm.plugin.json", import.meta.url);
const manifest = JSON.parse(readFileSync(manifestUrl, "utf8"));
const { ALL_TOOLS } = await import("../build/tools/index.js");

manifest.version = packageJson.version;
manifest.tools = ALL_TOOLS;

writeFileSync(manifestUrl, `${JSON.stringify(manifest, null, 2)}\n`);
