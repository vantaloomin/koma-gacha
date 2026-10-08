import { defineConfig } from 'vite';
import { posesPlugin } from './tools/vite-poses-plugin.js';

export default defineConfig({
  plugins: [posesPlugin(process.cwd())],
  build: { rollupOptions: { input: { main: 'index.html', comic: 'comic.html' } } },
});
