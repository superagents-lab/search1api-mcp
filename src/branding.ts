import { fileURLToPath } from "node:url";

export const SERVER_ICON_PATH = "/assets/icon-square.png";
export const SERVER_ICON_FILE = fileURLToPath(
  new URL("../assets/icon-square.png", import.meta.url)
);

// Public, same-origin PNG shared by remote and stdio server metadata.
export const SERVER_ICONS = [
  {
    src: `https://mcp.search1api.com${SERVER_ICON_PATH}`,
    mimeType: "image/png",
    sizes: ["512x512"],
  },
];

// Same wording as server.json, advertised in the MCP handshake serverInfo.
export const SERVER_DESCRIPTION =
  "Multi-engine web and platform search, news, Google Maps places, page reading, sitemaps, and trends.";
