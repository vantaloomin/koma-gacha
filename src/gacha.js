// Storyboard gacha: plans a camera shot for every panel, scores it against
// composition rules, and keeps the best of several random draws.

import * as THREE from 'three';
import { makeRng } from './rng.js';
import { headRadius, headCenterY } from './figures.js';
import { posedWorld, listPoses, getPose } from './pose-runtime.js';
import { readingFlow } from './layout.js';

export const SIZES = ['Extreme wide', 'Full shot', 'Medium', 'Medium close-up', 'Close-up'];
export const SIZE_SHORT = ['EWS', 'FS', 'MS', 'MCU', 'CU'];
export const TYPES = { establish: 'Establishing', two: 'Two-shot', single: 'Single', ots: 'Over-the-shoulder' };
export const ROLES = { establish: 'Set the scene', dialogue: 'Dialogue', reaction: 'Reaction', key: 'Key moment' };

export const TONES = {
  auto: { label: 'Auto (everyday talk)', elev: [0, 12], dutch: 0, size: 0 },
  daily: { label: 'Everyday', elev: [0, 10], dutch: 0, size: -0.3 },
  tension: { label: 'Tension', elev: [-10, 10], dutch: 9, size: 0.6 },
  conflict: { label: 'Conflict', elev: [-22, -4], dutch: 5, size: 0.6 },
  surprise: { label: 'Surprise', elev: [-6, 14], dutch: 7, size: 0.9 },
  intimate: { label: 'Intimate', elev: [-4, 6], dutch: 0, size: 0.8 },
  sad: { label: 'Sad / lonely', elev: [18, 45], dutch: 0, size: -0.8 },
  comedy: { label: 'Comedy', elev: [0, 14], dutch: 0, size: -0.6 },
  resolve: { label: 'Determination', elev: [-28, -10], dutch: 0, size: 0.7 },
  ominous: { label: 'Ominous', elev: [20, 50], dutch: 11, size: 0 },
  joy: { label: 'Joy', elev: [-6, 8], dutch: 0, size: -0.2 },
};

export const STYLES = { safe: { label: 'Safe', k: 14, jitter: 0.6 }, balance: { label: 'Balanced', k: 8, jitter: 1 }, bold: { label: 'Bold', k: 5, jitter: 1.6 } };

export const CRITERIA = [
  ['face', 'Speaker’s face visible', 1.5],
  ['role', 'Shot fits the panel’s role', 1.2],
  ['tone', 'Shot fits the tone', 1.0],
  ['flow', 'Reading flow', 1.0],
  ['biggest', 'Speaker is largest', 1.0],
  ['lookroom', 'Look room', 0.8],
  ['headroom', 'Headroom / cropping', 1.0],
  ['balloon', 'Space for balloon', 1.0],
  ['variety', 'Shot variety', 0.8],
  ['grammar', 'Sequence grammar', 0.8],
  ['overlap', 'Faces don’t overlap', 1.2],
  ['thirds', 'Rule of thirds', 0.6],
];

const DEG = Math.PI / 180;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const clamp01 = (v) => clamp(v, 0, 1);
const UP = new THREE.Vector3(0, 1, 0);

// --- world ----------------------------------------------------------------

export function defaultPositions(n) {
  if (n === 1) return [{ x: 0, z: 0 }];
  if (n === 2) return [{ x: -0.55, z: 0 }, { x: 0.55, z: 0 }];
  return [{ x: -0.6, z: 0.05 }, { x: 0.6, z: 0.05 }, { x: 0, z: -0.75 }];
}

// chars: [{height(cm), x, z, yawOffset}] -> world description used by camera + scoring
export function buildWorld(chars) {
  const n = chars.length;
  const cx = chars.reduce((s, c) => s + c.x, 0) / n;
  const cz = chars.reduce((s, c) => s + c.z, 0) / n;
  const people = chars.map((c, i) => {
    const h = c.height / 100;
    let fx = 0;
    let fz = 1;
    if (n === 2) {
      const o = chars[1 - i];
      fx = o.x - c.x; fz = o.z - c.z;
    } else if (n >= 3) {
      fx = cx - c.x; fz = cz - c.z;
    }
    let yaw = Math.atan2(fx, fz) + (c.yawOffset || 0) * DEG;
    return {
      i, h, r: headRadius(h),
      pos: new THREE.Vector3(c.x, 0, c.z),
      yaw,
      fwd: new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw)),
      head: new THREE.Vector3(c.x, headCenterY(h), c.z),
      center: new THREE.Vector3(c.x, h / 2, c.z), extentY: h, extentXZ: 0.4,
    };
  });
  let axisA = null;
  let axisB = null;
  let normal = new THREE.Vector3(0, 0, 1);
  const mid = new THREE.Vector3(cx, 0, cz);
  if (n >= 2) {
    axisA = people[0].pos;
    axisB = people[1].pos;
    const d = new THREE.Vector3().subVectors(axisB, axisA).setY(0).normalize();
    normal = new THREE.Vector3(-d.z, 0, d.x);
    if (normal.z < 0 || (Math.abs(normal.z) < 1e-6 && normal.x < 0)) normal.negate();
    mid.addVectors(axisA, axisB).multiplyScalar(0.5);
  } else {
    normal.copy(people[0].fwd);
  }
  return { people, normal, mid, axisA, axisB, n };
}

// Head direction for a person in a panel (looks at the speaker, or the speaker looks at a listener).
export function gazeFor(world, idx, speaker, listener) {
  const W = posedWorld(world, {}, { speaker, listener });
  const p = W.people[idx];
  return { dir: p.headFwd.clone(), yaw: p.look?.yaw || 0, pitch: p.look?.pitch || 0 };
}

// --- camera ---------------------------------------------------------------

// Vertical span to frame for each shot size; wide sizes follow the posed body's extent.
function spanFor(size, S) {
  const ext = Math.max(0.5, S.extentY ?? S.h);
  return [ext * 1.9, ext * 1.2, 1.0, 0.68, 0.42][size];
}

function rotY(v, ang) {
  return v.clone().applyAxisAngle(UP, ang);
}

// Returns {camera, sideOk}. spec: {type, subject, other, size, az, elev, dutch, fov, fx, fy}
export function computeCamera(spec, world, aspect, ctx = null) {
  world = posedWorld(world, spec, ctx);
  const cam = new THREE.PerspectiveCamera(spec.fov, aspect, 0.05, 200);
  const S = world.people[spec.subject] || world.people[0];
  const O = world.people[spec.other] ?? null;
  const n = world.normal;
  let focus;
  let pos;
  const size = spec.size;
  let span = spanFor(size, S);

  if (spec.type === 'ots' && O) {
    // behind the listener's shoulder, on the camera side of the axis
    focus = S.head.clone();
    const side = n.clone();
    const back = O.fwd.clone().multiplyScalar(-1);
    const shoulder = O.head.clone().add(back.multiplyScalar(0.42 + (size <= 2 ? 0.5 : 0))).add(side.multiplyScalar(0.4));
    shoulder.y = O.head.y - 0.04 + Math.tan(spec.elev * DEG) * 0.6;
    const dir = shoulder.clone().sub(focus);
    const hd = Math.hypot(dir.x, dir.z);
    const rotated = rotY(new THREE.Vector3(dir.x, 0, dir.z).normalize(), spec.az * DEG);
    pos = focus.clone().add(rotated.multiplyScalar(hd));
    pos.y = shoulder.y;
    const dist = pos.distanceTo(focus);
    cam.fov = clamp(2 * Math.atan(span / 2 / dist) / DEG, 8, 80);
  } else {
    let base;
    if (spec.type === 'single') {
      base = S.fwd.clone().add(n.clone().multiplyScalar(0.55)).setY(0).normalize();
      if (world.n === 1) base = S.fwd.clone();
      focus = size >= 2 ? S.head.clone() : S.center.clone().add(new THREE.Vector3(0, size === 0 ? 0 : S.extentY * 0.06, 0));
      // lying or sprawled bodies are wider than they are tall
      if (size <= 1) span = Math.max(span, ((S.extentXZ + 0.3) / aspect) * 1.05);
    } else {
      base = n.clone();
      const pts = world.people;
      const c = pts.reduce((v, p) => v.add(p.center), new THREE.Vector3()).multiplyScalar(1 / pts.length);
      const hy = pts.reduce((s, p) => s + p.head.y, 0) / pts.length;
      focus = new THREE.Vector3(c.x, size >= 2 ? hy - 0.08 : c.y, c.z);
      // fit everyone (every joint) horizontally
      let maxSpread = 0;
      for (const p of pts) for (const q of p.fk?.points || [p.pos]) maxSpread = Math.max(maxSpread, Math.hypot(q.x - c.x, q.z - c.z));
      const needW = maxSpread * 2 + 0.5;
      span = Math.max(span, (needW / aspect) * 1.05);
      if (spec.type === 'establish') span *= 1.05;
    }
    const dir = rotY(base, spec.az * DEG);
    const dist = span / 2 / Math.tan((spec.fov * DEG) / 2);
    pos = focus.clone()
      .add(dir.multiplyScalar(dist * Math.cos(spec.elev * DEG)))
      .add(new THREE.Vector3(0, dist * Math.sin(spec.elev * DEG), 0));
    if (pos.y < 0.15) pos.y = 0.15;
  }

  cam.position.copy(pos);
  cam.lookAt(focus);
  if (spec.dutch) cam.rotateZ(spec.dutch * DEG);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  // lens shift so the focus point lands on (fx, fy) in NDC
  cam.projectionMatrix.elements[8] = -spec.fx;
  cam.projectionMatrix.elements[9] = -spec.fy;
  cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();

  const rel = new THREE.Vector3().subVectors(pos, world.mid).setY(0);
  const sideOk = world.n < 2 || rel.dot(n) >= -0.02;
  return { camera: cam, focus, sideOk, world };
}

// --- projection helpers ---------------------------------------------------

function inPoly(u, v, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > v) !== (yj > v) && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

// Is a panel-normalized point actually visible (inside the panel shape, not under an inset)?
export function visibleAt(u, v, ctx) {
  if (ctx?.polyN && !inPoly(u, v, ctx.polyN)) return false;
  for (const o of ctx?.occN || []) if (u > o.u0 && u < o.u1 && v > o.v0 && v < o.v1) return false;
  return true;
}

function toPanel(v, cam) {
  const p = v.clone().project(cam);
  return { u: (p.x + 1) / 2, v: (1 - p.y) / 2, behind: p.z > 1 || v.clone().applyMatrix4(cam.matrixWorldInverse).z > -0.05 };
}

// Screen-space facts about each person in a shot.
export function analyzeShot(spec, world, aspect, ctx) {
  const { camera, sideOk, world: W } = computeCamera(spec, world, aspect, ctx);
  const camPos = camera.position;
  const people = W.people.map((p) => {
    const dir = p.headFwd;
    const c = toPanel(p.head, camera);
    const top = toPanel(p.head.clone().add(new THREE.Vector3(0, p.r * 1.15, 0)), camera);
    const rv = Math.abs(c.v - top.v) / 1.15; // head radius in v units
    const tip = toPanel(p.head.clone().add(dir.clone().multiplyScalar(0.35)), camera);
    const toCam = camPos.clone().sub(p.head).normalize();
    const faceVis = dir.dot(toCam);
    // body box from every projected joint
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const q of p.fk.points) {
      const t = toPanel(q, camera);
      if (t.behind) continue;
      u0 = Math.min(u0, t.u); u1 = Math.max(u1, t.u); v0 = Math.min(v0, t.v); v1 = Math.max(v1, t.v);
    }
    if (!Number.isFinite(u0)) { u0 = c.u; u1 = c.u; v0 = c.v; v1 = c.v; }
    const body = { u0, u1, v0: Math.max(v0, Math.min(v1, c.v + rv * 0.8)), v1 };
    const depth = camPos.distanceTo(p.head);
    const inFrame = !c.behind && c.u > -0.02 && c.u < 1.02 && c.v > -0.02 && c.v < 1.02 && visibleAt(clamp01(c.u), clamp01(c.v), ctx);
    return { i: p.i, u: c.u, v: c.v, rv, ru: rv / aspect, gaze: { du: tip.u - c.u, dv: tip.v - c.v }, faceVis, body, depth, inFrame, behind: c.behind, topV: c.v - rv * 1.1, gazeInfo: { dir } };
  });
  return { camera, sideOk, people };
}

// --- scoring --------------------------------------------------------------

const ROLE_PREFS = {
  establish: { types: { establish: 3, two: 1.4, single: 0.4 }, sizes: [3, 3, 0.8, 0.1, 0] },
  dialogue: { types: { ots: 3, single: 2, two: 1.4, establish: 0.2 }, sizes: [0.1, 0.6, 2.2, 3, 1.2] },
  reaction: { types: { single: 3, ots: 1.2, two: 0.4 }, sizes: [0, 0.3, 1, 2.4, 3] },
  key: { types: { single: 2.5, ots: 2.2, two: 0.6 }, sizes: [0, 0.4, 1, 2.4, 3] },
};

function roleFit(spec, role) {
  const pr = ROLE_PREFS[role];
  const tw = pr.types[spec.type] ?? 0;
  const tmax = Math.max(...Object.values(pr.types));
  const sw = pr.sizes[spec.size];
  const smax = Math.max(...pr.sizes);
  return 100 * (0.5 * (tw / tmax) + 0.5 * (sw / smax));
}

function toneFit(spec, tone, intensity) {
  const t = TONES[tone] || TONES.auto;
  const [lo, hi] = t.elev;
  const k = intensity === 'strong' ? 1.4 : intensity === 'quiet' ? 0.7 : 1;
  const e = spec.elev;
  const de = e < lo * k ? lo * k - e : e > hi * k ? e - hi * k : 0;
  let s = 100 - de * 2.2;
  const wantDutch = t.dutch * k;
  s -= Math.abs(Math.abs(spec.dutch) - wantDutch) * 2.2;
  // size bias: positive favours tighter shots
  if (t.size) s -= Math.max(0, -(spec.size - 2) * t.size) * 9;
  return clamp(s, 0, 100);
}

function findBalloon(an, ctx, focusIdx) {
  const { w, h } = ctx.px;
  const rx = clamp(Math.min(w * 0.17, h * 0.26), 36, 95);
  const ry = Math.min(rx * 1.25, h * 0.3);
  const ru = rx / w;
  const rv = ry / h;
  const sp = an.people[focusIdx];
  let best = null;
  for (let u = 0.08 + ru; u <= 0.92 - ru + 1e-6; u += 0.035) {
    for (let v = 0.06 + rv; v <= 0.72; v += 0.035) {
      let ok = true;
      let soft = 0;
      for (const p of an.people) {
        if (!p.inFrame && !p.behind) {
          // partially visible heads still block
        }
        if (p.behind) continue;
        // head as ellipse in px
        const dx = (u - p.u) * w;
        const dy = (v - p.v) * h;
        const rr = p.rv * h * 1.15;
        const ex = dx / (rx + rr);
        const ey = dy / (ry + rr);
        if (ex * ex + ey * ey < 1) { ok = false; break; }
        // body overlap (soft)
        const ou = Math.max(0, Math.min(u + ru, p.body.u1) - Math.max(u - ru, p.body.u0));
        const ov = Math.max(0, Math.min(v + rv, p.body.v1) - Math.max(v - rv, p.body.v0));
        soft += (ou * ov) / (4 * ru * rv);
      }
      if (!ok) continue;
      // the whole balloon must sit inside the panel shape and clear of insets
      if (![[u, v], [u - ru, v], [u + ru, v], [u, v - rv], [u, v + rv]].every(([a, c]) => visibleAt(a, c, ctx))) continue;
      const dHead = sp && !sp.behind ? Math.hypot((u - sp.u) * w, (v - sp.v) * h) / Math.hypot(w, h) : 0.5;
      const dEntry = Math.hypot((u - ctx.entry.u) * w, (v - ctx.entry.v) * h) / Math.hypot(w, h);
      const q = 1 - dHead * 0.9 - dEntry * 0.7 - soft * 0.6;
      if (!best || q > best.q) best = { u, v, ru, rv, q, soft };
    }
  }
  return best;
}

export function scoreShot(spec, world, ctx) {
  const aspect = ctx.px.w / ctx.px.h;
  const an = analyzeShot(spec, world, aspect, ctx);
  const s = {};
  const speaking = ctx.speaker >= 0;
  const fIdx = speaking ? ctx.speaker : ctx.focus;
  const F = an.people[fIdx];

  // face
  if (!F.inFrame) s.face = 0;
  else s.face = clamp01((F.faceVis + 0.15) / 0.6) * 100;

  s.role = roleFit(spec, ctx.role);
  // an over-the-shoulder shot needs the near shoulder/head at the frame edge
  if (spec.type === 'ots' && an.people[spec.other]) {
    const O = an.people[spec.other];
    const edgeIn = !O.behind && O.u > -0.2 && O.u < 1.2 && O.v < 1.15;
    if (!edgeIn) s.role *= 0.55;
  }
  s.tone = toneFit(spec, ctx.tone, ctx.intensity);

  // balloon
  let balloon = null;
  if (speaking) {
    balloon = findBalloon(an, ctx, fIdx);
    s.balloon = balloon ? clamp(60 + balloon.q * 55 - balloon.soft * 30, 0, 100) : 10;
  } else s.balloon = 100;

  // reading flow: balloon (or focus face) near the entry, gaze toward the exit
  const anchor = balloon ? { u: balloon.u, v: balloon.v } : { u: F.u, v: F.v };
  const dEntry = Math.hypot(anchor.u - ctx.entry.u, (anchor.v - ctx.entry.v) / Math.max(0.5, aspect));
  let flow = 100 - dEntry * 70;
  const ex = ctx.exit.u - F.u;
  const ey = ctx.exit.v - F.v;
  const gl = Math.hypot(F.gaze.du, F.gaze.dv);
  if (gl > 1e-3) {
    const cos = (F.gaze.du * ex + F.gaze.dv * ey) / (gl * Math.hypot(ex, ey) + 1e-6);
    flow += cos * 12;
  }
  s.flow = clamp(flow, 0, 100);

  // biggest
  const visible = an.people.filter((p) => p.inFrame);
  const maxOther = Math.max(0, ...visible.filter((p) => p.i !== fIdx).map((p) => p.rv));
  s.biggest = !F.inFrame ? 0 : maxOther <= F.rv * 1.02 ? 100 : clamp((F.rv / maxOther) * 100 - 15, 0, 100);

  // look room
  if (Math.abs(F.gaze.du) < 0.01) s.lookroom = 90;
  else {
    const room = F.gaze.du > 0 ? 1 - F.u : F.u;
    s.lookroom = clamp(40 + (room - 0.3) * 200, 0, 100);
  }

  // headroom / cropping
  {
    const top = F.topV;
    const chin = F.v + F.rv;
    let hr = 100;
    if (spec.size >= 4) {
      // close-ups may crop the crown but not the eyes
      if (F.v - F.rv * 0.2 < 0.03) hr -= 70;
      if (top > 0.18) hr -= (top - 0.18) * 250;
    } else {
      if (top < 0.02) hr -= (0.02 - top) * 900;
      if (top > 0.3) hr -= (top - 0.3) * 220;
    }
    if (chin > 0.97) hr -= 60;
    s.headroom = clamp(hr, 0, 100);
  }

  // overlap: heads covering each other (focus covered is worst)
  {
    let ov = 100;
    for (let a = 0; a < an.people.length; a++) {
      for (let b = a + 1; b < an.people.length; b++) {
        const A = an.people[a];
        const B = an.people[b];
        if (A.behind || B.behind) continue;
        const d = Math.hypot((A.u - B.u) * aspect, A.v - B.v);
        const rsum = (A.rv + B.rv) * 1.05;
        if (d < rsum) {
          const amt = 1 - d / rsum;
          const front = A.depth < B.depth ? A : B;
          const back = front === A ? B : A;
          ov -= amt * (back.i === fIdx ? 160 : 60);
        }
      }
      // body of a nearer person over the focus face
      const P = an.people[a];
      if (P.i !== fIdx && !P.behind && P.depth < F.depth && F.u > P.body.u0 && F.u < P.body.u1 && F.v > P.body.v0 && F.v < P.body.v1) ov -= 60;
    }
    s.overlap = clamp(ov, 0, 100);
  }

  // thirds
  {
    let best = 9;
    for (const tu of [1 / 3, 2 / 3]) for (const tv of [1 / 3, 2 / 3]) best = Math.min(best, Math.hypot(F.u - tu, F.v - tv));
    if (spec.type === 'two' || spec.type === 'establish') best = Math.min(best, Math.abs(F.v - 1 / 3) + 0.05);
    s.thirds = clamp(100 - best * 330, 0, 100);
  }

  // variety vs previous panel
  if (!ctx.prev) s.variety = 100;
  else if (ctx.prev.size === spec.size && ctx.prev.type === spec.type) s.variety = 40;
  else if (ctx.prev.size === spec.size) s.variety = 72;
  else s.variety = 100;

  // grammar: open wide, land the key panel close, avoid big jumps
  if (ctx.index === 0) s.grammar = spec.size <= 1 ? 100 : spec.size === 2 ? 75 : 50;
  else if (ctx.isLargest && ctx.role === 'key') s.grammar = spec.size >= 3 ? 100 : 65;
  else if (ctx.prev) s.grammar = Math.abs(spec.size - ctx.prev.size) <= 2 ? 100 : 72;
  else s.grammar = 90;

  let total = 0;
  let wsum = 0;
  for (const [k, , w] of CRITERIA) { total += s[k] * w; wsum += w; }
  total /= wsum;
  if (!an.sideOk) total -= 25; // crossing the line
  return { total: Math.round(clamp(total, 0, 100)), criteria: s, balloon, analysis: an, sideOk: an.sideOk };
}

// --- planning -------------------------------------------------------------

export function planRoles(layout, nChars) {
  const panels = layout.panels;
  const n = panels.length;
  let largest = 0;
  panels.forEach((p, i) => { if (p.area > panels[largest].area) largest = i; });
  const roles = panels.map((_, i) => {
    if (i === 0 && n > 1) return 'establish';
    if (i === largest) return 'key';
    if (i === n - 1 && n >= 4) return 'reaction';
    return 'dialogue';
  });
  if (n === 1) roles[0] = 'key';
  let who = 0;
  const speakers = roles.map((r, i) => {
    if (r === 'reaction') return -1;
    const s = who % nChars;
    who++;
    return s;
  });
  const focus = speakers.map((s, i) => {
    if (s >= 0) return s;
    const prevSpeaker = speakers.slice(0, i).reverse().find((x) => x >= 0) ?? 0;
    return nChars > 1 ? (prevSpeaker + 1) % nChars : 0;
  });
  return panels.map((p, i) => ({ role: roles[i], speaker: speakers[i], focus: focus[i], isLargest: i === largest }));
}

// Poses the gacha may pick: library poses tagged 'speak' or 'listen' (never adult or pair poses).
// A character staged in a non-standing base (sitting, lying...) only gets upper-body overlays.
function posePool(role, tone, stagingId) {
  const base = stagingId && getPose(stagingId);
  const standing = !base || (base.tags || []).includes('standing');
  // only conversational body language is picked automatically; actions, fights, dances etc.
  // are chosen deliberately (edit_panel / staging)
  const catWeight = { gestures: 3, emotions: 1, standing: 1 };
  const pool = listPoses()
    .filter((p) => !p.pair && !p.adult && catWeight[p.cat] && (p.tags || []).includes(role))
    .filter((p) => p.layer === 'upper' || (standing && (p.tags || []).includes('standing')))
    .map((p) => [p.id, catWeight[p.cat] * ((p.tones || []).includes(tone) ? 3 : 1) * (p.cat === 'emotions' && !(p.tones || []).includes(tone) ? 0.2 : 1)]);
  return pool.length ? pool : [[role === 'speak' ? 'talk' : 'idle', 1]];
}

function samplePoses(rng, nChars, speaker, tone, staging) {
  const poses = {};
  for (let c = 0; c < nChars; c++) poses[c] = rng.weighted(posePool(c === speaker ? 'speak' : 'listen', tone, staging?.[c]));
  return poses;
}

export function sampleSpec(rng, world, ctx, jitter, keep) {
  const nChars = world.n;
  const pr = ROLE_PREFS[ctx.role];
  const tone = TONES[ctx.tone] || TONES.auto;
  const subject = ctx.speaker >= 0 ? ctx.speaker : ctx.focus;
  const other = nChars > 1 ? (ctx.listener ?? (subject === 0 ? 1 : 0)) : null;

  let type = keep?.type;
  if (!type) {
    const types = { ...pr.types };
    if (nChars === 1) { delete types.ots; delete types.two; types.single = (types.single || 0) + 1; }
    type = rng.weighted(Object.entries(types).map(([k, w]) => [k, Math.pow(w, 1 / jitter)]));
  }
  let size = keep?.size;
  if (size == null) {
    const sz = pr.sizes.map((w, i) => [i, Math.pow(Math.max(0.02, w * (1 + (i - 2) * tone.size * 0.35)), 1 / jitter)]);
    size = Number(rng.weighted(sz));
    if (type === 'establish') size = Math.min(size, 1);
    if (type === 'two') size = Math.min(size, 3);
  }
  const k = ctx.intensity === 'strong' ? 1.4 : ctx.intensity === 'quiet' ? 0.7 : 1;
  const [elo, ehi] = tone.elev;
  let elev = rng.range(elo * k, ehi * k) + rng.gauss() * 6 * jitter;
  if (type === 'establish') elev = Math.max(elev, 18 + rng.range(0, 22));
  if (ctx.role === 'establish' && type === 'two') elev = Math.max(elev, 10);
  elev = clamp(elev, -40, 75);
  const dutch = rng.chance(tone.dutch ? 0.75 : 0.06 * jitter) ? (rng.chance(0.5) ? 1 : -1) * rng.range(3, (tone.dutch || 6) * k + 3) : 0;
  const az = rng.gauss() * (type === 'ots' ? 10 : 22) * jitter;
  const fov = type === 'ots' ? 35 : rng.pick(size >= 3 ? [28, 32, 38] : [35, 40, 45, 50]);
  const spec = { type, subject, other, size, az, elev, dutch, fov, fx: 0, fy: 0, poses: keep?.poses || samplePoses(rng, nChars, ctx.speaker, ctx.tone, ctx.staging) };

  // smart composition defaults: look room + face on the upper third
  if (keep?.fx != null) { spec.fx = keep.fx; spec.fy = keep.fy; }
  else {
    const an = analyzeShot(spec, world, ctx.px.w / ctx.px.h, ctx);
    const F = an.people[subject];
    const dir = Math.abs(F.gaze.du) > 0.005 ? Math.sign(F.gaze.du) : rng.chance(0.5) ? 1 : -1;
    const isGroup = type === 'two' || type === 'establish';
    spec.fx = isGroup ? rng.gauss() * 0.08 * jitter : clamp(-dir * rng.range(0.15, 0.42) + rng.gauss() * 0.06 * jitter, -0.6, 0.6);
    spec.fy = size >= 2 ? clamp(rng.range(0.12, 0.42) + rng.gauss() * 0.05 * jitter, -0.2, 0.6) : rng.range(-0.15, 0.12);
    // triangles only show half the frame: pull the subject toward the visible part
    if (ctx.polyN?.length === 3) {
      const cu = ctx.polyN.reduce((t, q) => t + q[0], 0) / 3;
      const cv = ctx.polyN.reduce((t, q) => t + q[1], 0) / 3;
      const k = rng.range(0.55, 0.85);
      spec.fx = clamp(spec.fx * (1 - k) + (cu * 2 - 1) * k, -0.75, 0.75);
      spec.fy = clamp(spec.fy * (1 - k) + (1 - cv * 2) * k, -0.75, 0.75);
    }
  }
  return spec;
}

// Panel contexts derived from layout + plan (entry/exit in panel-normalized coords).
export function panelContexts(layout, plan, tone, intensity, extra = {}) {
  const flow = readingFlow(layout);
  return layout.panels.map((pn, i) => {
    const b = pn.bbox;
    const norm = ([x, y]) => ({ u: clamp01((x - b.x) / b.w), v: clamp01((y - b.y) / b.h) });
    const polyN = pn.poly.map(([x, y]) => [(x - b.x) / b.w, (y - b.y) / b.h]);
    const occN = (pn.occluders || []).map((o) => ({ u0: (o.x0 - b.x) / b.w, u1: (o.x1 - b.x) / b.w, v0: (o.y0 - b.y) / b.h, v1: (o.y1 - b.y) / b.h }));
    const pl = plan[i];
    let listener = null;
    if (pl.speaker >= 0) {
      const prevSpeaker = plan.slice(0, i).reverse().find((x) => x.speaker >= 0 && x.speaker !== pl.speaker)?.speaker;
      listener = prevSpeaker ?? (pl.speaker === 0 ? 1 : 0);
    }
    return {
      index: i, role: pl.role, speaker: pl.speaker, focus: pl.focus, listener, isLargest: pl.isLargest,
      tone, intensity, entry: norm(flow[i].entry), exit: norm(flow[i].exit), entryPx: flow[i].entry, exitPx: flow[i].exit,
      px: { w: b.w, h: b.h }, polyN, occN,
      staging: extra.staging || null, sceneProps: extra.sceneProps || null,
    };
  });
}

// Roll one proposal. locks: {panelIndex: {mode:'all'|'camera'|'pose', spec}}
export function rollProposal({ layout, world, plan, tone, intensity, style, seed, locks = {}, nChars, staging = null, sceneProps = null }) {
  const rng = makeRng(seed);
  const st = STYLES[style] || STYLES.balance;
  const ctxs = panelContexts(layout, plan, tone, intensity, { staging, sceneProps });
  const shots = [];
  for (let i = 0; i < ctxs.length; i++) {
    const ctx = { ...ctxs[i], prev: shots[i - 1]?.spec };
    const lock = locks[i];
    if (lock?.mode === 'all') {
      const sc = scoreShot(lock.spec, world, ctx);
      shots.push({ spec: lock.spec, ...sc, ctx });
      continue;
    }
    const cands = [];
    for (let k = 0; k < st.k; k++) {
      let keep = null;
      if (lock?.mode === 'camera') keep = { ...lock.spec, poses: null };
      if (lock?.mode === 'pose') keep = { poses: lock.spec.poses };
      let spec = sampleSpec(rng, world, ctx, st.jitter, keep);
      if (lock?.mode === 'camera') spec = { ...lock.spec, poses: spec.poses };
      cands.push({ spec, ...scoreShot(spec, world, ctx) });
    }
    cands.sort((a, b) => b.total - a.total);
    const pick = style === 'bold' ? cands[Math.min(cands.length - 1, rng.int(0, 2))] : cands[0];
    shots.push({ ...pick, ctx });
  }
  // re-score variety/grammar with final neighbours
  for (let i = 0; i < shots.length; i++) {
    const ctx = { ...shots[i].ctx, prev: shots[i - 1]?.spec };
    Object.assign(shots[i], scoreShot(shots[i].spec, world, ctx), { ctx });
  }
  const total = Math.round(shots.reduce((s, x) => s + x.total, 0) / Math.max(1, shots.length));
  return { shots, total, seed };
}

export function rescoreProposal(prop, world) {
  for (let i = 0; i < prop.shots.length; i++) {
    const ctx = { ...prop.shots[i].ctx, prev: prop.shots[i - 1]?.spec };
    Object.assign(prop.shots[i], scoreShot(prop.shots[i].spec, world, ctx), { ctx });
  }
  prop.total = Math.round(prop.shots.reduce((s, x) => s + x.total, 0) / Math.max(1, prop.shots.length));
  return prop;
}

export function rerollPanel(prop, i, { world, style, seed }) {
  const rng = makeRng(seed);
  const st = STYLES[style] || STYLES.balance;
  const ctx = { ...prop.shots[i].ctx, prev: prop.shots[i - 1]?.spec };
  let best = null;
  for (let k = 0; k < st.k; k++) {
    const spec = sampleSpec(rng, world, ctx, st.jitter * 1.2, null);
    const sc = scoreShot(spec, world, ctx);
    if (!best || sc.total > best.total) best = { spec, ...sc };
  }
  prop.shots[i] = { ...best, ctx };
  return rescoreProposal(prop, world);
}

export function shotLabel(shot) {
  const sp = shot.spec;
  const role = ROLES[shot.ctx.role];
  let cam = sp.type === 'ots' ? 'Over-shoulder' : sp.type === 'establish' ? 'Establishing' : sp.type === 'two' ? 'Two-shot' : SIZE_SHORT[sp.size];
  if (sp.elev > 22) cam += ', high';
  else if (sp.elev < -10) cam += ', low';
  if (Math.abs(sp.dutch) > 3) cam += ', dutch';
  return `${role} · ${cam}`;
}
