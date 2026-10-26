# Changelog

## 0.9.0 - 2026-10-26

- Add `send_feedback` to both remote HTTP and local stdio, built on the public Agentback SDK. Agents can report wrong results, unresolved errors and missing capabilities to the Search1API team at no credit cost. With a Search1API credential the report carries the signed account; without one it is sent anonymously.
- Advertise a one-line server description in `serverInfo` and require MCP server SDK 2.3.1.
- Declare tool idempotency and describe what each tool returns.
- Name the server Search1API for hosts that read the server name.

## 0.8.0 - 2026-10-14

- Add `render_results` to both remote HTTP and local stdio. Present selected existing sources as interactive cards in MCP Apps hosts, with a complete text list and structured JSON for every client. Rendering does not repeat a search or consume search credits.
- Keep data retrieval tools separate from presentation; remove the experimental `ui` URL switch. The default MCP endpoint exposes the renderer without special parameters.
- Bundle the source-card UI and attribution in the npm package. Cards support source expansion, collapse, host sizing and accessible waiting/error states.
- Let portable hosts choose their sandbox origin while retaining ChatGPT's dedicated origin through its OpenAI metadata alias. Keep the previous deployed UI resource readable for cached tool definitions.
- Advertise the existing 512×512 square logo through standard `serverInfo.icons`, the server card and registry metadata. Include the PNG in the npm package.
- Refresh plugin descriptions around multi-engine web access and interactive source cards, and use English-only plugin skills.

## 0.7.1 - 2026-10-12

Read GitHub and Hacker News fields from the HTTP API result `metadata` object. MCP result metadata, dates, snippets and full-content indicators keep their existing output shape. No fallback to the removed API top-level fields.
