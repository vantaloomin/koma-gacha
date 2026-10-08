// Screenshots of the app UI for design review: every tab and the main states, light and dark.
//   node tools/ui-shots.mjs [outDir] [--url=http://localhost:6170/] [--only=name,name]
// Needs the dev server running (start.bat or npm run dev).
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const args = process.argv.slice(2);
const out = path.resolve(args.find((a) => !a.startsWith('--')) || 'ui-shots');
const url = (args.find((a) => a.startsWith('--url=')) || '--url=http://localhost:6170/').slice(6);
const only = (args.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
fs.mkdirSync(out, { recursive: true });

let browser;
for (const opt of [{ channel: 'msedge' }, { channel: 'chrome' }, {}]) {
  try { browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'], ...opt }); break; } catch { /* next */ }
}
if (!browser) throw new Error('Could not launch Edge/Chrome');

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const shots = [];

async function session(scheme, viewport, fn) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, colorScheme: scheme });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`[${scheme}] page error: ${e.message}`));
  await page.goto(url);
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
  await page.waitForFunction(() => window.__ng?.layout, null, { timeout: 30000 });
  await wait(1500);
  await fn(page);
  await ctx.close();
}

async function snap(page, name) {
  if (only.length && !only.includes(name)) return;
  const file = path.join(out, name + '.png');
  await page.screenshot({ path: file });
  shots.push(file);
  console.log('saved', file);
}

for (const scheme of ['light', 'dark']) {
  await session(scheme, { width: 1440, height: 900 }, async (page) => {
    await snap(page, `${scheme}-storyboard`);
    // select a panel → inspector
    const box = await page.locator('#sb-page').boundingBox();
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await wait(600);
    await snap(page, `${scheme}-storyboard-panel`);
    await page.locator('#tab-story .inspector-scroll').evaluate((e) => e.scrollTo(0, 99999));
    await wait(200);
    await snap(page, `${scheme}-storyboard-panel-bottom`);
    for (const pane of ['scene', 'gacha', 'view', 'score']) {
      await page.click(`.ptabs[data-ptabs=story] button[data-pane=${pane}]`);
      await wait(300);
      await snap(page, `${scheme}-storyboard-${pane}`);
    }
    await page.click('.ptabs[data-ptabs=story] button[data-pane=panel]');
    await page.click('[data-menu=export-menu]');
    await wait(300);
    await snap(page, `${scheme}-storyboard-export-menu`);
    await page.keyboard.press('Escape');
    await page.click('.drawer-open[data-pane=layout]');
    await wait(500);
    await snap(page, `${scheme}-drawer-layout`);
    await page.click('#drawer-tabs button[data-pane=chars]');
    await wait(300);
    await snap(page, `${scheme}-drawer-cast`);
    await page.click('#drawer-close');
    await wait(400);
    await page.click('#sb-prompt');
    await wait(1200);
    await snap(page, `${scheme}-image-prompt`);
    await page.click('#ip-close');
    await page.click('#sb-view button[data-v=compare]');
    await wait(1500);
    await snap(page, `${scheme}-storyboard-compare`);
    await page.click('#sb-view button[data-v=single]');

    await page.click('.tab[data-tab=layout]');
    await wait(1200);
    await snap(page, `${scheme}-layouts`);
    await page.locator('.lcard').nth(2).click();
    await wait(500);
    await snap(page, `${scheme}-layout-dialog`);
    await page.keyboard.press('Escape');

    await page.click('.tab[data-tab=poses]');
    await wait(1500);
    await snap(page, `${scheme}-poses`);
    await page.click('.ptabs[data-ptabs=poses] button[data-pane=props]');
    await page.click('#pe-addprop');
    await wait(400);
    await snap(page, `${scheme}-poses-props`);
    await page.click('#theme-toggle');
    await wait(300);
    await snap(page, `${scheme}-theme-menu`);
    await page.keyboard.press('Escape');
    await page.click('.ptabs[data-ptabs=poses] button[data-pane=save]');
    await wait(300);
    await snap(page, `${scheme}-poses-save`);
    await page.click('#about-open');
    await wait(400);
    await snap(page, `${scheme}-about`);
  });
}

// narrow window
await session('light', { width: 820, height: 1000 }, async (page) => {
  await snap(page, 'light-narrow-storyboard');
  await page.click('.tab[data-tab=layout]');
  await wait(1000);
  await snap(page, 'light-narrow-layouts');
});

await browser.close();
console.log(`${shots.length} screenshots in ${out}`);
