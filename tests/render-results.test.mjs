import assert from 'node:assert/strict';
import test from 'node:test';
import { INVALID_PARAMS } from '@modelcontextprotocol/server';
import { handleToolCall } from '../build/tools/handlers.js';

const render = (args) => handleToolCall('render_results', args);
const source = { title: 'Original source', url: 'https://example.com/original' };

test('renders selected sources without fetching, mutating, or changing their provenance fields', async (context) => {
  context.mock.method(globalThis, 'fetch', () => { throw new Error('render must not fetch'); });
  const args = {
    title: 'Selected sources',
    results: [
      { ...source, id: 'provider:42', text: 'Original snippet', metadata: { published_date: '2026-10-13', score: 0.7 } },
      { ...source, title: 'A second entry with the same URL' },
    ],
  };
  const before = structuredClone(args);
  const result = await render(args);
  assert.equal(result.isError, false);
  assert.deepEqual(result.structuredContent, {
    title: args.title, total: 2,
    results: [args.results[0], { ...args.results[1], id: source.url }],
  });
  assert.deepEqual(args, before);
  for (const entry of result.structuredContent.results) {
    assert.ok(result.content[0].text.includes(entry.title));
    assert.ok(result.content[0].text.includes(entry.url));
    if (entry.text) assert.ok(result.content[0].text.includes(entry.text));
  }
  assert.deepEqual(await render(args), result, 'repeating presentation is idempotent');
  assert.equal(globalThis.fetch.mock.callCount(), 0);
  assert.equal('_meta' in result, false, 'essential sources must not require component-only metadata');
  assert.equal('rendered' in result.structuredContent, false, 'handler cannot attest to host rendering');
});

test('empty input is a readable success, and Unicode limits count code points', async () => {
  const empty = await render({ results: [] });
  assert.deepEqual(empty.structuredContent, { title: 'Results', total: 0, results: [] });
  assert.equal(empty.content[0].text, 'Results\n\nNo results to display.');
  const unicode = await render({ results: [{ ...source, title: '📚'.repeat(300), text: '文'.repeat(2000) }] });
  assert.equal(unicode.structuredContent.total, 1);
});

test('rejects unsafe or malformed links instead of producing a partial list', async () => {
  for (const url of ['javascript:alert(1)', 'file:///etc/passwd', '//example.com/path', 'https://user:password@example.com', 'https://', 'https://example.com/white space', 'https://example.com/\npath']) {
    await assert.rejects(render({ results: [source, { ...source, url }] }), error =>
      error.code === INVALID_PARAMS && error.message.includes('results[1].url') && !error.message.includes('password'));
  }
});

test('enforces bounded arguments and source fields without leaking the submitted payload', async () => {
  for (const [args, field] of [
    [null, 'arguments'],
    [{ results: 'not an array' }, 'results'],
    [{ results: [], query: 'not a search' }, 'arguments'],
    [{ results: [], title: ' ' }, 'title'],
    [{ results: [], title: 'a'.repeat(121) }, 'title'],
    [{ results: [null] }, 'results[0]'],
    [{ results: [{ ...source, title: ' ' }] }, 'results[0].title'],
    [{ results: [{ ...source, id: '' }] }, 'results[0].id'],
    [{ results: [{ ...source, text: 'a'.repeat(2001) }] }, 'results[0].text'],
    [{ results: [{ ...source, metadata: [] }] }, 'results[0].metadata'],
    [{ results: [{ ...source, html: '<script>untrusted</script>' }] }, 'results[0]'],
    [{ results: Array.from({ length: 51 }, () => source) }, 'results'],
    [{ results: [{ ...source, metadata: { large: 'x'.repeat(65_536) } }] }, 'arguments'],
  ]) {
    await assert.rejects(render(args), error => error.code === INVALID_PARAMS && error.message.includes(field));
  }
  const maximum = await render({ results: Array.from({ length: 50 }, () => source) });
  assert.equal(maximum.structuredContent.total, 50);
});
