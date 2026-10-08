// Video export through the MCP: builds a short page, adds shot motion, previews it and writes
// the animatic plus depth / line-art / OpenPose control videos.
//   node mcp/test-video.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..', 'comics', '_video-previews');
fs.rmSync(path.join(here, '..', 'comics', 'video-test'), { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const client = new Client({ name: 'test-video', version: '1.0.0' });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(here, 'server.js')], stderr: 'inherit' }));

async function call(name, args, img) {
  const t0 = Date.now();
  const r = await client.callTool({ name, arguments: args });
  const t = r.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
  console.log(`\n=== ${name}${r.isError ? ' (ERROR)' : ''} ${((Date.now() - t0) / 1000).toFixed(1)}s\n${t.split('\n').slice(0, 24).join('\n')}`);
  if (r.isError) throw new Error(t);
  const im = r.content.find((c) => c.type === 'image');
  if (img && im) fs.writeFileSync(path.join(out, img), Buffer.from(im.data, 'base64'));
  return t;
}

await call('create_comic', {
  title: 'Video Test', format: 'letter', reading_direction: 'ltr',
  characters: [
    { name: 'Walter', height_cm: 183, color: '#c96a4a' },
    { name: 'June', height_cm: 163, color: '#4f7fc4' },
  ],
});
await call('add_page', {
  comic_id: 'video-test', cast: ['Walter', 'June'], tone: 'intimate', layout: { preset: 'standard', seed: 'VID-1' }, panel_count: 4,
  scene_props: [{ prop: 'door', x: 0.9, z: -0.9 }],
  panels: [
    { caption: 'Autumn, 1945.', role: 'establish' },
    { dialogue: [{ speaker: 'June', text: 'Walter...?', kind: 'whisper' }] },
    { focus: 'June', role: 'reaction' },
    { dialogue: [{ speaker: 'June', text: 'You’re home.' }, { speaker: 'Walter', text: 'I’m home.' }], role: 'key' },
  ],
});
await call('set_shot_motion', { comic_id: 'video-test', page: 1, panel: 1, camera_move: 'pushIn', duration: 3 }, 'motion-1.jpg');
await call('set_shot_motion', { comic_id: 'video-test', page: 1, panel: 2, end_poses: { June: 'coverMouth' }, timing: { start: 0.2, end: 0.7 } }, 'motion-2.jpg');
await call('set_shot_motion', { comic_id: 'video-test', page: 1, panel: 3, moves: { June: { toward: 'Walter', gap: 0.5 } }, end_poses: { June: 'running' }, camera_move: 'auto', duration: 3 }, 'motion-3.jpg');
await call('set_shot_motion', { comic_id: 'video-test', page: 1, panel: 4, end_pair: { pose: 'hugFriendly', a: 'Walter', b: 'June' }, end_camera: { shot_type: 'two_shot', size: 'medium', orbit: 30 }, transition: 'dissolve', duration: 5 }, 'motion-4.jpg');
await call('preview_motion', { comic_id: 'video-test', page: 1, frames: 4 }, 'page-motion.jpg');
const res = await call('export_video', { comic_id: 'video-test', size: '720p', fps: 24, controls: ['depth', 'lineart', 'pose'] });
for (const f of res.split('\n').map((l) => l.trim()).filter((l) => l.endsWith('.mp4'))) {
  const size = fs.statSync(f).size;
  console.log(`${path.basename(f)}: ${(size / 1024).toFixed(0)} KB`);
  if (size < 10000) throw new Error(`${f} looks empty`);
}
await call('get_comic', { comic_id: 'video-test' });
await client.close();
console.log('\nOK');
