// Standard SDK host fixture: no production API, no authentication, no credits.
import { createServer } from '../ui/node_modules/vite/dist/node/index.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const server = await createServer({
  configFile: false,
  root: fileURLToPath(new URL('../ui/', import.meta.url)),
  optimizeDeps: { entries: ['tests/host.html'] },
  server: { host: '127.0.0.1', port: 5199, strictPort: true },
  plugins: [{ name: 'fixture-resource', configureServer(server) {
    server.middlewares.use('/test-resource', (_req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.end(readFileSync(new URL('../ui/dist/index.html', import.meta.url)));
    });
  } }],
});
await server.listen();
console.log('MCP Apps fixture: http://127.0.0.1:5199/tests/host.html');
