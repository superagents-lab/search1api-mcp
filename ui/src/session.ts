import type { App, McpUiHostContext } from "@modelcontextprotocol/ext-apps";

export type Source = { id: string; title: string; url: string; favicon?: string };
export type ViewState = {
  status: "waiting" | "done" | "error" | "cancelled";
  sources: Source[];
  message?: string;
  title?: string;
  linkError?: string;
  blockedUrl?: string;
  context?: McpUiHostContext;
};

export function webUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return;
    return url.href;
  } catch { return; }
}

export function parseSources(data: unknown): Source[] {
  if (!data || typeof data !== "object" || !("results" in data) || !Array.isArray(data.results)) {
    throw new Error("Invalid search results");
  }
  return data.results.map((item: unknown, index: number) => {
    if (!item || typeof item !== "object" || !("url" in item) || !("title" in item)) throw new Error("Invalid source");
    const url = webUrl(item.url);
    if (!url || typeof item.title !== "string") throw new Error("Invalid source");
    return {
      id: `${index}:${url}`,
      title: item.title || new URL(url).hostname,
      url,
      favicon: `https://icons.duckduckgo.com/ip3/${new URL(url).hostname}.ico`,
    };
  });
}

type Bridge = Pick<App, "connect" | "close" | "getHostContext" | "openLink" | "ontoolresult" | "ontoolinput" | "ontoolcancelled" | "onhostcontextchanged" | "onclose">;

// A single connection per iframe, independent of React effect remounts.
export function createSearchSession(app: Bridge) {
  let state: ViewState = { status: "waiting", sources: [] };
  let started: Promise<void> | undefined;
  const listeners = new Set<() => void>();
  const update = (patch: Partial<ViewState>) => {
    state = { ...state, ...patch };
    listeners.forEach((listener) => listener());
  };
  app.ontoolinput = () => {}; // Input does not identify live execution versus replay.
  app.ontoolresult = (result) => {
    if (result.isError) {
      update({ status: "error", sources: [], message: "Results could not be prepared. Refer to the source results in the conversation." });
      return;
    }
    try {
      const data = result.structuredContent;
      update({ status: "done", sources: parseSources(data), title: data && typeof data === "object" && "title" in data && typeof data.title === "string" ? data.title : undefined, message: undefined });
    } catch {
      update({ status: "error", sources: [], message: "These results could not be displayed. Refer to the source results in the conversation." });
    }
  };
  app.ontoolcancelled = () => update({ status: "cancelled", sources: [], message: "Result display cancelled." });
  app.onhostcontextchanged = (context) => update({ context: { ...state.context, ...context } });
  app.onclose = () => {
    if (state.status === "waiting") update({ status: "error", message: "Connection to the host was lost. Reopen the result view." });
  };

  return {
    getSnapshot: () => state,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    start: () => started ??= app.connect(undefined, { timeout: 15_000 }).then(() => {
      update({ context: app.getHostContext() });
    }).catch(() => {
      update({ status: "error", message: "Could not connect to the host. Reopen the result view; your results remain available in the conversation." });
    }),
    openLink: async (value: string) => {
      const url = webUrl(value);
      update({ linkError: undefined, blockedUrl: undefined });
      if (!url) { update({ linkError: "This source does not have a valid web link." }); return; }
      try {
        const result = await app.openLink({ url });
        if (result.isError) throw new Error("Host denied link");
      } catch {
        update({ linkError: "The host could not open this link. Copy the URL below.", blockedUrl: url });
      }
    },
    close: () => app.close(),
  };
}
