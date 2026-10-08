// Image-prompt export through the MCP (uses the pose-test comic from test-poses.js).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const client = new Client({ name: 'test-prompt', version: '1.0.0' });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(here, 'server.js')], stderr: 'inherit' }));
const call = async (name, args) => {
  const r = await client.callTool({ name, arguments: args });
  const t = r.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
  if (r.isError) throw new Error(t);
  return r;
};
await call('add_character', { comic_id: 'pose-test', name: 'Ada', description: 'tall woman in her 30s, braided red hair, leather jacket' });
const r = await call('export_image_prompt', { comic_id: 'pose-test', page: 1, panel: 3, style: 'full-colour western comic, bold inks' });
console.log(r.content[0].text.split('\n').slice(0, 40).join('\n'));
await client.close();
