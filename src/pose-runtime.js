// Pose runtime: the shared skeleton, pose compiling (incl. direction-based limbs), layering,
// mirroring, pair placement, and forward kinematics used for camera framing and scoring.
//
// Conventions (body frame): +X = the character's left, +Y = up, +Z = forward (where the face points).
// Every bone's rest pose is a T-pose: arms along ±X, legs and feet down/forward, spine up.

import * as THREE from 'three';

const DEG = Math.PI / 180;

// name: [parent, offset from parent joint as a fraction of body height]
export const JOINTS = {
  hips: [null, [0, 0, 0]], // sits at the posed root (0.5h above the floor at rest)
  spine: ['hips', [0, 0.05, 0]],
  chest: ['spine', [0, 0.1, 0]],
  neck: ['chest', [0, 0.17, 0]],
  head: ['neck', [0, 0.04, 0]],
  leftUpperArm: ['chest', [0.115, 0.165, 0]],
  leftLowerArm: ['leftUpperArm', [0.165, 0, 0]],
  leftHand: ['leftLowerArm', [0.15, 0, 0]],
  rightUpperArm: ['chest', [-0.115, 0.165, 0]],
  rightLowerArm: ['rightUpperArm', [-0.165, 0, 0]],
  rightHand: ['rightLowerArm', [-0.15, 0, 0]],
  leftUpperLeg: ['hips', [0.055, 0, 0]],
  leftLowerLeg: ['leftUpperLeg', [0, -0.255, 0]],
  leftFoot: ['leftLowerLeg', [0, -0.25, 0]],
  rightUpperLeg: ['hips', [-0.055, 0, 0]],
  rightLowerLeg: ['rightUpperLeg', [0, -0.255, 0]],
  rightFoot: ['rightLowerLeg', [0, -0.25, 0]],
};
export const BONES = Object.keys(JOINTS);
export const HIPS_Y = 0.5; // rest hip height, fraction of height
export const HEAD_R = 0.068; // head radius, fraction of height

const REST = {
  spine: [0, 1, 0], chest: [0, 1, 0], neck: [0, 1, 0], head: [0, 1, 0],
  leftUpperArm: [1, 0, 0], leftLowerArm: [1, 0, 0], leftHand: [1, 0, 0],
  rightUpperArm: [-1, 0, 0], rightLowerArm: [-1, 0, 0], rightHand: [-1, 0, 0],
  leftUpperLeg: [0, -1, 0], leftLowerLeg: [0, -1, 0], leftFoot: [0, 0, 1],
  rightUpperLeg: [0, -1, 0], rightLowerLeg: [0, -1, 0], rightFoot: [0, 0, 1],
};
export const LIMBS = {
  leftArm: ['leftUpperArm', 'leftLowerArm', 'leftHand'],
  rightArm: ['rightUpperArm', 'rightLowerArm', 'rightHand'],
  leftLeg: ['leftUpperLeg', 'leftLowerLeg', 'leftFoot'],
  rightLeg: ['rightUpperLeg', 'rightLowerLeg', 'rightFoot'],
};
export const UPPER_BONES = ['spine', 'chest', 'neck', 'head', 'leftUpperArm', 'leftLowerArm', 'leftHand', 'rightUpperArm', 'rightLowerArm', 'rightHand'];

// ---------------------------------------------------------------- registry

const registry = new Map();
const compiled = new Map();

export function registerPoses(list) {
  for (const p of list) if (p?.id) registry.set(p.id, p);
  compiled.clear();
}
export const getPose = (id) => registry.get(id) || null;
export function listPoses({ adult = false, cat = null } = {}) {
  return [...registry.values()].filter((p) => (adult || !p.adult) && (!cat || p.cat === cat));
}
export const poseCategories = (adult = false) => [...new Set(listPoses({ adult }).map((p) => p.cat))];

// ---------------------------------------------------------------- compile

const eulerQ = (e = [0, 0, 0]) => new THREE.Quaternion().setFromEuler(new THREE.Euler(e[0] * DEG, e[1] * DEG, e[2] * DEG, 'XYZ'));
const v3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);

// def: {root:{y, rot}, bones:{name:[deg]}, limbs:{leftArm:[dirUpper, dirLower, dirHand?]}, look, props, layer}
export function compileDef(def) {
  const bones = {};
  for (const name of BONES) bones[name] = eulerQ(def.bones?.[name]);
  // world (body-frame) rotation of a bone, from the bones compiled so far
  const worldQ = (name) => {
    const chain = [];
    for (let n = name; n; n = JOINTS[n][0]) chain.unshift(n);
    const q = new THREE.Quaternion();
    for (const n of chain) q.multiply(bones[n]);
    return q;
  };
  for (const [limb, dirs] of Object.entries(def.limbs || {})) {
    const names = LIMBS[limb];
    if (!names || !dirs) continue;
    dirs.forEach((dir, k) => {
      if (!dir) return;
      const name = names[k];
      const parentQ = worldQ(JOINTS[name][0]);
      const restW = v3(REST[name]).applyQuaternion(parentQ).normalize();
      const delta = new THREE.Quaternion().setFromUnitVectors(restW, v3(dir).normalize());
      const world = delta.multiply(parentQ);
      bones[name] = parentQ.clone().invert().multiply(world);
    });
  }
  return {
    id: def.id, layer: def.layer || 'full', adult: !!def.adult,
    bones,
    defined: definedBones(def),
    root: { y: def.root?.y || 0, q: eulerQ(def.root?.rot) },
    look: def.look ?? 1,
    props: def.props || [],
  };
}

function definedBones(def) {
  const set = new Set(Object.keys(def.bones || {}));
  for (const [limb, dirs] of Object.entries(def.limbs || {})) (dirs || []).forEach((d, k) => { if (d && LIMBS[limb]) set.add(LIMBS[limb][k]); });
  return set;
}

export function compilePose(id) {
  if (!id) return null;
  if (compiled.has(id)) return compiled.get(id);
  const def = registry.get(id);
  if (!def || def.pair || def.trio) return null;
  const c = compileDef(def);
  compiled.set(id, c);
  return c;
}

// Overlay an upper-body pose on a base (or replace it with a full-body pose).
export function mergePoses(base, over) {
  if (!over) return base;
  if (!base || over.layer === 'full') return over;
  const bones = { ...base.bones };
  for (const n of over.defined) if (UPPER_BONES.includes(n) || over.layer === 'lower') bones[n] = over.bones[n];
  return { ...base, id: `${base.id}+${over.id}`, bones, look: over.look ?? base.look, props: [...base.props, ...over.props], adult: base.adult || over.adult };
}

// Mirror a pose definition left <-> right.
export function mirrorDef(def) {
  const swap = (n) => n.replace(/^left/, '__').replace(/^right/, 'left').replace(/^__/, 'right');
  const me = (e) => [e[0], -e[1], -e[2]];
  const out = { ...def, id: def.id + 'Mirror', name: (def.name || def.id) + ' (mirrored)' };
  if (def.bones) out.bones = Object.fromEntries(Object.entries(def.bones).map(([n, e]) => [swap(n), me(e)]));
  if (def.limbs) {
    const sw = { leftArm: 'rightArm', rightArm: 'leftArm', leftLeg: 'rightLeg', rightLeg: 'leftLeg' };
    out.limbs = Object.fromEntries(Object.entries(def.limbs).map(([l, d]) => [sw[l], d.map((x) => x && [-x[0], x[1], x[2]])]));
  }
  if (def.root?.rot) out.root = { ...def.root, rot: me(def.root.rot) };
  if (def.props) out.props = def.props.map((p) => ({ ...p, attach: p.attach?.startsWith('left') ? p.attach.replace('left', 'right') : p.attach?.startsWith('right') ? p.attach.replace('right', 'left') : p.attach, offset: p.offset && [-p.offset[0], p.offset[1], p.offset[2]], rot: p.rot && me(p.rot) }));
  if (def.pair || def.trio) {
    const flip = (o) => o && { ...o, x: -(o.x || 0), yaw: -(o.yaw || 0) };
    out.a = mirrorDef(def.a);
    out.b = mirrorDef(def.b);
    out.offset = flip(def.offset);
    if (def.trio) { out.c = mirrorDef(def.c); out.offsetC = flip(def.offsetC); }
  }
  return out;
}

// ---------------------------------------------------------------- forward kinematics

const _m = new THREE.Matrix4();
const ONE = new THREE.Vector3(1, 1, 1);

/**
 * pose: compiled pose. place: {x, z, yaw (rad)}. look: {yaw, pitch} extra neck/head rotation (rad).
 * Returns world matrices for every bone, the head centre/forward, all joint points and bounds.
 */
export function fk(h, pose, place, look = null) {
  const mats = {};
  const base = new THREE.Matrix4().compose(new THREE.Vector3(place.x, 0, place.z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), place.yaw), ONE);
  const posed = base.clone().multiply(_m.compose(new THREE.Vector3(0, (HIPS_Y + (pose?.root.y || 0)) * h, 0), pose?.root.q || new THREE.Quaternion(), ONE));
  for (const name of BONES) {
    const [parent, off] = JOINTS[name];
    let q = pose?.bones[name] || new THREE.Quaternion();
    if (look && (name === 'neck' || name === 'head')) {
      const k = name === 'neck' ? 0.4 : 0.6;
      q = q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(look.pitch * k, look.yaw * k, 0, 'YXZ')));
    }
    const local = new THREE.Matrix4().compose(new THREE.Vector3(off[0] * h, off[1] * h, off[2] * h), q, ONE);
    mats[name] = (parent ? mats[parent] : posed).clone().multiply(local);
  }
  const pos = (n, o = [0, 0, 0]) => new THREE.Vector3(o[0], o[1], o[2]).applyMatrix4(mats[n]);
  const headCenter = pos('head', [0, HEAD_R * h, 0]);
  const headFwd = new THREE.Vector3(0, 0, 1).transformDirection(mats.head);
  const points = BONES.filter((n) => n !== 'head').map((n) => pos(n));
  points.push(pos('leftHand', [0.04 * h, 0, 0]), pos('rightHand', [-0.04 * h, 0, 0]), pos('leftFoot', [0, 0, 0.08 * h]), pos('rightFoot', [0, 0, 0.08 * h]));
  const all = [...points, headCenter.clone().add(new THREE.Vector3(0, HEAD_R * h, 0))];
  const box = new THREE.Box3().setFromPoints(all);
  return { mats, headCenter, headFwd, points, box };
}

// Neck/head turn so a character looks at `target`, relative to their chest.
export function lookAngles(fkRes, target, weight = 1) {
  if (!target || !weight) return null;
  const inv = fkRes.mats.chest.clone().invert();
  const d = target.clone().applyMatrix4(inv).sub(new THREE.Vector3(0, 0.25, 0)); // roughly from the neck
  const yaw = Math.max(-1.2, Math.min(1.2, Math.atan2(d.x, d.z)));
  const pitch = Math.max(-0.5, Math.min(0.5, -Math.atan2(d.y, Math.hypot(d.x, d.z))));
  return { yaw: yaw * weight, pitch: pitch * weight };
}

// ---------------------------------------------------------------- per-shot resolution

const resolveId = (id) => (typeof id === 'string' ? compilePose(id) : id ? compileDef(id) : null);

/**
 * Work out every character's pose and placement for one shot.
 * ctx.staging: {charIndex: poseId, pair: {id, a, b}}  — page-level base poses
 * spec.poses: {charIndex: poseId}  — per-panel overlays or full poses;  spec.pair: {id, a, b}
 * spec.hold: {charIndex: {left?: propId, right?: propId}}
 */
export function resolveCast(world, spec, ctx) {
  const out = world.people.map((p) => ({ place: { x: p.pos.x, z: p.pos.z, yaw: p.yaw }, pose: null, locked: false, extraProps: [] }));
  // Group poses: pair (a, b) or trio (a, b, c). Members after A are placed relative to A;
  // offsets are authored for 1.65 m (A), 1.75 m (B) and 1.70 m (C) figures and scaled to the real cast.
  const AUTHOR_H = [1.65, 1.75, 1.7];
  const groupMembers = (g, def) => [g.a, g.b, ...(def.trio ? [g.c] : [])];
  const applyGroup = (g) => {
    const def = g && registry.get(g.id);
    if (!def || !(def.pair || def.trio)) return;
    const idxs = groupMembers(g, def);
    if (idxs.some((i) => !out[i]) || new Set(idxs).size !== idxs.length) return;
    const parts = def.trio ? [def.a, def.b, def.c] : [def.a, def.b];
    const offsets = [null, def.offset || { x: 0, z: 0.6, yaw: 180 }, def.offsetC || { x: 0.6, z: 0.3, yaw: -90 }];
    const A = out[idxs[0]];
    parts.forEach((part, k) => {
      const o = out[idxs[k]];
      o.pose = compileDef({ ...part, id: `${def.id}:${'abc'[k]}` });
      o.pose.adult = !!def.adult;
      o.locked = true;
      if (k === 0) return;
      const off = offsets[k];
      const scale = ((world.people[idxs[0]]?.h || AUTHOR_H[0]) + (world.people[idxs[k]]?.h || AUTHOR_H[k])) / (AUTHOR_H[0] + AUTHOR_H[k]);
      const v = new THREE.Vector3((off.x || 0) * scale, 0, (off.z || 0) * scale).applyAxisAngle(new THREE.Vector3(0, 1, 0), A.place.yaw);
      o.place = { x: A.place.x + v.x, z: A.place.z + v.z, yaw: A.place.yaw + (off.yaw || 0) * DEG };
    });
  };
  if (ctx?.staging?.pair) applyGroup(ctx.staging.pair);
  if (spec?.pair) {
    // a panel group overrides page staging for its members
    const def = registry.get(spec.pair.id);
    const mine = def ? groupMembers(spec.pair, def) : [];
    out.forEach((o, i) => { if (mine.includes(i)) o.locked = false; });
    applyGroup(spec.pair);
  }
  // per-panel placement overrides (e.g. characters moved in the pose editor): {i: {x, z, yaw (rad)}}
  for (const [i, pl] of Object.entries(spec?.place || {})) if (out[i] && pl) out[i].place = { x: pl.x, z: pl.z, yaw: pl.yaw };
  out.forEach((o, i) => {
    if (o.locked) return;
    const base = resolveId(ctx?.staging?.[i]) || compilePose('stand');
    o.pose = mergePoses(base, resolveId(spec?.poses?.[i]));
  });
  out.forEach((o, i) => {
    for (const side of ['left', 'right']) {
      const id = spec?.hold?.[i]?.[side];
      if (id) o.extraProps.push({ id, attach: `${side}Hand` });
    }
  });
  return out;
}

/**
 * The world as posed for one shot: heads, facing, body bounds and look angles come from FK.
 * Keeps the page-level axis/normal from the base world.
 */
export function posedWorld(world, spec, ctx) {
  if (world.posed) return world;
  return worldFromCast(world, castWithLooks(world, spec, ctx));
}

// Every character's pose, placement and head turn for one shot (the keyframe state used by motion).
export function castWithLooks(world, spec, ctx) {
  const cast = resolveCast(world, spec, ctx);
  const first = cast.map((c, i) => fk(world.people[i].h, c.pose, c.place));
  const speaker = ctx?.speaker ?? -1;
  const target = (i) => {
    if (world.n === 1) return null;
    if (i === speaker) return first[ctx.listener ?? (i === 0 ? 1 : 0)]?.headCenter;
    if (speaker >= 0) return first[speaker].headCenter;
    return first[i === 0 ? 1 : 0]?.headCenter;
  };
  return cast.map((c, i) => ({ ...c, look: lookAngles(first[i], target(i), c.pose?.look ?? 1) }));
}

// Build the posed world (heads, bounds, props) from a cast state.
export function worldFromCast(world, cast) {
  const people = world.people.map((p, i) => {
    const c = cast[i];
    const f = fk(p.h, c.pose, c.place, c.look);
    const size = f.box.getSize(new THREE.Vector3());
    const center = f.box.getCenter(new THREE.Vector3());
    return {
      ...p,
      pos: new THREE.Vector3(c.place.x, 0, c.place.z),
      yaw: c.place.yaw,
      fwd: new THREE.Vector3(Math.sin(c.place.yaw), 0, Math.cos(c.place.yaw)),
      head: f.headCenter,
      headFwd: f.headFwd,
      fk: f, pose: c.pose, look: c.look, props: [...(c.pose?.props || []), ...c.extraProps],
      center, extentY: size.y, extentXZ: Math.max(size.x, size.z),
    };
  });
  return { ...world, people, posed: true };
}

// Blend two cast states: joints slerp, positions lerp, turns take the short way round.
// Props swap at the halfway point.
export function lerpCast(A, B, t) {
  const lerp = (a, b) => a + (b - a) * t;
  const lerpAngle = (a, b) => a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
  return A.map((a, i) => {
    const b = B[i] || a;
    const pa = a.pose;
    const pb = b.pose || pa;
    let pose = pa;
    if (pa && pb && pa !== pb) {
      const bones = {};
      for (const n of BONES) bones[n] = pa.bones[n].clone().slerp(pb.bones[n], t);
      pose = {
        ...(t < 0.5 ? pa : pb),
        id: `${pa.id}~${pb.id}`,
        bones,
        root: { y: lerp(pa.root.y, pb.root.y), q: pa.root.q.clone().slerp(pb.root.q, t) },
        look: lerp(pa.look ?? 1, pb.look ?? 1),
      };
    }
    const la = a.look || { yaw: 0, pitch: 0 };
    const lb = b.look || { yaw: 0, pitch: 0 };
    return {
      place: { x: lerp(a.place.x, b.place.x), z: lerp(a.place.z, b.place.z), yaw: lerpAngle(a.place.yaw, b.place.yaw) },
      pose,
      look: a.look || b.look ? { yaw: lerp(la.yaw, lb.yaw), pitch: lerp(la.pitch, lb.pitch) } : null,
      extraProps: t < 0.5 ? a.extraProps : b.extraProps,
      locked: a.locked,
    };
  });
}
