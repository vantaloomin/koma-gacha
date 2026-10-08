// Comic lettering: speech/thought/shout/whisper balloons with tails, captions and SFX.
// Everything is placed in page units (the layout's W x H) and drawn at scale `s`.
//
// Placement rules, in order of preference:
//   1. inside the panel (unless allowBreak), including thought-cloud bumps and shout spikes
//   2. clear of faces, bodies and earlier balloons — the text rewraps / shrinks before it overlaps anyone
//   3. in reading order, near the speaker
// A line/caption/sfx with `pos: {u, v}` (panel-relative centre) is placed there instead.
// letterPanel() returns hit areas so an editor can drag items around.

import { makeRng } from './rng.js';

export const FONT = '"Comic Neue", "Comic Sans MS", sans-serif';
export const SFX_FONT = '"Bangers", "Impact", sans-serif';
const LINE = 1.12;
const MARGIN = 8;

function wrap(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    const words = para.split(/\s+/).filter(Boolean);
    let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (ctx.measureText(t).width <= maxW || !line) line = t;
      else { out.push(line); line = w; }
    }
    out.push(line);
  }
  return out;
}

function pointInPoly(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// How far a balloon's outline reaches beyond its text ellipse (cloud bumps, starburst spikes).
function cloudBump(rx, ry) {
  const n = Math.max(9, Math.round((rx + ry) / 14));
  return ((Math.PI * (rx + ry)) / n) * 0.62;
}
function extent(item) {
  if (item.kind === 'thought') {
    const br = cloudBump(item.rx, item.ry);
    return { ex: item.rx + br * 0.65, ey: item.ry + br * 0.65 };
  }
  if (item.kind === 'shout') return { ex: item.rx * 1.22, ey: item.ry * 1.22 };
  return { ex: item.rx + 2, ey: item.ry + 2 };
}

// Every way the text could be set (font size x wrap width), largest font first, that fits the panel.
function balloonFits(ctx, line, b, caps) {
  const kind = line.kind || 'speech';
  const base = kind === 'shout' ? 21 : kind === 'whisper' ? 16 : 18;
  const text = caps ? String(line.text).toUpperCase() : String(line.text);
  const short = b.h < b.w * 0.5;
  const widths = (short ? [0.7, 0.55, 0.42, 0.3] : [0.45, 0.6, 0.34, 0.75]).map((f) => Math.max(70, Math.min(330, b.w * f)));
  const out = [];
  for (let fs = base; fs >= 11; fs -= 1.5) {
    ctx.font = `${kind === 'whisper' ? 'italic ' : ''}700 ${fs}px ${FONT}`;
    for (const maxW of widths) {
      const lines = wrap(ctx, text, maxW);
      const tw = Math.max(...lines.map((l) => ctx.measureText(l).width));
      const th = lines.length * fs * LINE;
      const pad = kind === 'thought' ? 12 : kind === 'shout' ? 14 : 9;
      const item = { kind, fs, lines, tw, th, rx: (tw / 2) * 1.3 + pad, ry: (th / 2) * 1.34 + pad };
      const { ex, ey } = extent(item);
      if (2 * ex <= b.w - 2 * MARGIN && 2 * ey <= b.h - 2 * MARGIN) out.push(item);
    }
    if (out.length >= 3) break;
  }
  if (!out.length) {
    // nothing fits: use the smallest setting anyway
    ctx.font = `700 11px ${FONT}`;
    const lines = wrap(ctx, text, Math.max(60, b.w * 0.8));
    const tw = Math.max(...lines.map((l) => ctx.measureText(l).width));
    const th = lines.length * 11 * LINE;
    out.push({ kind, fs: 11, lines, tw, th, rx: (tw / 2) * 1.3 + 8, ry: (th / 2) * 1.34 + 8 });
  }
  return out;
}

// Search a grid of centres. relax 0: bodies are hard obstacles; 1: bodies soft; 2: faces soft too.
function placeEllipse(item, region, obstacles, prevR, target, dir, relax) {
  const { b, poly, bounds, allowBreak } = region;
  const { ex, ey } = extent(item);
  const x0 = bounds.x + ex + MARGIN;
  const x1 = bounds.x + bounds.w - ex - MARGIN;
  const y0 = bounds.y + ey + MARGIN;
  const y1 = bounds.y + bounds.h - ey - MARGIN;
  let best = null;
  const step = 8;
  for (let cx = x0; cx <= x1; cx += step) {
    for (let cy = y0; cy <= y1; cy += step) {
      const probe = allowBreak ? [[cx, cy]] : [[cx, cy], [cx - ex, cy], [cx + ex, cy], [cx, cy - ey], [cx, cy + ey], [cx - ex * 0.7, cy - ey * 0.7], [cx + ex * 0.7, cy - ey * 0.7], [cx - ex * 0.7, cy + ey * 0.7], [cx + ex * 0.7, cy + ey * 0.7]];
      if (!probe.every(([x, y]) => pointInPoly(x, y, poly))) continue;
      let cost = 0;
      let bad = false;
      for (const o of obstacles) {
        if (o.type === 'head') {
          const dx = (cx - o.x) / (ex + o.r);
          const dy = (cy - o.y) / (ey + o.r);
          const d = dx * dx + dy * dy;
          if (d < 1) { if (relax < 2) { bad = true; break; } cost += (1 - d) * 600; }
        } else if (o.type === 'ellipse') {
          const dx = (cx - o.x) / (ex + o.ex);
          const dy = (cy - o.y) / (ey + o.ey);
          if (dx * dx + dy * dy < 1) { bad = true; break; }
        } else if (o.type === 'rect') {
          const ox = Math.max(0, Math.min(cx + ex * 0.85, o.x1) - Math.max(cx - ex * 0.85, o.x0));
          const oy = Math.max(0, Math.min(cy + ey * 0.85, o.y1) - Math.max(cy - ey * 0.85, o.y0));
          const frac = (ox * oy) / (4 * ex * ey);
          if (frac > 0.01 && (o.hard || (o.body && relax === 0))) { bad = true; break; }
          cost += frac * (relax >= 2 ? 60 : 220);
        }
      }
      if (bad) continue;
      // reading position: top first, then along the reading direction
      const r = (cy - b.y) / b.h + 0.45 * (dir === 'rtl' ? (b.x + b.w - cx) / b.w : (cx - b.x) / b.w);
      cost += r * 30;
      if (prevR != null && r < prevR + 0.05) cost += 40 + (prevR - r) * 60;
      if (target) {
        const d = Math.hypot(cx - target.x, cy - target.y) - Math.max(ex, ey);
        cost += Math.max(0, d - 30) * 0.12 + (d < 0 ? 15 : 0);
      }
      if (!best || cost < best.cost) best = { x: cx, y: cy, cost, r };
    }
  }
  return best;
}

function ellipsePath(ctx, x, y, rx, ry, s) {
  ctx.moveTo((x + rx) * s, y * s);
  ctx.ellipse(x * s, y * s, rx * s, ry * s, 0, 0, Math.PI * 2);
}

function shoutPath(ctx, x, y, rx, ry, s, rng) {
  const n = 22;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const k = i % 2 === 0 ? 1.16 + rng.range(-0.04, 0.06) : 0.97;
    const px = x + Math.cos(a) * rx * k;
    const py = y + Math.sin(a) * ry * k;
    i ? ctx.lineTo(px * s, py * s) : ctx.moveTo(px * s, py * s);
  }
  ctx.closePath();
}

function cloudPath(ctx, x, y, rx, ry, s) {
  const n = Math.max(9, Math.round((rx + ry) / 14));
  const br = cloudBump(rx, ry);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const px = x + Math.cos(a) * (rx - br * 0.35);
    const py = y + Math.sin(a) * (ry - br * 0.35);
    ctx.moveTo((px + br) * s, py * s);
    ctx.arc(px * s, py * s, br * s, 0, Math.PI * 2);
  }
  ctx.moveTo((x + rx * 0.8) * s, y * s);
  ctx.ellipse(x * s, y * s, rx * 0.8 * s, ry * 0.8 * s, 0, 0, Math.PI * 2);
}

// Tail polygon from the balloon toward a target point.
function tailPath(ctx, bl, tx, ty, s, sharp) {
  const ang = Math.atan2(ty - bl.y, tx - bl.x);
  const ex = Math.cos(ang);
  const ey = Math.sin(ang);
  const edge = 1 / Math.sqrt((ex / bl.rx) ** 2 + (ey / bl.ry) ** 2);
  const dist = Math.hypot(tx - bl.x, ty - bl.y);
  const len = Math.max(14, Math.min(dist - edge, sharp ? 60 : 48));
  const tip = [bl.x + ex * (edge + len), bl.y + ey * (edge + len)];
  const base = edge * 0.72;
  const half = sharp ? 7 : 11;
  const nx = -ey;
  const ny = ex;
  const bend = sharp ? 0 : 0.35;
  ctx.moveTo((bl.x + ex * base + nx * half) * s, (bl.y + ey * base + ny * half) * s);
  ctx.quadraticCurveTo(
    (bl.x + ex * (edge + len * 0.5) + nx * half * bend) * s, (bl.y + ey * (edge + len * 0.5) + ny * half * bend) * s,
    tip[0] * s, tip[1] * s);
  ctx.lineTo((bl.x + ex * base - nx * half) * s, (bl.y + ey * base - ny * half) * s);
  ctx.closePath();
}

function drawBalloon(ctx, bl, s, target, seed, blank = false) {
  const rng = makeRng(seed);
  const lw = 2.4;
  const shape = (c) => {
    c.beginPath();
    if (bl.kind === 'shout') shoutPath(c, bl.x, bl.y, bl.rx, bl.ry, s, rng);
    else if (bl.kind === 'thought') cloudPath(c, bl.x, bl.y, bl.rx, bl.ry, s);
    else ellipsePath(c, bl.x, bl.y, bl.rx, bl.ry, s);
  };
  const tail = (c) => {
    if (!target || bl.kind === 'thought') return;
    c.beginPath();
    tailPath(c, bl, target.x, target.y, s, bl.kind === 'shout');
  };
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#111';
  ctx.fillStyle = '#fff';
  ctx.lineWidth = lw * 2 * s;
  if (bl.kind === 'whisper') ctx.setLineDash([7 * s, 5 * s]);
  // stroke at double width, then fill: the fill hides the inner half and the seam
  shape(ctx); ctx.stroke();
  tail(ctx); if (target && bl.kind !== 'thought') ctx.stroke();
  ctx.setLineDash([]);
  shape(ctx); ctx.fill();
  tail(ctx); if (target && bl.kind !== 'thought') ctx.fill();
  if (bl.kind === 'thought' && target) {
    const ang = Math.atan2(target.y - bl.y, target.x - bl.x);
    const { ex } = extent(bl);
    const edge = 1 / Math.sqrt((Math.cos(ang) / ex) ** 2 + (Math.sin(ang) / (extent(bl).ey)) ** 2);
    [[6, 8], [20, 5.5], [31, 3.5]].forEach(([d, r]) => {
      const x = bl.x + Math.cos(ang) * (edge + d);
      const y = bl.y + Math.sin(ang) * (edge + d);
      ctx.beginPath();
      ctx.arc(x * s, y * s, r * s, 0, Math.PI * 2);
      ctx.lineWidth = lw * s;
      ctx.fill();
      ctx.stroke();
    });
  }
  if (blank) { ctx.restore(); return; }
  ctx.fillStyle = bl.kind === 'whisper' ? '#444' : '#111';
  ctx.font = `${bl.kind === 'whisper' ? 'italic ' : ''}700 ${bl.fs * s}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lh = bl.fs * LINE;
  const y0 = bl.y - ((bl.lines.length - 1) * lh) / 2;
  bl.lines.forEach((l, i) => ctx.fillText(l, bl.x * s, (y0 + i * lh + bl.fs * 0.06) * s));
  ctx.restore();
}

function drawCaption(ctx, cap, s, blank = false) {
  ctx.save();
  ctx.fillStyle = '#fff6cc';
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 2 * s;
  ctx.fillRect(cap.x * s, cap.y * s, cap.w * s, cap.h * s);
  ctx.strokeRect(cap.x * s, cap.y * s, cap.w * s, cap.h * s);
  if (blank) { ctx.restore(); return; }
  ctx.fillStyle = '#111';
  ctx.font = `700 ${cap.fs * s}px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  cap.lines.forEach((l, i) => ctx.fillText(l, (cap.x + 8) * s, (cap.y + 6 + i * cap.fs * LINE) * s));
  ctx.restore();
}

function drawSfx(ctx, fx, s) {
  ctx.save();
  ctx.translate(fx.x * s, fx.y * s);
  ctx.rotate(fx.rot);
  ctx.font = `${fx.fs * s}px ${SFX_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#111';
  ctx.lineWidth = fx.fs * 0.22 * s;
  ctx.strokeText(fx.text, 0, 0);
  ctx.fillStyle = fx.color || '#fff';
  ctx.fillText(fx.text, 0, 0);
  ctx.restore();
}

const clampTo = (v, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, v)));

/**
 * Letter one panel.
 * pn: layout panel. shot: scored shot (has .analysis). script: {dialogue:[{speaker, text, kind, pos?}], caption, captionPos?, sfx:[{text,size,color,pos?}]}
 * speaker is a cast index (>= 0), -1 for off-panel, or null for narration.
 * opts: {dir, caps, seed, safe (page area lettering may use), allowBreak (balloons may cross the panel border)}
 * Returns hit areas: [{kind: 'line'|'caption'|'sfx', index, x, y, ex, ey}] in page units.
 */
export function letterPanel(ctx, s, pn, shot, script, { dir = 'rtl', caps = true, seed = 'x', safe = null, allowBreak = false, blank = false } = {}) {
  const hits = [];
  if (!script) return hits;
  const b = pn.bbox;
  const page = safe || { x: -1e4, y: -1e4, w: 2e4, h: 2e4 };
  const inter = (r) => {
    const x = Math.max(r.x, page.x);
    const y = Math.max(r.y, page.y);
    return { x, y, w: Math.min(r.x + r.w, page.x + page.w) - x, h: Math.min(r.y + r.h, page.y + page.h) - y };
  };
  const bounds = allowBreak ? inter({ x: b.x - b.w * 0.25, y: b.y - b.h * 0.25, w: b.w * 1.5, h: b.h * 1.5 }) : inter(b);
  const region = { b, poly: pn.poly, bounds, allowBreak };
  const people = shot?.analysis?.people || [];
  const obstacles = [];
  const headOf = {};
  // an inset panel laid over this one blocks lettering
  for (const o of pn.occluders || []) obstacles.push({ type: 'rect', hard: true, ...o });
  for (const p of people) {
    const x = b.x + p.u * b.w;
    const y = b.y + p.v * b.h;
    headOf[p.i] = { x, y, r: p.rv * b.h, visible: !p.behind && p.u > 0 && p.u < 1 && p.v > 0 && p.v < 1 };
    if (!p.behind && p.inFrame) {
      obstacles.push({ type: 'head', x, y, r: p.rv * b.h * 1.25 });
      obstacles.push({ type: 'rect', body: true, x0: b.x + p.body.u0 * b.w, x1: b.x + p.body.u1 * b.w, y0: b.y + p.body.v0 * b.h, y1: b.y + p.body.v1 * b.h });
    }
  }
  const fromPos = (pos) => pos && { x: b.x + pos.u * b.w, y: b.y + pos.v * b.h };

  // caption at the reading-start corner (or where it was dragged)
  if (script.caption) {
    ctx.font = `700 15px ${FONT}`;
    const fs = 15;
    const text = caps ? String(script.caption).toUpperCase() : String(script.caption);
    const lines = wrap(ctx, text, Math.max(110, Math.min(b.w * 0.55, 320)));
    const w = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 16;
    const h = lines.length * fs * LINE + 12;
    const left = bounds.x + 10;
    const right = bounds.x + bounds.w - 10;
    const top = bounds.y + 10;
    let cap = null;
    const want = fromPos(script.captionPos);
    if (want) {
      cap = { x: clampTo(want.x - w / 2, allowBreak ? page.x : left, (allowBreak ? page.x + page.w : right) - w), y: clampTo(want.y - h / 2, allowBreak ? page.y : top, (allowBreak ? page.y + page.h : bounds.y + bounds.h - 10) - h), w, h, fs, lines };
    } else {
      // corners in reading order (top first), sliding inward; never over a face, avoid bodies if possible
      const xs = dir === 'rtl' ? [right - w, left] : [left, right - w];
      const bottom = bounds.y + bounds.h - 10 - h;
      const hitsHead = (x, y) => obstacles.some((o) => o.type === 'head' && o.x + o.r > x && o.x - o.r < x + w && o.y + o.r > y && o.y - o.r < y + h);
      const bodyCost = (x, y) => obstacles.reduce((t, o) => {
        if (o.type !== 'rect' || !o.body) return t;
        const ox = Math.max(0, Math.min(x + w, o.x1) - Math.max(x, o.x0));
        const oy = Math.max(0, Math.min(y + h, o.y1) - Math.max(y, o.y0));
        return t + (ox * oy) / (w * h);
      }, 0);
      let best = null;
      for (const [yStart, yStep] of [[top, 6], [bottom, -6]]) {
        for (const x of xs) {
          for (let k = 0; k < 40; k++) {
            const y = yStart + k * yStep;
            if (y < top || y > bottom) break;
            const corners = [[x, y], [x + w, y], [x, y + h], [x + w, y + h]];
            const blocked = (pn.occluders || []).some((o) => x < o.x1 && x + w > o.x0 && y < o.y1 && y + h > o.y0);
            if (blocked || !corners.every(([cx, cy]) => pointInPoly(cx, cy, pn.poly)) || hitsHead(x, y)) continue;
            const cost = bodyCost(x, y) * 100 + k * 0.5 + (yStep < 0 ? 15 : 0) + (x === xs[0] ? 0 : 6);
            if (!best || cost < best.cost) best = { x, y, cost };
            break; // first clear spot on this slide is enough
          }
        }
      }
      cap = best ? { x: best.x, y: best.y, w, h, fs, lines } : { x: xs[0], y: top, w, h, fs, lines };
    }
    drawCaption(ctx, cap, s, blank);
    obstacles.push({ type: 'rect', hard: true, x0: cap.x - 4, x1: cap.x + w + 4, y0: cap.y - 4, y1: cap.y + h + 4 });
    hits.push({ kind: 'caption', index: 0, x: cap.x + w / 2, y: cap.y + h / 2, ex: w / 2, ey: h / 2 });
  }

  // balloons: manually placed ones first (they claim their space), then automatic ones in order
  const lines = (script.dialogue || []).map((line, k) => ({ line, k })).filter(({ line }) => line?.text);
  const ordered = [...lines.filter((x) => x.line.pos), ...lines.filter((x) => !x.line.pos)];
  let prevR = null;
  for (const { line, k } of ordered) {
    const fits = balloonFits(ctx, line, b, caps);
    const head = line.speaker != null && line.speaker >= 0 ? headOf[line.speaker] : null;
    let target = null;
    if (head) {
      target = head.visible ? { x: head.x, y: head.y - head.r * 0.2 } : { x: clampTo(head.x, b.x - 40, b.x + b.w + 40), y: clampTo(head.y, b.y - 40, b.y + b.h + 40) };
    } else if (line.speaker === -1) {
      target = { x: dir === 'rtl' ? b.x + b.w + 60 : b.x - 60, y: b.y + b.h * 0.3 }; // off-panel voice
    }
    let item = fits[0];
    let spot = null;
    const want = fromPos(line.pos);
    if (want) {
      const { ex, ey } = extent(item);
      spot = { x: clampTo(want.x, bounds.x + ex + MARGIN, bounds.x + bounds.w - ex - MARGIN), y: clampTo(want.y, bounds.y + ey + MARGIN, bounds.y + bounds.h - ey - MARGIN), r: null };
    } else {
      // try the biggest text first; rewrap or shrink before overlapping anyone
      for (const relax of [0, 1]) {
        for (const cand of fits) {
          spot = placeEllipse(cand, region, obstacles, prevR, target, dir, relax);
          if (spot) { item = cand; break; }
        }
        if (spot) break;
      }
      if (!spot) {
        item = fits[fits.length - 1];
        spot = placeEllipse(item, region, obstacles, prevR, target, dir, 2);
      }
      if (!spot) {
        const { ey } = extent(item);
        spot = { x: b.x + b.w / 2, y: b.y + ey + MARGIN, r: 0 };
      }
      prevR = spot.r;
    }
    const bl = { ...item, x: spot.x, y: spot.y };
    const { ex, ey } = extent(bl);
    obstacles.push({ type: 'ellipse', x: bl.x, y: bl.y, ex, ey });
    // no tail if the speaker's head is under the balloon or right next to it
    if (target && Math.hypot(target.x - bl.x, target.y - bl.y) < Math.max(bl.rx, bl.ry) * 0.9) target = null;
    drawBalloon(ctx, bl, s, line.speaker == null ? null : target, `${seed}|${k}`, blank);
    hits.push({ kind: 'line', index: k, x: bl.x, y: bl.y, ex, ey });
  }

  // sound effects
  (script.sfx || []).forEach((fx, k) => {
    if (!fx?.text) return;
    const fs = { small: 34, medium: 52, large: 76 }[fx.size || 'medium'] || 52;
    ctx.font = `${fs}px ${SFX_FONT}`;
    const text = String(fx.text).toUpperCase();
    const w = ctx.measureText(text).width;
    const item = { kind: 'sfx', rx: Math.min(w / 2 + 6, b.w / 2 - 8), ry: fs * 0.55 };
    const rng = makeRng(`${seed}|sfx|${k}`);
    const want = fromPos(fx.pos);
    const spot = want
      ? { x: clampTo(want.x, bounds.x + item.rx, bounds.x + bounds.w - item.rx), y: clampTo(want.y, bounds.y + item.ry, bounds.y + bounds.h - item.ry) }
      : placeEllipse(item, region, obstacles.filter((o) => o.type !== 'rect' || o.hard), null, { x: b.x + b.w * rng.range(0.3, 0.7), y: b.y + b.h * 0.8 }, dir, 1)
        || { x: b.x + b.w / 2, y: b.y + b.h * 0.75 };
    drawSfx(ctx, { text, fs, x: spot.x, y: spot.y, rot: fx.rotation != null ? (fx.rotation * Math.PI) / 180 : rng.range(-0.2, 0.12), color: fx.color }, s);
    obstacles.push({ type: 'ellipse', x: spot.x, y: spot.y, ex: item.rx, ey: item.ry });
    hits.push({ kind: 'sfx', index: k, x: spot.x, y: spot.y, ex: item.rx, ey: item.ry });
  });
  return hits;
}
