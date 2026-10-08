// Print export check on an existing comic (default: layout-test from test-layouts.js).
//   node mcp/test-print.js [comic_id]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const id = process.argv[2] || 'layout-test';
const client = new Client({ name: 'test-print', version: '1.0.0' });
await client.connect(new StdioClientTransport({ command: process.execPath, args: [path.join(here, 'server.js')], stderr: 'inherit' }));
const t0 = Date.now();
const r = await client.callTool({ name: 'export_comic', arguments: { comic_id: id, print: { bleed_mm: 3, crop_marks: true, dpi: 300 } } });
console.log(r.content.map((c) => c.text).join('\n'), `\n(${Date.now() - t0} ms)`);
await client.close();
if (r.isError) process.exit(1);
