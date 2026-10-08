// Input-to-next-paint timing for the main interactions (Event Timing API), so motion polish can be
// checked against responsiveness.   node tools/interaction-timing.mjs [--url=http://localhost:6170/]
import { chromium } from 'playwright-core';

const url = (process.argv.find((a) => a.startsWith('--url=')) || '--url=http://localhost:6170/').slice(6);
let browser;
for (const opt of [{ channel: 'msedge' }, { channel: 'chrome' }, {}]) {
  try { browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'], ...opt }); break; } catch { /* next */ }
}
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(url);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.waitForFunction(() => window.__ng?.layout);
await page.waitForTimeout(1500);
await page.evaluate(() => {
  window.__ev = [];
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__ev.push({ name: e.name, d: e.duration, p: e.processingEnd - e.processingStart }); })
    .observe({ type: 'event', durationThreshold: 16, buffered: false });
});

const results = [];
async function measure(label, act, settle = 600) {
  await page.evaluate(() => { window.__ev.length = 0; });
  await act();
  await page.waitForTimeout(settle);
  const ev = await page.evaluate(() => window.__ev.filter((e) => ['pointerup', 'click', 'keydown', 'pointerdown'].includes(e.name)));
  const worst = ev.reduce((m, e) => (e.d > m.d ? e : m), { d: 0, p: 0 });
  results.push({ label, inputToPaint: Math.round(worst.d), handler: Math.round(worst.p) });
}

const box = await page.locator('#sb-page').boundingBox();
const at = (fx, fy) => [box.x + box.width * fx, box.y + box.height * fy];
await measure('select panel', () => page.mouse.click(...at(0.5, 0.5)));
await measure('select another panel', () => page.mouse.click(...at(0.3, 0.75)));
await measure('switch proposal', () => page.locator('#sb-strip .thumb').nth(2).click());
await measure('roll (button)', () => page.click('#g-roll'), 1500);
await measure('view → Compare', () => page.click('#sb-view button[data-v=compare]'), 2500);
await measure('view → Page', () => page.click('#sb-view button[data-v=single]'), 2500);
await measure('view → Compare again', () => page.click('#sb-view button[data-v=compare]'), 2500);
await measure('compare → open proposal', () => page.locator('#sb-compare .thumb').nth(2).click(), 2500);
await measure('inspector tab', () => page.click('.ptabs[data-ptabs=story] button[data-pane=view]'));
await measure('toggle display switch', () => page.locator('#r-show input').nth(2).click());
await measure('open export menu', () => page.click('[data-menu=export-menu]'));
await page.keyboard.press('Escape');
await measure('open cast sheet', () => page.click('.drawer-open[data-pane=chars]'));
await page.click('#drawer-close');
await measure('tab → Pages', () => page.click('.tab[data-tab=layout]'), 1500);
await measure('open layout dialog', () => page.locator('.lcard').nth(1).click());
await page.keyboard.press('Escape');
await measure('tab → Poses', () => page.click('.tab[data-tab=poses]'), 1500);
await measure('load pose', () => page.locator('.pe-item').nth(3).locator('button').first().click());
await measure('tab → Shots', () => page.click('.tab[data-tab=story]'), 1500);

console.table(results);
await browser.close();
