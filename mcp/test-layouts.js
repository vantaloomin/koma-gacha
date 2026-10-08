// Exercises the layout types through the MCP: grids, strips, insets, diagonal splits, key-panel bleed.
//   node mcp/test-layouts.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..', 'comics', '_layout-previews');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

const client = new Client({ name: 'test-layouts', version: '1.0.0' });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(here, 'server.js')], stderr: 'inherit' }));

let n = 0;
async function call(name, args, tag = name) {
  const r = await client.callTool({ name, arguments: args });
  const txt = r.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
  console.log(`\n=== ${tag}${r.isError ? ' ERROR' : ''}\n${txt.split('\n').filter((l) => !l.trim().startsWith('camera:')).join('\n')}`);
  for (const c of r.content.filter((x) => x.type === 'image')) {
    fs.writeFileSync(path.join(out, `${String(++n).padStart(2, '0')}-${tag}.${c.mimeType.includes('jpeg') ? 'jpg' : 'png'}`), Buffer.from(c.data, 'base64'));
  }
  if (r.isError) throw new Error(txt);
  return txt;
}

for (const preset of ['grid', 'strips', 'action']) {
  await call('find_layouts', { layout: { preset, seed: 'LT-1', insets: preset === 'action' ? 100 : undefined, diagonal_splits: preset === 'action' ? 100 : undefined }, count: 8 }, `find-${preset}`);
}

const created = await call('create_comic', {
  title: 'Layout Test', format: 'letter', reading_direction: 'ltr',
  characters: [{ name: 'Ada', height_cm: 165 }, { name: 'Bram', height_cm: 180 }],
});
const id = created.match(/id (\S+)/)[1];
const line = (speaker, text) => ({ dialogue: [{ speaker, text }] });

// 1. even 3x3 grid
await call('add_page', {
  comic_id: id, cast: ['Ada', 'Bram'], layout: { grid: '3x3', seed: 'G1' },
  panels: Array.from({ length: 9 }, (_, i) => line(i % 2 ? 'Bram' : 'Ada', `Line ${i + 1}.`)),
}, 'page-grid');

// 2. strip rows with repeated steep slants
await call('add_page', {
  comic_id: id, cast: ['Ada', 'Bram'], layout: { preset: 'strips', seed: 'S1' }, panel_count: 12,
  panels: Array.from({ length: 12 }, (_, i) => (i % 3 === 2 ? {} : line(i % 2 ? 'Bram' : 'Ada', 'Quick beat.'))),
}, 'page-strips');

// 3. action page forced to have an inset and a diagonal split
await call('add_page', {
  comic_id: id, cast: ['Ada', 'Bram'], tone: 'conflict',
  layout: { preset: 'action', seed: 'A1', insets: 100, diagonal_splits: 100, bleed: 'none' },
  panels: [line('Ada', 'Move!'), line('Bram', 'I am moving!'), { sfx: [{ text: 'KRAK', size: 'large' }] }, line('Ada', 'Faster!'), line('Bram', 'Working on it.')],
}, 'page-action');

// 3b. a page with triangle panels (diagonal splits)
await call('add_page', {
  comic_id: id, cast: ['Ada', 'Bram'], tone: 'tension',
  layout: { preset: 'action', seed: 'LT-1', index: 3, diagonal_splits: 100, insets: 100 }, // same options as find-action
  panels: [line('Ada', 'Did you hear that?'), line('Bram', 'Hear what?'), { caption: 'Silence.' }, line('Ada', 'Exactly.')],
}, 'page-triangles');

// 4. splash with a key panel allowed to bleed
await call('add_page', {
  comic_id: id, cast: ['Ada', 'Bram'], tone: 'resolve', layout: { preset: 'splash', seed: 'K1', bleed: 'key' }, panel_count: 3,
  panels: [{ caption: 'The next morning.' }, line('Ada', 'We go together.'), line('Bram', 'Together.')],
}, 'page-splash');

await call('render_page', { comic_id: id, page: 4, diagnostics: true }, 'page-triangles-diag');
await call('export_comic', { comic_id: id, width: 1200, formats: ['png'] }, 'export');
await client.close();
console.log('\nOK — previews in', out);
