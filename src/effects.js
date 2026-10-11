// Comic effect lines and tones, drawn in 2D over (or behind) a panel's 3D render.
// "back" effects replace the panel's background: the 3D render is drawn on top with a transparent
// background, so the characters stay in front. "front" effects are drawn over everything.

import { makeRng } from './rng.js';

export const EFFECTS = {
  focusLines: { label: 'Focus lines', layer: 'back' },
  lightRays: { label: 'Light rays', layer: 'back' },
  betaFlash: { label: 'Beta flash', layer: 'back' },
  uniFlash: { label: 'Uni flash', layer: 'back' },
  speedLines: { label: 'Speed lines', layer: 'back' },
  curvedSpeedLines: { label: 'Curved speed lines', layer: 'back' },
  windLines: { label: 'Wind lines', layer: 'front' },
  verticalGloomLines: { label: 'Vertical gloom lines', layer: 'back' },
  rain: { label: 'Rain', layer: 'front' },
  crossHatching: { label: 'Cross-hatching', layer: 'back' },
  crossHatchGradient: { label: 'Cross-hatch gradient', layer: 'back' },
  blackEdgeHatching: { label: 'Black-edge hatching', layer: 'back' },
  ropeHatching: { label: 'Rope hatching', layer: 'back' },
  ropeHatchingGradient: { label: 'Rope hatching gradient', layer: 'back' },
  radialRopeHatching: { label: 'Radial rope hatching', layer: 'back' },
  halftoneDots: { label: 'Halftone dots', layer: 'back' },
  lineTone: { label: 'Line tone', layer: 'back' },
  gradientTone: { label: 'Gradient tone', layer: 'back' },
  patternTone: { label: 'Pattern tone', layer: 'back' },
  stipple: { label: 'Stipple', layer: 'back' },
  sandGrainTone: { label: 'Sand grain tone', layer: 'back' },
  sparkles: { label: 'Sparkles', layer: 'front' },
  flowerBackground: { label: 'Flower background', layer: 'back' },
  hearts: { label: 'Hearts', layer: 'front' },
  petals: { label: 'Petals', layer: 'front' },
  bubbles: { label: 'Bubbles', layer: 'back' },
  snow: { label: 'Snow', layer: 'front' },
};

export const hasBackEffect = (list) => (list || []).some((e) => EFFECTS[e.id]?.layer === 'back');

/**
 * Draw one layer of a panel's effects. g: 2D context already clipped to the panel.
 * box: panel box in canvas pixels {x, y, w, h}; center: {x, y} in canvas pixels (focus point);
 * s: pixels per page unit (line weights scale with it).
 */
export function drawEffects(g, list, layer, { box, center, s = 1, seed = 'fx' }) {
  for (const [k, e] of (list || []).entries()) {
    const def = EFFECTS[e.id];
    if (!def || def.layer !== layer) continue;
    const rng = makeRng(`${seed}|${e.id}|${k}`);
    const density = Math.max(5, Math.min(100, e.density ?? 60)) / 100;
    g.save();
    DRAW[e.id]?.(g, { box, c: center || { x: box.x + box.w / 2, y: box.y + box.h / 2 }, s, rng, d: density });
    g.restore();
  }
}

const TAU = Math.PI * 2;
const diag = (b) => Math.hypot(b.w, b.h);

function wedge(g, cx, cy, a, r0, r1, w) {
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  const px = -sa * w * 0.5;
  const py = ca * w * 0.5;
  g.beginPath();
  g.moveTo(cx + ca * r0, cy + sa * r0);
  g.lineTo(cx + ca * r1 + px, cy + sa * r1 + py);
  g.lineTo(cx + ca * r1 - px, cy + sa * r1 - py);
  g.closePath();
  g.fill();
}

function star(g, x, y, r, points = 4, inner = 0.28) {
  g.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * TAU - Math.PI / 2;
    const rr = i % 2 ? r * inner : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
}

function heart(g, x, y, r) {
  g.beginPath();
  g.moveTo(x, y + r * 0.9);
  g.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.6, y - r * 1.3, x, y - r * 0.45);
  g.bezierCurveTo(x + r * 0.6, y - r * 1.3, x + r * 1.6, y - r * 0.2, x, y + r * 0.9);
  g.closePath();
}

function dotScreen(g, b, s, levelAt, cell = 7) {
  const step = cell * s;
  g.fillStyle = '#111';
  for (let y = b.y - step; y < b.y + b.h + step; y += step * 0.7071) {
    const row = Math.round((y - b.y) / (step * 0.7071));
    for (let x = b.x - step + (row % 2) * step * 0.5; x < b.x + b.w + step; x += step) {
      const lv = levelAt(x, y);
      if (lv <= 0.02) continue;
      const r = Math.sqrt(lv) * step * 0.48;
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.fill();
    }
  }
}

function hatch(g, b, s, angle, gap, alphaAt = null, wobble = 0, rng = null) {
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const D = diag(b);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  g.strokeStyle = '#111';
  g.lineWidth = 0.9 * s;
  for (let t = -D / 2; t <= D / 2; t += gap * s) {
    const x0 = cx - sa * t - ca * D / 2;
    const y0 = cy + ca * t - sa * D / 2;
    const n = 24;
    g.beginPath();
    for (let k = 0; k <= n; k++) {
      const u = k / n;
      let x = x0 + ca * D * u;
      let y = y0 + sa * D * u;
      if (wobble) { const w = Math.sin(u * 18 + t * 0.07) * wobble * s; x += -sa * w; y += ca * w; }
      if (alphaAt && alphaAt(x, y) < (rng ? rng.next() : 0.5)) { g.moveTo(x, y); continue; }
      k ? g.lineTo(x, y) : g.moveTo(x, y);
    }
    g.stroke();
  }
}

const DRAW = {
  focusLines(g, { box: b, c, s, rng, d }) {
    const R = diag(b);
    const clear = Math.min(b.w, b.h) * 0.3;
    g.fillStyle = '#111';
    const n = Math.round(70 + d * 140);
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, TAU);
      wedge(g, c.x, c.y, a, R, clear * rng.range(0.9, 1.6), rng.range(1.5, 5.5) * s);
    }
  },
  uniFlash(g, { box: b, c, s, rng, d }) {
    const r0 = Math.min(b.w, b.h) * 0.22;
    g.fillStyle = '#111';
    const n = Math.round(90 + d * 160);
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, TAU);
      const len = rng.range(0.25, 0.75) * Math.min(b.w, b.h) * 0.55;
      const start = r0 * rng.range(0.95, 1.15);
      // a thin spike pointing outward, sharp at the outer end
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const w = rng.range(1.2, 3.2) * s;
      g.beginPath();
      g.moveTo(c.x + ca * start - sa * w, c.y + sa * start + ca * w);
      g.lineTo(c.x + ca * (start + len), c.y + sa * (start + len));
      g.lineTo(c.x + ca * start + sa * w, c.y + sa * start - ca * w);
      g.closePath();
      g.fill();
    }
  },
  betaFlash(g, { box: b, c, s, rng, d }) {
    g.fillStyle = '#0d0d0f';
    g.fillRect(b.x, b.y, b.w, b.h);
    const R = diag(b);
    const r0 = Math.min(b.w, b.h) * 0.16;
    g.fillStyle = '#fff';
    const n = Math.round(60 + d * 120);
    for (let i = 0; i < n; i++) wedge(g, c.x, c.y, rng.range(0, TAU), r0 * rng.range(0.6, 1.4), R * rng.range(0.35, 1), rng.range(2, 9) * s);
    const gr = g.createRadialGradient(c.x, c.y, 0, c.x, c.y, r0 * 2.2);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(b.x, b.y, b.w, b.h);
  },
  lightRays(g, { box: b, s, rng, d }) {
    const ox = b.x + b.w * rng.range(0.1, 0.35);
    const oy = b.y - b.h * 0.15;
    const R = diag(b) * 1.3;
    const n = Math.round(8 + d * 14);
    for (let i = 0; i < n; i++) {
      const a = Math.PI * rng.range(0.15, 0.85);
      const gr = g.createLinearGradient(ox, oy, ox + Math.cos(a) * R, oy + Math.sin(a) * R);
      gr.addColorStop(0, 'rgba(120,120,130,0.32)');
      gr.addColorStop(1, 'rgba(120,120,130,0)');
      g.fillStyle = gr;
      wedge(g, ox, oy, a, 0, R, rng.range(18, 60) * s);
    }
  },
  speedLines(g, { box: b, c, s, rng, d }) {
    g.strokeStyle = '#111';
    const n = Math.round(40 + d * 90);
    for (let i = 0; i < n; i++) {
      const y = b.y + rng.range(0, b.h);
      if (Math.abs(y - c.y) < b.h * 0.14 && rng.chance(0.75)) continue;
      const len = b.w * rng.range(0.25, 0.9);
      const x0 = rng.chance(0.5) ? b.x + b.w - len * rng.range(0, 0.3) : b.x + rng.range(0, b.w * 0.2);
      g.lineWidth = rng.range(0.6, 2.4) * s;
      g.beginPath();
      g.moveTo(x0, y);
      g.lineTo(x0 + len, y);
      g.stroke();
    }
  },
  curvedSpeedLines(g, { box: b, c, s, rng, d }) {
    const ox = c.x;
    const oy = b.y + b.h * 2.2;
    g.strokeStyle = '#111';
    const n = Math.round(30 + d * 70);
    for (let i = 0; i < n; i++) {
      const r = rng.range(b.h * 1.3, b.h * 3.1);
      const a0 = -Math.PI / 2 + rng.range(-0.45, 0.2);
      g.lineWidth = rng.range(0.6, 2.2) * s;
      g.beginPath();
      g.arc(ox, oy, r, a0, a0 + rng.range(0.08, 0.35));
      g.stroke();
    }
  },
  windLines(g, { box: b, s, rng, d }) {
    g.strokeStyle = 'rgba(40,40,45,0.55)';
    const n = Math.round(4 + d * 8);
    for (let i = 0; i < n; i++) {
      const y = b.y + rng.range(0.1, 0.9) * b.h;
      g.lineWidth = rng.range(0.8, 1.6) * s;
      g.beginPath();
      g.moveTo(b.x - 10, y);
      g.bezierCurveTo(b.x + b.w * 0.3, y - rng.range(10, 30) * s, b.x + b.w * 0.6, y + rng.range(10, 30) * s, b.x + b.w + 10, y - rng.range(0, 20) * s);
      g.stroke();
    }
  },
  verticalGloomLines(g, { box: b, s, rng, d }) {
    g.strokeStyle = '#111';
    const n = Math.round(40 + d * 140);
    for (let i = 0; i < n; i++) {
      const x = b.x + rng.range(0, b.w);
      g.lineWidth = rng.range(0.5, 1.6) * s;
      g.beginPath();
      g.moveTo(x, b.y - 2);
      g.lineTo(x, b.y + b.h * rng.range(0.25, 0.8));
      g.stroke();
    }
  },
  rain(g, { box: b, s, rng, d }) {
    g.strokeStyle = 'rgba(30,35,45,0.5)';
    g.lineWidth = 0.9 * s;
    const n = Math.round(60 + d * 200);
    for (let i = 0; i < n; i++) {
      const x = b.x + rng.range(-0.1, 1.1) * b.w;
      const y = b.y + rng.range(0, 1) * b.h;
      const len = rng.range(10, 26) * s;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x - len * 0.25, y + len);
      g.stroke();
    }
  },
  snow(g, { box: b, s, rng, d }) {
    const n = Math.round(30 + d * 120);
    for (let i = 0; i < n; i++) {
      const r = rng.range(1.5, 5) * s;
      g.beginPath();
      g.arc(b.x + rng.range(0, b.w), b.y + rng.range(0, b.h), r, 0, TAU);
      g.fillStyle = '#fff';
      g.fill();
      g.strokeStyle = 'rgba(80,90,110,0.6)';
      g.lineWidth = 0.7 * s;
      g.stroke();
    }
  },
  sparkles(g, { box: b, c, s, rng, d }) {
    const n = Math.round(6 + d * 18);
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, TAU);
      const rr = rng.range(0.18, 0.5) * Math.min(b.w, b.h);
      star(g, c.x + Math.cos(a) * rr * 1.3, c.y + Math.sin(a) * rr, rng.range(4, 12) * s, 4, 0.22);
      g.fillStyle = '#fff';
      g.fill();
      g.strokeStyle = '#111';
      g.lineWidth = 1.1 * s;
      g.stroke();
    }
  },
  hearts(g, { box: b, c, s, rng, d }) {
    const n = Math.round(4 + d * 12);
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, TAU);
      const rr = rng.range(0.2, 0.5) * Math.min(b.w, b.h);
      heart(g, c.x + Math.cos(a) * rr * 1.3, c.y + Math.sin(a) * rr, rng.range(5, 13) * s);
      g.fillStyle = '#ffd5e1';
      g.fill();
      g.strokeStyle = '#111';
      g.lineWidth = 1.1 * s;
      g.stroke();
    }
  },
  petals(g, { box: b, s, rng, d }) {
    const n = Math.round(10 + d * 30);
    for (let i = 0; i < n; i++) {
      g.save();
      g.translate(b.x + rng.range(0, b.w), b.y + rng.range(0, b.h));
      g.rotate(rng.range(0, TAU));
      g.beginPath();
      g.ellipse(0, 0, rng.range(4, 8) * s, rng.range(2, 3.5) * s, 0, 0, TAU);
      g.fillStyle = '#ffe1ea';
      g.fill();
      g.strokeStyle = 'rgba(60,40,50,0.7)';
      g.lineWidth = 0.8 * s;
      g.stroke();
      g.restore();
    }
  },
  bubbles(g, { box: b, s, rng, d }) {
    const n = Math.round(8 + d * 26);
    for (let i = 0; i < n; i++) {
      const x = b.x + rng.range(0, b.w);
      const y = b.y + rng.range(0, b.h);
      const r = rng.range(4, 18) * s;
      g.beginPath();
      g.arc(x, y, r, 0, TAU);
      g.strokeStyle = '#222';
      g.lineWidth = 1 * s;
      g.stroke();
      g.beginPath();
      g.arc(x - r * 0.35, y - r * 0.35, r * 0.22, 0, TAU);
      g.fillStyle = '#222';
      g.fill();
    }
  },
  flowerBackground(g, { box: b, s, rng, d }) {
    const n = Math.round(5 + d * 12);
    for (let i = 0; i < n; i++) {
      const x = b.x + rng.range(0, b.w);
      const y = b.y + rng.range(0, b.h);
      const r = rng.range(14, 34) * s;
      const petals = rng.int(5, 7);
      for (let k = 0; k < petals; k++) {
        const a = (k / petals) * TAU;
        g.beginPath();
        g.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.5, r * 0.3, a, 0, TAU);
        g.fillStyle = '#fff';
        g.fill();
        g.strokeStyle = '#333';
        g.lineWidth = 1 * s;
        g.stroke();
      }
      g.beginPath();
      g.arc(x, y, r * 0.22, 0, TAU);
      g.fillStyle = '#444';
      g.fill();
    }
  },
  crossHatching(g, { box: b, s, d }) {
    const gap = 9 - d * 5;
    hatch(g, b, s, Math.PI / 4, gap);
    hatch(g, b, s, -Math.PI / 4, gap);
  },
  crossHatchGradient(g, { box: b, s, rng, d }) {
    const gap = 8 - d * 4;
    const fade = (x, y) => 1 - (y - b.y) / b.h;
    hatch(g, b, s, Math.PI / 4, gap, fade, 0, rng);
    hatch(g, b, s, -Math.PI / 4, gap, (x, y) => fade(x, y) - 0.3, 0, rng);
  },
  blackEdgeHatching(g, { box: b, s, rng, d }) {
    const edge = (x, y) => {
      const e = Math.min(x - b.x, b.x + b.w - x, y - b.y, b.y + b.h - y) / (Math.min(b.w, b.h) * 0.35);
      return 1.05 - e;
    };
    hatch(g, b, s, Math.PI / 4, 6 - d * 3, edge, 0, rng);
    hatch(g, b, s, -Math.PI / 4, 6 - d * 3, (x, y) => edge(x, y) - 0.25, 0, rng);
    const gr = g.createRadialGradient(b.x + b.w / 2, b.y + b.h / 2, Math.min(b.w, b.h) * 0.35, b.x + b.w / 2, b.y + b.h / 2, diag(b) * 0.6);
    gr.addColorStop(0, 'rgba(0,0,0,0)');
    gr.addColorStop(1, 'rgba(0,0,0,0.85)');
    g.fillStyle = gr;
    g.fillRect(b.x, b.y, b.w, b.h);
  },
  ropeHatching(g, { box: b, s, d }) {
    hatch(g, b, s, Math.PI / 3, 8 - d * 4, null, 2.4);
  },
  ropeHatchingGradient(g, { box: b, s, rng, d }) {
    hatch(g, b, s, Math.PI / 3, 7 - d * 3, (x, y) => 1 - (y - b.y) / b.h, 2.4, rng);
  },
  radialRopeHatching(g, { box: b, c, s, rng, d }) {
    g.strokeStyle = '#111';
    g.lineWidth = 0.9 * s;
    const R = diag(b);
    const r0 = Math.min(b.w, b.h) * 0.3;
    const n = Math.round(80 + d * 160);
    for (let i = 0; i < n; i++) {
      const a = rng.range(0, TAU);
      g.beginPath();
      for (let k = 0; k <= 12; k++) {
        const r = r0 + ((R - r0) * k) / 12;
        const w = Math.sin(k * 1.4 + i) * 2.5 * s;
        const x = c.x + Math.cos(a) * r - Math.sin(a) * w;
        const y = c.y + Math.sin(a) * r + Math.cos(a) * w;
        k ? g.lineTo(x, y) : g.moveTo(x, y);
      }
      g.stroke();
    }
  },
  halftoneDots(g, { box: b, s, d }) {
    dotScreen(g, b, s, () => 0.12 + d * 0.3);
  },
  gradientTone(g, { box: b, s, d }) {
    dotScreen(g, b, s, (x, y) => (0.05 + d * 0.55) * (1 - (y - b.y) / b.h));
  },
  lineTone(g, { box: b, s, d }) {
    g.fillStyle = '#111';
    const gap = (7 - d * 3) * s;
    for (let y = b.y; y < b.y + b.h; y += gap) g.fillRect(b.x, y, b.w, Math.max(0.6, 1.1 * s * (0.5 + d)));
  },
  patternTone(g, { box: b, s, d }) {
    g.fillStyle = `rgba(17,17,17,${0.25 + d * 0.35})`;
    const step = 12 * s;
    for (let y = b.y; y < b.y + b.h + step; y += step) {
      for (let x = b.x + ((y / step) % 2) * step * 0.5; x < b.x + b.w + step; x += step) {
        g.beginPath();
        g.moveTo(x, y - step * 0.22);
        g.lineTo(x + step * 0.22, y);
        g.lineTo(x, y + step * 0.22);
        g.lineTo(x - step * 0.22, y);
        g.fill();
      }
    }
  },
  stipple(g, { box: b, s, rng, d }) {
    g.fillStyle = '#111';
    const n = Math.round((b.w * b.h) / (s * s) * 0.004 * (0.4 + d));
    for (let i = 0; i < n; i++) g.fillRect(b.x + rng.next() * b.w, b.y + rng.next() * b.h, 1.2 * s, 1.2 * s);
  },
  sandGrainTone(g, { box: b, s, rng, d }) {
    g.fillStyle = 'rgba(17,17,17,0.7)';
    const n = Math.round((b.w * b.h) / (s * s) * 0.012 * (0.3 + d));
    for (let i = 0; i < n; i++) g.fillRect(b.x + rng.next() * b.w, b.y + rng.next() * b.h, 0.7 * s, 0.7 * s);
  },
};
