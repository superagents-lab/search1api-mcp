import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const { outputText } = ts.transpileModule(readFileSync(new URL('../ui/src/session.ts', import.meta.url), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
});
const { createSearchSession, parseSources } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const result = { structuredContent: { results: [{ title: 'Example', url: 'https://example.com/' }] } };
function fixture(overrides = {}) {
  let connections = 0;
  const app = { connect: async () => { connections++; }, close: async () => {}, getHostContext: () => ({ theme: 'dark' }), openLink: async () => ({}), ...overrides };
  const session = createSearchSession(app);
  return { app, session, connections: () => connections };
}

test('UI connection is single-use and results do not depend on input/replay timing', async () => {
  const { app, session, connections } = fixture();
  await Promise.all([session.start(), session.start()]);
  assert.equal(connections(), 1);
  app.ontoolresult(result);
  assert.equal(session.getSnapshot().status, 'done');
  app.ontoolinput({ arguments: { query: 'replayed input' } });
  assert.equal(session.getSnapshot().status, 'done');
  assert.equal(session.getSnapshot().sources.length, 1);
});

test('connection rejection becomes a visible terminal error', async () => {
  const { session } = fixture({ connect: async () => { throw new Error('transport failure'); } });
  await session.start();
  assert.equal(session.getSnapshot().status, 'error');
  assert.match(session.getSnapshot().message, /Could not connect/);
});

test('cancel, tool errors, and unexpected disconnect stop waiting', async () => {
  for (const event of ['cancel', 'error', 'close']) {
    const { app, session } = fixture();
    await session.start();
    if (event === 'cancel') app.ontoolcancelled({});
    if (event === 'error') app.ontoolresult({ isError: true });
    if (event === 'close') app.onclose();
    assert.notEqual(session.getSnapshot().status, 'waiting');
    assert.ok(session.getSnapshot().message);
  }
});

test('empty and malformed results are distinct', () => {
  const { app, session } = fixture();
  app.ontoolresult({ structuredContent: { results: [] } });
  assert.equal(session.getSnapshot().status, 'done');
  app.ontoolresult({ structuredContent: { results: {} } });
  assert.equal(session.getSnapshot().status, 'error');
  assert.throws(() => parseSources({ results: [{ title: 'unsafe', url: 'javascript:alert(1)' }] }));
  assert.throws(() => parseSources({ results: [{ title: 'credential', url: 'https://user:secret@example.com' }] }));
});

test('host link rejection or transport error preserves a copyable URL', async () => {
  for (const openLink of [async () => ({ isError: true }), async () => { throw new Error('denied'); }]) {
    const { session } = fixture({ openLink });
    await session.openLink('https://example.com/');
    assert.match(session.getSnapshot().linkError, /could not open/);
    assert.equal(session.getSnapshot().blockedUrl, 'https://example.com/');
  }
});

test('invalid links never reach the host and context patches preserve the theme', async () => {
  let calls = 0;
  const { app, session } = fixture({ openLink: async () => { calls++; return {}; } });
  await session.start();
  await session.openLink('file:///etc/passwd');
  assert.equal(calls, 0);
  app.onhostcontextchanged({ containerDimensions: { width: 360, maxHeight: 160 } });
  assert.equal(session.getSnapshot().context.theme, 'dark');
  assert.equal(session.getSnapshot().context.containerDimensions.maxHeight, 160);
});
