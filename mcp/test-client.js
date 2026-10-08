// Smoke test: drives the MCP server over stdio and builds a short two-page comic.
//   node mcp/test-client.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..', 'comics', '_test-previews');
fs.mkdirSync(out, { recursive: true });

const client = new Client({ name: 'test', version: '1.0.0' });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(here, 'server.js')], stderr: 'inherit' }));

let n = 0;
async function call(name, args) {
  const t0 = Date.now();
  const r = await client.callTool({ name, arguments: args });
  const txt = r.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
  console.log(`\n=== ${name} (${Date.now() - t0} ms)${r.isError ? ' ERROR' : ''}\n${txt}`);
  for (const c of r.content.filter((x) => x.type === 'image')) {
    const f = path.join(out, `${String(++n).padStart(2, '0')}-${name}.${c.mimeType.includes('jpeg') ? 'jpg' : 'png'}`);
    fs.writeFileSync(f, Buffer.from(c.data, 'base64'));
    console.log('image ->', f);
  }
  if (r.isError) throw new Error(txt);
  return txt;
}

const tools = await client.listTools();
console.log('tools:', tools.tools.map((t) => t.name).join(', '));

const created = await call('create_comic', {
  title: 'Test Late Shift',
  reading_direction: 'ltr',
  characters: [{ name: 'Nell', height_cm: 160, color: '#e2735f' }, { name: 'Oscar', height_cm: 178, color: '#5a8fd8' }],
});
const id = created.match(/id (\S+)/)[1];

await call('add_page', {
  comic_id: id, cast: ['Nell', 'Oscar'], tone: 'daily',
  panels: [
    { caption: 'The bakery, 4:55 a.m.', dialogue: [{ speaker: 'Nell', text: 'You\'re early. That\'s new.' }] },
    { dialogue: [{ speaker: 'Oscar', text: 'Couldn\'t sleep. The oven was talking to me.' }] },
    { dialogue: [{ speaker: 'Nell', text: 'Ovens don\'t talk.', kind: 'speech' }, { speaker: 'Nell', text: '...What did it say?' }] },
    { dialogue: [{ speaker: 'Oscar', text: 'It said the sourdough is plotting something.', kind: 'whisper' }] },
    { sfx: [{ text: 'DING!', size: 'large', color: '#ffd84a' }], focus: 'Nell' },
  ],
});

await call('render_page', { comic_id: id, page: 1, diagnostics: true });
await call('edit_panel', { comic_id: id, page: 1, panel: 5, camera: { shot_type: 'single', size: 'closeup', subject: 'Nell', elevation: -15 }, poses: { Nell: 'surprised' } });
await call('roll_page', { comic_id: id, page: 1, proposals: 6 });

await call('add_page', {
  comic_id: id, cast: ['Nell', 'Oscar'], tone: 'comedy', layout: { preset: 'action' },
  panels: [
    { dialogue: [{ speaker: 'Nell', text: 'Oscar. The dough. It\'s MOVING.', kind: 'shout' }], sfx: [{ text: 'BLORP', size: 'medium' }] },
    { dialogue: [{ speaker: 'Oscar', text: 'Told you.' }] },
    { dialogue: [{ speaker: 'Nell', text: 'I am not getting paid enough for this.', kind: 'thought' }] },
  ],
});

await call('export_panel_guides', { comic_id: id, page: 2, panels: [1], kinds: ['render', 'depth', 'lineart'], long_side: 768 });
await call('get_comic', { comic_id: id });
await call('export_comic', { comic_id: id, width: 1200 });

await client.close();
console.log('\nOK');
