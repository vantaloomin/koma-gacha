// Everyday poses: standing variations, conversation gestures, emotions, everyday actions with props, and dance.
// See src/poses/README.md for the format. Arm/leg directions were solved from hand/foot targets
// (mouth, ear, cheeks, floor...) on the default proportions, so hands land where they should.

export default [
  // --- standing ---
  {
    id: 'weightShift', name: 'Relaxed (weight on one leg)', cat: 'standing', layer: 'full', tags: ['standing', 'listen'], tones: ['daily', 'auto', 'intimate'],
    root: { y: -0.018 },
    bones: { hips: [0, 0, -9], spine: [0, 0, 5], chest: [0, 0, 4], head: [0, 0, -5] },
    limbs: {
      leftArm: [[0.22, -1, 0.04], [0.14, -1, 0.12]],
      rightArm: [[-0.16, -1, 0.02], [-0.1, -1, 0.08]],
      rightLeg: [[0.04, -0.97, 0.23], [0.04, -0.97, -0.24], [-0.15, 0, 0.99]],
      leftLeg: [[0.19, -0.88, 0.43], [0.07, -0.99, -0.11], [0.33, 0, 0.94]],
    },
  },
  {
    id: 'handsInPockets', name: 'Hands in pockets', cat: 'standing', layer: 'full', tags: ['standing', 'listen'], tones: ['daily', 'auto', 'tension'],
    bones: { chest: [-3, 0, 0], head: [3, 0, 0] },
    limbs: {
      leftArm: [[0.35, -0.94, 0], [-0.32, -0.87, 0.39], [-0.1, -0.97, 0.24]],
      rightArm: [[-0.35, -0.94, 0], [0.32, -0.87, 0.39], [0.1, -0.97, 0.24]],
      leftLeg: [[0.07, -1, 0]],
      rightLeg: [[-0.07, -1, 0]],
    },
  },
  {
    id: 'leanWall', name: 'Leaning back against a wall', cat: 'standing', layer: 'full', tags: ['standing', 'listen'], tones: ['daily', 'tension', 'ominous'],
    root: { y: -0.01, rot: [-12, 0, 0] },
    bones: { neck: [8, 0, 0], head: [6, 0, 0] },
    limbs: {
      leftArm: [[0.3, -0.9, 0.28], [-0.95, 0.06, 0.28]],
      rightArm: [[-0.3, -0.9, 0.3], [0.95, 0.14, 0.24]],
      rightLeg: [[-0.03, -0.99, 0.13], [-0.03, -0.97, -0.23], [-0.1, -0.21, 0.97]],
      leftLeg: [[0.05, -0.9, 0.43], [0.01, 0.02, -1], [0, -1, 0.04]],
    },
    look: 0.7,
  },
  {
    id: 'shy', name: 'Shy (fidgeting)', cat: 'standing', layer: 'full', tags: ['standing', 'listen'], tones: ['intimate', 'comedy', 'sad'],
    root: { y: -0.012 },
    bones: { spine: [3, 0, 0], chest: [6, 0, 0], neck: [8, 0, 0], head: [10, 0, 7] },
    limbs: {
      leftArm: [[-0.06, -0.98, 0.18], [-0.56, -0.73, 0.39], [-0.62, -0.72, 0.31]],
      rightArm: [[0.06, -0.98, 0.18], [0.56, -0.73, 0.39], [0.62, -0.72, 0.31]],
      leftLeg: [[-0.13, -0.96, 0.26], [0.13, -0.97, -0.18], [-0.41, 0, 0.91]],
      rightLeg: [[0.13, -0.96, 0.26], [-0.13, -0.97, -0.18], [0.41, 0, 0.91]],
    },
    look: 0.5,
  },
  {
    id: 'confidentStance', name: 'Confident wide stance', cat: 'standing', layer: 'full', tags: ['standing', 'speak', 'listen'], tones: ['resolve', 'conflict', 'comedy'],
    root: { y: -0.022 },
    bones: { chest: [-6, 0, 0], head: [-6, 0, 0] },
    limbs: {
      leftArm: [[0.72, -0.68, -0.15], [-0.55, -0.65, 0.25]],
      rightArm: [[-0.72, -0.68, -0.15], [0.55, -0.65, 0.25]],
      leftLeg: [[0.32, -0.93, 0.17], [0.25, -0.96, -0.1], [0.33, 0, 0.94]],
      rightLeg: [[-0.32, -0.93, 0.17], [-0.25, -0.96, -0.1], [-0.33, 0, 0.94]],
    },
  },
  {
    id: 'lookUpSky', name: 'Looking up at the sky', cat: 'standing', layer: 'full', tags: ['standing'], tones: ['intimate', 'sad', 'resolve', 'ominous'],
    bones: { chest: [-4, 0, 0], neck: [-15, 0, 0], head: [-28, 0, 0] },
    limbs: {
      leftArm: [[0.16, -1, -0.08], [0.1, -1, -0.02]],
      rightArm: [[-0.16, -1, -0.08], [-0.1, -1, -0.02]],
      leftLeg: [[0.06, -1, 0]],
      rightLeg: [[-0.06, -1, 0]],
    },
    look: 0,
  },
  // --- gestures ---
  {
    id: 'waveHello', name: 'Waving hello', cat: 'gestures', layer: 'upper', tags: ['speak'], tones: ['daily', 'joy', 'comedy'],
    bones: { chest: [0, 0, 3], head: [0, 0, -4] },
    limbs: {
      leftArm: [[0.16, -1, 0.02], [0.1, -1, 0.08]],
      rightArm: [[-0.85, 0.3, 0.3], [-0.12, 1, 0.08], [-0.2, 1, 0.05]],
    },
  },
  {
    id: 'thumbsUp', name: 'Thumbs up', cat: 'gestures', layer: 'upper', tags: ['speak', 'listen'], tones: ['joy', 'comedy', 'resolve'],
    bones: { chest: [-3, 0, 0], head: [0, 0, -5] },
    limbs: {
      leftArm: [[0.16, -1, 0.02], [0.1, -1, 0.08]],
      rightArm: [[-0.3, -0.8, 0.5], [-0.05, 0.55, 0.85], [0, 0.6, 0.8]],
    },
  },
  {
    id: 'shrug', name: 'Shrug', cat: 'gestures', layer: 'upper', tags: ['speak', 'listen'], tones: ['comedy', 'daily'],
    bones: { chest: [-2, 0, 0], head: [0, 0, 10] },
    limbs: {
      leftArm: [[0.4, -0.9, 0.05], [0.8, 0.25, 0.55], [0.8, 0.35, 0.4]],
      rightArm: [[-0.4, -0.9, 0.05], [-0.8, 0.25, 0.55], [-0.8, 0.35, 0.4]],
    },
  },
  {
    id: 'facepalm', name: 'Facepalm', cat: 'gestures', layer: 'upper', tags: ['speak', 'listen'], tones: ['comedy', 'conflict'],
    bones: { chest: [6, 0, 0], neck: [12, 0, 0], head: [14, 0, 0] },
    limbs: {
      leftArm: [[0.16, -1, 0.02], [0.1, -1, 0.08]],
      rightArm: [[0.13, -0.66, 0.74], [0.52, 0.85, -0.04], [0.05, 0.92, 0.4]],
    },
    look: 0,
  },
  {
    id: 'thinkChin', name: 'Thinking (hand on chin)', cat: 'gestures', layer: 'upper', tags: ['listen'], tones: ['daily', 'tension', 'ominous'],
    bones: { chest: [3, 0, 0], head: [5, 0, -6] },
    limbs: {
      rightArm: [[0.33, -0.83, 0.44], [0.31, 0.95, 0.07], [0.15, 0.95, 0.28]],
      leftArm: [[-0.5, -0.78, 0.37], [-0.75, -0.57, 0.34], [-1, 0, 0.1]],
    },
    look: 0.6,
  },
  {
    id: 'sheepish', name: 'Hand behind head (sheepish)', cat: 'gestures', layer: 'upper', tags: ['speak', 'listen'], tones: ['comedy', 'joy', 'intimate'],
    bones: { head: [6, 0, 8] },
    limbs: {
      leftArm: [[0.16, -1, 0.02], [0.1, -1, 0.08]],
      rightArm: [[-0.55, 0.79, 0.27], [0.84, -0.15, -0.52], [0.53, 0.65, -0.54]],
    },
  },
  {
    id: 'beckon', name: 'Beckoning (come here)', cat: 'gestures', layer: 'upper', tags: ['speak'], tones: ['intimate', 'comedy', 'ominous'],
    bones: { chest: [-2, 0, 0], head: [0, 0, -5] },
    limbs: {
      leftArm: [[0.16, -1, 0.02], [0.1, -1, 0.08]],
      rightArm: [[-0.25, -0.55, 0.8], [-0.05, 0.55, 0.85], [0, 0.9, -0.4]],
    },
  },
  {
    id: 'coverMouth', name: 'Covering mouth (giggle / shock)', prompt: { default: 'covering mouth in shock', comedy: 'covering mouth, giggling', joy: 'covering mouth, giggling' }, cat: 'gestures', layer: 'upper', tags: ['speak', 'listen'], tones: ['surprise', 'comedy', 'sad'],
    bones: { chest: [-4, 0, 0], head: [5, 0, 0] },
    limbs: {
      rightArm: [[0.33, -0.59, 0.73], [0.3, 0.94, -0.16], [0.15, 0.99, -0.08]],
      leftArm: [[-0.22, -0.87, 0.44], [-0.79, -0.47, 0.39], [-0.96, 0.19, 0.19]],
    },
  },
  // --- emotions ---
  {
    id: 'cryIntoHands', name: 'Crying into hands', cat: 'emotions', layer: 'upper', tags: ['listen'], tones: ['sad'],
    bones: { spine: [8, 0, 0], chest: [10, 0, 0], neck: [12, 0, 0], head: [15, 0, 0] },
    limbs: {
      leftArm: [[-0.12, -0.86, 0.5], [-0.4, 0.9, 0.18], [-0.1, 0.8, 0.59]],
      rightArm: [[0.12, -0.86, 0.5], [0.4, 0.9, 0.18], [0.1, 0.8, 0.59]],
    },
    look: 0,
  },
  {
    id: 'laughing', name: 'Laughing (leaning back)', cat: 'emotions', layer: 'upper', tags: ['speak', 'listen'], tones: ['joy', 'comedy'],
    bones: { spine: [-6, 0, 0], chest: [-10, 0, 0], neck: [-5, 0, 0], head: [-12, 0, 0] },
    limbs: {
      leftArm: [[0.26, -0.86, 0.43], [-0.52, -0.57, 0.63], [-0.96, 0, 0.29]],
      rightArm: [[-0.4, -0.8, 0.3], [-0.2, 0.7, 0.6]],
    },
    look: 0.4,
  },
  {
    id: 'angry', name: 'Angry (fists clenched)', cat: 'emotions', layer: 'full', tags: ['standing', 'speak'], tones: ['conflict', 'tension'],
    root: { y: -0.012 },
    bones: { spine: [8, 0, 0], chest: [4, 0, 0], neck: [6, 0, 0], head: [-8, 0, 0] },
    limbs: {
      leftArm: [[0.35, -0.95, -0.1], [0.12, -1, 0.25]],
      rightArm: [[-0.35, -0.95, -0.1], [-0.12, -1, 0.25]],
      leftLeg: [[0.18, -0.94, 0.29], [0.12, -0.99, -0.05], [0.29, 0, 0.96]],
      rightLeg: [[-0.17, -0.97, 0.15], [-0.09, -0.96, -0.27], [-0.29, 0, 0.96]],
    },
  },
  {
    id: 'cower', name: 'Scared (cowering)', cat: 'emotions', layer: 'full', tags: ['standing', 'listen'], tones: ['ominous', 'tension', 'surprise'],
    root: { y: -0.09 },
    bones: { spine: [15, 0, 0], chest: [10, 0, 0], neck: [10, 0, 0], head: [12, 0, 0] },
    limbs: {
      leftArm: [[-0.3, -0.74, 0.6], [-0.77, 0.51, 0.38], [-0.71, 0.48, 0.52]],
      rightArm: [[0.32, -0.63, 0.71], [0.75, 0.43, 0.5], [0.71, 0.48, 0.52]],
      leftLeg: [[0.2, -0.8, 0.56], [-0.02, -0.82, -0.57], [0.24, 0, 0.97]],
      rightLeg: [[-0.2, -0.8, 0.56], [0.02, -0.82, -0.57], [-0.24, 0, 0.97]],
    },
    look: 0.5,
  },
  {
    id: 'embarrassed', name: 'Embarrassed (hands on cheeks)', cat: 'emotions', layer: 'upper', tags: ['listen', 'speak'], tones: ['comedy', 'intimate', 'joy'],
    bones: { chest: [3, 0, 0], head: [8, 0, -8] },
    limbs: {
      leftArm: [[-0.25, -0.75, 0.61], [-0.03, 0.88, -0.47], [0.09, 0.95, 0.29]],
      rightArm: [[0.33, -0.53, 0.78], [-0.09, 0.77, -0.63], [0.19, 0.94, 0.28]],
    },
  },
  {
    id: 'exhausted', name: 'Exhausted (hunched)', cat: 'emotions', layer: 'full', tags: ['standing', 'listen'], tones: ['sad', 'comedy'],
    root: { y: -0.025 },
    bones: { spine: [15, 0, 0], chest: [14, 0, 0], neck: [12, 0, 0], head: [10, 0, 0] },
    limbs: {
      leftArm: [[0.06, -1, 0.04], [0.03, -1, 0.04]],
      rightArm: [[-0.06, -1, 0.04], [-0.03, -1, 0.04]],
      leftLeg: [[0.1, -0.92, 0.38], [0.04, -0.96, -0.27], [0.2, 0, 0.98]],
      rightLeg: [[-0.1, -0.94, 0.33], [-0.04, -0.94, -0.33], [-0.2, 0, 0.98]],
    },
    look: 0.3,
  },
  {
    id: 'triumph', name: 'Triumphant (arms raised)', cat: 'emotions', layer: 'full', tags: ['standing', 'speak'], tones: ['joy', 'resolve'],
    root: { y: -0.012 },
    bones: { chest: [-4, 0, 0], head: [-4, 0, 0] },
    limbs: {
      leftArm: [[0.5, 0.85, 0.1], [0.3, 0.95, 0.05]],
      rightArm: [[-0.5, 0.85, 0.1], [-0.3, 0.95, 0.05]],
      leftLeg: [[0.22, -0.96, 0.17], [0.15, -0.97, -0.17], [0.29, 0, 0.96]],
      rightLeg: [[-0.22, -0.96, 0.17], [-0.15, -0.97, -0.17], [-0.29, 0, 0.96]],
    },
    look: 0.3,
  },
  {
    id: 'sulk', name: 'Sulking (arms crossed, looking away)', cat: 'emotions', layer: 'upper', tags: ['listen'], tones: ['comedy', 'conflict'],
    bones: { chest: [3, 0, 0], head: [-8, 45, -5] },
    limbs: {
      leftArm: [[0.3, -0.9, 0.28], [-0.95, 0.06, 0.28]],
      rightArm: [[-0.3, -0.9, 0.3], [0.95, 0.14, 0.24]],
    },
    look: 0,
  },
  // --- actions ---
  {
    id: 'drinkCup', name: 'Drinking from a cup', cat: 'actions', layer: 'upper', tags: ['listen'], tones: ['daily', 'intimate', 'comedy'],
    bones: { neck: [-8, 0, 0], head: [-18, 0, 0] },
    limbs: {
      leftArm: [[0.16, -1, 0.02], [0.1, -1, 0.08]],
      rightArm: [[0.18, -0.37, 0.91], [0.38, 0.85, -0.35], [0.72, 0.31, 0.62]],
    },
    look: 0, props: [{ id: 'cup', attach: 'rightHand', offset: [0.045, -0.01, -0.02], rot: [-30, 0, 0] }],
  },
  {
    id: 'holdCup', name: 'Holding a cup', cat: 'actions', layer: 'upper', tags: ['listen', 'speak'], tones: ['daily', 'intimate'],
    bones: { head: [6, 0, 0] },
    limbs: {
      rightArm: [[-0.14, -0.93, 0.33], [0.74, 0.2, 0.65], [0.69, 0.2, 0.69]],
      leftArm: [[0.13, -0.92, 0.36], [-0.73, 0.31, 0.61], [-0.71, 0, 0.71]],
    },
    props: [{ id: 'cup', attach: 'rightHand', offset: [0.045, 0, 0] }],
  },
  {
    id: 'eatFork', name: 'Eating with a fork', cat: 'actions', layer: 'upper', tags: ['listen'], tones: ['daily', 'comedy', 'intimate'],
    bones: { chest: [4, 0, 0], head: [6, 0, 0] },
    limbs: {
      leftArm: [[0.12, -0.93, 0.36], [-0.74, -0.13, 0.66], [-0.2, 0, 0.98]],
      rightArm: [[0.13, -0.58, 0.81], [0.42, 0.88, -0.22], [0.74, 0.42, 0.53]],
    },
    look: 0.2, props: [{ id: 'bowl', attach: 'leftHand', offset: [0, 0.02, 0] }, { id: 'fork', attach: 'rightHand' }],
  },
  {
    id: 'eatBurger', name: 'Eating a burger', cat: 'actions', layer: 'upper', tags: ['listen'], tones: ['daily', 'comedy', 'joy'],
    bones: { chest: [4, 0, 0], head: [4, 0, 0] },
    limbs: {
      rightArm: [[0.19, -0.61, 0.77], [0.32, 0.94, -0.11], [0.64, 0.64, 0.43]],
      leftArm: [[-0.19, -0.61, 0.77], [-0.32, 0.94, -0.11], [-0.64, 0.64, 0.43]],
    },
    look: 0, props: [{ id: 'burger', attach: 'rightHand', offset: [0.06, 0.03, 0.01] }],
  },
  {
    id: 'phoneCall', name: 'Talking on the phone', cat: 'actions', layer: 'upper', tags: ['speak', 'listen'], tones: ['daily', 'tension', 'auto'],
    bones: { head: [3, 0, 5] },
    limbs: {
      leftArm: [[0.16, -1, 0.02], [0.1, -1, 0.08]],
      rightArm: [[0.32, -0.2, 0.92], [-0.11, 0.58, -0.81], [0.15, 0.97, 0.19]],
    },
    look: 0, props: [{ id: 'phone', attach: 'rightHand', mode: 'upright', offset: [0, 0.03, 0], rot: [0, 90, 0] }],
  },
  {
    id: 'texting', name: 'Texting', cat: 'actions', layer: 'upper', tags: ['listen'], tones: ['daily', 'auto'],
    bones: { neck: [12, 0, 0], head: [22, 0, 0] },
    limbs: {
      rightArm: [[-0.07, -0.95, 0.31], [0.7, -0.07, 0.71], [0.51, 0.3, 0.81]],
      leftArm: [[0.07, -0.95, 0.31], [-0.7, -0.07, 0.71], [-0.51, 0.3, 0.81]],
    },
    look: 0, props: [{ id: 'phone', attach: 'rightHand', mode: 'upright', offset: [0.035, 0, 0], rot: [50, 180, 0] }],
  },
  {
    id: 'readBook', name: 'Reading a book', cat: 'actions', layer: 'upper', tags: ['listen'], tones: ['daily', 'intimate', 'auto'],
    bones: { neck: [10, 0, 0], head: [16, 0, 0] },
    limbs: {
      rightArm: [[-0.26, -0.91, 0.33], [0.53, 0.09, 0.84], [0.2, 0.3, 0.93]],
      leftArm: [[0.26, -0.91, 0.33], [-0.53, 0.09, 0.84], [-0.2, 0.3, 0.93]],
    },
    look: 0, props: [{ id: 'openBook', attach: 'rightHand', offset: [0.13, 0, 0], rot: [-35, 0, 0] }],
  },
  {
    id: 'writeNotebook', name: 'Writing in a notebook', cat: 'actions', layer: 'upper', tags: ['listen'], tones: ['daily', 'auto'],
    bones: { chest: [4, 0, 0], neck: [10, 0, 0], head: [16, 0, 0] },
    limbs: {
      leftArm: [[0.25, -0.92, 0.3], [-0.67, -0.13, 0.73], [-0.4, 0.2, 0.9]],
      rightArm: [[-0.01, -0.9, 0.43], [0.78, 0.01, 0.63], [0.64, -0.43, 0.64]],
    },
    look: 0, props: [{ id: 'notebook', attach: 'leftHand', offset: [0.06, 0, 0], rot: [-40, 0, 0] }, { id: 'pen', attach: 'rightHand' }],
  },
  {
    id: 'carryBags', name: 'Carrying a backpack and shopping bag', cat: 'actions', layer: 'upper', tags: ['listen', 'speak'], tones: ['daily', 'auto'],
    limbs: {
      leftArm: [[0.22, -1, 0], [0.18, -1, 0.04]],
      rightArm: [[-0.39, -0.91, -0.14], [0.53, 0.5, 0.68], [0, 1, 0]],
    },
    props: [{ id: 'backpack', attach: 'body', offset: [0, 1.02, -0.2] }, { id: 'shoppingBag', attach: 'leftHand' }],
  },
  {
    id: 'holdUmbrella', name: 'Holding an umbrella', cat: 'actions', layer: 'upper', tags: ['listen', 'speak'], tones: ['sad', 'daily', 'intimate'],
    limbs: {
      leftArm: [[0.16, -1, 0.02], [0.1, -1, 0.08]],
      rightArm: [[-0.15, -0.88, 0.45], [0.54, 0.07, 0.84], [0.51, 0, 0.86]],
    },
    props: [{ id: 'umbrella', attach: 'rightHand', offset: [0.03, 0, 0] }],
  },
  {
    id: 'takePhoto', name: 'Taking a photo', cat: 'actions', layer: 'upper', tags: ['listen'], tones: ['daily', 'joy'],
    bones: { head: [4, 0, 0] },
    limbs: {
      rightArm: [[-0.03, -0.15, 0.99], [0.54, 0.8, -0.28], [0.62, 0.31, 0.72]],
      leftArm: [[0.03, -0.15, 0.99], [-0.54, 0.8, -0.28], [-0.62, 0.31, 0.72]],
    },
    look: 0, props: [{ id: 'camera', attach: 'rightHand', offset: [0.065, 0.025, 0.01], rot: [0, 180, 0] }],
  },
  {
    id: 'swordReady', name: 'Sword at the ready', cat: 'actions', layer: 'full', tags: ['standing'], tones: ['conflict', 'tension', 'resolve'],
    root: { y: -0.04 },
    bones: { chest: [3, 0, 0], head: [-3, 0, 0] },
    limbs: {
      rightArm: [[0.29, -0.68, 0.67], [0.33, -0.65, 0.69], [0.1, 0.5, 0.86]],
      leftArm: [[-0.31, -0.79, 0.53], [-0.35, -0.76, 0.55], [-0.1, 0.5, 0.86]],
      rightLeg: [[-0.06, -0.83, 0.55], [-0.08, -0.99, 0.12], [-0.05, 0, 1]],
      leftLeg: [[0.1, -0.99, -0.04], [0.03, -0.83, -0.56], [0.37, 0, 0.93]],
    },
    props: [{ id: 'sword', attach: 'rightHand' }],
  },
  // --- dance ---
  {
    id: 'discoPoint', name: 'Disco point', cat: 'dance', layer: 'full', tags: [], tones: ['comedy', 'joy'],
    root: { y: -0.015 },
    bones: { hips: [0, 0, -8], spine: [0, 0, 6], chest: [0, 0, 6], head: [0, 0, 6] },
    limbs: {
      rightArm: [[-0.55, 0.8, 0.2], [-0.55, 0.8, 0.2]],
      leftArm: [[0.72, -0.68, -0.15], [-0.55, -0.65, 0.25]],
      rightLeg: [[0.01, -0.98, 0.22], [0.01, -0.98, -0.22], [-0.2, 0, 0.98]],
      leftLeg: [[-0.27, -0.78, 0.56], [0.06, -0.99, -0.09], [-0.09, -0.51, 0.85]],
    },
  },
  {
    id: 'danceCelebrate', name: 'Celebration dance (raise the roof)', cat: 'dance', layer: 'full', tags: [], tones: ['joy', 'comedy'],
    root: { y: -0.02 },
    bones: { hips: [0, 0, 6], spine: [0, 0, -4], chest: [0, 0, -5], head: [-5, 0, -8] },
    limbs: {
      leftArm: [[0.75, 0.5, 0.2], [0.2, 0.95, 0.2]],
      rightArm: [[-0.75, 0.5, 0.2], [-0.2, 0.95, 0.2]],
      leftLeg: [[0.03, -0.96, 0.27], [0.03, -0.96, -0.27], [0.2, 0, 0.98]],
      rightLeg: [[-0.24, -0.79, 0.56], [-0.01, -0.97, -0.25], [-0.18, -0.44, 0.88]],
    },
  },
  {
    id: 'sideStep', name: 'Side-step with swinging arms', cat: 'dance', layer: 'full', tags: [], tones: ['joy', 'comedy', 'daily'],
    root: { y: -0.015 },
    bones: { hips: [0, 0, 5], spine: [0, 8, -3], chest: [0, 12, -3], head: [0, -15, 0] },
    limbs: {
      leftArm: [[0.85, -0.35, 0.2], [0.55, 0.5, 0.6]],
      rightArm: [[0.15, -0.7, 0.65], [0.95, 0.2, 0.25]],
      leftLeg: [[-0.01, -0.97, 0.24], [-0.01, -0.97, -0.25], [0.2, 0, 0.98]],
      rightLeg: [[-0.42, -0.9, 0.06], [-0.39, -0.92, -0.06], [-0.34, -0.42, 0.84]],
    },
  },
  {
    id: 'arabesque', name: 'Ballet arabesque (relevé)', cat: 'dance', layer: 'full', tags: [], tones: ['intimate', 'joy', 'resolve'],
    root: { y: 0.045, rot: [12, 0, 0] },
    bones: { chest: [-10, 0, 0], head: [-6, 0, 0] },
    limbs: {
      rightLeg: [[0.05, -0.86, 0.51], [0.05, -1, 0], [0, -0.6, 0.8]],
      leftLeg: [[0.03, 0.04, -1], [0.03, 0.04, -1], [0, -0.11, -0.99]],
      rightArm: [[-0.14, 0.55, 0.82], [-0.09, 0.59, 0.8]],
      leftArm: [[0.98, 0.11, -0.17], [0.98, 0.17, -0.14]],
    },
  },
];
