// Adult pack (opt-in). Never picked by the gacha; only usable when a comic enables adult content,
// and only on characters marked adult (see the MCP adult gate). Mannequin reference poses.

const A = { adult: true, tags: ['adult'], look: 0.6 };

// thighs forward & level, shins down: seated on something at hip height
const seatedLegs = (spread = 0.08) => ({ leftLeg: [[spread, -0.05, 1], [0.02, -1, 0.05]], rightLeg: [[-spread, -0.05, 1], [-0.02, -1, 0.05]] });

// Adult poses use the normal categories (the `adult` flag hides them unless the pack is enabled).
const CAT = {
  adultHipPop: 'standing', adultBendOver: 'standing', adultUndress: 'gestures', adultBedEdge: 'sitting',
  adultReclineSide: 'ground', adultLieBackArmsUp: 'ground', adultKneelArched: 'ground', adultAllFours: 'ground',
};
const withCat = (p) => ({ ...p, cat: p.trio ? 'groups' : p.pair ? 'pairs' : CAT[p.id] || 'ground' });

export default [
  // --- solo ---
  {
    ...A, id: 'adultHipPop', name: 'Hip-pop stand', layer: 'full',
    bones: { spine: [0, 0, -6], chest: [-3, 0, -4], head: [0, -10, 6] },
    limbs: {
      rightArm: [[-0.72, -0.68, -0.15], [0.55, -0.65, 0.25]],
      leftArm: [[0.5, 0.7, 0.1], [-0.6, 0.5, -0.2]],
      leftLeg: [[0.1, -1, 0]],
      rightLeg: [[-0.02, -1, 0.14], [-0.04, -1, -0.12]],
    },
  },
  {
    ...A, id: 'adultReclineSide', name: 'Reclining on side, head propped', layer: 'full',
    root: { y: -0.43, rot: [0, 0, 90] },
    bones: { head: [0, 0, -12] },
    limbs: {
      rightArm: [[-1, 0.25, 0.1], [0.4, 0.9, 0.1]],
      leftArm: [[0.3, -1, 0.2], [0.1, -1, 0.3]],
      leftLeg: [[0.05, -0.6, 0.8], [0, -1, 0.2]],
      rightLeg: [[-0.05, -1, 0.05]],
    },
  },
  {
    ...A, id: 'adultLieBackArmsUp', name: 'Lying on back, arms overhead', layer: 'full',
    root: { y: -0.43, rot: [-90, 0, 0] },
    limbs: {
      leftArm: [[0.45, 0.88, -0.1], [0.15, 1, -0.05]],
      rightArm: [[-0.45, 0.88, -0.1], [-0.15, 1, -0.05]],
      leftLeg: [[0.05, -0.5, 0.86], [0.05, -1, -0.45]],
      rightLeg: [[-0.05, -1, 0]],
    },
  },
  {
    ...A, id: 'adultKneelArched', name: 'Kneeling on heels, back arched', layer: 'full',
    root: { y: -0.33, rot: [0, 0, 0] },
    bones: { spine: [-10, 0, 0], chest: [-12, 0, 0], head: [-15, 0, 0] },
    limbs: {
      leftArm: [[0.7, 0.6, -0.2], [-0.6, 0.5, -0.3]],
      rightArm: [[-0.7, 0.6, -0.2], [0.6, 0.5, -0.3]],
      leftLeg: [[0.12, -0.48, 0.88], [0, -0.05, -1], [0, -0.2, -1]],
      rightLeg: [[-0.12, -0.48, 0.88], [0, -0.05, -1], [0, -0.2, -1]],
    },
  },
  {
    ...A, id: 'adultAllFours', name: 'On all fours, back arched', layer: 'full',
    root: { y: -0.215, rot: [90, 0, 0] },
    bones: { spine: [-10, 0, 0], chest: [-6, 0, 0], head: [-35, 0, 0] },
    limbs: {
      leftArm: [[0.12, 0, 1], [0.05, 0.1, 1]],
      rightArm: [[-0.12, 0, 1], [-0.05, 0.1, 1]],
      leftLeg: [[0.12, 0, 1], [0, -1, 0.05]],
      rightLeg: [[-0.12, 0, 1], [0, -1, 0.05]],
    },
  },
  {
    ...A, id: 'adultBedEdge', name: 'Sitting on bed edge, leaning back', layer: 'full',
    root: { y: -0.167, rot: [-12, 0, 0] },
    bones: { head: [8, 0, 0] },
    limbs: {
      leftArm: [[0.35, -0.75, -0.55], [0.2, -1, -0.2]],
      rightArm: [[-0.35, -0.75, -0.55], [-0.2, -1, -0.2]],
      leftLeg: [[0.35, -0.05, 0.93], [0.1, -1, 0.05]],
      rightLeg: [[-0.35, -0.05, 0.93], [-0.1, -1, 0.05]],
    },
    props: [{ id: 'bed', attach: 'body', offset: [0, 0, -0.85] }],
  },
  {
    ...A, id: 'adultBendOver', name: 'Bending over, hands on knees', layer: 'full',
    bones: { spine: [45, 0, 0], chest: [25, 0, 0], neck: [-15, 0, 0], head: [-25, 0, 0] },
    limbs: {
      leftArm: [[0.15, -0.9, 0.15], [0.05, -1, -0.1]],
      rightArm: [[-0.15, -0.9, 0.15], [-0.05, -1, -0.1]],
      leftLeg: [[0.12, -1, -0.08]],
      rightLeg: [[-0.12, -1, -0.08]],
    },
  },
  {
    ...A, id: 'adultUndress', name: 'Pulling shirt up', layer: 'upper',
    bones: { head: [-5, 0, 0] },
    limbs: {
      leftArm: [[0.25, -0.3, 0.4], [-0.6, 0.75, 0.2]],
      rightArm: [[-0.25, -0.3, 0.4], [0.6, 0.75, 0.2]],
    },
  },

  // --- pairs (B is placed relative to A) ---
  {
    ...A, id: 'adultKiss', name: 'Kiss (standing)', pair: true,
    a: {
      bones: { chest: [-6, 0, 0], neck: [-10, 0, 0], head: [-14, 0, 10] },
      limbs: { leftArm: [[0.35, 0.55, 0.75], [-0.4, 0.35, 0.85]], rightArm: [[-0.35, 0.55, 0.75], [0.4, 0.35, 0.85]], leftLeg: [[0.06, -1, 0]], rightLeg: [[-0.06, -1, 0]] },
      look: 0,
    },
    b: {
      bones: { spine: [6, 0, 0], chest: [6, 0, 0], neck: [12, 0, 0], head: [16, 0, -10] },
      limbs: { leftArm: [[0.35, -0.45, 0.8], [-0.6, -0.1, 0.75]], rightArm: [[-0.35, -0.45, 0.8], [0.6, -0.1, 0.75]], leftLeg: [[0.06, -1, 0]], rightLeg: [[-0.06, -1, 0]] },
      look: 0,
    },
    offset: { x: 0, z: 0.24, yaw: 180 },
  },
  {
    ...A, id: 'adultEmbraceBehind', name: 'Embrace from behind', pair: true,
    a: {
      limbs: { leftArm: [[0.22, -0.94, 0.26], [-0.92, -0.15, 0.3]], rightArm: [[-0.22, -0.94, 0.26], [0.92, -0.1, 0.3]], leftLeg: [[0.06, -1, 0]], rightLeg: [[-0.06, -1, 0]] },
      bones: { head: [-5, 25, 0] }, look: 0,
    },
    b: {
      bones: { head: [10, -20, 0] },
      limbs: { leftArm: [[0.45, -0.5, 0.74], [-0.85, -0.05, 0.5]], rightArm: [[-0.45, -0.5, 0.74], [0.85, -0.05, 0.5]], leftLeg: [[0.06, -1, 0]], rightLeg: [[-0.06, -1, 0]] },
      look: 0,
    },
    offset: { x: 0, z: -0.24, yaw: 0 },
  },
  {
    ...A, id: 'adultSpooning', name: 'Spooning (lying)', pair: true,
    a: {
      root: { y: -0.43, rot: [0, 0, 90] },
      limbs: { rightArm: [[-0.6, 0.6, 0.5], [0.2, 0.6, 0.75]], leftArm: [[0.3, -0.6, 0.75], [0, -0.3, 0.95]], leftLeg: [[0.05, -0.6, 0.8], [0, -0.95, 0.3]], rightLeg: [[-0.05, -0.6, 0.8], [0, -0.95, 0.3]] },
      look: 0,
    },
    b: {
      root: { y: -0.43, rot: [0, 0, 90] },
      limbs: { rightArm: [[-0.6, 0.7, 0.4], [0.2, 0.9, 0.3]], leftArm: [[0.2, -0.1, 1], [0, -0.4, 0.9]], leftLeg: [[0.05, -0.6, 0.8], [0, -0.95, 0.3]], rightLeg: [[-0.05, -0.6, 0.8], [0, -0.95, 0.3]] },
      look: 0,
    },
    offset: { x: 0, z: -0.24, yaw: 0 },
  },
  {
    ...A, id: 'adultStraddleLap', name: 'Straddling a seated partner', pair: true,
    a: {
      root: { y: -0.19 },
      limbs: { leftArm: [[0.3, -0.3, 0.85], [-0.55, 0.05, 0.8]], rightArm: [[-0.3, -0.3, 0.85], [0.55, 0.05, 0.8]], ...seatedLegs(0.1) },
      props: [{ id: 'chair', attach: 'body' }],
      bones: { head: [-10, 0, 0] }, look: 0,
    },
    b: {
      root: { y: -0.157 },
      bones: { head: [12, 0, 0] },
      limbs: { leftArm: [[0.3, 0.4, 0.85], [-0.5, 0.3, 0.8]], rightArm: [[-0.3, 0.4, 0.85], [0.5, 0.3, 0.8]], leftLeg: [[0.6, -0.15, 0.75], [0.1, -1, -0.2]], rightLeg: [[-0.6, -0.15, 0.75], [-0.1, -1, -0.2]] },
      look: 0,
    },
    offset: { x: 0, z: 0.3, yaw: 180 },
  },
  {
    ...A, id: 'adultMissionary', name: 'Lying together, face to face (on top)', pair: true,
    a: {
      root: { y: -0.43, rot: [-90, 0, 0] },
      limbs: { leftArm: [[0.6, 0.3, 0.75], [-0.5, 0.2, 0.8]], rightArm: [[-0.6, 0.3, 0.75], [0.5, 0.2, 0.8]], leftLeg: [[0.4, -0.4, 0.82], [0.1, -0.75, -0.65]], rightLeg: [[-0.4, -0.4, 0.82], [-0.1, -0.75, -0.65]] },
      look: 0,
    },
    b: {
      root: { y: -0.33, rot: [90, 0, 0] },
      bones: { head: [-20, 0, 0] },
      limbs: { leftArm: [[0.3, 0.15, 0.94], [0.05, 1, 0.05]], rightArm: [[-0.3, 0.15, 0.94], [-0.05, 1, 0.05]], leftLeg: [[0.15, -0.35, 0.92], [0, -1, 0.05]], rightLeg: [[-0.15, -0.35, 0.92], [0, -1, 0.05]] },
      look: 0,
    },
    offset: { x: 0, z: 0, yaw: 180 },
  },
  {
    ...A, id: 'adultRiding', name: 'Sitting astride a lying partner', pair: true,
    a: {
      root: { y: -0.43, rot: [-90, 0, 0] },
      limbs: { leftArm: [[0.5, -0.6, 0.6], [0.2, -0.3, 0.93]], rightArm: [[-0.5, -0.6, 0.6], [-0.2, -0.3, 0.93]], leftLeg: [[0.08, -1, 0]], rightLeg: [[-0.08, -1, 0]] },
      bones: { head: [20, 0, 0] }, look: 0,
    },
    b: {
      root: { y: -0.33 },
      bones: { spine: [5, 0, 0], head: [20, 0, 0] },
      limbs: { leftArm: [[0.15, -0.6, 0.78], [0.05, -0.8, 0.6]], rightArm: [[-0.15, -0.6, 0.78], [-0.05, -0.8, 0.6]], leftLeg: [[0.55, -0.6, 0.55], [0.05, -0.25, -0.96]], rightLeg: [[-0.55, -0.6, 0.55], [-0.05, -0.25, -0.96]] },
      look: 0,
    },
    offset: { x: 0, z: 0, yaw: 180 },
  },
  {
    ...A, id: 'adultFromBehind', name: 'From behind (all fours, kneeling)', pair: true,
    a: {
      root: { y: -0.215, rot: [90, 0, 0] },
      bones: { spine: [-6, 0, 0], head: [-30, 0, 0] },
      limbs: { leftArm: [[0.12, 0, 1], [0.05, 0.1, 1]], rightArm: [[-0.12, 0, 1], [-0.05, 0.1, 1]], leftLeg: [[0.14, 0, 1], [0, -1, 0.05]], rightLeg: [[-0.14, 0, 1], [0, -1, 0.05]] },
      look: 0,
    },
    b: {
      root: { y: -0.214 },
      bones: { head: [15, 0, 0] },
      limbs: { leftArm: [[0.3, -0.55, 0.75], [-0.05, -0.3, 0.95]], rightArm: [[-0.3, -0.55, 0.75], [0.05, -0.3, 0.95]], leftLeg: [[0.12, -1, 0], [0, -0.1, -1]], rightLeg: [[-0.12, -1, 0], [0, -0.1, -1]] },
      look: 0,
    },
    offset: { x: 0, z: -0.2, yaw: 0 },
  },
].map(withCat);
