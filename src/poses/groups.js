// Friendly three-person poses (trio: A, B, C). B and C are placed relative to A with
// offset / offsetC. Authored with the IK helper for 1.65 m (A), 1.75 m (B) and 1.70 m (C)
// figures; the runtime scales the spacing to the real cast.

import { solve, toLocal } from '../pose-ik.js';

const H = { a: 1.65, b: 1.75, c: 1.7 };
const T = { cat: 'groups', trio: true, tags: ['group'] };
const planted = (w = 0.11) => ({ left: [w, 0, 0.02], right: [-w, 0, 0.02] });

// a figure standing at `place` reaching both hands to points given in A's frame
function reach(h, place, handsA, extra = {}) {
  const hands = {};
  for (const [side, p] of Object.entries(handsA)) hands[side] = p ? toLocal(p, place) : undefined;
  return solve({ h, feet: planted(), ...extra, hands: { ...(extra.hands || {}), ...hands } });
}

// --- group hug: three in a circle, arms over each other's shoulders --------------------------
const ring = (deg, r = 0.43) => {
  const a = (deg * Math.PI) / 180;
  const c = [0, r];
  const x = c[0] + Math.sin(a) * -r;
  const z = c[1] + Math.cos(a) * -r;
  return { x, z, yaw: deg };
};
const hugA = ring(0);
const hugB = ring(120);
const hugC = ring(-120);
const hugPose = (h) => solve({
  h, bones: { spine: [8, 0, 0], chest: [6, 0, 0], head: [8, 0, 0] }, feet: planted(0.13),
  hands: { left: [0.4, h * 0.76, 0.36], right: [-0.4, h * 0.76, 0.36] },
  elbows: { left: [1, 0.2, 0.2], right: [-1, 0.2, 0.2] },
});

// --- shoulder ride: C on B's shoulders, A beside cheering ------------------------------------
const rideB = { x: 0.75, z: 0, yaw: 0 };
const rideC = { x: 0.75, z: -0.06, yaw: 0 };
const riderHipY = 1.75 * 0.815 + 0.1; // just above the carrier's shoulders

// --- arm in arm: three in a row, middle one with arms over both shoulders --------------------
const rowB = { x: 0.5, z: 0, yaw: 0 };
const rowC = { x: -0.5, z: 0, yaw: 0 };

// --- huddle: bent in, hands on shoulders ---------------------------------------------------
const hud = (deg) => ring(deg, 0.55);

export default [
  {
    ...T, id: 'groupHug', name: 'Group hug',
    a: { ...hugPose(H.a), look: 0 },
    b: { ...hugPose(H.b), look: 0 },
    c: { ...hugPose(H.c), look: 0 },
    offset: { x: hugB.x - hugA.x, z: hugB.z - hugA.z, yaw: 120 },
    offsetC: { x: hugC.x - hugA.x, z: hugC.z - hugA.z, yaw: -120 },
  },
  {
    ...T, id: 'shoulderRide', name: 'Shoulder ride (with a cheering friend)', tags: ['group', 'joy'],
    a: solve({ h: H.a, feet: planted(0.14), hands: { left: [0.35, 1.95, 0.1], right: [-0.3, 1.9, 0.15] }, bones: { head: [-15, -20, 0] } }),
    b: solve({ h: H.b, feet: planted(0.14), hands: { left: [0.17, 1.18, 0.12], right: [-0.17, 1.18, 0.12] }, bones: { head: [-8, 0, 0] } }),
    c: {
      ...solve({
        h: H.c, root: { y: riderHipY / H.c - 0.5 },
        feet: { left: [0.2, 1.08, 0.16], right: [-0.2, 1.08, 0.16] },
        knees: { left: [0.3, 0, 1], right: [-0.3, 0, 1] },
        hands: { left: [0.32, 2.35, 0.1], right: [-0.32, 2.35, 0.1] },
      }),
      look: 0.3,
    },
    offset: rideB, offsetC: rideC,
  },
  {
    ...T, id: 'armInArm', name: 'Arm in arm (three in a row)',
    a: reach(H.a, { x: 0, z: 0, yaw: 0 }, { left: [0.62, 1.4, -0.04], right: [-0.62, 1.36, -0.04] }, { elbows: { left: [0, 0.3, -1], right: [0, 0.3, -1] } }),
    b: { ...reach(H.b, rowB, { right: [0.05, 0.98, -0.12] }), ...{} , limbs: { ...reach(H.b, rowB, { right: [0.05, 0.98, -0.12] }).limbs, leftArm: [[0.16, -1, 0.02], [0.1, -1, 0.08]] } },
    c: { ...reach(H.c, rowC, { left: [-0.05, 0.98, -0.12] }), limbs: { ...reach(H.c, rowC, { left: [-0.05, 0.98, -0.12] }).limbs, rightArm: [[-0.16, -1, 0.02], [-0.1, -1, 0.08]] } },
    offset: rowB, offsetC: rowC,
  },
  {
    ...T, id: 'huddle', name: 'Huddle (heads together)', tags: ['group', 'tension'],
    a: { ...solve({ h: H.a, bones: { spine: [28, 0, 0], chest: [18, 0, 0], head: [-10, 0, 0] }, feet: planted(0.16), hands: { left: [0.42, 1.12, 0.38], right: [-0.42, 1.12, 0.38] } }), look: 0 },
    b: { ...solve({ h: H.b, bones: { spine: [28, 0, 0], chest: [18, 0, 0], head: [-10, 0, 0] }, feet: planted(0.16), hands: { left: [0.42, 1.18, 0.38], right: [-0.42, 1.18, 0.38] } }), look: 0 },
    c: { ...solve({ h: H.c, bones: { spine: [28, 0, 0], chest: [18, 0, 0], head: [-10, 0, 0] }, feet: planted(0.16), hands: { left: [0.42, 1.15, 0.38], right: [-0.42, 1.15, 0.38] } }), look: 0 },
    offset: { x: hud(120).x - hud(0).x, z: hud(120).z - hud(0).z, yaw: 120 },
    offsetC: { x: hud(-120).x - hud(0).x, z: hud(-120).z - hud(0).z, yaw: -120 },
  },
];
