// Drawing a built plot page (3D panels + lettering), shared by the Script workspace and the MCP renderer.

import { drawPage } from '../renderer.js';
import { letterPanel } from '../letter.js';

// Letter every panel (insets last, so their balloons sit on top). Returns hit areas per panel.
export function letterPlotPage(g, scale, p, { caps = true, blank = false } = {}) {
  const order = [...p.layout.panels.keys()].sort((x, y) => (p.layout.panels[x].inset ? 1 : 0) - (p.layout.panels[y].inset ? 1 : 0));
  const f = p.layout.frame;
  const hits = {};
  for (const i of order) {
    const script = p.scripts[i];
    if (script) hits[i] = letterPanel(g, scale, p.layout.panels[i], p.prop.shots[i], script, { dir: p.layout.dir, caps, blank, seed: `plot|${p.number}|${i}`, safe: { x: f.x - 30, y: f.y - 30, w: f.w + 60, h: f.h + 60 } });
  }
  return hits;
}

// p: a page from comicalize(). opts: {scale, caps, show, selected, accent, uiScale}
export function drawPlotPage(g, sr, p, opts = {}) {
  drawPage(g, sr, p.layout, p.prop, p.world, { scale: opts.scale, show: opts.show || {}, chars: p.chars, selected: opts.selected, accent: opts.accent, uiScale: opts.uiScale, panelFx: p.panels });
  return letterPlotPage(g, opts.scale, p, opts);
}
