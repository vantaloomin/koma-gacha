// comic_from_plot through the MCP, then ordinary tools on the result.
//   node mcp/test-plot-mcp.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, '..', 'comics', '_plot-previews');
fs.mkdirSync(out, { recursive: true });
for (const d of fs.readdirSync(path.join(here, '..', 'comics'))) if (/^the-library(-\d+)?$/.test(d)) fs.rmSync(path.join(here, '..', 'comics', d), { recursive: true, force: true });
const client = new Client({ name: 'test-plot-mcp', version: '1.0.0' });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(here, 'server.js')], stderr: 'inherit' }));

async function call(name, args, img) {
  const r = await client.callTool({ name, arguments: args });
  const t = r.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
  console.log(`\n=== ${name}${r.isError ? ' (ERROR)' : ''}\n${t.split('\n').slice(0, 30).join('\n')}`);
  if (r.isError) throw new Error(t);
  r.content.filter((c) => c.type === 'image').forEach((im, k) => img && fs.writeFileSync(path.join(out, `${img}-${k + 1}.jpg`), Buffer.from(im.data, 'base64')));
  return t;
}

const PLOT = `Title: The Library
Reading direction: Left to right
Cast: Ken=M01 (174cm), Mia=F01 (152cm)
# Scene: Library [Background classroom]
Page 1
1: Caption "Saturday." Background (library doors) [Establishing shot, Wide panel]
2: Mia "You came!" Ken [Two-shot, Joy]
3: Ken "You said 'together'." [Medium close-up] [Ken pose=Hands in pockets]
4: Mia (He actually came...) [Close-up, Intimacy, Small panel]
Page 2 [Page-turn reveal]
1: Mia "So... what do you want to read?" Ken [Over-the-shoulder shot]
2: Ken "...You." [Climax, Close-up, Large panel, Focus lines]
3: Mia "!!" [Burst balloon, Surprise] [Mia pose=Covering face]
`;

await call('guide', { topic: 'plot' });
const res = await call('comic_from_plot', { plot: PLOT, seed: 'LIB' }, 'mcp-library');
const id = /\(([\w-]+)\) from the plot/.exec(res)[1];
await call('get_plot', { comic_id: id });
await call('edit_panel', { comic_id: id, page: 2, panel: 2, camera: { elevation: -12 } }, 'mcp-library-edit');
await call('set_shot_motion', { comic_id: id, page: 2, panel: 2, camera_move: 'pushIn', duration: 3 });
await call('export_video', { comic_id: id, size: '720p', fps: 12 });
await client.close();
console.log('\nOK');
