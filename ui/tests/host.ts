import { AppBridge, PostMessageTransport } from '@modelcontextprotocol/ext-apps/app-bridge';
const value = (id: string) => (document.getElementById(id) as HTMLSelectElement).value;
const status = document.getElementById('status')!;
let bridge: AppBridge | undefined;
let deliverResult: (() => Promise<void>) | undefined;
const deliverButton = document.getElementById('deliver') as HTMLButtonElement;
async function load() {
  deliverResult = undefined;
  deliverButton.disabled = true;
  await bridge?.close();
  const tool = value('tool');
  const scenario = value('case');
  const hold = (document.getElementById('hold') as HTMLInputElement).checked;
  const width = Number(value('width')), maxHeight = Number(value('height'));
  const html = await (await fetch('/test-resource')).text();
  const frame = document.createElement('iframe');
  frame.title = 'Search results';
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.style.cssText = `display:block;width:${width}px;height:200px;border:1px solid #aaa;background:${value('theme') === 'dark' ? '#171717' : '#fff'}`;
  document.getElementById('container')!.replaceChildren(frame);
  status.textContent = 'Connecting';
  if (value('case') === 'no bridge') { frame.srcdoc = html; return; }
  bridge = new AppBridge(null, { name: 'standard-sdk-fixture', version: '1.0.0' }, { openLinks: {} }, {
    hostContext: { toolInfo: { tool: { name: tool, inputSchema: { type: 'object' } } }, theme: value('theme') as 'light' | 'dark', displayMode: 'inline', availableDisplayModes: ['inline'], containerDimensions: { width, maxHeight } },
  });
  bridge.onsizechange = ({ height }) => { if (height) { frame.style.height = `${Math.min(maxHeight, height)}px`; status.textContent = `Reported ${height}px / maximum ${maxHeight}px`; } };
  bridge.onopenlink = async () => ({ isError: (document.getElementById('deny') as HTMLInputElement).checked });
  const current = bridge;
  current.oninitialized = async () => {
    await current.sendToolInput({ arguments: { results: [] } });
    const deliver = async () => {
      if (current !== bridge) return;
      if (scenario === 'slow replay') await new Promise((resolve) => setTimeout(resolve, 1200));
      if (scenario === 'cancel') { await current.sendToolCancelled({ reason: 'Cancelled by fixture' }); return; }
      if (scenario === 'error') { await current.sendToolResult({ isError: true, content: [{ type: 'text', text: 'Synthetic failure' }] }); return; }
      if (scenario === 'malformed') { await current.sendToolResult({ structuredContent: { results: {} }, content: [] }); return; }
      const news = tool === 'news';
      const results = Array.from({ length: scenario === 'empty' ? 0 : Number(value('count')) }, (_, i) => ({
        id: `result-${i}`,
        title: news ? `News ${i + 1}: New MCP Apps features announced` : `Source ${i + 1}: MCP Apps documentation`,
        url: `https://example.com/source/${i + 1}`, text: 'Synthetic result for layout testing.',
        ...(news && i % 4 !== 3 ? { metadata: { published_date: ['2026-10-12T08:30:00Z', 'Oct 11, 2026', '2 hours ago'][i % 4] } } : {}),
      }));
      await current.sendToolResult({ structuredContent: { title: 'Selected sources', total: results.length, results }, content: [{ type: 'text', text: JSON.stringify({ results }) }] });
    };
    if (hold) { deliverResult = deliver; deliverButton.disabled = false; }
    else await deliver();
  };
  await current.connect(new PostMessageTransport(frame.contentWindow!, frame.contentWindow!));
  frame.srcdoc = html;
}
document.getElementById('load')!.addEventListener('click', () => { void load(); });
document.getElementById('deliver')!.addEventListener('click', () => {
  const deliver = deliverResult;
  deliverResult = undefined;
  deliverButton.disabled = true;
  void deliver?.();
});
void load();
