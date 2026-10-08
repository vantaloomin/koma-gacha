// Full-body poses: movement, sitting, ground (kneel/crouch/lie), fighting, and pair poses.
// See src/poses/README.md for the format. Heights below assume h = 1.65 m.

const down = (x) => [[x * 0.16, -1, 0.02], [x * 0.1, -1, 0.08]]; // arm hanging relaxed (x = 1 left, -1 right)
const lap = (x) => [[x * 0.12, -1, 0.12], [x * -0.05, -0.75, 0.8]]; // seated, hand resting on the thigh

export default [
  // ------------------------------------------------------------------ movement
  {
    id: 'walking', name: 'Walking', cat: 'movement', layer: 'full', tags: [], tones: ['daily', 'auto'],
    root: { y: 0 },
    bones: { spine: [3, 0, 0] },
    limbs: {
      leftLeg: [[0.04, -1, 0.35], [0.02, -1, 0.1]],
      rightLeg: [[-0.04, -1, -0.3], [-0.02, -1, -0.4], [0, -0.6, 1]],
      leftArm: [[0.12, -1, -0.3], [0.1, -1, -0.1]],
      rightArm: [[-0.12, -1, 0.35], [-0.08, -0.8, 0.6]],
    },
    look: 0.6,
  },
  {
    id: 'running', name: 'Running', cat: 'movement', layer: 'full', tags: [], tones: ['tension', 'auto', 'surprise'],
    root: { y: -0.01 },
    bones: { spine: [12, 0, 0], chest: [6, 0, 0], neck: [-8, 0, 0], head: [-8, 0, 0] },
    limbs: {
      leftLeg: [[0.03, -0.3, 1], [0, -1, -0.35], [0, -0.3, 1]],
      rightLeg: [[-0.03, -1, -0.5], [-0.02, -1, -0.6], [0, -0.8, 0.6]],
      rightArm: [[-0.15, -0.75, 0.55], [-0.05, 0.6, 0.8]],
      leftArm: [[0.15, -0.7, -0.6], [0.1, -0.4, 0.9]],
    },
    look: 0.3,
  },
  {
    id: 'jumping', name: 'Jumping (airborne)', cat: 'movement', layer: 'full', tags: [], tones: ['joy', 'comedy', 'surprise'],
    root: { y: 0.16 },
    bones: { spine: [-5, 0, 0], head: [-8, 0, 0] },
    limbs: {
      leftLeg: [[0.08, -0.25, 1], [0.02, -1, -0.3], [0, -0.5, 1]],
      rightLeg: [[-0.08, -0.4, 1], [-0.02, -1, -0.45], [0, -0.5, 1]],
      leftArm: [[0.5, 0.85, 0.1], [0.3, 0.95, 0.1]],
      rightArm: [[-0.5, 0.85, 0.1], [-0.3, 0.95, 0.1]],
    },
    look: 0.3,
  },
  {
    id: 'fallingBack', name: 'Falling backward', cat: 'movement', layer: 'full', tags: [], tones: ['surprise', 'comedy', 'conflict'],
    root: { y: -0.12, rot: [-40, 0, 0] },
    bones: { neck: [15, 0, 0], head: [15, 0, 0] },
    limbs: {
      leftLeg: [[0.08, -1, 0.7], [0.04, -1, 0.3]],
      rightLeg: [[-0.06, -1, 0.15], [-0.02, -1, 0.0]],
      leftArm: [[0.7, 0.5, 0.4], [0.4, 0.9, -0.2]],
      rightArm: [[-0.8, 0.3, 0.3], [-0.6, 0.7, 0.4]],
    },
    look: 0,
  },
  {
    id: 'sneaking', name: 'Sneaking (tiptoe)', cat: 'movement', layer: 'full', tags: [], tones: ['tension', 'comedy', 'ominous'],
    root: { y: -0.04 },
    bones: { spine: [25, 0, 0], chest: [10, 0, 0], neck: [-15, 0, 0], head: [-15, 0, 0] },
    limbs: {
      leftLeg: [[0.08, -0.6, 0.8], [0.02, -1, -0.2], [0, -0.7, 1]],
      rightLeg: [[-0.08, -1, 0.1], [-0.02, -0.6, -0.8], [0, -1, 0.3]],
      leftArm: [[0.3, -0.85, 0.3], [-0.1, 0.5, 1]],
      rightArm: [[-0.3, -0.85, 0.3], [0.1, 0.5, 1]],
    },
    look: 0.5,
  },
  {
    id: 'climbing', name: 'Climbing / reaching up', cat: 'movement', layer: 'full', tags: [], tones: ['resolve', 'tension'],
    root: { y: 0.03 },
    bones: { spine: [-5, 0, 0], neck: [-15, 0, 0], head: [-20, 0, 0] },
    limbs: {
      leftLeg: [[0.05, -0.1, 1], [0, -1, 0.05]],
      rightLeg: [[-0.05, -1, 0], [-0.02, -1, 0], [0, -0.6, 1]],
      leftArm: [[0.25, 1, 0.25], [0.15, 1, 0.2]],
      rightArm: [[-0.2, 1, 0.15], [-0.1, 1, 0.25]],
    },
    look: 0,
  },

  // ------------------------------------------------------------------ sitting
  {
    id: 'sitChair', name: 'Sitting on a chair', cat: 'sitting', layer: 'full', tags: ['listen', 'speak'], tones: ['daily', 'auto'],
    root: { y: -0.191 },
    limbs: {
      leftLeg: [[0.05, -0.27, 1], [0.02, -1, 0.08]],
      rightLeg: [[-0.05, -0.27, 1], [-0.02, -1, 0.08]],
      leftArm: lap(1), rightArm: lap(-1),
    },
    props: [{ id: 'chair', attach: 'body' }],
  },
  {
    id: 'sitRelaxed', name: 'Sitting back, legs crossed', cat: 'sitting', layer: 'full', tags: ['listen', 'speak'], tones: ['daily', 'comedy'],
    root: { y: -0.191 },
    bones: { spine: [-12, 0, 0], chest: [-5, 0, 0], neck: [8, 0, 0], head: [6, 0, 0] },
    limbs: {
      rightLeg: [[-0.06, -0.27, 1], [-0.02, -1, 0.12]],
      leftLeg: [[-0.2, 0.2, 1], [-0.1, -1, 0.25]],
      leftArm: down(1), rightArm: down(-1),
    },
    props: [{ id: 'chair', attach: 'body' }],
  },
  {
    id: 'sitDesk', name: 'Sitting at a desk (elbows on it)', cat: 'sitting', layer: 'full', tags: [], tones: ['daily', 'sad'],
    root: { y: -0.191 },
    bones: { spine: [18, 0, 0], chest: [10, 0, 0], neck: [-10, 0, 0], head: [-10, 0, 0] },
    limbs: {
      leftLeg: [[0.05, -0.27, 1], [0.02, -1, 0.08]],
      rightLeg: [[-0.05, -0.27, 1], [-0.02, -1, 0.08]],
      leftArm: [[0.1, -0.8, 0.45], [-0.6, 0.1, 0.8]],
      rightArm: [[-0.1, -0.8, 0.45], [0.6, 0.1, 0.8]],
    },
    props: [{ id: 'chair', attach: 'body' }, { id: 'desk', attach: 'body', offset: [-0.2, 0, 0.58], rot: [0, 180, 0] }],
  },
  {
    id: 'sitBarStool', name: 'Sitting on a bar stool', cat: 'sitting', layer: 'full', tags: ['listen', 'speak'], tones: ['daily', 'intimate'],
    root: { y: -0.015 },
    limbs: {
      leftLeg: [[0.06, -0.25, 1], [0.02, -1, -0.35], [0, -0.2, 1]],
      rightLeg: [[-0.06, -0.25, 1], [-0.02, -1, -0.35], [0, -0.2, 1]],
      leftArm: lap(1), rightArm: lap(-1),
    },
    props: [{ id: 'barStool', attach: 'body' }],
  },
  {
    id: 'sitSofa', name: 'Slouching on a sofa', cat: 'sitting', layer: 'full', tags: ['listen', 'speak'], tones: ['daily', 'comedy', 'sad'],
    root: { y: -0.227 },
    bones: { spine: [-25, 0, 0], chest: [-5, 0, 0], neck: [15, 0, 0], head: [10, 0, 0] },
    limbs: {
      leftLeg: [[0.1, -0.15, 1], [0.05, -1, 0.4]],
      rightLeg: [[-0.1, -0.15, 1], [-0.05, -1, 0.4]],
      leftArm: [[0.5, -0.8, -0.2], [0.3, -0.6, 0.5]],
      rightArm: [[-0.5, -0.8, -0.2], [-0.3, -0.6, 0.5]],
    },
    props: [{ id: 'sofa', attach: 'body' }],
  },
  {
    id: 'sitBench', name: 'Sitting on a bench (hands on knees)', cat: 'sitting', layer: 'full', tags: ['listen', 'speak'], tones: ['daily', 'resolve'],
    root: { y: -0.197 },
    bones: { spine: [12, 0, 0], chest: [4, 0, 0], neck: [-8, 0, 0], head: [-6, 0, 0] },
    limbs: {
      leftLeg: [[0.25, -0.25, 1], [0.08, -1, 0.05]],
      rightLeg: [[-0.25, -0.25, 1], [-0.08, -1, 0.05]],
      leftArm: [[0.05, -0.85, 0.5], [0, -0.9, 0.5]],
      rightArm: [[-0.05, -0.85, 0.5], [0, -0.9, 0.5]],
    },
    props: [{ id: 'bench', attach: 'body' }],
  },
  {
    id: 'sitHugKnees', name: 'Sitting on the floor hugging knees', cat: 'sitting', layer: 'full', tags: [], tones: ['sad', 'intimate'],
    root: { y: -0.44 },
    bones: { spine: [20, 0, 0], chest: [8, 0, 0], neck: [-5, 0, 0], head: [-5, 0, 0] },
    limbs: {
      leftLeg: [[0.05, 0.9, 0.75], [0, -1, 0.2]],
      rightLeg: [[-0.05, 0.9, 0.75], [0, -1, 0.2]],
      leftArm: [[0.08, -0.72, 0.75], [-1, -0.05, 0.28]],
      rightArm: [[-0.08, -0.82, 0.7], [1, -0.3, 0.22]],
    },
    look: 0.4,
  },
  {
    id: 'sitCrossLegged', name: 'Sitting cross-legged on the floor', cat: 'sitting', layer: 'full', tags: ['listen', 'speak'], tones: ['daily', 'comedy'],
    root: { y: -0.44 },
    bones: { spine: [6, 0, 0] },
    limbs: {
      leftLeg: [[0.75, -0.1, 0.6], [-0.85, 0, 0.5], [-0.5, -0.3, 0.6]],
      rightLeg: [[-0.75, -0.1, 0.6], [0.85, 0, 0.25], [0.5, -0.3, 0.6]],
      leftArm: [[0.25, -0.9, 0.2], [0.2, -0.6, 0.6]],
      rightArm: [[-0.25, -0.9, 0.2], [-0.2, -0.6, 0.6]],
    },
  },

  // ------------------------------------------------------------------ ground
  {
    id: 'kneel', name: 'Kneeling on both knees', cat: 'ground', layer: 'full', tags: [], tones: ['sad', 'resolve', 'intimate'],
    root: { y: -0.209 },
    limbs: {
      leftLeg: [[0.06, -1, 0], [0, 0, -1], [0, 0.05, -1]],
      rightLeg: [[-0.06, -1, 0], [0, 0, -1], [0, 0.05, -1]],
      leftArm: down(1), rightArm: down(-1),
    },
  },
  {
    id: 'kneelOne', name: 'Kneeling on one knee', cat: 'ground', layer: 'full', tags: [], tones: ['resolve', 'intimate'],
    root: { y: -0.233 },
    bones: { spine: [10, 0, 0], neck: [10, 0, 0], head: [10, 0, 0] },
    limbs: {
      leftLeg: [[0.06, -0.05, 1], [0, -1, 0]],
      rightLeg: [[-0.04, -0.86, -0.5], [0, 0, -1], [0, 0.05, -1]],
      leftArm: [[0.05, -0.8, 0.6], [-0.4, -0.4, 0.8]],
      rightArm: [[-0.28, -0.85, 0.3], [0.65, 0.6, 0.3]],
    },
    look: 0,
  },
  {
    id: 'crouch', name: 'Crouching on heels', cat: 'ground', layer: 'full', tags: [], tones: ['daily', 'tension'],
    root: { y: -0.345 },
    bones: { spine: [25, 0, 0], chest: [10, 0, 0], neck: [-15, 0, 0], head: [-15, 0, 0] },
    limbs: {
      leftLeg: [[0.2, 0.35, 1], [0, -1, -0.55], [0, -0.6, 1]],
      rightLeg: [[-0.2, 0.35, 1], [0, -1, -0.55], [0, -0.6, 1]],
      leftArm: [[0.15, -0.6, 0.8], [0, -1, 0.3]],
      rightArm: [[-0.15, -0.6, 0.8], [0, -1, 0.3]],
    },
    look: 0.6,
  },
  {
    id: 'lieBack', name: 'Lying on the back', cat: 'ground', layer: 'full', tags: [], tones: ['daily', 'sad', 'intimate'],
    root: { y: -0.43, rot: [-90, 0, 0] },
    bones: { neck: [10, 0, 0] },
    limbs: {
      leftLeg: [[0.06, -0.7, 0.7], [0, -0.6, -1]],
      rightLeg: [[-0.07, -1, 0], [-0.03, -1, 0], [0, 0.3, 1]],
      leftArm: [[0.55, 0.8, 0], [-1, -0.1, -0.4]],
      rightArm: [[-0.55, 0.8, 0], [1, -0.1, -0.4]],
    },
    look: 0,
  },
  {
    id: 'lieSide', name: 'Lying on the side, head propped', cat: 'ground', layer: 'full', tags: [], tones: ['daily', 'intimate', 'comedy'],
    root: { y: -0.424, rot: [0, 0, 90] },
    bones: { spine: [0, 0, -22], chest: [0, 0, -22], neck: [0, 0, 18], head: [0, 0, 18] },
    limbs: {
      rightLeg: [[0, -1, 0.1], [0, -1, 0.1]],
      leftLeg: [[-0.2, -0.6, 0.8], [0, -1, -0.2]],
      rightArm: [[-0.7, 0.28, 0.68], [1, 0.08, -0.55]],
      leftArm: [[0.12, -1, 0.2], [0, -1, 0.5]],
    },
    look: 0,
  },
  {
    id: 'lieFrontReading', name: 'Lying on the front, reading', cat: 'ground', layer: 'full', tags: [], tones: ['daily', 'joy'],
    root: { y: -0.43, rot: [90, 0, 0] },
    bones: { spine: [-15, 0, 0], chest: [-25, 0, 0], neck: [-5, 0, 0], head: [15, 0, 0] },
    limbs: {
      leftArm: [[0.1, 0.2, 1], [-0.2, 1, 0.1]],
      rightArm: [[-0.1, 0.2, 1], [0.2, 1, 0.1]],
      leftLeg: [[0.07, -1, 0], [0, -0.3, -1]],
      rightLeg: [[-0.07, -1, 0], [0, -0.5, -1]],
    },
    look: 0,
    props: [{ id: 'openBook', attach: 'body', offset: [0, 0, 0.95] }],
  },
  {
    id: 'crawling', name: 'Crawling on all fours', cat: 'ground', layer: 'full', tags: [], tones: ['comedy', 'tension'],
    root: { y: -0.2, rot: [83, 0, 0] },
    bones: { neck: [-30, 0, 0], head: [-20, 0, 0] },
    limbs: {
      leftLeg: [[0.06, 0, 1], [0, -1, -0.04], [0, -1, -0.2]],
      rightLeg: [[-0.06, 0, 1], [0, -1, -0.04], [0, -1, -0.2]],
      leftArm: [[0.05, 0, 1], [0.05, 0, 1]],
      rightArm: [[-0.05, 0, 1], [-0.05, 0, 1]],
    },
    look: 0,
  },
  {
    id: 'collapsed', name: 'Collapsed (unconscious)', cat: 'ground', layer: 'full', tags: [], tones: ['ominous', 'sad', 'comedy'],
    root: { y: -0.43, rot: [90, 0, 0] },
    bones: { head: [0, 70, 0] },
    limbs: {
      leftArm: [[1, 0.4, 0.1], [0.6, 0.8, 0.1]],
      rightArm: [[-0.9, -0.4, 0.15], [-0.6, -0.8, 0.15]],
      leftLeg: [[0.35, -1, 0], [0.3, -1, 0]],
      rightLeg: [[-0.1, -1, 0], [0.2, -1, -0.2]],
    },
    look: 0,
  },

  // ------------------------------------------------------------------ fighting
  {
    id: 'guardStance', name: 'Fighting guard', cat: 'fighting', layer: 'full', tags: ['standing', 'listen'], tones: ['conflict', 'tension', 'resolve'],
    root: { y: -0.005 },
    bones: { hips: [0, -15, 0], head: [8, 0, 0] },
    limbs: {
      leftLeg: [[0.12, -1, 0.3], [0.05, -1, -0.15]],
      rightLeg: [[-0.15, -1, -0.3], [-0.05, -1, -0.1], [-0.3, 0, 1]],
      leftArm: [[0.2, -0.6, 0.75], [-0.05, 0.85, 0.5]],
      rightArm: [[-0.35, -0.85, 0.3], [0.2, 0.9, 0.35]],
    },
    look: 0.6,
  },
  {
    id: 'punch', name: 'Straight punch', cat: 'fighting', layer: 'full', tags: ['standing'], tones: ['conflict'],
    root: { y: -0.03 },
    bones: { spine: [8, 15, 0], chest: [0, 10, 0] },
    limbs: {
      leftLeg: [[0.12, -1, 0.45], [0.05, -1, 0]],
      rightLeg: [[-0.15, -1, -0.5], [-0.05, -1, -0.5], [0, -0.5, 1]],
      rightArm: [[-0.02, 0.08, 1], [0, 0.08, 1]],
      leftArm: [[0.3, -0.8, 0.3], [-0.25, 0.9, 0.3]],
    },
    look: 0.5,
  },
  {
    id: 'highKick', name: 'High kick', cat: 'fighting', layer: 'full', tags: [], tones: ['conflict', 'comedy'],
    root: { y: 0 },
    bones: { spine: [-10, 0, -10] },
    limbs: {
      rightLeg: [[-0.3, 0.6, 0.75], [-0.3, 0.65, 0.7]],
      leftLeg: [[0.1, -1, -0.1], [0.05, -1, 0], [0.3, 0, 1]],
      leftArm: [[0.8, -0.2, 0.3], [0.5, 0.6, 0.5]],
      rightArm: [[-0.5, -0.7, -0.3], [-0.2, -0.6, 0.6]],
    },
    look: 0.5,
  },
  {
    id: 'block', name: 'Block (forearms up)', cat: 'fighting', layer: 'full', tags: ['standing'], tones: ['conflict', 'tension', 'surprise'],
    root: { y: -0.005 },
    bones: { spine: [10, 0, 0], neck: [5, 0, 0], head: [10, 0, 0] },
    limbs: {
      leftLeg: [[0.15, -1, 0.2], [0.06, -1, -0.1]],
      rightLeg: [[-0.15, -1, -0.15], [-0.06, -1, -0.05]],
      leftArm: [[0.4, -0.4, 0.8], [-0.4, 0.9, 0.15]],
      rightArm: [[-0.4, -0.35, 0.8], [0.4, 0.9, 0.2]],
    },
    look: 0.3,
  },
  {
    id: 'swordOverhead', name: 'Sword raised overhead (two hands)', cat: 'fighting', layer: 'full', tags: ['standing'], tones: ['conflict', 'resolve'],
    root: { y: -0.012 },
    bones: { spine: [-4, 0, 0] },
    limbs: {
      leftLeg: [[0.12, -1, 0.3], [0.05, -1, -0.1]],
      rightLeg: [[-0.12, -1, -0.3], [-0.05, -1, -0.1]],
      rightArm: [[-0.01, 0.952, 0.306], [0.697, 0.715, -0.052]],
      leftArm: [[0.136, 0.847, 0.514], [-0.836, 0.547, -0.038]],
    },
    look: 0.5,
    props: [{ id: 'katana', attach: 'rightHand', rot: [-74, -34, 44] }],
  },
  {
    id: 'swordThrust', name: 'Sword thrust (lunge)', cat: 'fighting', layer: 'full', tags: ['standing'], tones: ['conflict', 'resolve'],
    root: { y: -0.08 },
    bones: { spine: [8, 0, 0] },
    limbs: {
      rightLeg: [[-0.08, -0.6, 0.8], [0, -1, 0]],
      leftLeg: [[0.12, -1, -0.7], [0.05, -1, -0.6], [0.5, -0.3, 0.6]],
      rightArm: [[-0.05, 0.05, 1], [0, 0.02, 1]],
      leftArm: [[0.6, 0.3, -0.6], [0.3, 0.8, -0.2]],
    },
    look: 0.5,
    props: [{ id: 'sword', attach: 'rightHand', rot: [0, 0, 89] }],
  },
  {
    id: 'dodge', name: 'Dodging (leaning back)', cat: 'fighting', layer: 'full', tags: ['standing'], tones: ['surprise', 'conflict', 'comedy'],
    root: { y: -0.008 },
    bones: { spine: [-25, 0, 0], chest: [-15, 0, 0], neck: [10, 0, 0], head: [10, 0, 0] },
    limbs: {
      leftLeg: [[0.1, -1, 0.35], [0.03, -1, -0.25]],
      rightLeg: [[-0.1, -1, 0.35], [-0.03, -1, -0.25]],
      leftArm: [[0.8, 0.3, -0.1], [0.6, 0.6, 0.2]],
      rightArm: [[-0.8, 0.3, -0.1], [-0.6, 0.6, 0.2]],
    },
    look: 0.5,
  },
  {
    id: 'knockedDown', name: 'Knocked down (propped on an elbow)', cat: 'fighting', layer: 'full', tags: [], tones: ['conflict', 'sad'],
    root: { y: -0.43, rot: [-90, 0, 0] },
    bones: { spine: [12, 0, 0], chest: [10, 0, 0], neck: [20, 0, 0], head: [10, 0, 0] },
    limbs: {
      rightArm: [[-0.2, -0.3, -1], [-0.2, -1, 0]],
      leftArm: [[0.3, -0.8, 0.5], [-0.6, 0.1, 0.4]],
      leftLeg: [[0.06, -0.8, 0.6], [0, -0.6, -1]],
      rightLeg: [[-0.08, -1, 0], [-0.03, -1, 0], [0, 0.3, 1]],
    },
    look: 0.6,
  },

  // ------------------------------------------------------------------ pairs
  {
    id: 'handshake', name: 'Handshake', cat: 'pairs', pair: true, tags: [], tones: ['daily', 'resolve', 'joy'],
    a: { layer: 'full', limbs: { leftArm: down(1), rightArm: [[-0.009, -0.814, 0.58], [0.736, -0.174, 0.655]], leftLeg: [[0.06, -1, 0]], rightLeg: [[-0.06, -1, 0]] } },
    b: { layer: 'full', limbs: { leftArm: down(1), rightArm: [[0.054, -0.844, 0.534], [0.67, -0.391, 0.631]], leftLeg: [[0.06, -1, 0]], rightLeg: [[-0.06, -1, 0]] } },
    offset: { x: 0, z: 0.74, yaw: 180 },
  },
  {
    id: 'hugFriendly', name: 'Friendly hug', cat: 'pairs', pair: true, tags: [], tones: ['joy', 'intimate', 'resolve'],
    a: {
      layer: 'full', bones: { spine: [4, 0, 0], neck: [0, 20, -24], head: [0, 25, -10] }, look: 0,
      limbs: { leftArm: [[0.251, -0.525, 0.814], [-0.76, -0.125, 0.638]], rightArm: [[-0.206, -0.58, 0.788], [0.711, -0.225, 0.667]], leftLeg: [[0.06, -1, 0.02]], rightLeg: [[-0.06, -1, -0.08]] },
    },
    b: {
      layer: 'full', bones: { spine: [10, 0, 0], neck: [10, 20, -24], head: [5, 25, -10] }, look: 0,
      limbs: { leftArm: [[0.21, 0.125, 0.97], [-0.692, -0.706, 0.15]], rightArm: [[-0.205, 0.027, 0.978], [0.687, -0.713, 0.141]], leftLeg: [[0.06, -1, -0.1]], rightLeg: [[-0.06, -1, -0.02]] },
    },
    offset: { x: 0, z: 0.27, yaw: 180 },
  },
  {
    id: 'highFive', name: 'High five', cat: 'pairs', pair: true, tags: [], tones: ['joy', 'comedy'],
    a: { layer: 'full', look: 0.5, bones: { head: [-10, 0, 0] }, limbs: { leftArm: down(1), rightArm: [[-0.023, 0.739, 0.673], [0.175, 0.743, 0.646]], leftLeg: [[0.06, -1, 0.05]], rightLeg: [[-0.06, -1, -0.05]] } },
    b: { layer: 'full', look: 0.5, limbs: { leftArm: down(1), rightArm: [[0.485, 0.537, 0.69], [-0.338, 0.681, 0.65]], leftLeg: [[0.06, -1, 0.05]], rightLeg: [[-0.06, -1, -0.05]] } },
    offset: { x: -0.3, z: 0.8, yaw: 180 },
  },
  {
    id: 'piggyback', name: 'Piggyback carry', cat: 'pairs', pair: true, tags: [], tones: ['joy', 'comedy', 'intimate'],
    a: {
      layer: 'full', bones: { spine: [20, 0, 0], neck: [-12, 0, 0], head: [-8, 0, 0] }, look: 0.3,
      limbs: { leftArm: [[0.52, -0.78, -0.37], [-0.11, -0.92, 0.37]], rightArm: [[-0.52, -0.78, -0.37], [0.11, -0.92, 0.37]], leftLeg: [[0.08, -1, 0.1], [0.03, -1, -0.05]], rightLeg: [[-0.08, -1, 0.1], [-0.03, -1, -0.05]] },
    },
    b: {
      layer: 'full', root: { y: 0.07 }, bones: { spine: [15, 0, 0], head: [-5, -15, 0] }, look: 0.3,
      limbs: { leftArm: [[0.18, -0.36, 0.92], [-0.81, -0.42, 0.42]], rightArm: [[-0.18, -0.36, 0.92], [0.81, -0.47, 0.4]], leftLeg: [[0.4, -0.25, 0.9], [0.05, -1, 0.15]], rightLeg: [[-0.4, -0.25, 0.9], [-0.05, -1, 0.15]] },
    },
    offset: { x: 0, z: -0.25, yaw: 0 },
  },
  {
    id: 'supportInjured', name: 'Supporting an injured friend', cat: 'pairs', pair: true, tags: [], tones: ['sad', 'resolve', 'tension'],
    a: {
      layer: 'full', look: 0.5,
      limbs: { leftArm: [[0.521, -0.711, -0.472], [0.68, -0.732, 0.035]], rightArm: [[-0.537, -0.73, 0.423], [0.711, 0.703, 0.02]], leftLeg: [[0.06, -1, 0.1]], rightLeg: [[-0.06, -1, -0.1]] },
    },
    b: {
      layer: 'full', root: { y: -0.01 }, bones: { spine: [8, 0, 3], neck: [10, 0, 5], head: [15, 0, 5] }, look: 0,
      limbs: { rightArm: [[-0.679, 0.198, -0.707], [-0.844, 0, 0.537], [-0.2, -1, 0.4]], leftArm: [[0.2, -1, 0.2], [-0.75, -0.25, 0.6]], rightLeg: [[-0.06, -1, 0.1], [-0.02, -1, 0]], leftLeg: [[0.08, -1, 0.15], [0.02, -1, -0.6]] },
    },
    offset: { x: 0.45, z: 0, yaw: 0 },
  },
  {
    id: 'punchLanding', name: 'Punch landing', cat: 'pairs', pair: true, tags: [], tones: ['conflict', 'comedy'],
    a: {
      layer: 'full', root: { y: -0.03 }, bones: { spine: [8, 15, 0], chest: [0, 10, 0] },
      limbs: {
        leftLeg: [[0.12, -1, 0.45], [0.05, -1, 0]],
        rightLeg: [[-0.15, -1, -0.5], [-0.05, -1, -0.5], [0, -0.5, 1]],
        rightArm: [[0.28, 0.349, 0.894], [0.445, 0.408, 0.797]],
        leftArm: [[0.3, -0.8, 0.3], [-0.25, 0.9, 0.3]],
      },
      look: 0,
    },
    b: {
      layer: 'full', root: { y: -0.002 }, bones: { spine: [-12, 0, 0], chest: [-8, 0, 0], neck: [-10, 0, 0], head: [-20, 25, 0] },
      limbs: {
        leftLeg: [[0.1, -1, -0.05], [0.05, -1, 0]],
        rightLeg: [[-0.1, -1, -0.35], [-0.03, -1, -0.35], [0, -0.6, 1]],
        leftArm: [[0.8, 0.2, -0.3], [0.5, 0.7, -0.2]],
        rightArm: [[-0.8, 0.0, -0.3], [-0.6, 0.5, -0.4]],
      },
      look: 0,
    },
    offset: { x: 0, z: 0.5, yaw: 180 },
  },
];
