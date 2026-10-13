# Search result UI

The optional view uses MCP Apps (`io.modelcontextprotocol/ui`): `search` and `news` link to the same content-hashed `ui://` resource served as `text/html;profile=mcp-app`. Both tools' text and structured output are unchanged. Showing results, expanding and opening sources do not run another search. `crawl` does not advertise this UI.

Cards show the result title, favicon and destination domain, without publication dates. Every source card uses the component's original 84px height. Domains are not presented as verified publisher names. The original tool response retains publication metadata for the assistant.

Cards have no result numbers. The shared Rare UI component initially shows three sources and a more-sources card. More sources expands the full list downward; Show less restores the short list. The top trigger collapses the entire result area and preserves whether the full list was expanded. There are no pagination controls.

Tool display titles are `Web search` and `News search`. Documented ChatGPT invocation metadata provides `Searching the web…` / `Search results` and `Searching news…` / `News results`. Outer launch buttons and any `Open` prefix belong to the host; these labels do not guarantee its exact wording. See the [OpenAI reference](https://developers.openai.com/plugins/reference#_meta-fields-on-tool-descriptor).

## Remote URL opt-in

Remote MCP defaults to **UI off**, even in a UI-capable client:

| Connection URL | Search and news UI |
| --- | --- |
| `https://mcp.search1api.com/mcp` | Off |
| `https://mcp.search1api.com/mcp?ui=false` | Off |
| `https://mcp.search1api.com/mcp?ui=true` | On in supporting clients |
| `https://mcp.search1api.com/mcp?apiKey=YOUR_SEARCH1API_KEY&ui=true` | On, using the legacy query credential |

Only a single `ui=true` enables the view. Empty, unknown, uppercase and duplicate values remain off. This is a Search1API connection setting, not a standardized MCP parameter and not a tool argument. It applies to both `search` and `news`; the six public tools and all tool input/output schemas stay the same. There is no separate rendering tool.

The HTTP factory reads the URL on each request, for both modern discovery and legacy protocol handling. When off, tool descriptors omit both `_meta.ui` and the legacy `_meta["ui/resourceUri"]`, and the UI resource is neither listed nor readable. Authentication, non-UI resources, text and structured tool output remain unchanged. Tool definitions are copied rather than mutated, so concurrent connections with different choices do not interfere. The client must retain the configured query string on discovery, calls and resource requests. The OAuth resource identifier stays `https://mcp.search1api.com/mcp`; `ui` is a presentation preference, not a different authorization audience.

After changing the connection URL, reconnect or refresh tool discovery to replace cached descriptors. Previously rendered messages are not retroactively removed. URL editing requires a client/connector that allows a custom endpoint. A local stdio build from this source advertises the built UI; this URL option does not apply to stdio. Already published npm versions are unaffected by the remote deployment.

The HTTP service must run a build containing this feature. Tests cover request routing, authentication challenges and both protocol eras. Production OAuth and connector refresh should be checked separately from local UI rendering.

## Host contract

- Uses the standard App bridge and automatic `size-changed` notifications.
- Supports inline only, declared in both app capabilities and the documented `openai/ui` resource metadata. Optional `openai/widgetHeightHint: 154` and `openai/widgetMinFrameHeight: 0` supplement standard sizing in the current ChatGPT desktop host: reserve one result row, then allow internal collapse to shrink the frame. These two hints are supported by the inspected client but were not found in the checked public specifications; hosts without them continue using standard size notifications. No product-name detection. Both HTML and resource metadata participate in the resource URI hash to invalidate cached sizing hints.
- While waiting, reuses the Rare UI text shimmer and a fixed-length arc rotating continuously (1.2 seconds per revolution). There is no simulated progress, percentage, skeleton-card sequence, or completion hold. Results and terminal messages replace the waiting view immediately. Reduced-motion preferences stop the shimmer and rotation.
- Uses standard `toolInfo.tool.name` to label web/news searches, with `Searching…` as the fallback when the host omits tool identity. Hosts that load the iframe only after tool completion may not show a waiting phase. Does not infer historical replay from elapsed time; a replay awaiting hydration uses the same waiting view until the saved result arrives.
- Uses the component's native expansion for both search and news. A host-provided fixed or maximum height bounds the view with internal scrolling; flexible hosts receive the content height, including shrinkage after either collapse control. Shows visible errors for connection, cancellation and link denial. Links are HTTP(S) only and open through the host.
- Missing UI build artifacts remove the tool's UI metadata; standard clients still receive the original text result.
- CSP allows only favicon resources from `https://icons.duckduckgo.com`; there are no direct UI API calls. Favicon loads disclose result hostnames to that provider. Account credentials do not enter the HTML or tool output.

## ChatGPT resource metadata

`ui.domain` defaults to the existing Search1API MCP origin `https://mcp.search1api.com`. Use this origin only for the Search1API app's UI identity. ChatGPT serves the component; this does not embed the MCP endpoint as an external iframe.

For a separate deployment, set `SEARCH1API_UI_DOMAIN` to its dedicated HTTPS origin, with no path, trailing slash, credentials, query or fragment. The server validates this at startup. The selected origin must be controlled by the publisher and unique to the app before public submission. A configured origin does not prove dashboard domain verification or approval.

The standard fields are `ui.domain`, `ui.csp`, `ui.prefersBorder`, and `ui.resourceUri`. The documented ChatGPT additions are `openai/ui` and `openai/widgetDescription`.

## Local checks

```sh
npm ci
npm ci --prefix ui
npm test
npm audit --audit-level=high
npm audit --prefix ui --audit-level=high
npm pack --dry-run
node scripts/smoke-search-ui.mjs
```

The last command without a query reads metadata/resources only. Passing a query performs a real billable search; it is not required for UI verification.

Run the independent host fixture:

```sh
node scripts/serve-ui-fixtures.mjs
# Open http://127.0.0.1:5199/tests/host.html
```

Use **Hold result** and **Deliver result** to inspect the waiting animation and its transition into results, errors, cancellation, or empty output.

This fixture uses the official `AppBridge` and sandboxed iframes with synthetic data. It is independent of ChatGPT/Codex and not a claim that the upstream basic-host application was tested.

For an actual ChatGPT custom-MCP UI test, `node scripts/serve-ui-mcp-fixture.mjs` serves synthetic `search` and `news` tools (15-second default delay, configurable with `UI_FIXTURE_DELAY_MS` up to 30 seconds) plus `preview_search_results` at `127.0.0.1:5200/mcp`. It has no production credentials or real API calls. Expose only this fixture via a temporary tunnel; never expose an authenticated development server with operator secrets. Use an empty task-specific cloudflared configuration so existing named-tunnel routes are not inherited. Remove the temporary connector and stop the tunnel after verification.

## Credits

The search cards are adapted from [Rare UI](https://rareui.com), copyright 2026 Swami Malode. The component's full license is in `THIRD_PARTY_NOTICES.md`, included in the npm package and HTML resource. The surrounding server retains its MIT license, with that third-party exception.

## Deployment and package releases

The HTTP deployment builds the UI together with the server. Deploying the remote service enables this opt-in feature without publishing a new npm package. Existing remote URLs remain text-only; users choose `?ui=true` in a supporting client.

The npm package and local stdio clients update only when a new package version is published and installed. This remote-only rollout does not publish an npm version. A future npm release must choose a new package version and synchronize the registry/plugin manifests first.

Public directory submission and production OAuth acceptance are separate from building and deploying the service. Verify the publisher domain, reviewer access and policy coverage before submitting an app.
