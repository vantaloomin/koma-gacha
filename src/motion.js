// Motion: turns storyboard panels into timed shots for animatics and simple animation.
// A shot's panel is its start keyframe; an optional end keyframe changes the camera, poses,
// group pose, held props or positions, and every frame in between is blended:
// joints slerp, positions lerp, and the camera arcs around its focus point.

import * as THREE from 'three';
import { computeCamera, analyzeCamera } from './gacha.js';
import { castWithLooks, worldFromCast, lerpCast, HEAD_R } from './pose-runtime.js';

const DEG = Math.PI / 180;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const EASES = {
  inOut: { label: 'Ease in and out', f: (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)) },
  linear: { label: 'Linear', f: (t) => t },
  in: { label: 'Ease in', f: (t) => t * t },
  out: { label: 'Ease out', f: (t) => 1 - (1 - t) * (1 - t) },
};

// Camera moves. 'auto' frames the end keyframe the way the gacha would (the camera follows the action);
// 'locked' keeps the start camera; the rest change the end camera relative to the start.
export const CAMERA_MOVES = {
  auto: { label: 'Follow the action' },
  locked: { label: 'Locked off' },
  pushIn: { label: 'Push in', end: (s) => ({ size: Math.min(4, s.size + 1) }) },
  pullOut: { label: 'Pull out', end: (s) => ({ size: Math.max(0, s.size - 1) }) },
  orbitLeft: { label: 'Orbit left', end: (s) => ({ az: s.az - 30 }) },
  orbitRight: { label: 'Orbit right', end: (s) => ({ az: s.az + 30 }) },
  craneUp: { label: 'Crane up', end: (s) => ({ elev: Math.min(60, s.elev + 18) }) },
  craneDown: { label: 'Crane down', end: (s) => ({ elev: Math.max(-30, s.elev - 15) }) },
  slideLeft: { label: 'Slide left', end: (s) => ({ fx: clamp(s.fx + 0.35, -0.8, 0.8) }) },
  slideRight: { label: 'Slide right', end: (s) => ({ fx: clamp(s.fx - 0.35, -0.8, 0.8) }) },
  dutch: { label: 'Dutch roll', end: (s) => ({ dutch: (s.dutch || 0) + 10 }) },
};

export const TRANSITIONS = { cut: 'Cut', dissolve: 'Dissolve', fade: 'Fade through black' };
export const TRANSITION_SECONDS = 0.5;

const words = (t) => (String(t || '').trim().match(/\S+/g) || []).length;

// Reading time for a panel: about 3 words a second plus a beat per balloon, longer for key moments.
export function defaultDuration(script, role) {
  const lines = (script?.dialogue || []).filter((d) => d.text?.trim());
  const n = lines.reduce((s, d) => s + words(d.text), 0) + words(script?.caption) * 0.8;
  let d = 1.8 + n * 0.34 + lines.length * 0.35;
  if (role === 'key') d += 1;
  if (role === 'establish') d += 0.5;
  return Math.round(clamp(d, 2, 10) * 10) / 10;
}

export const hasMotion = (m) => !!m && (m.camera && m.camera !== 'auto' && m.camera !== 'locked'
  || Object.keys(m.to?.poses || {}).length || Object.keys(m.to?.moves || {}).length || m.to?.camera || 'pair' in (m.to || {}) || 'hold' in (m.to || {}));

// The end keyframe's spec (without moves; those need the start positions).
export function endSpec(spec, motion) {
  const to = motion?.to || {};
  const out = { ...spec, ...(CAMERA_MOVES[motion?.camera]?.end?.(spec) || {}), ...(to.camera || {}) };
  if (to.poses) {
    out.poses = { ...spec.poses };
    for (const [i, id] of Object.entries(to.poses)) {
      if (id) out.poses[i] = id;
      else delete out.poses[i];
    }
  }
  if ('pair' in to) out.pair = to.pair || null;
  if ('hold' in to) out.hold = to.hold || {};
  return out;
}

// moves: {i: {forward, side, turn (deg), toward (cast index), gap (m)}} relative to each character's start.
function resolveMoves(castA, moves) {
  const place = {};
  for (const [k, m] of Object.entries(moves || {})) {
    const i = Number(k);
    const a = castA[i]?.place;
    if (!a || !m) continue;
    let { x, z, yaw } = a;
    if (Number.isInteger(m.toward) && castA[m.toward] && m.toward !== i) {
      const b = castA[m.toward].place;
      const dx = b.x - x;
      const dz = b.z - z;
      const dist = Math.hypot(dx, dz) || 1;
      const go = Math.max(0, dist - (m.gap ?? 0.55));
      x += (dx / dist) * go;
      z += (dz / dist) * go;
      yaw = Math.atan2(dx, dz);
    }
    const fwd = m.forward || 0;
    const side = m.side || 0;
    // +X is the character's left in body space
    x += Math.sin(yaw) * fwd + Math.cos(yaw) * side;
    z += Math.cos(yaw) * fwd - Math.sin(yaw) * side;
    yaw += (m.turn || 0) * DEG;
    place[i] = { x, z, yaw };
  }
  return place;
}

// Camera as {focus, r, theta, phi, fov, dutch, fx, fy} so it can be blended along an arc.
function camState(res, spec) {
  const c = res.camera;
  const off = c.position.clone().sub(res.focus);
  const r = Math.max(0.05, off.length());
  return { focus: res.focus.clone(), r, theta: Math.atan2(off.x, off.z), phi: Math.asin(clamp(off.y / r, -1, 1)), fov: c.fov, dutch: spec.dutch || 0, fx: spec.fx || 0, fy: spec.fy || 0 };
}

function lerpCam(a, b, t) {
  const l = (x, y) => x + (y - x) * t;
  return {
    focus: a.focus.clone().lerp(b.focus, t),
    r: a.r * Math.pow(b.r / a.r, t),
    theta: a.theta + Math.atan2(Math.sin(b.theta - a.theta), Math.cos(b.theta - a.theta)) * t,
    phi: l(a.phi, b.phi), fov: l(a.fov, b.fov), dutch: l(a.dutch, b.dutch), fx: l(a.fx, b.fx), fy: l(a.fy, b.fy),
  };
}

function camPos(s) {
  const pos = new THREE.Vector3(Math.sin(s.theta) * Math.cos(s.phi), Math.sin(s.phi), Math.cos(s.theta) * Math.cos(s.phi)).multiplyScalar(s.r).add(s.focus);
  if (pos.y < 0.15) pos.y = 0.15;
  return pos;
}

// How far a camera position is from the nearest body (0 = inside someone's bounds).
const clearance = (pos, W) => Math.min(Infinity, ...W.people.map((p) => p.fk.box.distanceToPoint(pos)));

function buildCamera(s, aspect) {
  const cam = new THREE.PerspectiveCamera(s.fov, aspect, 0.05, 200);
  const pos = camPos(s);
  cam.position.copy(pos);
  cam.lookAt(s.focus);
  if (s.dutch) cam.rotateZ(s.dutch * DEG);
  cam.updateMatrixWorld(true);
  cam.updateProjectionMatrix();
  cam.projectionMatrix.elements[8] = -s.fx;
  cam.projectionMatrix.elements[9] = -s.fy;
  cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  return cam;
}

/**
 * Samples one shot over time. shot: {spec, ctx}; world: the page's base world;
 * motion: {camera, ease, start, end (fractions of the shot), to: {camera, poses, pair, hold, moves}}.
 * opts.drift: slow push-in for shots that would otherwise be still (fraction of camera distance).
 */
export class ShotSampler {
  constructor(shot, world, aspect, motion = null, { drift = 0 } = {}) {
    this.aspect = aspect;
    this.worldBase = world;
    this.ctx = { ...shot.ctx, polyN: null, occN: [] };
    this.motion = motion;
    this.ease = EASES[motion?.ease]?.f || EASES.inOut.f;
    this.span = [clamp(motion?.start ?? 0, 0, 1), clamp(motion?.end ?? 1, 0, 1)];
    const specA = shot.spec;
    this.specA = specA;
    this.castA = castWithLooks(world, specA, this.ctx);
    const WA = worldFromCast(world, this.castA);
    this.camA = camState(computeCamera(specA, WA, aspect, this.ctx), specA);
    this.moving = hasMotion(motion);
    let WB = WA;
    if (this.moving) {
      const specB = endSpec(specA, motion);
      const moved = resolveMoves(this.castA, motion.to?.moves);
      if (Object.keys(moved).length) specB.place = { ...(specA.place || {}), ...moved };
      this.specB = specB;
      this.castB = castWithLooks(world, specB, this.ctx);
      WB = worldFromCast(world, this.castB);
      this.camB = motion.camera === 'locked' ? this.camA : camState(computeCamera(specB, WB, aspect, this.ctx), specB);
    } else {
      this.specB = specA;
      this.castB = this.castA;
      this.camB = drift ? { ...this.camA, focus: this.camA.focus.clone(), r: this.camA.r * (1 - drift) } : this.camA;
    }
    // in between, the camera keeps at least the clearance it has at the keyframes (so it never passes
    // through a character who walks into its path)
    this.minClear = Math.min(0.15, clearance(camPos(this.camA), WA), clearance(camPos(this.camB), WB));
    this.cache = new Map();
  }

  // Eased progress for a time fraction u (0..1 of the shot).
  progress(u) {
    const [a, b] = this.span;
    if (!this.moving) return clamp(u, 0, 1); // drift runs the whole shot, linearly
    if (b <= a) return u >= a ? 1 : 0;
    return this.ease(clamp((u - a) / (b - a), 0, 1));
  }

  // {world (posed), camera, t} at time fraction u.
  at(u) {
    const t = this.progress(u);
    const key = Math.round(t * 1e4);
    if (this.cache.has(key)) return this.cache.get(key);
    const cast = this.castA === this.castB ? this.castA : lerpCast(this.castA, this.castB, t);
    const W = worldFromCast(this.worldBase, cast);
    const cs = lerpCam(this.camA, this.camB, t);
    if (t > 0 && t < 1 && this.minClear > 0) {
      for (let k = 0; k < 30 && clearance(camPos(cs), W) < this.minClear; k++) cs.r *= 1.06;
    }
    const out = { world: W, camera: buildCamera(cs, this.aspect), t };
    if (this.cache.size > 400) this.cache.clear();
    this.cache.set(key, out);
    return out;
  }

  // Head/body positions in the frame at time fraction u (for lettering and checks).
  analysis(u) {
    const { world, camera } = this.at(u);
    return { people: analyzeCamera(camera, world, this.ctx) };
  }
}

// --- timeline -------------------------------------------------------------------------------

/**
 * clips: [{duration, transition, ...}] -> adds t0/t1 (seconds); returns {clips, total}.
 * A clip's transition is how it starts (from the clip before it).
 */
export function layoutTimeline(clips) {
  let t = 0;
  for (const c of clips) {
    c.t0 = t;
    t += Math.max(0.2, c.duration);
    c.t1 = t;
  }
  return { clips, total: t };
}

export function clipAt(timeline, time) {
  const { clips } = timeline;
  if (!clips.length) return -1;
  for (let k = 0; k < clips.length; k++) if (time < clips[k].t1) return k;
  return clips.length - 1;
}

// --- OpenPose (COCO-18) skeleton from the shared joints ------------------------------------

const OP_PAIRS = [[1, 2], [1, 5], [2, 3], [3, 4], [5, 6], [6, 7], [1, 8], [8, 9], [9, 10], [1, 11], [11, 12], [12, 13], [1, 0], [0, 14], [14, 16], [0, 15], [15, 17]];
const OP_COLORS = [[255, 0, 0], [255, 85, 0], [255, 170, 0], [255, 255, 0], [170, 255, 0], [85, 255, 0], [0, 255, 0], [0, 255, 85], [0, 255, 170], [0, 255, 255], [0, 170, 255], [0, 85, 255], [0, 0, 255], [85, 0, 255], [170, 0, 255], [255, 0, 255], [255, 0, 170], [255, 0, 85]];

function openPosePoints(p) {
  const m = p.fk.mats;
  const at = (n, o = [0, 0, 0]) => new THREE.Vector3(...o).applyMatrix4(m[n]);
  const h = p.h;
  const r = HEAD_R * h;
  const head = p.fk.headCenter;
  const fwd = p.fk.headFwd.clone();
  const side = new THREE.Vector3(1, 0, 0).transformDirection(m.head); // character's left
  const up = new THREE.Vector3(0, 1, 0).transformDirection(m.head);
  const H = (f, s, u) => head.clone().addScaledVector(fwd, f * r).addScaledVector(side, s * r).addScaledVector(up, u * r);
  const rSh = at('rightUpperArm');
  const lSh = at('leftUpperArm');
  return [
    H(1.0, 0, -0.15), // 0 nose
    rSh.clone().add(lSh).multiplyScalar(0.5), // 1 neck
    rSh, at('rightLowerArm'), at('rightHand'), // 2-4
    lSh, at('leftLowerArm'), at('leftHand'), // 5-7
    at('rightUpperLeg'), at('rightLowerLeg'), at('rightFoot'), // 8-10
    at('leftUpperLeg'), at('leftLowerLeg'), at('leftFoot'), // 11-13
    H(0.85, -0.38, 0.12), H(0.85, 0.38, 0.12), // 14 right eye, 15 left eye
    H(0.05, -0.95, 0), H(0.05, 0.95, 0), // 16 right ear, 17 left ear
  ];
}

// Draws the cast as OpenPose skeletons (black background, standard colours) for pose ControlNets.
export function drawOpenPose(g, W, camera, w, h) {
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  const stick = Math.max(2, Math.round((4 * Math.min(w, h)) / 512));
  for (const p of W.people) {
    const pts = openPosePoints(p).map((v) => {
      const q = v.clone().applyMatrix4(camera.matrixWorldInverse);
      if (q.z > -0.05) return null; // behind the camera
      const n = v.clone().project(camera);
      return [((n.x + 1) / 2) * w, ((1 - n.y) / 2) * h];
    });
    // the back of the head hides the face keypoints
    const toCam = camera.position.clone().sub(p.fk.headCenter).normalize();
    const facing = p.fk.headFwd.dot(toCam);
    if (facing < -0.2) [0, 14, 15].forEach((k) => { pts[k] = null; });
    g.globalAlpha = 0.6;
    OP_PAIRS.forEach(([a, b], k) => {
      const A = pts[a];
      const B = pts[b];
      if (!A || !B) return;
      const [r, gg, bb] = OP_COLORS[k];
      g.strokeStyle = `rgb(${r},${gg},${bb})`;
      g.lineWidth = stick * 2;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(A[0], A[1]);
      g.lineTo(B[0], B[1]);
      g.stroke();
    });
    g.globalAlpha = 1;
    pts.forEach((P, k) => {
      if (!P) return;
      const [r, gg, bb] = OP_COLORS[k];
      g.fillStyle = `rgb(${r},${gg},${bb})`;
      g.beginPath();
      g.arc(P[0], P[1], stick, 0, Math.PI * 2);
      g.fill();
    });
  }
}
