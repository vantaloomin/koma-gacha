// Frame strips of the main interactions (for reviewing motion without a screen recorder).
//   node tools/motion-frames.mjs <outDir> [--dark]
// Each interaction is captured as a row of cropped frames at fixed times after the input.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const out = path.resolve(process.argv[2] || 'motion-frames');
const dark = process.argv.includes('--dark');
fs.mkdirSync(out, { recursive: true });
let browser;
for (const opt of [{ channel: 'msedge' }, { channel: 'chrome' }, {}]) {
  try { browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'], ...opt }); break; } catch { /* next */ }
}
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: dark ? 'dark' : 'light' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://localhost:6170/');
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => window.__ng?.layout);
await page.waitForTimeout(1500);

const wait = (ms) => page.waitForTimeout(ms);
// capture frames at the given times (ms after the action starts); clip = region
async function strip(name, action, times, clip) {
  const t0 = Date.now();
  const p = action();
  const files = [];
  for (const t of times) {
    const dt = t - (Date.now() - t0);
    if (dt > 0) await wait(dt);
    const f = path.join(out, `${name}-${String(t).padStart(4, '0')}ms.png`);
    await page.screenshot({ path: f, clip });
    files.push(f);
  }
  await p;
  console.log(name, files.length, 'frames');
}

const box = await page.locator('#sb-page').boundingBox();
const pageClip = { x: box.x - 10, y: box.y - 10, width: box.width + 20, height: box.height * 0.55 };
await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.45);
await wait(300);
await page.screenshot({ path: path.join(out, 'hover-panel.png'), clip: pageClip });
await strip('select-panel', () => page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.45), [0, 60, 120, 260], pageClip);
await page.mouse.move(1390, 78);
await wait(700);
await page.screenshot({ path: path.join(out, 'tooltip-roll.png'), clip: { x: 1100, y: 50, width: 340, height: 90 } });
await page.mouse.move(1060, 78);
await wait(80);
await page.screenshot({ path: path.join(out, 'tooltip-warm-delete.png'), clip: { x: 900, y: 50, width: 400, height: 90 } });
await strip('roll', () => page.click('#g-roll'), [0, 40, 120, 240, 420], { x: 0, y: 52, width: 1440, height: 520 });
await strip('lock-segment', () => page.locator('.lock-row .seg button').nth(1).click(), [0, 80, 160, 360], { x: 1090, y: 210, width: 350, height: 70 });
await strip('inspector-tabs', () => page.click('.ptabs[data-ptabs=story] button[data-pane=score]'), [0, 80, 160, 360], { x: 1090, y: 105, width: 350, height: 140 });
await strip('export-menu', () => page.click('[data-menu=export-menu]'), [0, 50, 100, 220], { x: 1050, y: 52, width: 390, height: 300 });
await page.keyboard.press('Escape');
await strip('cast-sheet', () => page.click('.drawer-open[data-pane=chars]'), [0, 100, 200, 450], { x: 0, y: 0, width: 1440, height: 900 });
await page.click('#drawer-close');
await wait(500);
await strip('delete-nothing', async () => { await page.keyboard.press('Escape'); await page.click('#sb-del'); }, [0, 80, 160, 320], { x: 980, y: 55, width: 140, height: 46 });
await strip('tab-pages', () => page.click('.tab[data-tab=layout]'), [0, 60, 140, 300, 600], { x: 0, y: 0, width: 1440, height: 900 });
await strip('layout-zoom', () => page.locator('.lcard').nth(6).click(), [0, 80, 160, 340], { x: 0, y: 0, width: 1440, height: 900 });
await page.keyboard.press('Escape');
await strip('tab-poses', () => page.keyboard.press('3'), [0, 60, 160, 400, 900], { x: 0, y: 0, width: 1440, height: 900 });
console.log('errors:', errors.length ? errors : 'none');
await browser.close();
