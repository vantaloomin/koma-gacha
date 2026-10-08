// Core poses: the default standing base and the conversation gestures the gacha uses most.
// See src/poses/README.md for the format.

const down = (x) => [[x * 0.16, -1, 0.02], [x * 0.1, -1, 0.08]]; // arm hanging relaxed (x = 1 left, -1 right)

export default [
  {
    id: 'stand', name: 'Standing', cat: 'standing', layer: 'full', tags: ['standing', 'listen'],
    limbs: { leftArm: down(1), rightArm: down(-1), leftLeg: [[0.06, -1, 0]], rightLeg: [[-0.06, -1, 0]] },
  },
  // --- upper-body overlays (work on any base: standing, sitting...) ---
  {
    id: 'idle', name: 'Arms relaxed', cat: 'gestures', layer: 'upper', tags: ['listen'],
    limbs: { leftArm: down(1), rightArm: down(-1) },
  },
  {
    id: 'talk', name: 'Talking (one hand out)', cat: 'gestures', layer: 'upper', tags: ['speak'], tones: ['daily', 'auto', 'joy', 'intimate'],
    limbs: { leftArm: down(1), rightArm: [[-0.22, -0.82, 0.38], [-0.12, 0.15, 1]] },
  },
  {
    id: 'gesture', name: 'Open-handed gesture', cat: 'gestures', layer: 'upper', tags: ['speak'], tones: ['daily', 'comedy', 'joy'],
    limbs: { leftArm: [[0.35, -0.78, 0.35], [0.45, 0.05, 1]], rightArm: [[-0.35, -0.78, 0.35], [-0.45, 0.05, 1]] },
  },
  {
    id: 'point', name: 'Pointing', cat: 'gestures', layer: 'upper', tags: ['speak'], tones: ['conflict', 'comedy', 'surprise'],
    limbs: { leftArm: down(1), rightArm: [[-0.15, 0.05, 1], [-0.1, 0.06, 1]] },
  },
  {
    id: 'armsCrossed', name: 'Arms crossed', cat: 'gestures', layer: 'upper', tags: ['listen'], tones: ['tension', 'conflict'],
    bones: { chest: [3, 0, 0] },
    limbs: { leftArm: [[0.3, -0.9, 0.28], [-0.95, 0.06, 0.28]], rightArm: [[-0.3, -0.9, 0.3], [0.95, 0.14, 0.24]] },
  },
  {
    id: 'handOnChest', name: 'Hand on chest', cat: 'gestures', layer: 'upper', tags: ['speak'], tones: ['sad', 'intimate', 'resolve'],
    limbs: { leftArm: down(1), rightArm: [[-0.28, -0.85, 0.3], [0.65, 0.6, 0.3]] },
  },
  {
    id: 'handsOnHips', name: 'Hands on hips', cat: 'gestures', layer: 'upper', tags: ['listen', 'speak'], tones: ['conflict', 'comedy'],
    bones: { chest: [-3, 0, 0] },
    limbs: { leftArm: [[0.72, -0.68, -0.15], [-0.55, -0.65, 0.25]], rightArm: [[-0.72, -0.68, -0.15], [0.55, -0.65, 0.25]] },
  },
  {
    id: 'surprised', name: 'Surprised (hands up)', cat: 'gestures', layer: 'upper', tags: ['speak', 'listen'], tones: ['surprise', 'comedy'],
    bones: { spine: [-3, 0, 0], chest: [-5, 0, 0] },
    limbs: { leftArm: [[0.55, -0.6, 0.3], [0.2, 0.9, 0.35]], rightArm: [[-0.55, -0.6, 0.3], [-0.2, 0.9, 0.35]] },
  },
  {
    id: 'slump', name: 'Slumped', cat: 'gestures', layer: 'upper', tags: ['listen'], tones: ['sad'],
    bones: { spine: [12, 0, 0], chest: [10, 0, 0], neck: [10, 0, 0] },
    limbs: { leftArm: [[0.06, -1, 0.12], [0.04, -1, 0.15]], rightArm: [[-0.06, -1, 0.12], [-0.04, -1, 0.15]] },
  },
  {
    id: 'fist', name: 'Clenched fist', cat: 'gestures', layer: 'upper', tags: ['speak'], tones: ['resolve', 'conflict'],
    bones: { chest: [4, 0, 0] },
    limbs: { leftArm: down(1), rightArm: [[-0.22, -0.85, 0.3], [-0.05, 0.85, 0.42]] },
  },
];
