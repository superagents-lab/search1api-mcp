import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Built by `npm run build` in ui/, relative to build/ui.js.
const SEARCH_UI_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "../ui/dist/index.html"
);

export function readSearchUi(): string {
  return readFileSync(SEARCH_UI_PATH, "utf8");
}

function searchUiVersion(): string | undefined {
  try {
    return createHash("sha256")
      .update(readSearchUi())
      .update(JSON.stringify(SEARCH_UI_META))
      .digest("hex").slice(0, 10);
  } catch {
    return undefined;
  }
}

export const MCP_APP_MIME_TYPE = "text/html;profile=mcp-app";

/**
 * Directory listings omit the content-hashed view link. Copy metadata so
 * shared runtime tool definitions stay intact.
 */
export function withoutUiMeta<T extends { _meta?: Record<string, unknown> }>(
  tool: T
): T {
  if (!tool._meta) return tool;
  const { ui: _ui, "ui/resourceUri": _legacy, ...meta } = tool._meta;
  return { ...tool, _meta: meta };
}

// ChatGPT accepts an HTTPS origin; other hosts validate ui.domain differently.
// Keep this identity in the OpenAI alias so portable hosts choose their origin.
function uiDomain(): string {
  const value = process.env.SEARCH1API_UI_DOMAIN ?? "https://mcp.search1api.com";
  const url = new URL(value);
  if (url.protocol !== "https:" || url.origin !== value) {
    throw new Error("SEARCH1API_UI_DOMAIN must be an HTTPS origin without a path or credentials");
  }
  return value;
}

// Standard size-changed notifications remain authoritative once the view loads.
export const SEARCH_UI_META = {
  ui: {
    csp: { connectDomains: [], resourceDomains: ["https://icons.duckduckgo.com"] },
    prefersBorder: true,
  },
  "openai/widgetDomain": uiDomain(),
  "openai/ui": {
    availableDisplayModes: ["inline"],
    preferredDisplayMode: "inline",
  },
  // Optional hints supported by the current ChatGPT desktop host, not portable
  // MCP Apps fields. The shared view measures 154px for both search and news.
  // Reserve one result row initially and allow the internal toggle to shrink it.
  "openai/widgetHeightHint": 154,
  "openai/widgetMinFrameHeight": 0,
  "openai/widgetDescription": "Search1API source cards with titles, domains, and links. Displays results passed to render_results; expanding sources does not run a search or consume credits.",
};

const version = searchUiVersion();

/**
 * Reused source-card view. Version both HTML and metadata because hosts may
 * cache the entire resource by URI, including its initial sizing hints.
 * Without a UI build, render_results still returns its full text list.
 */
export const SEARCH_UI_URI: string | undefined = version
  ? `ui://search1api/web-search-${version}.html`
  : undefined;

// Keep the deployed renderer link readable for hosts with cached tool metadata.
// The HTML contract is unchanged; only its host-specific sandbox hint changed.
export const SEARCH_UI_COMPAT_URIS = ["ui://search1api/web-search-135d050d9e.html"];
