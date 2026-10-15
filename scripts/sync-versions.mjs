// Copy package.json's version into every manifest that ships it, so a
// release can't leave a listing (Cursor, Agent Plugins, LobeHub, MCP
// Registry) on an old version. `npm version` runs this automatically;
// `--check` only reports drift and exits non-zero.
//
// The Claude and Codex plugins are versioned on their own and are not
// listed here.
import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const root = new URL("../", import.meta.url);

export const VERSIONED_MANIFESTS = [
  {
    path: "server.json",
    fields: (manifest) => [
      ["version", manifest, "version"],
      ...manifest.packages
        .filter((pkg) => pkg.registryType === "npm")
        .map((pkg) => [`packages[${pkg.identifier}].version`, pkg, "version"]),
    ],
  },
  { path: "lhm.plugin.json", fields: (manifest) => [["version", manifest, "version"]] },
  { path: "plugin.json", fields: (manifest) => [["version", manifest, "version"]] },
  {
    path: ".cursor-plugin/plugin.json",
    fields: (manifest) => [["version", manifest, "version"]],
  },
];

const readJson = (path) => JSON.parse(readFileSync(new URL(path, root), "utf8"));

export function packageVersion() {
  return readJson("package.json").version;
}

export function findDrift(version = packageVersion()) {
  const drift = [];
  for (const { path, fields } of VERSIONED_MANIFESTS) {
    for (const [field, target, key] of fields(readJson(path))) {
      if (target[key] !== version) {
        drift.push({ path, field, found: target[key], expected: version });
      }
    }
  }
  return drift;
}

function syncVersions(version = packageVersion()) {
  const changed = [];
  for (const { path, fields } of VERSIONED_MANIFESTS) {
    const manifest = readJson(path);
    let dirty = false;
    for (const [, target, key] of fields(manifest)) {
      if (target[key] !== version) {
        target[key] = version;
        dirty = true;
      }
    }
    if (dirty) {
      writeFileSync(new URL(path, root), `${JSON.stringify(manifest, null, 2)}\n`);
      changed.push(path);
    }
  }
  return changed;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const version = packageVersion();
  if (process.argv.includes("--check")) {
    const drift = findDrift(version);
    for (const { path, field, found } of drift) {
      console.error(`${path} ${field} is ${found}, expected ${version}`);
    }
    if (drift.length) {
      console.error("Run `npm run sync:versions` to fix.");
      process.exit(1);
    }
    console.log(`All manifests are at ${version}`);
  } else {
    const changed = syncVersions(version);
    console.log(
      changed.length
        ? `Set version ${version} in ${changed.join(", ")}`
        : `All manifests are already at ${version}`
    );
  }
}
