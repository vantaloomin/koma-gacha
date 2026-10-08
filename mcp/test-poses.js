// Poses/props through the MCP: staging, holds, scene props, pair poses and the adult gate.
//   node mcp/test-poses.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..', 'comics', '_pose-previews');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
fs.rmSync(path.join(here, '..', 'comics', 'pose-test'), { recursive: true, force: true });

const client = new Client({ name: 'test-poses', version: '1.0.0' });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(here, 'server.js')], stderr: 'inherit' }));
let n = 0;
async function call(name, args, { expectError = false, tag = name } = {}) {
  const r = await client.callTool({ name, arguments: args });
  const txt = r.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
  console.log(`\n=== ${tag}${r.isError ? ' (error)' : ''}\n${txt.split('\n').filter((l) => !l.includes('camera:')).slice(0, 14).join('\n')}`);
  for (const c of r.content.filter((x) => x.type === 'image')) fs.writeFileSync(path.join(out, `${String(++n).padStart(2, '0')}-${tag}.${c.mimeType.includes('jpeg') ? 'jpg' : 'png'}`), Buffer.from(c.data, 'base64'));
  if (!!r.isError !== expectError) throw new Error(`${tag}: expected ${expectError ? 'an error' : 'success'}`);
  return txt;
}

await call('create_comic', {
  title: 'Pose Test', format: 'letter', reading_direction: 'ltr',
  characters: [{ name: 'Ada', height_cm: 165 }, { name: 'Bram', height_cm: 180 }, { name: 'Pip', height_cm: 128, adult: false }],
});
await call('list_poses', {}, { tag: 'list_poses' });
await call('add_page', {
  comic_id: 'pose-test', cast: ['Ada', 'Bram'],
  scene_props: [{ prop: 'chair', x: 1.4, z: -0.6, yaw: -30 }],
  panels: [{ dialogue: [{ speaker: 'Ada', text: 'Coffee?' }] }, { dialogue: [{ speaker: 'Bram', text: 'Please.' }] }, { dialogue: [{ speaker: 'Ada', text: 'Here.' }] }],
}, { tag: 'page1' });
await call('edit_panel', { comic_id: 'pose-test', page: 1, panel: 3, poses: { Ada: 'talk' }, hold: { Ada: { right: 'cup' } } }, { tag: 'hold-cup' });
await call('edit_panel', { comic_id: 'pose-test', page: 1, panel: 2, pose: undefined, poses: { Bram: 'noSuchPose' } }, { expectError: true, tag: 'bad-pose' });
// adult gate: blocked until the comic opts in, and never on a non-adult character
await call('edit_panel', { comic_id: 'pose-test', page: 1, panel: 1, pair: { pose: 'adultKiss', a: 'Ada', b: 'Bram' } }, { expectError: true, tag: 'adult-no-optin' });
await call('set_comic_options', { comic_id: 'pose-test', adult_content: true }, { tag: 'opt-in' });
await call('edit_panel', { comic_id: 'pose-test', page: 1, panel: 1, pair: { pose: 'adultKiss', a: 'Ada', b: 'Bram' } }, { tag: 'adult-ok' });
await call('add_page', { comic_id: 'pose-test', cast: ['Ada', 'Pip'], panel_count: 2, pair_staging: { pose: 'adultKiss', a: 'Ada', b: 'Pip' } }, { expectError: true, tag: 'adult-minor-blocked' });
await call('render_page', { comic_id: 'pose-test', page: 1, diagnostics: true }, { tag: 'page1-diag' });
// trios: need a, b and c; adult trios need every member to be an adult
await call('add_character', { comic_id: 'pose-test', name: 'Cass', height_cm: 170 }, { tag: 'add-cass' });
await call('add_page', { comic_id: 'pose-test', cast: ['Ada', 'Bram', 'Cass'], panel_count: 2, pair_staging: { pose: 'groupHug', a: 'Ada', b: 'Bram' } }, { expectError: true, tag: 'trio-missing-c' });
await call('add_page', { comic_id: 'pose-test', cast: ['Ada', 'Bram', 'Cass'], panel_count: 2, pair_staging: { pose: 'groupHug', a: 'Ada', b: 'Bram', c: 'Cass' } }, { tag: 'trio-hug' });
await call('edit_panel', { comic_id: 'pose-test', page: 2, panel: 2, pair: { pose: 'adultTrioSandwich', a: 'Ada', b: 'Bram', c: 'Cass' } }, { tag: 'adult-trio-ok' });
await call('add_page', { comic_id: 'pose-test', cast: ['Ada', 'Bram', 'Pip'], panel_count: 2, pair_staging: { pose: 'adultTrioSandwich', a: 'Ada', b: 'Bram', c: 'Pip' } }, { expectError: true, tag: 'adult-trio-minor-blocked' });
await client.close();
console.log('\nOK — previews in', out);
