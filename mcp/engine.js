// Starts a Vite server for the project and a headless Chromium (Edge/Chrome) that loads
// comic.html. Tool calls run window.ComicAPI functions inside that page.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createServer } from 'vite';
import { chromium } from 'playwright-core';
import { posesPlugin } from '../tools/vite-poses-plugin.js';

const log = (...a) => console.error('[koma]', ...a); // stdout belongs to MCP

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.vrm': 'model/gltf-binary', '.glb': 'model/gltf-binary' };

export class Engine {
  constructor(root) {
    this.root = root;
    this.files = new Map(); // token -> absolute path
    this.starting = null;
  }

  // Serve a local file to the page under an unguessable URL.
  fileUrl(absPath) {
    const token = crypto.createHash('sha1').update(absPath).digest('hex').slice(0, 16);
    this.files.set(token, absPath);
    return `/__file/${token}/${encodeURIComponent(path.basename(absPath))}`;
  }

  async start() {
    if (this.page) return;
    if (!this.starting) this.starting = this.#boot().catch((e) => { this.starting = null; throw e; });
    await this.starting;
  }

  async #boot() {
    const files = this.files;
    this.vite = await createServer({
      root: this.root,
      configFile: false,
      cacheDir: process.env.NG_CACHE_DIR || undefined, // separate caches let several engines run at once
      logLevel: 'silent',
      clearScreen: false,
      server: { host: '127.0.0.1', port: 6171, strictPort: false, hmr: false },
      plugins: [posesPlugin(this.root), {
        name: 'local-files',
        configureServer(server) {
          server.middlewares.use('/__file/', (req, res, next) => {
            const token = req.url.split('/')[1];
            const abs = files.get(token);
            if (!abs || !fs.existsSync(abs)) return next();
            res.setHeader('Content-Type', MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream');
            fs.createReadStream(abs).pipe(res);
          });
        },
      }],
    });
    await this.vite.listen();
    const base = this.vite.resolvedUrls.local[0];
    log('vite at', base);

    const args = ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'];
    const attempts = process.env.NG_BROWSER_PATH
      ? [{ executablePath: process.env.NG_BROWSER_PATH }]
      : [{ channel: 'msedge' }, { channel: 'chrome' }, {}];
    let lastErr;
    for (const opt of attempts) {
      try {
        this.browser = await chromium.launch({ headless: true, args, ...opt });
        break;
      } catch (e) { lastErr = e; }
    }
    if (!this.browser) throw new Error('Could not launch Edge/Chrome. Set NG_BROWSER_PATH to a Chromium-based browser. ' + lastErr?.message);
    await this.#openPage(base);
  }

  async #openPage(base = this.vite.resolvedUrls.local[0]) {
    this.page = await this.browser.newPage({ viewport: { width: 1200, height: 900 } });
    this.page.on('console', (m) => { if (m.type() === 'error') log('page error:', m.text()); });
    this.page.on('pageerror', (e) => log('page exception:', e.message));
    await this.page.goto(base + 'comic.html', { waitUntil: 'load', timeout: 120000 });
    await this.page.waitForFunction(() => window.ComicAPI, null, { timeout: 120000 });
    await this.page.evaluate(() => window.ComicAPI.ready);
    await this.page.evaluate(() => window.ComicAPI.loadCustom());
    log('renderer ready');
  }

  // Reload the render page (picks up source edits).
  async reload() {
    await this.start();
    await this.page.close();
    this.page = null;
    await this.#openPage();
  }

  async call(fn, arg) {
    await this.start();
    try {
      return await this.page.evaluate(([f, a]) => window.ComicAPI[f](a), [fn, arg]);
    } catch (e) {
      throw new Error(`Renderer error in ${fn}: ${e.message.split('\n')[0]}`);
    }
  }

  // Render HTML (e.g. a page of images) to PDF. Sizes are px numbers or CSS lengths ('210mm').
  async pdf(html, outPath, width, height) {
    await this.start();
    const p = await this.browser.newPage();
    try {
      await p.setContent(html, { waitUntil: 'load' });
      const len = (v) => (typeof v === 'number' ? `${v}px` : v);
      await p.pdf({ path: outPath, width: len(width), height: len(height), printBackground: true, margin: { top: 0, bottom: 0, left: 0, right: 0 } });
    } finally {
      await p.close();
    }
  }

  async close() {
    await this.browser?.close().catch(() => {});
    await this.vite?.close().catch(() => {});
  }
}

export function dataUrlToBuffer(dataUrl) {
  return Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
}
