// ChatGPT host acceptance against the real HTTP factory, using synthetic data.
// Never load operator credentials or make outbound API requests.
import express from 'express';
process.env.SEARCH1API_KEY = 'synthetic-ui-test-only';
const record = (event, extra = {}) => console.log(JSON.stringify({ at: new Date().toISOString(), event, ...extra }));
globalThis.fetch = async (input, init) => {
  const url = new URL(String(input));
  const kind = url.pathname.slice(1);
  if (url.origin !== 'https://api.search1api.com' || !['search', 'news'].includes(kind)) {
    throw new Error('Outbound request blocked by UI fixture');
  }
  const args = JSON.parse(init.body);
  const count = Math.min(8, args.max_results ?? 8);
  record('synthetic-result', { tool: kind, query: args.query, count });
  const results = Array.from({ length: count }, (_, i) => ({
    title: `FAT1909 ${kind === 'news' ? 'News' : 'Web'} fixture ${i + 1}`,
    link: `https://example.com/${kind}/${i + 1}`,
    snippet: 'Synthetic acceptance result; no live search or account data.',
    ...(kind === 'news' ? { published_date: '2026-10-13T08:00:00Z' } : {}),
  }));
  return new Response(JSON.stringify({ results }), { headers: { 'Content-Type': 'application/json' } });
};
const { ALL_TOOLS } = await import('../build/tools/index.js');
// This isolated fixture has no real account. Only replace auth declarations;
// all UI metadata, schemas, handlers and URL gating use the production build.
for (const tool of ALL_TOOLS) {
  tool.securitySchemes = [{ type: 'noauth' }];
  tool._meta = { ...tool._meta, securitySchemes: [{ type: 'noauth' }] };
}
const { createHttpApp } = await import('../build/http.js');
const httpApp = createHttpApp({ validateCredential: async () => ({ credential: 'synthetic-ui-test-only', principal: 'fixture' }) });
const app = express();
app.use(express.json());
app.use((req, _res, next) => {
  record('request', { path: req.originalUrl, method: req.body?.method, tool: req.body?.params?.name, uri: req.body?.params?.uri });
  req.headers.authorization = 'Bearer synthetic-ui-test-only';
  next();
});
app.use(httpApp.app);
const listener = app.listen(5201, '127.0.0.1', () => record('listening', { port: 5201 }));
async function close() { await httpApp.close(); listener.close(); }
process.once('SIGINT', close);
process.once('SIGTERM', close);
