// guide tool + key_panel through the MCP
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const client = new Client({ name: 'test-guide', version: '1.0.0' });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(here, 'server.js')], stderr: 'inherit' }));
const info = client.getInstructions?.() || '';
console.log('instructions lines:', info.split('\n').length, '| has cheat sheet:', info.includes('CRAFT CHEAT SHEET'));
const tools = (await client.listTools()).tools;
console.log('tools:', tools.length, '| guide:', tools.some((t) => t.name === 'guide'));
const call = async (name, args) => {
  const r = await client.callTool({ name, arguments: args });
  const t = r.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
  if (r.isError) throw new Error(t);
  return t;
};
console.log('\n--- guide(shots) first lines:\n' + (await call('guide', { topic: 'shots' })).split('\n').slice(0, 4).join('\n'));
console.log('\n--- find_layouts key_panel 5 of 6:\n' + (await call('find_layouts', { layout: { preset: 'standard', seed: 'K-1', key_panel: 5 }, panel_count: 6, count: 4 })));
await client.close();
