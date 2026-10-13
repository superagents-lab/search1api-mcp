# Search result UI

The optional view uses MCP Apps (`io.modelcontextprotocol/ui`). Only `render_results` links to the content-hashed `ui://` resource served as `text/html;profile=mcp-app`. Data tools such as `search`, `news`, and `ask` return their original text and structured results without a UI template.

Cards reuse the existing Rare UI component: result title, favicon and destination domain, without publication dates. Each source card retains the original 84px height. Domains are not verified publisher names. Source snippets and metadata remain in the tool output; the text fallback includes supplied snippets.

`render_results` displays existing data, including selected or merged source lists. Neither rendering nor expanding/opening sources performs another search. Loading and invocation text says `Preparing results…` / `Results ready`; outer launch controls belong to the host.

## Connection and fallback

Use `https://mcp.search1api.com/mcp` with the same OAuth or API-key authentication. There is no URL UI switch. Refresh or reconnect tool discovery if the renderer is missing. All authenticated transports expose the same tools and UI resource; a headless client receives the renderer's complete text list and structured data even if it never reads the resource.

See [render_results](render-results.md) for the input/output contract. An empty list succeeds with `No results to display.` A tool's success confirms prepared data, not successful UI loading. UI failure never triggers a new paid search.

## Host contract

- Uses the standard App bridge and automatic `size-changed` notifications.
- Supports inline only, declared in both app capabilities and the documented `openai/ui` resource metadata. Optional `openai/widgetHeightHint: 154` and `openai/widgetMinFrameHeight: 0` supplement standard sizing in the current ChatGPT desktop host: reserve one result row, then allow internal collapse to shrink the frame. These two hints are supported by the inspected client but were not found in the checked public specifications; hosts without them continue using standard size notifications. No product-name detection. Both HTML and resource metadata participate in the resource URI hash to invalidate cached sizing hints.
- While waiting, reuses the Rare UI text shimmer and a fixed-length arc rotating continuously (1.2 seconds per revolution). There is no simulated progress, percentage, skeleton-card sequence, or completion hold. Results and terminal messages replace the waiting view immediately. Reduced-motion preferences stop the shimmer and rotation.
- Uses `Preparing results…` as the waiting label. Hosts that load the iframe only after tool completion may not show a waiting phase. Does not infer historical replay from elapsed time; a replay awaiting hydration uses the same waiting view until the saved result arrives.
- Uses the component's native expansion for the selected source list. A host-provided fixed or maximum height bounds the view with internal scrolling; flexible hosts receive the content height, including shrinkage after either collapse control. Shows visible errors for connection, result-display cancellation and link denial. Links are HTTP(S) only and open through the host.
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

The last command reads metadata/resources and calls `render_results` with synthetic input. It does not perform a search or require a production key.

Run the independent host fixture:

```sh
node scripts/serve-ui-fixtures.mjs
# Open http://127.0.0.1:5199/tests/host.html
```

Use **Hold result** and **Deliver result** to inspect the waiting animation and its transition into results, errors, cancellation, or empty output.

This fixture uses the official `AppBridge` and sandboxed iframes with synthetic data. It is independent of ChatGPT/Codex and not a claim that the upstream basic-host application was tested.

For an actual ChatGPT custom-MCP UI test, `node scripts/serve-ui-mcp-fixture.mjs` serves synthetic `search`, `news` and the actual `render_results` tool (synthetic searches have a 15-second default delay, configurable with `UI_FIXTURE_DELAY_MS` up to 30 seconds) at `127.0.0.1:5200/mcp`. It has no production credentials or real API calls. Expose only this fixture via a temporary tunnel; never expose an authenticated development server with operator secrets. Use an empty task-specific cloudflared configuration so existing named-tunnel routes are not inherited. Remove the temporary connector and stop the tunnel after verification.

## Credits

The search cards are adapted from [Rare UI](https://rareui.com), copyright 2026 Swami Malode. The component's full license is in `THIRD_PARTY_NOTICES.md`, included in the npm package and HTML resource. The surrounding server retains its MIT license, with that third-party exception.

## Deployment and package releases

The HTTP deployment builds the UI together with the server. Deploying the remote service makes on-demand rendering available at the default URL without publishing a new npm package. Source cards are linked only to `render_results`.

The npm package and local stdio clients update only when a new package version is published and installed. This remote-only rollout does not publish an npm version. A future npm release must choose a new package version and synchronize the registry/plugin manifests first.

Public directory submission and production OAuth acceptance are separate from building and deploying the service. Verify the publisher domain, reviewer access and policy coverage before submitting an app.
