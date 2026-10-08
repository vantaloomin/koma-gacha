// Target-based pose authoring: give hand/foot positions (metres) and get limb directions.
//
//   solve({ h: 1.65, root: { y, rot }, bones: { spine: [20, 0, 0] },
//           hands: { left: [x, y, z], right: [x, y, z] }, feet: { left, right },
//           elbows: { left: [x, y, z] }, knees: { right: [x, y, z] } })   // optional pole hints
//
// Targets are in the character's own placement frame: origin on the floor under the hips,
// +X = their left, +Y up, +Z the way they face. Hand targets are wrists, foot targets ankles.
// Unreachable targets get a straight limb pointing at them. Returns a pose definition fragment
// ({root, bones, limbs}) to spread into a pose. Pair/trio helpers convert between partners' frames.

import * as THREE from 'three';
import { compileDef, fk } from './pose-runtime.js';

const DEG = Math.PI / 180;
const v = (a) => new THREE.Vector3(a[0], a[1], a[2]);
const arr = (p) => [round(p.x), round(p.y), round(p.z)];
const round = (x) => Math.round(x * 1000) / 1000;

const LEN = { arm: [0.165, 0.15], leg: [0.255, 0.25] };

function twoBone(S, T, L1, L2, pole) {
  const d0 = T.clone().sub(S);
  const dist = Math.min(Math.max(d0.length(), Math.abs(L1 - L2) + 1e-4), L1 + L2 - 1e-4);
  const dir = d0.lengthSq() > 1e-10 ? d0.clone().normalize() : new THREE.Vector3(0, -1, 0);
  const a = (L1 * L1 - L2 * L2 + dist * dist) / (2 * dist);
  const hgt = Math.sqrt(Math.max(0, L1 * L1 - a * a));
  let p = pole.clone().sub(dir.clone().multiplyScalar(pole.dot(dir)));
  if (p.lengthSq() < 1e-8) p = new THREE.Vector3(0, 0, -1).sub(dir.clone().multiplyScalar(dir.z));
  p.normalize();
  const E = S.clone().add(dir.clone().multiplyScalar(a)).add(p.multiplyScalar(hgt));
  const Tc = S.clone().add(dir.clone().multiplyScalar(dist));
  return [E.clone().sub(S).normalize(), Tc.sub(E).normalize()];
}

export function solve({ h = 1.65, root = {}, bones = {}, hands = {}, feet = {}, elbows = {}, knees = {}, ...rest }) {
  const base = compileDef({ root, bones });
  const f = fk(h, base, { x: 0, z: 0, yaw: 0 });
  const rootQ = base.root.q;
  const inv = rootQ.clone().invert();
  const toPosed = (w) => w.clone().applyQuaternion(inv);
  const toWorld = (p) => v(p).applyQuaternion(rootQ);
  const pos = (name) => new THREE.Vector3().setFromMatrixPosition(f.mats[name]);
  const limbs = {};
  for (const side of ['left', 'right']) {
    const s = side === 'left' ? 1 : -1;
    if (hands[side]) {
      const pole = elbows[side] ? v(elbows[side]) : toWorld([s * 0.4, -0.3, -1]);
      const [u, l] = twoBone(pos(`${side}UpperArm`), v(hands[side]), LEN.arm[0] * h, LEN.arm[1] * h, pole);
      limbs[`${side}Arm`] = [arr(toPosed(u)), arr(toPosed(l))];
    }
    if (feet[side]) {
      const pole = knees[side] ? v(knees[side]) : toWorld([s * 0.1, 0, 1]);
      const [u, l] = twoBone(pos(`${side}UpperLeg`), v(feet[side]), LEN.leg[0] * h, LEN.leg[1] * h, pole);
      limbs[`${side}Leg`] = [arr(toPosed(u)), arr(toPosed(l))];
    }
  }
  const out = { ...rest, bones, limbs: { ...limbs, ...(rest.limbs || {}) } };
  if (root.y || root.rot) out.root = root;
  return out;
}

// --- frames for pair / trio authoring ------------------------------------------------------
// place: {x, z, yaw (degrees)} of a partner in A's frame (the same as a pose's offset).

export function toLocal(point, place) {
  const p = v(point).sub(new THREE.Vector3(place.x || 0, 0, place.z || 0));
  return arr(p.applyAxisAngle(new THREE.Vector3(0, 1, 0), -(place.yaw || 0) * DEG));
}

export function toParent(point, place) {
  const p = v(point).applyAxisAngle(new THREE.Vector3(0, 1, 0), (place.yaw || 0) * DEG);
  return arr(p.add(new THREE.Vector3(place.x || 0, 0, place.z || 0)));
}

// World position (in A's frame) of a joint of a solved pose placed at `place`.
// joint: a bone name, or 'headCenter'.
export function jointOf(poseDef, h, place, joint) {
  const c = compileDef(poseDef);
  const r = fk(h, c, { x: place.x || 0, z: place.z || 0, yaw: (place.yaw || 0) * DEG });
  if (joint === 'headCenter') return arr(r.headCenter);
  return arr(new THREE.Vector3().setFromMatrixPosition(r.mats[joint]));
}

export const AUTHOR_H = { a: 1.65, b: 1.75, c: 1.7 };
