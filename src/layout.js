// Manga page layout generator.
// A page is cut into tiers by (optionally tilted) horizontal gutters, each tier into
// columns by tilted vertical gutters, and some cells get split again. Panels are
// quads computed from the four lines that bound them, inset by half a gutter on
// internal edges.

import { makeRng } from './rng.js';

export const FORMATS = {
  b5: { label: 'Manga page (B5/A5)', trimMm: [182, 257], W: 1000, H: 1414, margin: { t: 92, b: 112, l: 82, r: 82 } },
  letter: { label: 'US Letter (8.5×11)', trimMm: [215.9, 279.4], W: 1000, H: 1294, margin: { t: 64, b: 64, l: 64, r: 64 } },
  comic: { label: 'US comic book', trimMm: [168.3, 260.4], W: 1000, H: 1547, margin: { t: 80, b: 92, l: 72, r: 72 } },
  sns: { label: 'Social portrait 4:5', trimMm: [203.2, 254], W: 1000, H: 1250, margin: { t: 60, b: 60, l: 60, r: 60 } },
  square: { label: 'Square 1:1', trimMm: [203.2, 203.2], W: 1000, H: 1000, margin: { t: 50, b: 50, l: 50, r: 50 } },
};

// steep: chance of strongly slanted dividers; repeat: reuse one divider for every row with the
// same column count; inset: chance of an overlapping inset panel; diag: chance of triangle splits.
const BASE = { grid: 'off', steep: 0, repeat: false, inset: 0, diag: 0, bleedMode: 'none' };
export const PRESETS = {
  orderly: { ...BASE, label: 'Orderly / Dialogue', tiers: '3-4', hTilt: 5, vTilt: 5, bleed: 0, inner: 10, big: 10 },
  standard: { ...BASE, label: 'Standard', tiers: '2-4', hTilt: 25, vTilt: 25, steep: 10, bleedMode: 'key', bleed: 20, inner: 20, big: 20, inset: 5, diag: 3 },
  action: { ...BASE, label: 'Action', tiers: '2-3', hTilt: 60, vTilt: 60, steep: 45, bleedMode: 'free', bleed: 45, inner: 30, big: 35, inset: 15, diag: 12 },
  splash: { ...BASE, label: 'Splash / Title page', tiers: '1-2', hTilt: 20, vTilt: 20, steep: 10, bleedMode: 'key', bleed: 60, inner: 10, big: 70, inset: 25, diag: 5 },
  grid: { ...BASE, label: 'Even grid', grid: 'auto', tiers: '2-4', hTilt: 0, vTilt: 0, bleed: 0, inner: 0, big: 25 },
  strips: { ...BASE, label: 'Strip rows', tiers: '5-6', hTilt: 4, vTilt: 10, steep: 65, repeat: true, bleed: 0, inner: 0, big: 0 },
};

export const TIER_OPTIONS = ['1-2', '1-3', '2-3', '2-4', '3-4', '3-5', '4-6', '5-6'];
export const GRID_SHAPES = { off: 'Off', auto: 'Auto', '2x2': '2 × 2', '2x3': '2 × 3', '3x3': '3 × 3', '2x4': '2 × 4', '3x4': '3 × 4', '3x2': '3 × 2', '4x2': '4 × 2' };
export const BLEED_MODES = { none: 'No bleed', key: 'Key panel only', free: 'Random edges' };
export const LAYOUT_KEYS = ['preset', 'format', 'dir', 'tiers', 'hTilt', 'vTilt', 'steep', 'repeat', 'bleedMode', 'bleed', 'inner', 'big', 'inset', 'diag', 'grid', 'border', 'seed'];

export function defaultLayoutParams() {
  return {
    preset: 'standard',
    format: 'b5',
    dir: 'rtl',
    ...PRESETS.standard,
    border: 4,
    seed: 'SC-2026',
  };
}

// --- line helpers -----------------------------------------------------------
// h-line: y = a + b * (x - W/2)     v-line: x = c + d * (y - H/2)

function intersect(h, v, W, H) {
  const a = h.a - H / 2;
  const c = v.c - W / 2;
  const X = (c + v.d * a) / (1 - v.d * h.b);
  const Y = a + h.b * X;
  return [X + W / 2, Y + H / 2];
}
const hAt = (h, x, W) => h.a + h.b * (x - W / 2);
const vAt = (v, y, H) => v.c + v.d * (y - H / 2);
const shiftH = (h, dy) => ({ ...h, a: h.a + dy });
const shiftV = (v, dx) => ({ ...v, c: v.c + dx });

function polyArea(poly) {
  let s = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x1, y1] = poly[i];
    const [x2, y2] = poly[(i + 1) % poly.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

function splitWeights(rng, n, jitter, minFrac) {
  let w = Array.from({ length: n }, () => 1 + rng.next() * jitter);
  const sum = w.reduce((s, x) => s + x, 0);
  w = w.map((x) => Math.max(minFrac, x / sum));
  const s2 = w.reduce((s, x) => s + x, 0);
  return w.map((x) => x / s2);
}

function parseTiers(t) {
  const [lo, hi] = String(t).split('-').map(Number);
  return [lo || 1, hi || lo || 1];
}

function finishPanel(poly, extra) {
  const xs = poly.map((q) => q[0]);
  const ys = poly.map((q) => q[1]);
  const bbox = { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  const center = [xs.reduce((s, v) => s + v, 0) / poly.length, ys.reduce((s, v) => s + v, 0) / poly.length];
  return { poly, bbox, center, area: polyArea(poly), ...extra };
}

// Row plan for even grids: equal rows/columns, optionally one row merged into a big panel.
function gridPlan(p, rng, B) {
  const shapes = [['2x2', 2], ['2x3', 3], ['3x3', 3], ['2x4', 1.5], ['3x4', 1.5], ['3x2', 1.5], ['4x2', 0.6]];
  const shape = p.grid && p.grid !== 'auto' && p.grid !== 'off' ? p.grid : rng.weighted(shapes);
  const [C, R] = shape.split('x').map(Number);
  const rows = Array.from({ length: R }, () => ({ weight: 1, cols: C, even: true }));
  if (R >= 2 && rng.chance(B * 0.9)) {
    const k = rng.chance(0.65) ? R - 1 : rng.chance(0.5) ? 0 : rng.int(0, R - 1);
    rows[k] = { weight: rng.range(1.4, 2.1), cols: 1, even: true };
  }
  return rows;
}

// --- generator --------------------------------------------------------------

export function generateLayout(params, index = 0) {
  const p = { ...defaultLayoutParams(), ...params };
  if (!p.bleedMode) p.bleedMode = p.bleed > 0 ? 'free' : 'none'; // older saved params
  const fmt = FORMATS[p.format] || FORMATS.b5;
  const { W, H, margin } = fmt;
  const rng = makeRng(`${p.seed}|layout|${index}`);
  const B = p.big / 100;
  const hT = p.hTilt / 100;
  const vT = p.vTilt / 100;
  const steep = (p.steep || 0) / 100;
  const hGap = 22 + p.border * 1.5; // gutter between tiers
  const vGap = 12 + p.border; // gutter between columns
  const rtl = p.dir === 'rtl';
  const isGrid = p.grid && p.grid !== 'off';

  const frame = {
    top: { a: margin.t, b: 0 },
    bottom: { a: H - margin.b, b: 0 },
    left: { c: margin.l, d: 0 },
    right: { c: W - margin.r, d: 0 },
  };
  const pageEdge = {
    top: { a: -4, b: 0 },
    bottom: { a: H + 4, b: 0 },
    left: { c: -4, d: 0 },
    right: { c: W + 4, d: 0 },
  };
  const fw = W - margin.l - margin.r;
  const fh = H - margin.t - margin.b;

  // rows: either an even grid or random tiers biased low by "big panels"
  let rows;
  if (isGrid) rows = gridPlan(p, rng, B);
  else {
    const [tLo, tHi] = parseTiers(p.tiers);
    const tierChoices = [];
    for (let n = tLo; n <= tHi; n++) tierChoices.push([n, 1 + (tHi - n) * B * 1.5]);
    const nT = rng.weighted(tierChoices);
    const tw = splitWeights(rng, nT, nT >= 5 ? 0.25 : 0.7, nT >= 5 ? 0.1 : 0.12);
    if (nT > 1 && rng.chance(B * 0.8)) tw[rng.int(0, nT - 1)] *= 1.6 + B;
    rows = tw.map((weight) => ({ weight }));
  }
  const nTiers = rows.length;
  const wsum = rows.reduce((s, r) => s + r.weight, 0);

  const hLines = [frame.top];
  let acc = margin.t;
  // grids place lines so every visible cell is the same size (outer cells have no gutter)
  const rowUnit = (fh - (nTiers - 1) * hGap) / wsum;
  for (let i = 0; i < nTiers - 1; i++) {
    if (isGrid) acc = margin.t + rows.slice(0, i + 1).reduce((s, r) => s + r.weight * rowUnit, 0) + i * hGap + hGap / 2;
    else acc += (rows[i].weight / wsum) * fh;
    const tilt = !isGrid && rng.chance(0.25 + hT * 0.6) ? rng.gauss() * 0.05 * hT * 1.6 : 0;
    hLines.push({ a: acc, b: clamp(tilt, -0.09, 0.09) });
  }
  hLines.push(frame.bottom);

  const repeatMemo = {}; // nCols -> {cw, ds}
  const cells = [];
  for (let t = 0; t < nTiers; t++) {
    const top = hLines[t];
    const bottom = hLines[t + 1];
    const ym = (hAt(top, W / 2, W) + hAt(bottom, W / 2, W)) / 2;
    const tierH = hAt(bottom, W / 2, W) - hAt(top, W / 2, W);
    let nCols = rows[t].cols;
    if (!nCols) {
      const thin = tierH < fh * 0.2;
      const colWeights = {
        1: thin ? 0.08 : 0.12 + 0.7 * B + (tierH > fh * 0.45 ? 0.2 : 0),
        2: thin ? 0.75 : 0.45,
        3: (thin ? 0.2 : 0.33) * (1 - 0.5 * B),
        4: thin ? 0.02 : 0.07 * (1 - 0.6 * B), // tall rows of narrow strips are allowed too
      };
      nCols = Number(rng.weighted(colWeights));
    }
    let cw;
    let ds;
    const memo = p.repeat ? repeatMemo[nCols] : null;
    if (memo) ({ cw, ds } = memo);
    else {
      cw = rows[t].even ? Array(nCols).fill(1 / nCols) : splitWeights(rng, nCols, 0.8, nCols >= 4 ? 0.16 : 0.18);
      ds = [];
      for (let c = 0; c < nCols - 1; c++) {
        let d = 0;
        if (!rows[t].even) {
          if (rng.chance(steep * 0.7)) d = (rng.chance(0.5) ? 1 : -1) * rng.range(0.28, 0.5);
          else if (rng.chance(0.25 + vT * 0.6)) d = clamp(rng.gauss() * 0.08 * vT * 1.6, -0.14, 0.14);
        }
        ds.push(d);
      }
      if (p.repeat) repeatMemo[nCols] = { cw, ds };
    }
    const vLines = [frame.left];
    let x = margin.l;
    const colW = (fw - (nCols - 1) * vGap) / nCols;
    for (let c = 0; c < nCols - 1; c++) {
      x = rows[t].even ? margin.l + (c + 1) * colW + c * vGap + vGap / 2 : x + cw[c] * fw;
      // keep a slant from eating the neighbouring panels
      const maxD = (0.55 * Math.min(cw[c], cw[c + 1]) * fw) / Math.max(1, tierH);
      const d = clamp(ds[c], -maxD, maxD);
      vLines.push({ c: x - d * (ym - H / 2), d });
    }
    vLines.push(frame.right);
    for (let c = 0; c < nCols; c++) {
      cells.push({
        top, bottom, left: vLines[c], right: vLines[c + 1],
        internal: { top: t > 0, bottom: t < nTiers - 1, left: c > 0, right: c < nCols - 1 },
        tier: t, col: c, nCols,
      });
    }
  }

  // inner splits: 2 or 3 stacked (ratios can be lopsided), or 2 side by side
  const pieces = [];
  for (const cell of cells) {
    const yMid = (hAt(cell.top, W / 2, W) + hAt(cell.bottom, W / 2, W)) / 2;
    const xm = (vAt(cell.left, yMid, H) + vAt(cell.right, yMid, H)) / 2;
    const yTop = hAt(cell.top, xm, W);
    const yBot = hAt(cell.bottom, xm, W);
    const ym = (yTop + yBot) / 2;
    const cellW = vAt(cell.right, ym, H) - vAt(cell.left, ym, H);
    const cellH = yBot - yTop;
    const want = !isGrid && rng.chance((p.inner / 100) * 0.9);
    if (want && cellH > 220 && (cellW < cellH * 1.4 || rng.chance(0.3))) {
      const three = cellH > 420 && rng.chance(0.3);
      const fr = three ? [rng.range(0.28, 0.38), rng.range(0.62, 0.72)] : [rng.range(0.28, 0.72)];
      const lines = fr.map((f) => {
        const b = rng.chance(hT) ? clamp(rng.gauss() * 0.06 * hT, -0.1, 0.1) : 0;
        return { a: yTop + f * cellH - b * (xm - W / 2), b };
      });
      const bounds = [cell.top, ...lines, cell.bottom];
      for (let k = 0; k < bounds.length - 1; k++) {
        pieces.push({
          ...cell, top: bounds[k], bottom: bounds[k + 1], subrow: k,
          internal: { ...cell.internal, top: k > 0 || cell.internal.top, bottom: k < bounds.length - 2 || cell.internal.bottom },
        });
      }
    } else if (want && cellW > 300) {
      const f = rng.range(0.35, 0.65);
      const x0 = vAt(cell.left, ym, H) + f * cellW;
      const d = rng.chance(vT) ? clamp(rng.gauss() * 0.1 * vT, -0.15, 0.15) : 0;
      const mid = { c: x0 - d * (ym - H / 2), d };
      pieces.push({ ...cell, right: mid, internal: { ...cell.internal, right: true }, subcol: 0 });
      pieces.push({ ...cell, left: mid, internal: { ...cell.internal, left: true }, subcol: 1 });
    } else {
      pieces.push({ ...cell });
    }
  }

  const geom = (pc) => {
    const top = pc.internal.top ? shiftH(pc.top, hGap / 2) : pc.top;
    const bottom = pc.internal.bottom ? shiftH(pc.bottom, -hGap / 2) : pc.bottom;
    const left = pc.internal.left ? shiftV(pc.left, vGap / 2) : pc.left;
    const right = pc.internal.right ? shiftV(pc.right, -vGap / 2) : pc.right;
    return [intersect(top, left, W, H), intersect(top, right, W, H), intersect(bottom, right, W, H), intersect(bottom, left, W, H)]
      .map(([x, y]) => [clamp(x, -4, W + 4), clamp(y, -4, H + 4)]);
  };

  // bleed: none, only a real key panel (the largest, if it is big), or random outer edges
  for (const pc of pieces) pc.bleed = {};
  const bleedSide = (pc, side) => { pc[side] = pageEdge[side]; pc.bleed[side] = true; };
  if (p.bleedMode === 'free') {
    const bleedP = (p.bleed / 100) * 0.55;
    for (const pc of pieces) for (const side of ['top', 'bottom', 'left', 'right']) if (!pc.internal[side] && rng.chance(bleedP)) bleedSide(pc, side);
  } else if (p.bleedMode === 'key') {
    let best = null;
    let bestA = 0;
    for (const pc of pieces) {
      const a = polyArea(geom(pc));
      if (a > bestA) { bestA = a; best = pc; }
    }
    if (best && bestA / (W * H) >= 0.24) for (const side of ['top', 'bottom', 'left', 'right']) if (!best.internal[side]) bleedSide(best, side);
  }

  let panels = pieces.map((pc) => finishPanel(geom(pc), { tier: pc.tier, col: pc.col, subcol: pc.subcol, subrow: pc.subrow, bleed: pc.bleed }));

  // reading order: tier by tier; inside a tier, panels whose tops line up read across (in the reading
  // direction) before going down, so two stacked columns with aligned splits read row by row
  const top = (pn) => Math.min(...pn.poly.map((q) => q[1]));
  const cx = (pn) => pn.center[0];
  const ROW_TOL = 45;
  panels.sort((A, Bp) => {
    if (A.tier !== Bp.tier) return A.tier - Bp.tier;
    const dt = top(A) - top(Bp);
    if (Math.abs(dt) > ROW_TOL) return dt;
    return rtl ? cx(Bp) - cx(A) : cx(A) - cx(Bp);
  });

  // diagonal splits: a panel cut corner to corner into two triangles (no gutter)
  if (p.diag > 0 && !isGrid) {
    const out = [];
    for (const pn of panels) {
      const af = pn.area / (W * H);
      const asp = pn.bbox.w / pn.bbox.h;
      if (af > 0.09 && asp > 0.6 && asp < 2.8 && rng.chance((p.diag / 100) * 0.5)) {
        const [TL, TR, BR, BL] = pn.poly;
        const pair = rng.chance(0.5) ? [[TL, TR, BR], [TL, BR, BL]] : [[TL, TR, BL], [TR, BR, BL]];
        // the upper triangle reads first
        for (const tri of pair) out.push(finishPanel(tri, { tier: pn.tier, col: pn.col, bleed: pn.bleed, tri: true }));
      } else out.push(pn);
    }
    panels = out;
  }

  // inset: one small panel laid over the others, straddling a gutter or inside a big panel
  if (p.inset > 0 && rng.chance((p.inset / 100) * 0.7)) {
    const big = panels.filter((pn) => !pn.tri && pn.area / (W * H) > 0.22);
    const iw = fw * rng.range(0.3, 0.44);
    const ih = fh * rng.range(0.17, 0.27);
    let rect = null;
    let host = null;
    // try a few spots; reject any that would bury most of another panel
    for (let attempt = 0; attempt < 8 && !rect; attempt++) {
      let r = null;
      let h0 = null;
      if (nTiers >= 2 && (rng.chance(0.55) || !big.length)) {
        const t = rng.int(1, nTiers - 1);
        const cx = margin.l + fw * rng.range(0.3, 0.7);
        const cy = hAt(hLines[t], cx, W);
        r = { x: cx - iw / 2, y: cy - ih / 2, w: iw, h: ih };
      } else if (big.length) {
        h0 = rng.pick(big);
        const b = h0.bbox;
        const w = Math.min(iw, b.w * 0.42);
        const h = Math.min(ih, b.h * 0.4);
        const right = rng.chance(0.5);
        const low = rng.chance(0.6);
        r = { x: right ? b.x + b.w - w - 28 : b.x + 28, y: low ? b.y + b.h - h - 28 : b.y + 28, w, h };
      }
      if (!r) break;
      const buries = panels.some((pn) => {
        const b = pn.bbox;
        const ox = Math.max(0, Math.min(r.x + r.w, b.x + b.w) - Math.max(r.x, b.x));
        const oy = Math.max(0, Math.min(r.y + r.h, b.y + b.h) - Math.max(r.y, b.y));
        return (ox * oy) / (b.w * b.h) > 0.45;
      });
      if (!buries) { rect = r; host = h0; }
    }
    if (rect) {
      const poly = [[rect.x, rect.y], [rect.x + rect.w, rect.y], [rect.x + rect.w, rect.y + rect.h], [rect.x, rect.y + rect.h]];
      const inset = finishPanel(poly, { inset: true, bleed: {} });
      // reads right after the panel under its top edge
      const topMid = [rect.x + rect.w / 2, rect.y + 4];
      let after = host ? panels.indexOf(host) : panels.findIndex((pn) => pointInPolygon(topMid, pn.poly));
      if (after < 0) after = panels.length - 1;
      panels.splice(after + 1, 0, inset);
      const halo = 10;
      for (const pn of panels) {
        if (pn === inset) continue;
        const b = pn.bbox;
        if (rect.x < b.x + b.w && rect.x + rect.w > b.x && rect.y < b.y + b.h && rect.y + rect.h > b.y) {
          pn.occluders = [{ x0: rect.x - halo, y0: rect.y - halo, x1: rect.x + rect.w + halo, y1: rect.y + rect.h + halo }];
        }
      }
    }
  }

  const pageArea = W * H;
  panels.forEach((pn, i) => {
    pn.order = i;
    pn.areaFrac = pn.area / pageArea;
  });

  return {
    W, H, dir: p.dir, format: p.format, index, seed: p.seed,
    frame: { x: margin.l, y: margin.t, w: fw, h: fh },
    border: p.border,
    panels,
  };
}

export function pointInPolygon([x, y], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// --- reading flow -----------------------------------------------------------

function segIntersect(p1, p2, p3, p4) {
  const d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0]);
  if (Math.abs(d) < 1e-9) return null;
  const t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d;
  const u = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { t, pt: [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])] };
}

// Where the line from `from` to `to` crosses the polygon's outline (first/last hit).
function crossPoly(poly, from, to, last) {
  let best = null;
  for (let i = 0; i < poly.length; i++) {
    const hit = segIntersect(from, to, poly[i], poly[(i + 1) % poly.length]);
    if (hit && (!best || (last ? hit.t > best.t : hit.t < best.t))) best = hit;
  }
  return best ? best.pt : to;
}

// Entry/exit points of the reading path for each panel (page coordinates).
export function readingFlow(layout) {
  const { W, H, panels, dir } = layout;
  const rtl = dir === 'rtl';
  const start = rtl ? [W, 0] : [0, 0];
  const end = rtl ? [0, H] : [W, H];
  return panels.map((pn, i) => {
    const prev = i === 0 ? start : panels[i - 1].center;
    const next = i === panels.length - 1 ? end : panels[i + 1].center;
    return {
      entry: crossPoly(pn.poly, prev, pn.center, false),
      exit: crossPoly(pn.poly, pn.center, next, true),
    };
  });
}

// --- SVG --------------------------------------------------------------------

export function layoutToSVG(layout, opts = {}) {
  const { numbers = true, guide = true, border = layout.border, bg = '#fff', ink = '#111', accent = '#2f7fd6' } = opts;
  const { W, H, frame, panels } = layout;
  const out = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`);
  out.push(`<rect width="${W}" height="${H}" fill="${bg}"/>`);
  if (guide) {
    out.push(`<g id="guide"><rect x="${frame.x}" y="${frame.y}" width="${frame.w}" height="${frame.h}" fill="none" stroke="#7fb5ea" stroke-width="2" stroke-dasharray="8 8"/></g>`);
  }
  const pts = (pn) => pn.poly.map((q) => q.map((v) => v.toFixed(1)).join(',')).join(' ');
  out.push(`<g id="panels" fill="#fff" stroke="${ink}" stroke-width="${border}" stroke-linejoin="miter">`);
  for (const pn of panels) if (!pn.inset) out.push(`<polygon points="${pts(pn)}"/>`);
  // insets sit on top, separated by a white halo
  for (const pn of panels) if (pn.inset) out.push(`<polygon points="${pts(pn)}" stroke="${bg}" stroke-width="${border + 14}"/><polygon points="${pts(pn)}"/>`);
  out.push('</g>');
  if (numbers) {
    out.push(`<g id="numbers" font-family="sans-serif" font-size="30" font-weight="700" text-anchor="middle">`);
    for (const pn of panels) {
      const [cx, cy] = pn.center;
      out.push(`<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="22" fill="${accent}"/><text x="${cx.toFixed(1)}" y="${(cy + 10).toFixed(1)}" fill="#fff">${pn.order + 1}</text>`);
    }
    out.push('</g>');
  }
  out.push('</svg>');
  return out.join('');
}
