// Print output: real trim size at a given DPI, art extended into the bleed, crop marks in a slug.
// Page units (layout.W x layout.H) map onto the format's trim size; bleed panels grow past it.

import { FORMATS } from './layout.js';

export const DEFAULT_PRINT = { bleedMm: 3, cropMarks: true, dpi: 300, slugMm: 10 };

export function printGeometry(layout, opts = {}) {
  const o = { ...DEFAULT_PRINT, ...opts };
  const trim = FORMATS[layout.format]?.trimMm || FORMATS.b5.trimMm;
  const slug = o.cropMarks ? o.slugMm : 0;
  const pxmm = o.dpi / 25.4;
  const outer = o.bleedMm + slug; // mm from the canvas edge to the trim line
  return {
    ...o,
    trim,
    slug,
    pxmm,
    scale: (trim[0] * pxmm) / layout.W, // canvas px per page unit
    bleedU: o.bleedMm * (layout.W / trim[0]), // bleed in page units
    offsetPx: outer * pxmm,
    width: Math.round((trim[0] + 2 * outer) * pxmm),
    height: Math.round((trim[1] + 2 * outer) * pxmm),
    mediaMm: [trim[0] + 2 * outer, trim[1] + 2 * outer],
  };
}

// Crop marks at each trim corner, kept outside the bleed, plus an optional slug label.
export function drawCropMarks(ctx, g, label) {
  if (!g.cropMarks) return;
  const x0 = g.offsetPx;
  const y0 = g.offsetPx;
  const x1 = x0 + g.trim[0] * g.pxmm;
  const y1 = y0 + g.trim[1] * g.pxmm;
  const start = (g.bleedMm + 1) * g.pxmm; // gap so marks never print inside the bleed
  const end = (g.bleedMm + g.slug - 1) * g.pxmm;
  ctx.save();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = Math.max(1, (0.25 / 72) * g.dpi); // 0.25 pt hairline
  ctx.beginPath();
  for (const [x, sx] of [[x0, -1], [x1, 1]]) {
    for (const [y, sy] of [[y0, -1], [y1, 1]]) {
      ctx.moveTo(x + sx * start, y); ctx.lineTo(x + sx * end, y); // horizontal mark on the trim line
      ctx.moveTo(x, y + sy * start); ctx.lineTo(x, y + sy * end); // vertical mark
    }
  }
  ctx.stroke();
  if (label) {
    ctx.fillStyle = '#000';
    ctx.font = `${Math.round(2.4 * g.pxmm)}px system-ui, sans-serif`;
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x0 + start, y1 + (g.bleedMm + g.slug / 2) * g.pxmm);
  }
  ctx.restore();
}

// Grow a bleeding panel's outline from the trim edge out to the bleed edge.
export function extendPoly(poly, W, H, bleedU) {
  return poly.map(([x, y]) => [
    x <= 0.5 ? -bleedU : x >= W - 0.5 ? W + bleedU : x,
    y <= 0.5 ? -bleedU : y >= H - 0.5 ? H + bleedU : y,
  ]);
}
