// Body language for script staging: poses the plot word list names that the other files don't cover.
// They are untagged for the gacha (it keeps picking from the conversational set); scripts and the
// editor choose them by name. See src/poses/README.md for the format.

const HANG_L = [[0.16, -1, 0.02], [0.1, -1, 0.08]];
const HANG_R = [[-0.16, -1, 0.02], [-0.1, -1, 0.08]];
const STAND_L = [[0.06, -1, 0]];
const STAND_R = [[-0.06, -1, 0]];

export default [
  {
    id: 'handsBehindBack', name: 'Hands behind back', cat: 'standing', layer: 'upper', tags: [], tones: ['daily', 'intimate', 'resolve'],
    bones: { chest: [-3, 0, 0] },
    limbs: {
      leftArm: [[0.22, -0.86, -0.45], [-0.72, -0.38, -0.58], [-0.6, -0.5, -0.6]],
      rightArm: [[-0.22, -0.86, -0.45], [0.72, -0.38, -0.58], [0.6, -0.5, -0.6]],
    },
  },
  {
    id: 'handOnHip', name: 'Hand on hip', cat: 'gestures', layer: 'upper', tags: [], tones: ['daily', 'comedy', 'resolve'],
    bones: { chest: [0, 0, -3], head: [0, 0, 4] },
    limbs: { leftArm: HANG_L, rightArm: [[-0.72, -0.62, -0.2], [0.62, -0.72, 0.25]] },
  },
  {
    id: 'holdArm', name: 'Holding one arm', cat: 'emotions', layer: 'upper', tags: [], tones: ['sad', 'intimate'],
    bones: { chest: [5, 0, 0], head: [8, 0, 5] },
    limbs: { leftArm: [[0.1, -1, 0.06], [0.04, -1, 0.16]], rightArm: [[-0.15, -0.76, 0.62], [0.99, 0.05, 0.1]] },
    look: 0.5,
  },
  {
    id: 'pointSelf', name: 'Pointing at self', cat: 'gestures', layer: 'upper', tags: [], tones: ['comedy', 'surprise', 'resolve'],
    bones: { chest: [-2, 0, 0] },
    limbs: { leftArm: HANG_L, rightArm: [[-0.28, -0.78, 0.55], [0.72, 0.6, 0.35], [0.35, 0.1, -0.93]] },
  },
  {
    id: 'armsSpread', name: 'Arms spread', cat: 'gestures', layer: 'upper', tags: [], tones: ['joy', 'surprise', 'comedy'],
    bones: { chest: [-5, 0, 0], head: [-4, 0, 0] },
    limbs: { leftArm: [[0.85, 0.3, 0.42], [0.82, 0.42, 0.38]], rightArm: [[-0.85, 0.3, 0.42], [-0.82, 0.42, 0.38]] },
  },
  {
    id: 'raiseHand', name: 'Raising a hand', cat: 'gestures', layer: 'upper', tags: [], tones: ['daily', 'joy', 'comedy'],
    limbs: { leftArm: HANG_L, rightArm: [[-0.18, 0.98, 0.06], [-0.05, 1, 0.04], [0, 1, 0.1]] },
  },
  {
    id: 'offering', name: 'Offering (palms up)', cat: 'gestures', layer: 'upper', tags: [], tones: ['intimate', 'daily', 'joy'],
    bones: { chest: [4, 0, 0], head: [4, 0, 0] },
    limbs: { leftArm: [[0.14, -0.86, 0.48], [0.06, 0.05, 1], [0, -0.15, 1]], rightArm: [[-0.14, -0.86, 0.48], [-0.06, 0.05, 1], [0, -0.15, 1]] },
  },
  {
    id: 'stopGesture', name: 'Stop gesture', cat: 'gestures', layer: 'upper', tags: [], tones: ['conflict', 'tension', 'surprise'],
    bones: { chest: [-3, 0, 0], head: [-3, 0, 0] },
    limbs: { leftArm: HANG_L, rightArm: [[-0.22, 0.02, 0.98], [-0.06, 0.12, 0.99], [0, 1, 0.12]] },
  },
  {
    id: 'reachOut', name: 'Reaching out', cat: 'gestures', layer: 'upper', tags: [], tones: ['sad', 'intimate', 'tension'],
    bones: { spine: [6, 0, 0], chest: [8, 0, 0], head: [-6, 0, 0] },
    limbs: { leftArm: [[0.2, -0.9, 0.38], [0.1, -0.7, 0.7]], rightArm: [[-0.18, 0.1, 0.98], [-0.08, 0.12, 0.99], [0, 0, 1]] },
  },
  {
    id: 'bow', name: 'Bow', cat: 'gestures', layer: 'full', tags: [], tones: ['daily', 'intimate', 'sad'],
    bones: { spine: [22, 0, 0], chest: [16, 0, 0], neck: [6, 0, 0], head: [8, 0, 0] },
    limbs: { leftArm: [[0.12, -0.96, 0.24], [0.06, -0.96, 0.28]], rightArm: [[-0.12, -0.96, 0.24], [-0.06, -0.96, 0.28]], leftLeg: STAND_L, rightLeg: STAND_R },
    look: 0,
  },
  {
    id: 'leanIn', name: 'Leaning in', cat: 'gestures', layer: 'upper', tags: [], tones: ['intimate', 'tension', 'comedy'],
    bones: { spine: [10, 0, 0], chest: [10, 0, 0], neck: [-6, 0, 0], head: [-8, 0, 0] },
    limbs: { leftArm: [[0.22, -0.86, -0.45], [-0.72, -0.38, -0.58]], rightArm: [[-0.22, -0.86, -0.45], [0.72, -0.38, -0.58]] },
  },
  {
    id: 'headTilt', name: 'Head tilt', cat: 'gestures', layer: 'upper', tags: [], tones: ['comedy', 'intimate', 'daily'],
    bones: { neck: [0, 0, 7], head: [3, 0, 15] },
    limbs: { leftArm: HANG_L, rightArm: HANG_R },
  },
  {
    id: 'hugSelf', name: 'Hugging oneself', cat: 'emotions', layer: 'upper', tags: [], tones: ['sad', 'ominous', 'tension'],
    bones: { chest: [8, 0, 0], neck: [6, 0, 0], head: [8, 0, 0] },
    limbs: { leftArm: [[0.12, -0.74, 0.66], [-0.95, 0.26, 0.18]], rightArm: [[-0.12, -0.7, 0.7], [0.95, 0.3, 0.12]] },
    look: 0.4,
  },
  {
    id: 'fistPump', name: 'Fist pump', cat: 'emotions', layer: 'upper', tags: [], tones: ['joy', 'resolve', 'comedy'],
    bones: { chest: [-4, 0, 0], head: [-4, 0, 0] },
    limbs: { leftArm: HANG_L, rightArm: [[-0.5, -0.55, 0.45], [-0.12, 0.97, 0.2]] },
  },
  {
    id: 'lookBack', name: 'Looking back over the shoulder', cat: 'standing', layer: 'full', tags: [], tones: ['tension', 'intimate', 'ominous'],
    bones: { chest: [0, 30, 0], neck: [0, 25, 0], head: [0, 38, 0] },
    limbs: { leftArm: [[0.2, -1, -0.1], [0.12, -1, -0.02]], rightArm: [[-0.12, -1, 0.15], [-0.06, -1, 0.2]], leftLeg: STAND_L, rightLeg: STAND_R },
    look: 0,
  },
  {
    id: 'throw', name: 'Throwing', cat: 'actions', layer: 'full', tags: [], tones: ['conflict', 'joy'],
    root: { y: -0.03 },
    bones: { spine: [0, -12, 0], chest: [-6, -18, 0], head: [0, 20, 0] },
    limbs: {
      leftArm: [[0.5, -0.15, 0.85], [0.35, 0.05, 0.94]],
      rightArm: [[-0.62, 0.55, -0.55], [-0.1, 0.92, -0.38]],
      leftLeg: [[0.1, -0.9, 0.42], [0.05, -1, -0.08]],
      rightLeg: [[-0.08, -0.9, -0.42], [-0.04, -0.94, -0.33], [0, -0.4, 0.92]],
    },
    look: 0,
  },
  {
    id: 'stretch', name: 'Stretching (arms up)', cat: 'actions', layer: 'upper', tags: [], tones: ['daily', 'joy'],
    bones: { chest: [-7, 0, 0], neck: [-6, 0, 0], head: [-8, 0, 0] },
    limbs: { leftArm: [[0.16, 0.99, 0], [-0.06, 1, 0]], rightArm: [[-0.16, 0.99, 0], [0.06, 1, 0]] },
    look: 0,
  },
  {
    id: 'seiza', name: 'Seiza (formal kneeling)', cat: 'ground', layer: 'full', tags: [], tones: ['daily', 'intimate', 'resolve', 'sad'],
    root: { y: -0.35 },
    limbs: {
      leftArm: [[0.14, -0.96, 0.24], [0.04, -0.62, 0.78]],
      rightArm: [[-0.14, -0.96, 0.24], [-0.04, -0.62, 0.78]],
      leftLeg: [[0.06, -0.47, 0.88], [0, -0.03, -1], [0, -0.25, -0.97]],
      rightLeg: [[-0.06, -0.47, 0.88], [0, -0.03, -1], [0, -0.25, -0.97]],
    },
  },
];
