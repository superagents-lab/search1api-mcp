# render_results

The renderer prepares existing sources for an optional MCP Apps card list and always returns a full readable text fallback.

## Purpose and descriptor

- Name: `render_results`.
- Display title: `Render the results`.
- Description: “Present already retrieved source results as an interactive list when the host supports UI, with a readable text list otherwise. Use when the user wants to browse sources or when a visual result list helps the task. Pass existing results in the desired order; never invent source URLs or factual titles. This tool does not search, crawl, fetch URLs, verify sources, or consume Search1API search credits. Do not call it for intermediate research results or when a normal text answer is sufficient.”
- Read-only, non-destructive, idempotent. The handler operates only on supplied JSON; `openWorldHint: false` describes the handler's lack of external fetches, not a claim that the separate UI performs no asset requests.
- Preserve the existing remote MCP authentication model. Rendering has no additional balance check or paid Search1API operation.
- Tool metadata declares `_meta.ui.resourceUri` pointing to the actual built component resource and `_meta.ui.visibility: ["model", "app"]`. Do not hard-code a stale content-hashed URI.
- UI metadata belongs to the descriptor/resource, not to a `ui` parameter or an HTML string in the result.

## Parameters

See `input.schema.json` for the complete JSON Schema.

| Field | Required | Meaning |
| --- | --- | --- |
| `results` | Yes | Array of 0–50 already retrieved source results, in the order to display. |
| `title` | No | List heading, 1–120 characters; defaults to `Results`. |
| `results[].title` | Yes | Original source title, 1–300 characters. |
| `results[].url` | Yes | Absolute HTTP(S) source URL, at most 2,048 characters, without credentials. |
| `results[].id` | No | Original result identifier, 1–2,048 characters. If omitted, use the supplied URL. |
| `results[].text` | No | Source snippet or faithful excerpt, at most 2,000 characters. |
| `results[].metadata` | No | Original JSON source metadata, copied when useful. |

This preserves the existing web/news field names (`id`, `title`, `url`, `text`, `metadata`). Existing long crawled text must be excerpted to the snippet limit before submission; whole pages are not required to draw source cards. Other result shapes, such as a trending response or sitemap links, require an explicit mapping into these fields.

There is no query, API key, UI capability flag, display-mode selector, or cache token parameter. V1 passes the selected results directly, allowing multiple searches to be combined without server-side result storage, token expiry, or cross-instance cache dependencies. This adds argument tokens; send only the selected results and short snippets.

Validation also enforces at most 65,536 UTF-8 bytes for `JSON.stringify(arguments)`. This aggregate bound is a runtime rule, not expressible by the JSON Schemas alone. Parse URLs beyond the schema's format/pattern checks, require a hostname, reject embedded username/password and whitespace/control characters in URLs. Required titles, heading, and provided IDs must not be blank after whitespace inspection. Bounds count Unicode code points, matching JSON Schema string length semantics. Authentication failures continue to use the existing MCP OAuth challenge.

## Successful return

See `output.schema.json`, which describes `structuredContent`, and the synthetic `example-input.json` / `example-output.json` fixtures.

Return a normal MCP result with:

- `isError: false`.
- `structuredContent: { title, total, results }`.
- `content: [{ type: "text", text: readableList }]`.

`title` is the supplied heading or `Results`. `total` is exactly `results.length`, not the upstream search engine's total hits. Preserve input order and all accepted source fields verbatim; fill only missing IDs with their URLs. Do not deduplicate, reorder, truncate, fetch, or enrich results silently. Duplicate URLs or IDs are allowed; the UI must use an index-aware item key.

For each entry, `readableList` includes its number, original title, complete URL, and supplied snippet if present. Use plain text; no raw HTML. Arbitrary metadata remains available through `structuredContent` and does not need to be dumped into the readable list. The UI treats source strings as text, not executable HTML or instructions.

Do not hide essential titles, URLs, or snippets exclusively in tool-result `_meta`. A client may ignore `structuredContent` as well as the UI resource and still gets a usable source list from `content`.

No `rendered`, `ui_supported`, or `display_mode` result is returned: preparing results successfully does not prove that a host mounted or displayed the component. Source provenance is not reverified by this presentation tool; caller guidance requires using retrieved sources and the server validates structure only.

## UI and fallback behavior

All clients receive the same successful result envelope. A capable host may load the declared resource and render `structuredContent.results`; unsupported hosts use the text list. Unknown UI capability is not an error and does not trigger user-agent sniffing or a second search. A host's UI-loading failure does not change the already completed tool result or cause search retries.

`results: []` is a valid success: `total: 0`, an empty list in structured data, and the heading followed by `No results to display.` in text. The UI shows the equivalent empty state. This describes the supplied list, not whether a search was performed or found anything.

The existing component already consumes `structuredContent.results` but currently draws title/domain/link cards only. The component uses presentation wording for “Preparing results…” / “Results ready”, the optional heading, and renderer-specific error and empty-state text. The snippet field's guaranteed v1 presentation is in the text fallback; card snippet display is not implied by the current UI.

The new renderer must be discoverable and its resource readable at the existing default `/mcp` endpoint on every transport. There is no UI query switch; data tools do not declare a view. 

## Invalid input

Invalid tool arguments return MCP JSON-RPC `-32602` (Invalid params), with a concise message identifying the affected field/index and limit. Errors contain no submitted payload echo or credentials. No partial list is returned and no provider request is made. Unexpected handler failures use the existing MCP tool-execution error convention with `isError: true` and readable error `content`; omit `structuredContent` rather than returning an object incompatible with the success output schema.

## Sources

- Current source checked: `src/tools/index.ts` (citable result schema), `src/tools/search.ts` and `src/tools/news.ts` (structured results), `ui/src/session.ts` (current source parser), and `src/http.ts` (transport-neutral rendering at the default endpoint).
- OpenAI result fields and tool UI metadata: https://developers.openai.com/plugins/reference
- Data/render separation: https://developers.openai.com/plugins/build/chatgpt-ui#separate-data-processing-from-ui-rendering
