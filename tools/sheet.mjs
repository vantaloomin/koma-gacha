// Render pose or prop contact sheets for visual checking.
//   node tools/sheet.mjs poses [category|id,id,...] [out.png] [--adult] [--view=3q|front|side|top|back]
//   node tools/sheet.mjs props [category|id,id,...] [out.png]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Engine, dataUrlToBuffer } from '../mcp/engine.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flags = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => { const [k, v] = a.slice(2).split('='); return [k, v ?? true]; }));
const [kind = 'poses', sel = '', out = path.join(root, 'tools', `${kind}-sheet.png`)] = args;
const ids = sel.includes(',') || (sel && !/^[a-z &]+$/.test(sel)) ? sel.split(',').filter(Boolean) : null;
const cat = !ids && sel && sel !== 'all' ? sel : null;

const engine = new Engine(root);
try {
  const fn = kind === 'props' ? 'propSheet' : 'poseSheet';
  const r = await engine.call(fn, { ids, cat, adult: !!flags.adult, view: flags.view || '3q', cols: Number(flags.cols) || 6 });
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, dataUrlToBuffer(r.png));
  console.log(`${r.count} ${kind} -> ${out}`);
} finally {
  await engine.close();
}
