import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// This app has one entry and no dynamic chunks. Refuse unexpected outputs instead
// of shipping an HTML resource that depends on a local filesystem or CDN.
function singleHtml(): Plugin {
  return {
    name: "search1api-single-html",
    enforce: "post",
    generateBundle(_options, bundle) {
      const html = bundle["index.html"];
      if (!html || html.type !== "asset") throw new Error("Missing UI HTML");
      let source = String(html.source);
      source = source.replace(/<script\b[^>]*src="([^"]+)"[^>]*><\/script>/g, (_tag, path: string) => {
        const asset = bundle[path.replace(/^\//, "")];
        if (!asset || asset.type !== "chunk" || asset.imports.length || asset.dynamicImports.length) throw new Error(`UI script must be self-contained: ${path}`);
        delete bundle[asset.fileName];
        return `<script type="module">${asset.code.replace(/<\/script/gi, "<\\/script")}</script>`;
      });
      source = source.replace(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_tag, path: string) => {
        const asset = bundle[path.replace(/^\//, "")];
        if (!asset || asset.type !== "asset") throw new Error(`Missing UI CSS: ${path}`);
        delete bundle[asset.fileName];
        return `<style>${String(asset.source).replace(/<\/style/gi, "<\\/style")}</style>`;
      });
      if (Object.keys(bundle).some((key) => key !== "index.html")) throw new Error("UI build produced unbundled assets");
      const notices = readFileSync(new URL("../THIRD_PARTY_NOTICES.md", import.meta.url), "utf8");
      html.source = source.replace("<head>", `<head>\n<!-- ${notices.replace(/--/g, "—")} -->`);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), singleHtml()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  build: { outDir: "dist", emptyOutDir: true, assetsInlineLimit: Infinity, cssCodeSplit: false, modulePreload: false },
});
