# Changelog

## Unreleased — remote service

- Add optional shared source cards for `search` and `news`, enabled only when the remote URL contains `ui=true`. Default connections keep ordinary text and structured results; no extra rendering tool is added.
- Cards support native source expansion, collapse, host sizing and accessible waiting/error states. UI resources include third-party attribution and are built into the server deployment.
- This rollout does not publish an npm version.

## 0.7.1 - 2026-10-12

Read GitHub and Hacker News fields from the HTTP API result `metadata` object. MCP result metadata, dates, snippets and full-content indicators keep their existing output shape. No fallback to the removed API top-level fields.
