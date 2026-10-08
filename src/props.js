// Props: simple objects built from primitives (see src/props/catalog.js for the data format).
// Units are metres. Hand props have their origin at the grip point; floor props at floor centre.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CATALOG } from './props/catalog.js';
import { MODELS } from './props/models.js';

const DEG = Math.PI / 180;

export const MATERIALS = {
  wood: '#a0764a', darkWood: '#6b4a2e', lightWood: '#d2b48a', metal: '#a2abb5', darkMetal: '#4a4f57', gold: '#d4b048',
  glass: '#bfe3ef', water: '#6fb3d9', fabric: '#7d8fb3', leather: '#8a5a3b', paper: '#efe9da', plastic: '#e3e3e3',
  white: '#f2f2ee', black: '#2a2b30', grey: '#8e9095', stone: '#8d8a84', brick: '#a85a44',
  red: '#c9483c', orange: '#e3893a', yellow: '#e7c14a', green: '#5a9a52', leaf: '#4f8f3f', blue: '#4e7fc4',
  purple: '#8a64b8', pink: '#e59ab6', brown: '#7b5a3c', cream: '#f1e3c4', bread: '#d9a05b', meat: '#9c4a35',
  screen: '#1d2a3a', light: '#fff4c2', rubber: '#3a3a3a',
};

const registry = new Map();
export function registerProps(list) { for (const p of list) if (p?.id) registry.set(p.id, p); }
registerProps(CATALOG.map((p) => (MODELS[p.id] ? { ...p, ...MODELS[p.id], primitive: p.parts } : p)));
export const getProp = (id) => registry.get(id) || null;
export const listProps = (cat = null) => [...registry.values()].filter((p) => !cat || p.cat === cat);
export const propCategories = () => [...new Set([...registry.values()].map((p) => p.cat))];

// --- geometry -------------------------------------------------------------

function geometry(shape, d) {
  switch (shape) {
    case 'box': return new THREE.BoxGeometry(d[0], d[1], d[2]);
    case 'cyl': return new THREE.CylinderGeometry(d[0], d[1] ?? d[0], d[2], d[3] || 20);
    case 'sphere': return new THREE.SphereGeometry(d[0], 20, 14);
    case 'hemi': return new THREE.SphereGeometry(d[0], 20, 10, 0, Math.PI * 2, 0, Math.PI / 2);
    case 'cone': return new THREE.ConeGeometry(d[0], d[1], d[2] || 20);
    case 'torus': return new THREE.TorusGeometry(d[0], d[1], 10, 28, (d[2] ?? 360) * DEG);
    case 'capsule': return new THREE.CapsuleGeometry(d[0], Math.max(0.001, d[1]), 6, 14);
    case 'plane': return new THREE.BoxGeometry(d[0], 0.004, d[1]);
    case 'ring': return new THREE.TorusGeometry(d[0], d[1] ?? 0.004, 6, 32);
    default: return new THREE.BoxGeometry(0.05, 0.05, 0.05);
  }
}

// --- materials (shared per style + colour) ----------------------------------

const matCache = new Map();
const ink = new THREE.MeshBasicMaterial({ color: 0x15161a, side: THREE.BackSide });

function material(key, style) {
  const ck = `${style}|${key}`;
  if (matCache.has(ck)) return matCache.get(ck);
  const color = new THREE.Color(MATERIALS[key] || key || '#999999');
  let m;
  if (style === 'silhouette') m = new THREE.MeshBasicMaterial({ color: 0x55585f });
  else if (style === 'lineart') m = new THREE.MeshToonMaterial({ color: 0xffffff });
  else if (style === 'toon') m = new THREE.MeshToonMaterial({ color });
  else if (key === 'glass' || key === 'water') m = new THREE.MeshStandardMaterial({ color, roughness: 0.1, transparent: true, opacity: 0.55 });
  else m = new THREE.MeshStandardMaterial({ color, roughness: key === 'metal' || key === 'gold' ? 0.35 : 0.75, metalness: key === 'metal' || key === 'gold' || key === 'darkMetal' ? 0.5 : 0 });
  matCache.set(ck, m);
  return m;
}

// --- optional model files (CC0 packs in public/models/) ------------------------
// A catalog entry may set `model: 'kenney/furniture/chair.glb'` (relative to /models/).
// The model is scaled to the primitive version's size and aligned to its origin, so grips,
// seats and placement stay the same; the primitive parts are the fallback.

const models = new Map(); // url -> Promise<THREE.Object3D | null>
const loaded = new Map(); // url -> THREE.Object3D (ready)
let loader = null;

function loadModel(url) {
  if (!models.has(url)) {
    loader ||= new GLTFLoader();
    models.set(url, loader.loadAsync(url).then((g) => { loaded.set(url, g.scene); return g.scene; }).catch(() => null));
  }
  return models.get(url);
}

export const modelUrl = (def) => (def?.model ? `/models/${def.model}` : null);

// Load every model the catalog references (call before headless renders).
export function preloadModels() {
  return Promise.all([...registry.values()].map((d) => modelUrl(d)).filter(Boolean).map(loadModel));
}

function fitModel(def, primitive) {
  const src = loaded.get(modelUrl(def));
  if (!src) return null;
  const m = src.clone(true);
  const target = new THREE.Box3().setFromObject(primitive);
  const tsize = target.getSize(new THREE.Vector3());
  if (def.modelRot) m.rotation.set(def.modelRot[0] * DEG, def.modelRot[1] * DEG, def.modelRot[2] * DEG);
  else {
    // hand props: turn the model so its long axis matches the primitive's (e.g. a fork lying flat)
    const size0 = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3());
    const dom = (v) => (v.x >= v.y && v.x >= v.z ? 'x' : v.y >= v.z ? 'y' : 'z');
    const a = dom(size0);
    const b = dom(tsize);
    if (def.attach !== 'body' && def.attach !== 'world' && a !== b) {
      const turn = { 'x>y': ['z', 90], 'y>x': ['z', 90], 'x>z': ['y', 90], 'z>x': ['y', 90], 'y>z': ['x', 90], 'z>y': ['x', 90] }[`${a}>${b}`];
      m.rotation[turn[0]] = turn[1] * DEG;
    }
  }
  m.updateMatrixWorld(true);
  const size = new THREE.Box3().setFromObject(m).getSize(new THREE.Vector3());
  // furniture keeps its real height (seat heights matter); small props match their largest dimension
  const byHeight = def.fit === 'height' || (def.fit !== 'max' && (def.attach === 'body' || def.attach === 'world'));
  const k = def.modelScale ?? (byHeight ? tsize.y / Math.max(size.y, 1e-6) : Math.max(tsize.x, tsize.y, tsize.z) / Math.max(size.x, size.y, size.z, 1e-6));
  m.scale.multiplyScalar(k);
  m.updateMatrixWorld(true);
  const b2 = new THREE.Box3().setFromObject(m);
  const c2 = b2.getCenter(new THREE.Vector3());
  const tc = target.getCenter(new THREE.Vector3());
  m.position.sub(new THREE.Vector3(c2.x - tc.x, b2.min.y - target.min.y, c2.z - tc.z));
  m.traverse((o) => {
    if (o.isMesh) {
      o.userData.orig = o.material;
      o.userData.model = true;
    }
  });
  return m;
}

// part: [shape, dims, pos?, rotDeg?, materialKey?]
export function buildProp(id, style = 'shaded') {
  const def = registry.get(id);
  const g = new THREE.Group();
  g.name = `prop:${id}`;
  g.userData.propId = id;
  if (!def) return g;
  for (const part of def.parts || []) {
    const [shape, dims] = part;
    const pos = part[2] || [0, 0, 0];
    const rot = part[3] || [0, 0, 0];
    const mat = part[4] || def.mat || 'grey';
    const mesh = new THREE.Mesh(geometry(shape, dims), material(mat, style));
    mesh.position.set(pos[0], pos[1], pos[2]);
    mesh.rotation.set(rot[0] * DEG, rot[1] * DEG, rot[2] * DEG);
    mesh.userData.matKey = mat;
    const o = new THREE.Mesh(mesh.geometry, ink);
    o.scale.setScalar(1.05);
    o.visible = style === 'toon' || style === 'lineart';
    o.userData.outline = true;
    mesh.add(o);
    g.add(mesh);
  }
  // swap in the model file when it's available (otherwise keep the primitive version)
  if (def.model) {
    const url = modelUrl(def);
    const apply = () => {
      const m = fitModel(def, g);
      if (!m) return;
      for (const ch of [...g.children]) if (!ch.userData.isModel) g.remove(ch);
      m.userData.isModel = true;
      g.add(m);
      setPropStyle(g, g.userData.style || style);
    };
    if (loaded.has(url)) apply();
    else loadModel(url).then(apply);
  }
  g.userData.style = style;
  if (def.scale) g.scale.setScalar(def.scale);
  return g;
}

export function setPropStyle(g, style) {
  g.userData.style = style;
  g.traverse((o) => {
    if (!o.isMesh) return;
    if (o.userData.outline) o.visible = style === 'toon' || style === 'lineart';
    else if (o.userData.model) o.material = style === 'silhouette' || style === 'lineart' ? material('grey', style) : o.userData.orig;
    else o.material = material(o.userData.matKey, style);
  });
}

// --- placement ------------------------------------------------------------

const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/**
 * Place a prop instance.
 * use: {id, attach: 'leftHand'|'rightHand'|'body'|'world', mode: 'upright'|'aligned', offset, rot, x, z, y, yaw}
 * person: posed person ({pos, yaw}) and figure (for bone matrices) when attached to someone.
 */
export function placeProp(g, use, person, figure) {
  const def = registry.get(use.id) || {};
  const grip = def.grip || {};
  const off = use.offset || grip.offset || [0, 0, 0];
  const rot = use.rot || grip.rot || [0, 0, 0];
  const rq = new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0] * DEG, rot[1] * DEG, rot[2] * DEG));
  const attach = use.attach || def.attach || 'world';
  if ((attach === 'leftHand' || attach === 'rightHand') && figure) {
    const m = figure.boneMatrix(attach);
    m.decompose(_p, _q, _s);
    const mode = use.mode || grip.mode || 'upright';
    const side = attach === 'leftHand' ? 1 : -1;
    // offsets are authored for the right hand; mirror x for the left
    const o = new THREE.Vector3(off[0] * -side, off[1], off[2]);
    if (mode === 'aligned') {
      g.position.copy(o.applyQuaternion(_q).add(_p));
      g.quaternion.copy(_q).multiply(rq);
    } else {
      const yawQ = new THREE.Quaternion().setFromAxisAngle(UP, person.yaw);
      g.position.copy(o.applyQuaternion(yawQ).add(_p));
      g.quaternion.copy(yawQ).multiply(rq);
    }
  } else if (attach === 'body' && person) {
    const yawQ = new THREE.Quaternion().setFromAxisAngle(UP, person.yaw);
    g.position.copy(new THREE.Vector3(off[0], off[1], off[2]).applyQuaternion(yawQ).add(person.pos));
    g.quaternion.copy(yawQ).multiply(rq);
  } else {
    g.position.set(use.x || 0, use.y || 0, use.z || 0);
    g.quaternion.setFromAxisAngle(UP, (use.yaw || 0) * DEG).multiply(rq);
  }
}
