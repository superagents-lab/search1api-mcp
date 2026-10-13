import { App, applyDocumentTheme, applyHostFonts, applyHostStyleVariables } from "@modelcontextprotocol/ext-apps";
import { StrictMode, useEffect, useState, useSyncExternalStore, type MouseEvent } from "react";
import { createRoot } from "react-dom/client";
import { WebSearch } from "@/components/ui/web-search";
import { createSearchSession } from "./session";
import "./styles.css";

const app = new App({ name: "Search1API Search Results", version: "0.1.0" }, { availableDisplayModes: ["inline"] });
const session = createSearchSession(app);

function SearchView() {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [open, setOpen] = useState(true);
  const dimensions = state.context?.containerDimensions;
  const heightLimit = dimensions && ("height" in dimensions ? dimensions.height : dimensions.maxHeight);
  const maxWidth = dimensions && ("maxWidth" in dimensions ? dimensions.maxWidth : undefined);

  useEffect(() => {
    const context = state.context;
    if (context?.theme) applyDocumentTheme(context.theme);
    if (context?.styles?.variables) applyHostStyleVariables(context.styles.variables);
    if (context?.styles?.css?.fonts) applyHostFonts(context.styles.css.fonts);
  }, [state.context]);

  const openThroughHost = (event: MouseEvent<HTMLDivElement>) => {
    const anchor = (event.target as Element).closest<HTMLAnchorElement>("a[href]");
    if (!anchor) return;
    event.preventDefault();
    void session.openLink(anchor.href);
  };

  return (
    <div className="search-view"
      style={{ maxWidth, maxHeight: heightLimit, overflowY: heightLimit === undefined ? undefined : "auto" }}
      onClickCapture={openThroughHost}>
      {state.status === "waiting" && (
        <div role="status" aria-busy="true">
          <WebSearch className="w-full" status="searching" sources={[]} open={false}
            label={state.context?.toolInfo?.tool.name === "news" ? "Searching news…"
              : state.context?.toolInfo?.tool.name === "search" ? "Searching the web…" : "Searching…"}
            expandable={false} animateHeight={false} appear={false} />
        </div>
      )}
      {state.message && <p role={state.status === "error" ? "alert" : "status"}>{state.message}</p>}
      {state.status === "done" && state.sources.length === 0 && <p role="status">No results found.</p>}
      {state.status === "done" && state.sources.length > 0 && (
        <WebSearch className="w-full" status="done" label={`Found ${state.sources.length} results`}
          open={open} onOpenChange={setOpen}
          sources={state.sources} animateHeight={false} appear={false} />
      )}
      {state.linkError && <p role="alert" className="link-error">{state.linkError}</p>}
      {state.blockedUrl && <input aria-label="Source URL" className="source-url" readOnly value={state.blockedUrl} onFocus={(event) => event.target.select()} />}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<StrictMode><SearchView /></StrictMode>);
void session.start();
window.addEventListener("pagehide", () => { void session.close(); }, { once: true });
