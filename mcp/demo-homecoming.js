// Demo: one comic page built entirely through the MCP tools.
// "Homecoming" — a soldier returns from the war and sees his wife for the first time in years.
//   node mcp/demo-homecoming.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const here = path.dirname(fileURLToPath(import.meta.url));
fs.rmSync(path.join(here, '..', 'comics', 'homecoming'), { recursive: true, force: true });
const client = new Client({ name: 'demo-homecoming', version: '1.0.0' });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(here, 'server.js')], stderr: 'inherit' }));

async function call(name, args) {
  const r = await client.callTool({ name, arguments: args });
  const t = r.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
  console.log(`\n=== ${name}${r.isError ? ' (ERROR)' : ''}\n${t.split('\n').filter((l) => !l.includes('camera:')).slice(0, 30).join('\n')}`);
  if (r.isError) throw new Error(t);
  return t;
}

await call('create_comic', {
  title: 'Homecoming', format: 'letter', reading_direction: 'ltr',
  characters: [
    { name: 'Walter', height_cm: 183, color: '#c96a4a', description: 'man in his late 20s, lean and tired, short dark hair, olive-drab army uniform with a garrison cap, carries a canvas duffel' },
    { name: 'June', height_cm: 163, color: '#4f7fc4', description: 'woman in her mid 20s, wavy shoulder-length auburn hair pinned back, 1940s floral house dress with an apron' },
  ],
});

await call('add_page', {
  comic_id: 'homecoming', cast: ['Walter', 'June'], tone: 'intimate', layout: { preset: 'standard', seed: 'HOME-1', key_panel: 5, bleed: 'key' }, panel_count: 6,
  scene_props: [{ prop: 'door', x: 0.9, z: -0.9, yaw: 0 }, { prop: 'pottedPlant', x: 1.5, z: -0.8 }],
  panels: [
    { caption: 'Autumn, 1945. Three years, two months.', focus: 'Walter', role: 'establish' },
    { dialogue: [{ speaker: 'June', text: 'Walter...?', kind: 'whisper' }] },
    { dialogue: [{ speaker: 'Walter', text: 'Hello, June.' }] },
    { focus: 'June', role: 'reaction' },
    { caption: 'Neither of them said anything for a long time.', role: 'key' },
    { dialogue: [{ speaker: 'June', text: 'You’re home.' }, { speaker: 'Walter', text: 'I’m home.' }] },
  ],
});

// direct the acting: arrival, recognition, the run, the embrace
await call('edit_panel', { comic_id: 'homecoming', page: 1, panel: 1, poses: { Walter: 'walking', June: 'idle' }, hold: { Walter: { right: 'suitcase' } } });
await call('edit_panel', { comic_id: 'homecoming', page: 1, panel: 2, poses: { June: 'coverMouth' } });
await call('edit_panel', { comic_id: 'homecoming', page: 1, panel: 3, poses: { Walter: 'idle' }, hold: { Walter: { right: 'suitcase' } } });
await call('edit_panel', { comic_id: 'homecoming', page: 1, panel: 4, poses: { June: 'running', Walter: 'idle' }, camera: { shot_type: 'single', subject: 'June', size: 'full', elevation: 4, orbit: -45 } });
await call('edit_panel', { comic_id: 'homecoming', page: 1, panel: 5, pair: { pose: 'hugFriendly', a: 'Walter', b: 'June' }, camera: { shot_type: 'two_shot', size: 'medium', elevation: 6, orbit: 35 } });
await call('edit_panel', { comic_id: 'homecoming', page: 1, panel: 6, poses: { June: 'handOnChest', Walter: 'idle' } });

await call('render_page', { comic_id: 'homecoming', page: 1, diagnostics: true });
await call('render_page', { comic_id: 'homecoming', page: 1, width: 1400 });
await call('export_image_prompt', {
  comic_id: 'homecoming', page: 1,
  style: 'painted 1940s American comic, muted autumn colours, soft ink lines',
  setting: 'the front step of a small white clapboard house on a tree-lined street, late afternoon, autumn leaves',
});
await client.close();
console.log('\nOK');
