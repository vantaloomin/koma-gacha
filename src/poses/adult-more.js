// Adult pack, part 2 (opt-in, adult characters only): more solo poses, more duo positions and trio
// arrangements. Mannequin reference poses authored with the IK helper (src/pose-ik.js) for figures of
// 1.65 m (A), 1.75 m (B) and 1.70 m (C); partners are placed relative to A with offset / offsetC.
// Roles are body positions only — any characters can fill any role.

import { solve, toLocal, jointOf } from '../pose-ik.js';

const H = { a: 1.65, b: 1.75, c: 1.7 };
const AD = { adult: true, tags: ['adult'], look: 0 };

// --- body setups ---------------------------------------------------------------------------
const kneelY = (h) => 0.05 / h - 0.245; // knees on the floor, thighs upright
const heelsY = (h) => 0.3 / h - 0.5; // sitting back on the heels
const seatY = (h, seat = 0.46) => (seat + 0.05) / h - 0.5; // hips on a seat
const LIE_BACK = { y: -0.43, rot: [-90, 0, 0] }; // on the back, head toward -Z
const PRONE = { y: -0.43, rot: [90, 0, 0] }; // face down, head toward +Z
const fours = (h) => ({ y: kneelY(h), rot: [90, 0, 0] }); // hands and knees, head toward +Z
const SIDE_R = { y: -0.43, rot: [0, 0, 90] }; // on the right side, head toward -X
const SIDE_L = { y: -0.43, rot: [0, 0, -90] }; // on the left side, head toward +X

const planted = (w = 0.11) => ({ left: [w, 0, 0.02], right: [-w, 0, 0.02] });
const kneelFeet = (h, w = 0.11) => ({ left: [w, 0.05, -0.26 * h], right: [-w, 0.05, -0.26 * h] });
const KNEE_DOWN = { left: [0.1, -0.6, 1], right: [-0.1, -0.6, 1] };
const KNEE_OUT = { left: [1, 0, 0.5], right: [-1, 0, 0.5] };
const sym = (p) => ({ left: p, right: [-p[0], p[1], p[2]] });

// targets given in A's frame for a partner standing at `place`
const local = (place, hands) => Object.fromEntries(Object.entries(hands).map(([k, p]) => [k, p && toLocal(p, place)]));

// ===========================================================================================
// solo
// ===========================================================================================
const proneBones = { spine: [-22, 0, 0], chest: [-18, 0, 0], head: [-20, 0, 0] };
const proneHead = jointOf({ root: PRONE, bones: proneBones }, H.a, {}, 'headCenter');

const solo = [
  {
    ...AD, id: 'adultProneFeetUp', name: 'Lying on stomach, chin on hands, feet up', layer: 'full',
    ...solve({
      h: H.a, root: PRONE, bones: proneBones,
      hands: { left: [proneHead[0] + 0.06, proneHead[1] - 0.12, proneHead[2] + 0.02], right: [proneHead[0] - 0.06, proneHead[1] - 0.12, proneHead[2] + 0.02] },
      elbows: { left: [0.3, -1, 0], right: [-0.3, -1, 0] },
      feet: { left: [0.1, 0.42, -0.46], right: [-0.1, 0.36, -0.5] }, knees: { left: [0, -1, 0], right: [0, -1, 0] },
    }),
  },
  {
    ...AD, id: 'adultFloorLeanBack', name: 'Sitting on the floor, leaning back on hands', layer: 'full',
    ...solve({
      h: H.a, root: { y: -0.44, rot: [-25, 0, 0] }, bones: { head: [12, 0, 0] },
      hands: sym([0.22, 0.03, -0.38]),
      feet: { left: [0.22, 0.04, 0.72], right: [-0.12, 0.04, 0.36] }, knees: { left: [0, 1, 0.2], right: [0, 1, 0.2] },
    }),
  },
  {
    ...AD, id: 'adultSquat', name: 'Low squat, knees apart', layer: 'full',
    ...solve({
      h: H.a, root: { y: 0.32 / H.a - 0.5 }, bones: { spine: [12, 0, 0], head: [-8, 0, 0] },
      feet: { left: [0.24, 0, 0.06], right: [-0.24, 0, 0.06] }, knees: KNEE_OUT,
      hands: sym([0.27, 0.5, 0.3]),
    }),
  },
  {
    ...AD, id: 'adultStretchUp', name: 'Standing stretch, hands behind head', layer: 'full',
    ...solve({
      h: H.a, bones: { spine: [-6, 0, 4], chest: [-6, 0, 4], head: [-10, 0, 0] },
      feet: { left: [0.12, 0, 0.02], right: [-0.04, 0, 0.12] },
      hands: sym([0.07, 1.6, -0.06]), elbows: { left: [1, 0.5, 0], right: [-1, 0.5, 0] },
    }),
  },
  {
    ...AD, id: 'adultWallArch', name: 'Back to the wall, arched, hands up', layer: 'full',
    ...solve({
      h: H.a, root: { rot: [-5, 0, 0] }, bones: { chest: [-10, 0, 0], head: [-12, 0, 0] },
      feet: sym([0.1, 0, 0.12]), hands: sym([0.32, 1.85, -0.22]),
    }),
  },
  {
    ...AD, id: 'adultLieBackLegsUp', name: 'Lying on back, legs raised', layer: 'full',
    ...solve({
      h: H.a, root: LIE_BACK,
      feet: sym([0.09, 0.92, 0.06]), hands: sym([0.3, 0.04, -0.25]),
    }),
  },
  {
    ...AD, id: 'adultKneelLookBack', name: 'Kneeling upright, looking over shoulder', layer: 'full',
    ...solve({
      h: H.a, root: { y: kneelY(H.a) }, bones: { spine: [0, 20, 0], chest: [0, 20, 0], head: [0, 40, 0] },
      feet: kneelFeet(H.a), knees: KNEE_DOWN, hands: sym([0.14, 0.6, 0.1]),
    }),
  },
  {
    ...AD, id: 'adultChairBackwards', name: 'Straddling a chair backwards', layer: 'full',
    ...solve({
      h: H.a, root: { y: seatY(H.a) }, bones: { spine: [8, 0, 0], head: [-6, 0, 0] },
      feet: sym([0.36, 0, 0.12]), knees: KNEE_OUT,
      hands: { left: [-0.1, 0.94, 0.24], right: [0.1, 0.96, 0.22] }, elbows: { left: [1, 0, 0.3], right: [-1, 0, 0.3] },
    }),
    props: [{ id: 'chair', attach: 'body', offset: [0, 0, 0.06], rot: [0, 180, 0] }],
  },
  {
    ...AD, id: 'adultChairCrossed', name: 'Seated, legs crossed, leaning back', layer: 'full',
    ...solve({
      h: H.a, root: { y: seatY(H.a), rot: [-8, 0, 0] }, bones: { head: [6, 0, -6] },
      feet: { left: [-0.14, 0.24, 0.5], right: [-0.04, 0, 0.44] }, knees: { left: [0, 1, 0.6], right: [0, 0, 1] },
      hands: { left: [0.0, 0.62, 0.4], right: [-0.25, 0.47, -0.02] },
    }),
    props: [{ id: 'chair', attach: 'body' }],
  },
  {
    ...AD, id: 'adultChestDown', name: 'Kneeling, chest down, arms forward', layer: 'full',
    ...solve({
      h: H.a, root: { y: kneelY(H.a), rot: [110, 0, 0] }, bones: { head: [0, 30, 0] },
      feet: kneelFeet(H.a, 0.13), knees: KNEE_DOWN, hands: sym([0.22, 0.04, 0.95]),
    }),
  },
];

// ===========================================================================================
// duo (A + B)
// ===========================================================================================
const at = (x, z, yaw) => ({ x, z, yaw });

// wall pressed: A against a wall, B in front
const wallB = at(0, 0.28, 180);
// carried: A wrapped around standing B (B in front, facing A)
const carryB = at(0, 0.24, 180);
// kneeling in front of a standing partner
const oralB = at(0, 0.42, 180);
// lying, partner's head between the legs (B prone, facing -Z toward A's hips)
const oralLyingB = at(0, 1.02, 180);
// head to toe
const sixNineB = at(0, -0.66, 180);
// astride, facing the feet
const reverseB = at(0, 0, 0);
// bent forward, partner behind
const behindStandB = at(0, -0.3, 0);
// lotus: A in B's lap, face to face
const lotusB = at(0, 0.26, 180);
// bed edge: A lying back at the edge, B standing
const bedEdgeB = at(0, 0.36, 180);
// lying face to face on their sides
const sideFaceB = at(0, 0.3, 180);
// legs over shoulders: B kneeling upright between A's legs
const shouldersB = at(0, 0.27, 180);
// prone, partner on top
const proneB = at(0, -0.06, 0);

const bShoulders = (place, extra = {}) => ({
  left: jointOf({ root: extra.root || {}, bones: extra.bones || {} }, H.b, place, 'leftUpperArm'),
  right: jointOf({ root: extra.root || {}, bones: extra.bones || {} }, H.b, place, 'rightUpperArm'),
});

const kneelB = { y: kneelY(H.b) };
const shB = bShoulders(shouldersB, { root: kneelB });
const shBStand = bShoulders(bedEdgeB);

const duo = [
  {
    ...AD, id: 'adultWallPressed', name: 'Pressed against a wall, face to face', pair: true,
    a: solve({ h: H.a, bones: { chest: [-6, 0, 0], head: [-14, 0, 8] }, feet: sym([0.1, 0, 0.06]), hands: sym([0.2, 1.36, 0.24]) }),
    b: solve({ h: H.b, bones: { spine: [8, 0, 0], chest: [6, 0, 0], head: [16, 0, -8] }, feet: sym([0.13, 0, -0.05]), hands: local(wallB, sym([0.3, 1.62, -0.2])) }),
    offset: wallB,
  },
  {
    ...AD, id: 'adultCarried', name: 'Carried, legs wrapped around partner', pair: true,
    a: solve({
      h: H.a, root: { y: 1.0 / H.a - 0.5 }, bones: { head: [-10, 0, 10] },
      feet: sym([0.13, 0.95, 0.42]), knees: { left: [1, 0, 0.3], right: [-1, 0, 0.3] },
      hands: sym([0.07, 1.55, 0.32]),
    }),
    b: solve({ h: H.b, bones: { spine: [-6, 0, 0], head: [12, 0, -8] }, feet: planted(0.16), hands: local(carryB, sym([0.15, 0.98, 0.06])) }),
    offset: carryB,
  },
  {
    ...AD, id: 'adultOralKneeling', name: 'Kneeling in front of a standing partner', pair: true,
    a: solve({
      h: H.a, root: { y: heelsY(H.a) }, bones: { spine: [6, 0, 0], head: [-12, 0, 0] },
      feet: sym([0.1, 0.05, -0.12]), knees: KNEE_DOWN, hands: sym([0.13, 0.72, 0.34]),
    }),
    b: solve({ h: H.b, bones: { head: [22, 0, 0] }, feet: planted(0.14), hands: local(oralB, sym([0.09, 1.08, 0.08])) }),
    offset: oralB,
  },
  {
    ...AD, id: 'adultOralLying', name: 'Lying back, partner between the legs', pair: true,
    a: solve({
      h: H.a, root: LIE_BACK, bones: { head: [25, 0, 0] },
      feet: sym([0.42, 0.06, 0.42]), knees: { left: [1, 1, 0.2], right: [-1, 1, 0.2] },
      hands: sym([0.09, 0.26, 0.2]),
    }),
    b: solve({
      h: H.b, root: PRONE, bones: { spine: [-18, 0, 0], chest: [-14, 0, 0], head: [-20, 0, 0] },
      hands: local(oralLyingB, sym([0.24, 0.3, 0.42])), elbows: { left: [0.3, -1, 0], right: [-0.3, -1, 0] },
      feet: sym([0.16, 0.06, -0.95]),
    }),
    offset: oralLyingB,
  },
  {
    ...AD, id: 'adultSixtyNine', name: 'Head to toe (one lying, one on hands and knees)', pair: true,
    a: solve({ h: H.a, root: LIE_BACK, bones: { head: [20, 0, 0] }, feet: sym([0.3, 0.06, 0.4]), knees: { left: [1, 1, 0], right: [-1, 1, 0] }, hands: sym([0.16, 0.42, -0.62]) }),
    b: solve({
      h: H.b, root: fours(H.b), bones: { spine: [8, 0, 0], head: [30, 0, 0] },
      hands: local(sixNineB, sym([0.3, 0.04, 0.12])), feet: sym([0.18, 0.05, -0.45]), knees: KNEE_DOWN,
    }),
    offset: sixNineB,
  },
  {
    ...AD, id: 'adultReverseRiding', name: 'Astride, facing the partner’s feet', pair: true,
    a: solve({ h: H.a, root: LIE_BACK, bones: { head: [20, 0, 0] }, feet: sym([0.1, 0.06, 0.82]), hands: sym([0.18, 0.32, -0.04]) }),
    b: solve({
      h: H.b, root: { y: heelsY(H.b) }, bones: { spine: [14, 0, 0], head: [10, 0, 0] },
      feet: sym([0.36, 0.05, -0.36]), knees: { left: [0.6, -0.3, 1], right: [-0.6, -0.3, 1] },
      hands: sym([0.15, 0.25, 0.45]),
    }),
    offset: reverseB,
  },
  {
    ...AD, id: 'adultStandingBehind', name: 'Bent forward, partner standing behind', pair: true,
    a: solve({ h: H.a, bones: { spine: [50, 0, 0], chest: [30, 0, 0], neck: [-15, 0, 0], head: [-25, 0, 0] }, feet: sym([0.16, 0, 0.02]), hands: sym([0.16, 0.5, 0.28]) }),
    b: solve({ h: H.b, bones: { spine: [6, 0, 0], head: [20, 0, 0] }, feet: sym([0.16, 0, 0]), hands: local(behindStandB, sym([0.17, 0.88, 0.04])) }),
    offset: behindStandB,
  },
  {
    ...AD, id: 'adultLotus', name: 'Face to face in a seated partner’s lap', pair: true,
    a: solve({
      h: H.a, root: { y: 0.3 / H.a - 0.5 }, bones: { head: [-8, 0, 10] },
      feet: sym([0.13, 0.14, 0.46]), knees: { left: [1, 0, 0.3], right: [-1, 0, 0.3] }, hands: sym([0.1, 0.86, 0.42]),
    }),
    b: solve({
      h: H.b, root: { y: -0.44 }, bones: { spine: [4, 0, 0], head: [8, 0, -10] },
      feet: sym([0.16, 0.06, 0.26]), knees: KNEE_OUT, hands: local(lotusB, sym([0.12, 0.62, -0.12])),
    }),
    offset: lotusB,
  },
  {
    ...AD, id: 'adultBedEdgeStanding', name: 'Lying back at the bed’s edge, partner standing', pair: true,
    a: {
      ...solve({ h: H.a, root: { y: 0.55 / H.a - 0.5, rot: [-90, 0, 0] }, bones: { head: [25, 0, 0] }, feet: { left: [shBStand.left[0] - 0.02, shBStand.left[1] - 0.06, shBStand.left[2] - 0.04], right: [shBStand.right[0] + 0.02, shBStand.right[1] - 0.06, shBStand.right[2] - 0.04] }, hands: sym([0.3, 0.6, -0.4]) }),
      props: [{ id: 'bed', attach: 'body', offset: [0, 0, -1.0] }],
    },
    b: solve({ h: H.b, feet: planted(0.16), hands: local(bedEdgeB, sym([0.14, 0.85, 0.12])) }),
    offset: bedEdgeB,
  },
  {
    ...AD, id: 'adultSideFaceToFace', name: 'Lying on sides, face to face', pair: true,
    a: solve({ h: H.a, root: SIDE_R, bones: { head: [0, 0, -8] }, hands: { left: [-0.5, 0.3, 0.44], right: [-0.85, 0.12, 0.1] }, feet: { left: [0.62, 0.2, 0.2], right: [0.82, 0.08, 0] } }),
    b: solve({ h: H.b, root: SIDE_L, bones: { head: [0, 0, 8] }, hands: local(sideFaceB, { right: [-0.45, 0.28, -0.04], left: [-0.85, 0.12, 0.25] }), feet: local(sideFaceB, { right: [0.6, 0.12, 0.12], left: [0.85, 0.07, 0.3] }) }),
    offset: sideFaceB,
  },
  {
    ...AD, id: 'adultLegsOnShoulders', name: 'Lying back, legs on kneeling partner’s shoulders', pair: true,
    a: solve({ h: H.a, root: LIE_BACK, bones: { head: [20, 0, 0] }, feet: { left: [shB.left[0] + 0.03, shB.left[1] - 0.04, shB.left[2] - 0.05], right: [shB.right[0] - 0.03, shB.right[1] - 0.04, shB.right[2] - 0.05] }, hands: sym([0.26, 0.05, -0.66]) }),
    b: solve({ h: H.b, root: kneelB, bones: { head: [18, 0, 0] }, feet: kneelFeet(H.b), knees: KNEE_DOWN, hands: local(shouldersB, sym([0.13, 0.66, 0.16])) }),
    offset: shouldersB,
  },
  {
    ...AD, id: 'adultProneTop', name: 'Lying face down, partner on top', pair: true,
    a: solve({ h: H.a, root: PRONE, bones: { head: [0, 60, 0] }, hands: sym([0.3, 0.05, 0.75]), feet: sym([0.12, 0.06, -0.82]) }),
    b: solve({
      h: H.b, root: { y: 0.3 / H.b - 0.5, rot: [80, 0, 0] }, bones: { head: [-25, 0, 0] },
      hands: local(proneB, sym([0.32, 0.04, 0.62])), feet: local(proneB, sym([0.2, 0.06, -0.92])),
    }),
    offset: proneB,
  },
];

// ===========================================================================================
// trio (A + B + C)
// ===========================================================================================
const triKneelB = at(0.3, 0.42, -144);
const triKneelC = at(-0.3, 0.42, 144);
const foursFrontC = at(0, 1.0, 180);
const foursBackB = at(0, -0.2, 0);
const kissSideC = at(0.48, -0.5, -90);
const spoonB = at(0, -0.24, 0);
const spoonC = at(0, 0.26, 0);
const sandwichB = at(0, 0.27, 180);
const sandwichC = at(0, -0.24, 0);
const lapB = at(0, 0.3, 180);
const lapC = at(0, -0.36, 0);
const betweenB = at(0, 0.3, 180);
const doubleB = at(0.48, 0, 0);
const doubleC = at(0.24, 0.62, 180);

const kneelUprightPose = (h, place, hands, bones = {}) => solve({ h, root: { y: kneelY(h) }, bones, feet: kneelFeet(h), knees: KNEE_DOWN, hands: local(place, hands) });
const foursPose = (h, extra = {}) => solve({ h, root: fours(h), feet: kneelFeet(h, 0.13), knees: KNEE_DOWN, hands: sym([0.13, 0.04, 0.55]), ...extra });

const trio = [
  {
    ...AD, id: 'adultTrioKneelCenter', name: 'Kneeling between two standing partners', trio: true,
    a: solve({ h: H.a, root: { y: heelsY(H.a) }, bones: { head: [-10, 0, 0] }, feet: sym([0.1, 0.05, -0.12]), knees: KNEE_DOWN, hands: { left: [0.24, 0.72, 0.3], right: [-0.24, 0.72, 0.3] } }),
    b: solve({ h: H.b, bones: { head: [22, 0, 0] }, feet: planted(0.13), hands: local(triKneelB, { right: [0.05, 1.08, 0.06] }) }),
    c: solve({ h: H.c, bones: { head: [22, 0, 0] }, feet: planted(0.13), hands: local(triKneelC, { left: [-0.05, 1.08, 0.06] }) }),
    offset: triKneelB, offsetC: triKneelC,
  },
  {
    ...AD, id: 'adultTrioFoursFrontBack', name: 'On all fours, partners kneeling in front and behind', trio: true,
    a: foursPose(H.a, { bones: { head: [-30, 0, 0] } }),
    b: kneelUprightPose(H.b, foursBackB, sym([0.17, 0.5, 0.06]), { head: [18, 0, 0] }),
    c: kneelUprightPose(H.c, foursFrontC, sym([0.1, 0.62, 0.78]), { head: [20, 0, 0] }),
    offset: foursBackB, offsetC: foursFrontC,
  },
  {
    ...AD, id: 'adultTrioRidingKiss', name: 'One astride, one kissing the partner lying down', trio: true,
    a: solve({ h: H.a, root: LIE_BACK, bones: { head: [10, 0, 0] }, feet: sym([0.1, 0.06, 0.82]), hands: { left: [0.3, 0.45, 0.05], right: [-0.16, 0.42, 0.02] } }),
    b: solve({ h: H.b, root: { y: heelsY(H.b) }, bones: { spine: [6, 0, 0], head: [16, 0, 0] }, feet: sym([0.36, 0.05, -0.3]), knees: { left: [0.6, -0.3, 1], right: [-0.6, -0.3, 1] }, hands: local(at(0, 0, 180), sym([0.16, 0.2, -0.3])) }),
    c: solve({ h: H.c, root: { y: kneelY(H.c) }, bones: { spine: [38, 0, 0], chest: [26, 0, 0], head: [10, 0, 0] }, feet: kneelFeet(H.c), knees: KNEE_DOWN, hands: local(kissSideC, { left: [0.04, 0.04, -0.85], right: [0.04, 0.04, -0.45] }) }),
    offset: at(0, 0, 180), offsetC: kissSideC,
  },
  {
    ...AD, id: 'adultTrioSpoonChain', name: 'Three spooning, lying on their sides', trio: true,
    a: solve({ h: H.a, root: SIDE_R, hands: { left: [-0.4, 0.28, 0.42], right: [-0.85, 0.1, 0.12] }, feet: { left: [0.5, 0.2, 0.3], right: [0.72, 0.08, 0.2] } }),
    b: solve({ h: H.b, root: SIDE_R, hands: { left: [-0.42, 0.28, 0.38], right: [-0.9, 0.1, 0.12] }, feet: { left: [0.55, 0.2, 0.3], right: [0.78, 0.08, 0.2] } }),
    c: solve({ h: H.c, root: SIDE_R, hands: { left: [-0.3, 0.2, 0.3], right: [-0.85, 0.1, 0.15] }, feet: { left: [0.52, 0.2, 0.3], right: [0.74, 0.08, 0.2] } }),
    offset: spoonB, offsetC: spoonC,
  },
  {
    ...AD, id: 'adultTrioSandwich', name: 'Standing between two partners (front and behind)', trio: true,
    a: solve({ h: H.a, bones: { head: [-12, 0, 6] }, feet: planted(0.11), hands: sym([0.16, 1.02, 0.24]) }),
    b: solve({ h: H.b, bones: { spine: [6, 0, 0], head: [16, 0, -6] }, feet: planted(0.12), hands: local(sandwichB, sym([0.11, 1.5, 0.05])) }),
    c: solve({ h: H.c, bones: { head: [10, -25, 0] }, feet: planted(0.12), hands: local(sandwichC, { left: [0.1, 1.1, 0.12], right: [-0.1, 1.2, 0.12] }), elbows: { left: [1, 0, -0.5], right: [-1, 0, -0.5] } }),
    offset: sandwichB, offsetC: sandwichC,
  },
  {
    ...AD, id: 'adultTrioLapKiss', name: 'Seated with a partner in the lap, a third behind', trio: true,
    a: {
      ...solve({ h: H.a, root: { y: seatY(H.a) }, bones: { head: [-12, -20, 0] }, feet: sym([0.16, 0, 0.42]), hands: sym([0.16, 0.85, 0.36]) }),
      props: [{ id: 'chair', attach: 'body' }],
    },
    b: solve({ h: H.b, root: { y: 0.62 / H.b - 0.5 }, bones: { head: [12, 0, 0] }, feet: local(lapB, sym([0.36, 0.05, -0.3])), knees: KNEE_OUT, hands: local(lapB, sym([0.1, 1.4, -0.02])) }),
    c: solve({ h: H.c, bones: { spine: [26, 0, 0], chest: [14, 0, 0], head: [10, 20, 0] }, feet: planted(0.12), hands: local(lapC, sym([0.17, 1.3, 0.0])) }),
    offset: lapB, offsetC: lapC,
  },
  {
    ...AD, id: 'adultTrioBetweenKiss', name: 'Lying back between a kneeling partner, a third kissing', trio: true,
    a: solve({ h: H.a, root: LIE_BACK, bones: { head: [8, 0, 0] }, feet: sym([0.42, 0.06, 0.4]), knees: { left: [1, 1, 0.2], right: [-1, 1, 0.2] }, hands: { left: [0.4, 0.4, -0.5], right: [-0.3, 0.05, -0.6] } }),
    b: kneelUprightPose(H.b, betweenB, sym([0.3, 0.42, 0.28]), { head: [18, 0, 0] }),
    c: solve({ h: H.c, root: { y: kneelY(H.c) }, bones: { spine: [38, 0, 0], chest: [26, 0, 0], head: [10, 0, 0] }, feet: kneelFeet(H.c), knees: KNEE_DOWN, hands: local(kissSideC, { left: [0.04, 0.04, -0.85], right: [0.04, 0.04, -0.45] }) }),
    offset: betweenB, offsetC: kissSideC,
  },
  {
    ...AD, id: 'adultTrioDoubleKneel', name: 'Two kneeling side by side before a standing partner', trio: true,
    a: solve({ h: H.a, root: { y: heelsY(H.a) }, bones: { head: [-12, -10, 0] }, feet: sym([0.1, 0.05, -0.12]), knees: KNEE_DOWN, hands: { left: [0.18, 0.72, 0.5], right: [-0.05, 0.5, 0.2] } }),
    b: solve({ h: H.b, root: { y: heelsY(H.b) }, bones: { head: [-12, 10, 0] }, feet: sym([0.1, 0.05, -0.12]), knees: KNEE_DOWN, hands: local(doubleB, { right: [0.3, 0.72, 0.5], left: [0.56, 0.5, 0.2] }) }),
    c: solve({ h: H.c, bones: { spine: [12, 0, 0], head: [20, 0, 0] }, feet: planted(0.14), hands: local(doubleC, { left: [0.03, 1.02, 0.12], right: [0.45, 1.02, 0.12] }) }),
    offset: doubleB, offsetC: doubleC,
  },
];

// Adult poses use the normal categories (the `adult` flag hides them unless the pack is enabled).
const CAT = {
  adultStretchUp: 'standing', adultWallArch: 'standing',
  adultFloorLeanBack: 'sitting', adultChairBackwards: 'sitting', adultChairCrossed: 'sitting',
  adultProneFeetUp: 'ground', adultSquat: 'ground', adultLieBackLegsUp: 'ground', adultKneelLookBack: 'ground', adultChestDown: 'ground',
};
const withCat = (p) => ({ ...p, cat: p.trio ? 'groups' : p.pair ? 'pairs' : CAT[p.id] || 'ground' });

export default [...solo, ...duo, ...trio].map(withCat);
