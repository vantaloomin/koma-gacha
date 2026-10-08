// Prop catalog. Each prop is built from primitive parts (metres, degrees):
//   [shape, dims, position, rotation, material]
// shapes: box [w,h,d] · cyl [rTop, rBottom, h, segments?] · sphere [r] · hemi [r] (dome, flat side down)
//         cone [r, h] · torus [R, tube, arcDeg?] · capsule [r, straightLength] · plane [w, d] · ring [R, tube]
// materials: keys of MATERIALS in src/props.js (or any CSS colour).
// attach: where it goes by default — 'rightHand' (hand props), 'body' (placed relative to a character,
//   e.g. a chair under them), or 'world' (scene dressing).
// grip: default placement when attached {mode: 'upright'|'aligned', offset: [x,y,z], rot: [deg]}.
//   Hand props: origin = grip point. 'upright' keeps the prop vertical in the character's facing;
//   'aligned' follows the hand bone (x runs along the forearm, outward).
// Floor props: origin at floor level, centred; front faces +Z.
//
// Conventions used below (right hand, bone frame in T-pose: forearm along -X, back of hand +Y, thumb +Z):
//   - Fist-held props (weapons, bats, umbrellas, mics...) are modelled standing up along +Y from the grip
//     and use rot [90,0,0], so the business end comes out of the thumb side of the fist.
//   - Pointer-like props (pens, chopsticks, forks, wands) use rot [0,0,90]: they continue past the fingertips.
//   - Props with a face (shield, pistol) are modelled facing +Z and use rot [0,-90,-90]: face/muzzle points
//     past the knuckles, top towards the thumb.
//   - Bags and other things carried at the side hang below the origin (the handle) and turn their broad
//     side outwards (rot [0,-90,0]) so the handle runs through the fist.
//   - Seats: grip.offset puts the seat under a sitting character whose hips are at the body origin.
//     The bed is sat on at its foot end (+Z); the futon is sat up in (legs under the cover).

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;
const r3 = (v) => Math.round(v * 1000) / 1000;

// Cylinder from point a to point b (radius r at a, r2 at b).
function seg(a, b, r, mat, r2 = r) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d);
  const n = d.map((v) => v / len);
  const rz = -Math.asin(n[0]) * R2D;
  const rx = Math.atan2(n[2], n[1]) * R2D;
  return ['cyl', [r2, r, r3(len)], a.map((v, i) => r3((v + b[i]) / 2)), [r3(rx), 0, r3(rz)], mat];
}

// Four box legs at (±x, ±z), standing on y0.
const legs4 = (x, z, h, t, mat, y0 = 0) =>
  [[x, z], [-x, z], [x, -z], [-x, -z]].map(([px, pz]) => ['box', [t, h, t], [px, r3(y0 + h / 2), pz], null, mat]);

// Grip presets (fresh arrays per prop).
const HOLD = () => ({ mode: 'upright', offset: [-0.03, -0.02, 0.03] }); // cupped hand
const PALM = () => ({ mode: 'upright', offset: [-0.02, -0.04, 0.05] }); // resting on the palm
const CARRY = () => ({ mode: 'upright', offset: [0, -0.07, 0], rot: [0, -90, 0] }); // hanging from the hand
const FIST = () => ({ mode: 'aligned', offset: [-0.06, -0.01, 0], rot: [90, 0, 0] });
const POINT = () => ({ mode: 'aligned', offset: [-0.07, -0.01, 0.02], rot: [0, 0, 90] });
const FACE = () => ({ mode: 'aligned', offset: [-0.06, -0.01, 0], rot: [0, -90, -90] });
const FLAT = () => ({ mode: 'aligned', offset: [-0.02, 0, 0.02], rot: [0, 0, 0] }); // like a phone

export const CATALOG = [
  // ---------------------------------------------------------------- furniture
  {
    id: 'chair', name: 'Chair', cat: 'furniture', attach: 'body',
    seat: 0.46, grip: { offset: [0, 0, 0.06] },
    parts: [
      ['box', [0.44, 0.04, 0.42], [0, 0.44, 0], null, 'wood'],
      ['box', [0.44, 0.3, 0.03], [0, 0.76, -0.2], null, 'wood'],
      ['box', [0.035, 0.45, 0.035], [0.19, 0.685, -0.2], null, 'darkWood'],
      ['box', [0.035, 0.45, 0.035], [-0.19, 0.685, -0.2], null, 'darkWood'],
      ...legs4(0.19, 0.18, 0.44, 0.035, 'darkWood'),
    ],
  },
  {
    id: 'stool', name: 'Stool', cat: 'furniture', attach: 'body',
    seat: 0.46, grip: { offset: [0, 0, 0.03] },
    parts: [
      ['cyl', [0.17, 0.17, 0.04], [0, 0.44, 0], null, 'wood'],
      seg([0.1, 0.42, 0.1], [0.14, 0, 0.14], 0.016, 'darkWood'),
      seg([-0.1, 0.42, 0.1], [-0.14, 0, 0.14], 0.016, 'darkWood'),
      seg([0.1, 0.42, -0.1], [0.14, 0, -0.14], 0.016, 'darkWood'),
      seg([-0.1, 0.42, -0.1], [-0.14, 0, -0.14], 0.016, 'darkWood'),
      ['torus', [0.172, 0.01], [0, 0.17, 0], [90, 0, 0], 'darkWood'],
    ],
  },
  {
    id: 'barStool', name: 'Bar stool', cat: 'furniture', attach: 'body',
    seat: 0.75, grip: { offset: [0, 0, 0.03] },
    parts: [
      ['cyl', [0.19, 0.18, 0.06], [0, 0.72, 0], null, 'leather'],
      ['cyl', [0.025, 0.025, 0.66], [0, 0.36, 0], null, 'metal'],
      ['cyl', [0.2, 0.23, 0.03], [0, 0.015, 0], null, 'darkMetal'],
      ['torus', [0.17, 0.012], [0, 0.3, 0], [90, 0, 0], 'metal'],
      ['box', [0.34, 0.012, 0.012], [0, 0.3, 0], null, 'metal'],
      ['box', [0.012, 0.012, 0.34], [0, 0.3, 0], null, 'metal'],
    ],
  },
  {
    id: 'armchair', name: 'Armchair', cat: 'furniture', attach: 'body',
    seat: 0.42, grip: { offset: [0, 0, 0.1] },
    parts: [
      ['box', [0.85, 0.24, 0.8], [0, 0.18, 0], null, 'green'],
      ['box', [0.85, 0.55, 0.18], [0, 0.575, -0.31], null, 'green'],
      ['box', [0.125, 0.32, 0.8], [0.3625, 0.46, 0], null, 'green'],
      ['box', [0.125, 0.32, 0.8], [-0.3625, 0.46, 0], null, 'green'],
      ['box', [0.6, 0.12, 0.6], [0, 0.36, 0.09], null, 'leaf'],
      ...legs4(0.36, 0.34, 0.06, 0.05, 'darkWood'),
    ],
  },
  {
    id: 'sofa', name: 'Sofa', cat: 'furniture', attach: 'body',
    seat: 0.42, grip: { offset: [0, 0, 0.01] },
    parts: [
      ['box', [2.0, 0.24, 0.9], [0, 0.18, 0], null, 'grey'],
      ['box', [2.0, 0.5, 0.2], [0, 0.55, -0.35], null, 'grey'],
      ['box', [0.18, 0.32, 0.9], [0.91, 0.46, 0], null, 'grey'],
      ['box', [0.18, 0.32, 0.9], [-0.91, 0.46, 0], null, 'grey'],
      ...[-0.55, 0, 0.55].map((x) => ['box', [0.545, 0.12, 0.68], [x, 0.36, 0.1], null, 'fabric']),
      ...[-0.55, 0, 0.55].map((x) => ['box', [0.54, 0.4, 0.12], [x, 0.6, -0.19], [-8, 0, 0], 'fabric']),
      ...legs4(0.9, 0.38, 0.06, 0.05, 'darkWood'),
    ],
  },
  {
    id: 'bench', name: 'Bench', cat: 'furniture', attach: 'body',
    seat: 0.45, grip: { offset: [0, 0, 0.05] },
    parts: [
      ['box', [1.5, 0.05, 0.38], [0, 0.425, 0], null, 'wood'],
      ['box', [0.05, 0.4, 0.34], [0.6, 0.2, 0], null, 'darkWood'],
      ['box', [0.05, 0.4, 0.34], [-0.6, 0.2, 0], null, 'darkWood'],
      ['box', [1.2, 0.05, 0.04], [0, 0.12, 0], null, 'darkWood'],
    ],
  },
  {
    id: 'parkBench', name: 'Park bench', cat: 'furniture', attach: 'body',
    seat: 0.45, grip: { offset: [0, 0, 0.08] },
    parts: [
      ...[-0.15, -0.05, 0.05, 0.15].map((z) => ['box', [1.6, 0.03, 0.09], [0, 0.435, z], null, 'wood']),
      ...[[0.58, -0.215], [0.69, -0.233], [0.8, -0.251]].map(([y, z]) => ['box', [1.6, 0.09, 0.025], [0, y, z], [-9, 0, 0], 'wood']),
      ...[0.7, -0.7].flatMap((x) => [
        ['box', [0.05, 0.64, 0.05], [x, 0.32, 0.17], null, 'darkMetal'],
        seg([x, 0, -0.2], [x, 0.86, -0.27], 0.025, 'darkMetal'),
        ['box', [0.05, 0.04, 0.48], [x, 0.66, -0.03], null, 'darkMetal'],
        ['box', [0.05, 0.05, 0.42], [x, 0.395, -0.01], null, 'darkMetal'],
      ]),
    ],
  },
  {
    id: 'table', name: 'Dining table', cat: 'furniture', attach: 'world',
    parts: [
      ['box', [1.4, 0.04, 0.8], [0, 0.73, 0], null, 'wood'],
      ['box', [1.3, 0.08, 0.7], [0, 0.67, 0], null, 'wood'],
      ...legs4(0.64, 0.34, 0.71, 0.06, 'darkWood'),
    ],
  },
  {
    id: 'desk', name: 'Desk', cat: 'furniture', attach: 'world',
    parts: [
      ['box', [1.2, 0.03, 0.6], [0, 0.725, 0], null, 'wood'],
      ['box', [0.42, 0.71, 0.56], [0.37, 0.355, 0], null, 'wood'],
      ...[0.585, 0.365, 0.145].flatMap((y) => [
        ['box', [0.38, 0.21, 0.012], [0.37, y, 0.284], null, 'lightWood'],
        ['box', [0.1, 0.015, 0.015], [0.37, y + 0.06, 0.297], null, 'metal'],
      ]),
      ['box', [0.04, 0.71, 0.56], [-0.58, 0.355, 0], null, 'wood'],
      ['box', [0.74, 0.35, 0.02], [-0.2, 0.52, -0.26], null, 'wood'],
    ],
  },
  {
    id: 'coffeeTable', name: 'Coffee table', cat: 'furniture', attach: 'world',
    parts: [
      ['box', [1.0, 0.04, 0.55], [0, 0.4, 0], null, 'darkWood'],
      ['box', [0.9, 0.02, 0.45], [0, 0.1, 0], null, 'darkWood'],
      ...legs4(0.45, 0.23, 0.38, 0.045, 'darkWood'),
    ],
  },
  {
    id: 'counter', name: 'Counter', cat: 'furniture', attach: 'world',
    parts: [
      ['box', [1.76, 0.08, 0.52], [0, 0.04, -0.02], null, 'black'],
      ['box', [1.8, 0.8, 0.58], [0, 0.48, 0], null, 'white'],
      ['box', [1.84, 0.04, 0.62], [0, 0.9, 0.01], null, 'stone'],
      ...[-0.6, 0, 0.6].flatMap((x) => [
        ['box', [0.57, 0.74, 0.012], [x, 0.48, 0.296], null, 'cream'],
        ['box', [0.14, 0.015, 0.02], [x, 0.8, 0.31], null, 'metal'],
      ]),
    ],
  },
  {
    id: 'bed', name: 'Bed', cat: 'furniture', attach: 'body',
    seat: 0.5, grip: { offset: [0, 0, -0.85] },
    parts: [
      ['box', [1.45, 0.2, 2.05], [0, 0.18, 0], null, 'wood'],
      ...legs4(0.68, 0.98, 0.08, 0.06, 'darkWood'),
      ['box', [1.4, 0.22, 2.0], [0, 0.39, 0], null, 'white'],
      ['box', [1.45, 0.95, 0.06], [0, 0.475, -1.03], null, 'wood'],
      ['box', [0.55, 0.12, 0.35], [0.32, 0.56, -0.78], null, 'cream'],
      ['box', [0.55, 0.12, 0.35], [-0.32, 0.56, -0.78], null, 'cream'],
      ['box', [1.44, 0.05, 1.45], [0, 0.525, 0.27], null, 'fabric'],
      ['box', [0.02, 0.25, 1.45], [0.725, 0.41, 0.27], null, 'fabric'],
      ['box', [0.02, 0.25, 1.45], [-0.725, 0.41, 0.27], null, 'fabric'],
      ['box', [1.44, 0.25, 0.02], [0, 0.41, 0.995], null, 'fabric'],
    ],
  },
  {
    id: 'futon', name: 'Futon', cat: 'furniture', attach: 'body',
    seat: 0.15, grip: { offset: [0, 0, 0.5] },
    parts: [
      ['box', [1.0, 0.1, 2.0], [0, 0.05, 0], null, 'white'],
      ['box', [1.04, 0.07, 1.45], [0, 0.135, 0.27], null, 'blue'],
      ['capsule', [0.04, 0.96], [0, 0.14, -0.455], [0, 0, 90], 'blue'],
      ['box', [0.5, 0.08, 0.3], [0, 0.14, -0.78], null, 'cream'],
    ],
  },
  {
    id: 'bookshelf', name: 'Bookshelf', cat: 'furniture', attach: 'world',
    parts: [
      ['box', [0.02, 1.8, 0.3], [0.39, 0.9, 0], null, 'wood'],
      ['box', [0.02, 1.8, 0.3], [-0.39, 0.9, 0], null, 'wood'],
      ['box', [0.8, 1.8, 0.01], [0, 0.9, -0.145], null, 'darkWood'],
      ...[0.03, 0.4, 0.76, 1.12, 1.48].map((y) => ['box', [0.76, 0.02, 0.29], [0, y, 0], null, 'wood']),
      ['box', [0.8, 0.02, 0.3], [0, 1.79, 0], null, 'wood'],
      ...[
        [0.04, -0.18, 0.36, 0.28, 'red'], [0.04, 0.2, 0.3, 0.25, 'blue'],
        [0.41, -0.24, 0.26, 0.26, 'green'], [0.41, 0.08, 0.26, 0.22, 'yellow'],
        [0.77, -0.1, 0.5, 0.24, 'brown'], [0.77, 0.27, 0.14, 0.27, 'purple'],
        [1.13, -0.22, 0.3, 0.25, 'blue'], [1.13, 0.16, 0.34, 0.21, 'red'],
      ].map(([y, x, w, h, m]) => ['box', [w, h, 0.22], [x, r3(y + h / 2), 0.02], null, m]),
    ],
  },
  {
    id: 'wardrobe', name: 'Wardrobe', cat: 'furniture', attach: 'world',
    parts: [
      ['box', [0.96, 0.05, 0.55], [0, 0.025, 0], null, 'darkWood'],
      ['box', [1.0, 1.85, 0.58], [0, 0.975, 0], null, 'wood'],
      ['box', [1.04, 0.04, 0.62], [0, 1.92, 0], null, 'darkWood'],
      ['box', [0.49, 1.8, 0.015], [0.25, 0.975, 0.295], null, 'lightWood'],
      ['box', [0.49, 1.8, 0.015], [-0.25, 0.975, 0.295], null, 'lightWood'],
      ['box', [0.015, 0.25, 0.02], [0.03, 1.05, 0.31], null, 'metal'],
      ['box', [0.015, 0.25, 0.02], [-0.03, 1.05, 0.31], null, 'metal'],
    ],
  },
  {
    id: 'cabinet', name: 'Chest of drawers', cat: 'furniture', attach: 'world',
    parts: [
      ['box', [0.8, 0.84, 0.45], [0, 0.48, 0], null, 'wood'],
      ['box', [0.82, 0.02, 0.47], [0, 0.91, 0], null, 'darkWood'],
      ...legs4(0.36, 0.19, 0.06, 0.04, 'darkWood'),
      ...[0.2, 0.48, 0.76].flatMap((y) => [
        ['box', [0.74, 0.26, 0.015], [0, y, 0.23], null, 'lightWood'],
        ['box', [0.14, 0.02, 0.02], [0, y, 0.245], null, 'metal'],
      ]),
    ],
  },
  {
    id: 'door', name: 'Door', cat: 'furniture', attach: 'world',
    parts: [
      ['box', [0.05, 2.05, 0.12], [0.425, 1.025, 0], null, 'darkWood'],
      ['box', [0.05, 2.05, 0.12], [-0.425, 1.025, 0], null, 'darkWood'],
      ['box', [0.9, 0.05, 0.12], [0, 2.025, 0], null, 'darkWood'],
      ['box', [0.8, 2.0, 0.04], [0, 1.0, 0], null, 'wood'],
      ['box', [0.6, 0.75, 0.012], [0, 1.45, 0.024], null, 'lightWood'],
      ['box', [0.6, 0.75, 0.012], [0, 0.55, 0.024], null, 'lightWood'],
      ['cyl', [0.03, 0.03, 0.01], [0.32, 1.0, 0.025], [90, 0, 0], 'gold'],
      ['sphere', [0.028], [0.32, 1.0, 0.055], null, 'gold'],
    ],
  },
  {
    id: 'floorLamp', name: 'Floor lamp', cat: 'furniture', attach: 'world',
    parts: [
      ['cyl', [0.15, 0.16, 0.03], [0, 0.015, 0], null, 'darkMetal'],
      ['cyl', [0.012, 0.012, 1.4], [0, 0.73, 0], null, 'darkMetal'],
      ['cyl', [0.13, 0.2, 0.28], [0, 1.5, 0], null, 'cream'],
      ['cyl', [0.19, 0.19, 0.004], [0, 1.358, 0], null, 'light'],
    ],
  },
  {
    id: 'deskLamp', name: 'Desk lamp', cat: 'furniture', attach: 'world',
    parts: [
      ['cyl', [0.08, 0.085, 0.025], [0, 0.0125, 0], null, 'darkMetal'],
      seg([0, 0.025, 0], [0, 0.33, -0.1], 0.008, 'darkMetal'),
      ['sphere', [0.015], [0, 0.33, -0.1], null, 'darkMetal'],
      seg([0, 0.33, -0.1], [0, 0.42, 0.18], 0.008, 'darkMetal'),
      ['sphere', [0.014], [0, 0.42, 0.18], null, 'darkMetal'],
      ['cone', [0.07, 0.12], [0, 0.376, 0.215], [-25, 0, 0], 'red'],
      ['sphere', [0.025], [0, 0.33, 0.236], null, 'light'],
    ],
  },
  {
    id: 'pillow', name: 'Pillow', cat: 'furniture', attach: 'world',
    parts: [
      ['box', [0.46, 0.12, 0.3], [0, 0.06, 0], null, 'white'],
      ['capsule', [0.06, 0.46], [0, 0.06, 0.15], [0, 0, 90], 'white'],
      ['capsule', [0.06, 0.46], [0, 0.06, -0.15], [0, 0, 90], 'white'],
      ['capsule', [0.06, 0.3], [0.23, 0.06, 0], [90, 0, 0], 'white'],
      ['capsule', [0.06, 0.3], [-0.23, 0.06, 0], [90, 0, 0], 'white'],
    ],
  },

  // ------------------------------------------------------------- food & drink
  {
    id: 'cup', name: 'Cup', cat: 'food & drink', attach: 'rightHand',
    grip: HOLD(),
    parts: [
      ['cyl', [0.04, 0.032, 0.09], [0, 0.03, 0], null, 'white'],
      ['cyl', [0.037, 0.037, 0.002], [0, 0.0755, 0], null, 'brown'],
      ['torus', [0.022, 0.006], [0.045, 0.035, 0], null, 'white'],
    ],
  },
  {
    id: 'teacup', name: 'Teacup & saucer', cat: 'food & drink', attach: 'rightHand',
    grip: PALM(),
    parts: [
      ['cyl', [0.07, 0.06, 0.01], [0, 0.005, 0], null, 'white'],
      ['cyl', [0.045, 0.03, 0.05], [0, 0.035, 0], null, 'white'],
      ['cyl', [0.043, 0.043, 0.002], [0, 0.0605, 0], null, '#a5582a'],
      ['torus', [0.044, 0.0025], [0, 0.06, 0], [90, 0, 0], 'gold'],
      ['torus', [0.016, 0.005], [0.05, 0.04, 0], null, 'white'],
    ],
  },
  {
    id: 'wineGlass', name: 'Wine glass', cat: 'food & drink', attach: 'rightHand',
    grip: HOLD(),
    parts: [
      ['cyl', [0.035, 0.035, 0.004], [0, -0.045, 0], null, 'glass'],
      ['cyl', [0.004, 0.004, 0.09], [0, 0, 0], null, 'glass'],
      ['hemi', [0.04], [0, 0.085, 0], [180, 0, 0], 'glass'],
      ['cyl', [0.034, 0.04, 0.05], [0, 0.11, 0], null, 'glass'],
      ['hemi', [0.036], [0, 0.085, 0], [180, 0, 0], '#7a1f2e'],
      ['cyl', [0.037, 0.037, 0.002], [0, 0.085, 0], null, '#7a1f2e'],
    ],
  },
  {
    id: 'beerMug', name: 'Beer mug', cat: 'food & drink', attach: 'rightHand',
    grip: HOLD(),
    parts: [
      ['cyl', [0.045, 0.045, 0.14], [0, 0.03, 0], null, 'glass'],
      ['cyl', [0.041, 0.041, 0.115], [0, 0.0175, 0], null, 'yellow'],
      ['cyl', [0.047, 0.046, 0.025], [0, 0.0925, 0], null, 'white'],
      ['cyl', [0.03, 0.044, 0.012], [0, 0.111, 0], null, 'white'],
      ['torus', [0.035, 0.009, 180], [0.045, 0.03, 0], [0, 0, -90], 'glass'],
    ],
  },
  {
    id: 'bottle', name: 'Bottle', cat: 'food & drink', attach: 'rightHand',
    grip: HOLD(),
    parts: [
      ['cyl', [0.035, 0.035, 0.18], [0, 0.03, 0], null, 'green'],
      ['cyl', [0.0355, 0.0355, 0.07], [0, 0.02, 0], null, 'paper'],
      ['cyl', [0.013, 0.035, 0.05], [0, 0.145, 0], null, 'green'],
      ['cyl', [0.013, 0.013, 0.06], [0, 0.2, 0], null, 'green'],
      ['cyl', [0.0145, 0.0145, 0.014], [0, 0.235, 0], null, 'gold'],
    ],
  },
  {
    id: 'can', name: 'Can', cat: 'food & drink', attach: 'rightHand',
    grip: HOLD(),
    parts: [
      ['cyl', [0.033, 0.033, 0.11], [0, 0.015, 0], null, 'red'],
      ['cyl', [0.0335, 0.0335, 0.02], [0, 0.025, 0], null, 'white'],
      ['cyl', [0.028, 0.033, 0.008], [0, 0.074, 0], null, 'metal'],
      ['cyl', [0.033, 0.028, 0.008], [0, -0.044, 0], null, 'metal'],
      ['box', [0.012, 0.002, 0.02], [0, 0.0785, 0.01], null, 'metal'],
    ],
  },
  {
    id: 'plate', name: 'Plate', cat: 'food & drink', attach: 'rightHand',
    grip: PALM(),
    parts: [
      ['cyl', [0.08, 0.075, 0.008], [0, 0.004, 0], null, 'white'],
      ['cyl', [0.12, 0.085, 0.012], [0, 0.012, 0], null, 'white'],
      ['torus', [0.112, 0.003], [0, 0.0185, 0], [90, 0, 0], 'blue'],
    ],
  },
  {
    id: 'bowl', name: 'Rice bowl', cat: 'food & drink', attach: 'rightHand',
    grip: PALM(),
    parts: [
      ['cyl', [0.03, 0.032, 0.012], [0, 0.006, 0], null, 'red'],
      ['hemi', [0.06], [0, 0.068, 0], [180, 0, 0], 'red'],
      ['torus', [0.058, 0.004], [0, 0.068, 0], [90, 0, 0], 'red'],
      ['hemi', [0.056], [0, 0.045, 0], null, 'white'],
    ],
  },
  {
    id: 'chopsticks', name: 'Chopsticks', cat: 'food & drink', attach: 'rightHand',
    grip: POINT(),
    parts: [
      seg([0.009, -0.08, 0], [0.002, 0.15, 0.004], 0.0045, 'red', 0.0025),
      seg([-0.006, -0.08, 0.004], [0.002, 0.15, -0.002], 0.0045, 'red', 0.0025),
    ],
  },
  {
    id: 'fork', name: 'Fork', cat: 'food & drink', attach: 'rightHand',
    grip: POINT(),
    parts: [
      ['box', [0.016, 0.12, 0.004], [0, -0.02, 0], null, 'metal'],
      ['box', [0.01, 0.03, 0.004], [0, 0.055, 0], null, 'metal'],
      ['box', [0.026, 0.02, 0.003], [0, 0.078, 0], null, 'metal'],
      ...[-0.0105, -0.0035, 0.0035, 0.0105].map((x) => ['box', [0.004, 0.04, 0.003], [x, 0.106, 0], null, 'metal']),
    ],
  },
  {
    id: 'burger', name: 'Burger', cat: 'food & drink', attach: 'rightHand',
    grip: HOLD(),
    parts: [
      ['cyl', [0.055, 0.05, 0.025], [0, -0.0275, 0], null, 'bread'],
      ['cyl', [0.058, 0.058, 0.02], [0, -0.005, 0], null, 'meat'],
      ['box', [0.1, 0.004, 0.1], [0, 0.007, 0], [0, 45, 0], 'yellow'],
      ['cyl', [0.063, 0.063, 0.006], [0, 0.012, 0], null, 'leaf'],
      ['cyl', [0.05, 0.05, 0.008], [0, 0.018, 0], null, 'red'],
      ['cyl', [0.046, 0.056, 0.02], [0, 0.032, 0], null, 'bread'],
      ['cyl', [0.026, 0.046, 0.016], [0, 0.05, 0], null, 'bread'],
    ],
  },
  {
    id: 'sandwich', name: 'Sandwich', cat: 'food & drink', attach: 'rightHand',
    grip: HOLD(),
    parts: [
      ['cyl', [0.07, 0.07, 0.012, 3], [0, 0.03, -0.014], [-90, 0, 0], 'cream'],
      ['cyl', [0.067, 0.067, 0.012, 3], [0, 0.03, -0.002], [-90, 0, 0], 'yellow'],
      ['cyl', [0.069, 0.069, 0.004, 3], [0, 0.03, 0.006], [-90, 0, 0], 'leaf'],
      ['cyl', [0.07, 0.07, 0.012, 3], [0, 0.03, 0.014], [-90, 0, 0], 'cream'],
    ],
  },
  {
    id: 'pizzaSlice', name: 'Pizza slice', cat: 'food & drink', attach: 'rightHand',
    grip: HOLD(),
    parts: [
      ['cyl', [0.12, 0.12, 0.01, 3], [0, 0, 0.06], null, 'bread'],
      ['cyl', [0.105, 0.105, 0.004, 3], [0, 0.006, 0.062], null, 'yellow'],
      ['capsule', [0.013, 0.19], [0, 0.006, 0.003], [0, 0, 90], 'bread'],
      ['cyl', [0.016, 0.016, 0.004], [0, 0.009, 0.11], null, 'red'],
      ['cyl', [0.016, 0.016, 0.004], [-0.035, 0.009, 0.04], null, 'red'],
      ['cyl', [0.016, 0.016, 0.004], [0.035, 0.009, 0.05], null, 'red'],
    ],
  },
  {
    id: 'apple', name: 'Apple', cat: 'food & drink', attach: 'rightHand',
    grip: HOLD(),
    parts: [
      ['sphere', [0.04], [0, 0, 0], null, 'red'],
      ['cyl', [0.002, 0.003, 0.022], [0.002, 0.045, 0], [0, 0, -10], 'brown'],
      ['box', [0.022, 0.002, 0.011], [0.014, 0.046, 0], [0, 0, 20], 'leaf'],
    ],
  },
  {
    id: 'iceCream', name: 'Ice cream cone', cat: 'food & drink', attach: 'rightHand',
    grip: HOLD(),
    parts: [
      ['cone', [0.03, 0.11], [0, 0, 0], [180, 0, 0], 'bread'],
      ['cyl', [0.033, 0.031, 0.012], [0, 0.058, 0], null, 'bread'],
      ['sphere', [0.033], [0, 0.082, 0], null, 'cream'],
      ['sphere', [0.03], [0, 0.125, 0], null, 'pink'],
      ['sphere', [0.009], [0, 0.16, 0], null, 'red'],
    ],
  },
  {
    id: 'cake', name: 'Cake', cat: 'food & drink', attach: 'rightHand',
    grip: PALM(),
    parts: [
      ['cyl', [0.13, 0.12, 0.01], [0, 0.005, 0], null, 'white'],
      ['cyl', [0.1, 0.1, 0.08], [0, 0.05, 0], null, 'white'],
      ['cyl', [0.1005, 0.1005, 0.012], [0, 0.045, 0], null, 'yellow'],
      ['torus', [0.088, 0.008], [0, 0.09, 0], [90, 0, 0], 'cream'],
      ...[0, 60, 120, 180, 240, 300].map((a) => ['cone', [0.012, 0.024], [r3(0.075 * Math.sin(a * D2R)), 0.102, r3(0.075 * Math.cos(a * D2R))], null, 'red']),
    ],
  },

  // --------------------------------------------------------------------- tech
  {
    id: 'phone', name: 'Smartphone', cat: 'tech', attach: 'rightHand',
    grip: FLAT(),
    parts: [['box', [0.075, 0.15, 0.009], [0, 0.04, 0], null, 'black'], ['box', [0.068, 0.138, 0.002], [0, 0.04, 0.005], null, 'screen']],
  },
  {
    id: 'laptop', name: 'Laptop', cat: 'tech', attach: 'world',
    parts: [
      ['box', [0.32, 0.018, 0.22], [0, 0.009, 0], null, 'metal'],
      ['box', [0.28, 0.002, 0.1], [0, 0.019, -0.03], null, 'black'],
      ['box', [0.09, 0.002, 0.06], [0, 0.019, 0.065], null, 'grey'],
      ['box', [0.32, 0.21, 0.008], [0, 0.119, -0.137], [-15, 0, 0], 'metal'],
      ['box', [0.3, 0.19, 0.002], [0, 0.12, -0.132], [-15, 0, 0], 'screen'],
    ],
  },
  {
    id: 'tablet', name: 'Tablet', cat: 'tech', attach: 'rightHand',
    grip: { mode: 'aligned', offset: [-0.03, 0, 0.02], rot: [0, 0, 0] },
    parts: [
      ['box', [0.17, 0.245, 0.007], [0, 0.09, 0], null, 'darkMetal'],
      ['box', [0.155, 0.225, 0.002], [0, 0.09, 0.0045], null, 'screen'],
    ],
  },
  {
    id: 'camera', name: 'Camera', cat: 'tech', attach: 'rightHand',
    grip: { mode: 'upright', offset: [-0.02, 0, 0.04] },
    parts: [
      ['box', [0.13, 0.085, 0.065], [0.05, 0, 0], null, 'black'],
      ['box', [0.035, 0.085, 0.075], [0, 0, 0.008], null, 'rubber'],
      ['cyl', [0.034, 0.034, 0.07], [0.055, -0.005, 0.065], [90, 0, 0], 'darkMetal'],
      ['cyl', [0.036, 0.036, 0.012], [0.055, -0.005, 0.09], [90, 0, 0], 'black'],
      ['cyl', [0.026, 0.026, 0.002], [0.055, -0.005, 0.1], [90, 0, 0], 'screen'],
      ['box', [0.045, 0.03, 0.05], [0.055, 0.055, 0], null, 'black'],
      ['cyl', [0.007, 0.007, 0.006], [0.0, 0.045, 0.01], null, 'metal'],
      ['box', [0.07, 0.05, 0.002], [0.06, 0, -0.033], null, 'screen'],
    ],
  },
  {
    id: 'headphones', name: 'Headphones', cat: 'tech', attach: 'rightHand',
    grip: { mode: 'upright', offset: [-0.02, -0.04, 0] },
    parts: [
      ['torus', [0.1, 0.012, 180], [0, -0.105, 0], null, 'black'],
      ['cyl', [0.045, 0.045, 0.035], [0.11, -0.15, 0], [0, 0, 90], 'darkMetal'],
      ['cyl', [0.045, 0.045, 0.035], [-0.11, -0.15, 0], [0, 0, 90], 'darkMetal'],
      ['cyl', [0.04, 0.04, 0.02], [0.085, -0.15, 0], [0, 0, 90], 'black'],
      ['cyl', [0.04, 0.04, 0.02], [-0.085, -0.15, 0], [0, 0, 90], 'black'],
      ['box', [0.01, 0.03, 0.015], [0.1, -0.11, 0], null, 'metal'],
      ['box', [0.01, 0.03, 0.015], [-0.1, -0.11, 0], null, 'metal'],
    ],
  },
  {
    id: 'microphone', name: 'Microphone', cat: 'tech', attach: 'rightHand',
    grip: FIST(),
    parts: [
      ['cyl', [0.017, 0.012, 0.16], [0, 0, 0], null, 'black'],
      ['cyl', [0.024, 0.018, 0.025], [0, 0.092, 0], null, 'darkMetal'],
      ['sphere', [0.028], [0, 0.12, 0], null, 'metal'],
      ['cyl', [0.0285, 0.0285, 0.008], [0, 0.112, 0], null, 'darkMetal'],
    ],
  },
  {
    id: 'tv', name: 'TV', cat: 'tech', attach: 'world',
    parts: [
      ['box', [0.4, 0.015, 0.2], [0, 0.0075, 0], null, 'darkMetal'],
      ['box', [0.06, 0.1, 0.03], [0, 0.065, -0.01], null, 'darkMetal'],
      ['box', [0.97, 0.57, 0.04], [0, 0.385, 0], null, 'black'],
      ['box', [0.93, 0.53, 0.002], [0, 0.385, 0.021], null, 'screen'],
    ],
  },
  {
    id: 'gameController', name: 'Game controller', cat: 'tech', attach: 'rightHand',
    grip: { mode: 'upright', offset: [0.04, -0.02, 0.06] },
    parts: [
      ['capsule', [0.024, 0.1], [0, 0, 0], [0, 0, 90], 'darkMetal'],
      ['box', [0.08, 0.03, 0.03], [0, -0.004, -0.015], null, 'darkMetal'],
      ['capsule', [0.024, 0.05], [0.058, -0.014, -0.04], [65, 0, -15], 'darkMetal'],
      ['capsule', [0.024, 0.05], [-0.058, -0.014, -0.04], [65, 0, 15], 'darkMetal'],
      ['box', [0.026, 0.006, 0.008], [-0.045, 0.022, 0.003], null, 'black'],
      ['box', [0.008, 0.006, 0.026], [-0.045, 0.022, 0.003], null, 'black'],
      ['sphere', [0.0055], [0.045, 0.021, 0.012], null, 'red'],
      ['sphere', [0.0055], [0.055, 0.019, 0.002], null, 'blue'],
      ['sphere', [0.0055], [0.045, 0.021, -0.008], null, 'green'],
      ['sphere', [0.0055], [0.035, 0.021, 0.002], null, 'yellow'],
      ['cyl', [0.01, 0.01, 0.012], [-0.017, 0.022, -0.006], null, 'black'],
      ['cyl', [0.01, 0.01, 0.012], [0.017, 0.022, -0.006], null, 'black'],
    ],
  },
  {
    id: 'monitor', name: 'Monitor', cat: 'tech', attach: 'world',
    parts: [
      ['box', [0.22, 0.012, 0.17], [0, 0.006, 0], null, 'darkMetal'],
      ['box', [0.05, 0.22, 0.02], [0, 0.12, -0.05], null, 'darkMetal'],
      ['box', [0.6, 0.36, 0.03], [0, 0.29, -0.025], null, 'black'],
      ['box', [0.58, 0.34, 0.002], [0, 0.29, -0.009], null, 'screen'],
    ],
  },
  {
    id: 'radio', name: 'Radio', cat: 'tech', attach: 'rightHand',
    grip: CARRY(),
    parts: [
      ['box', [0.3, 0.17, 0.09], [0, -0.155, 0], null, 'red'],
      ['torus', [0.06, 0.008, 180], [0, -0.07, 0], null, 'black'],
      ['cyl', [0.05, 0.05, 0.01], [0.08, -0.165, 0.046], [90, 0, 0], 'darkMetal'],
      ['cyl', [0.05, 0.05, 0.01], [-0.08, -0.165, 0.046], [90, 0, 0], 'darkMetal'],
      ['cyl', [0.016, 0.016, 0.01], [0.08, -0.165, 0.05], [90, 0, 0], 'black'],
      ['cyl', [0.016, 0.016, 0.01], [-0.08, -0.165, 0.05], [90, 0, 0], 'black'],
      ['box', [0.07, 0.025, 0.004], [0, -0.1, 0.046], null, 'cream'],
      ['cyl', [0.01, 0.01, 0.01], [0, -0.17, 0.048], [90, 0, 0], 'cream'],
      ['cyl', [0.01, 0.01, 0.01], [0, -0.205, 0.048], [90, 0, 0], 'cream'],
      seg([-0.12, -0.07, -0.025], [-0.17, 0.2, -0.025], 0.003, 'metal'),
    ],
  },

  // -------------------------------------------------------------------- paper
  {
    id: 'book', name: 'Book', cat: 'paper', attach: 'rightHand',
    grip: FLAT(),
    parts: [
      ['box', [0.15, 0.22, 0.003], [0, 0.07, 0.0135], null, 'blue'],
      ['box', [0.15, 0.22, 0.003], [0, 0.07, -0.0135], null, 'blue'],
      ['box', [0.006, 0.22, 0.03], [-0.073, 0.07, 0], null, 'blue'],
      ['box', [0.144, 0.214, 0.024], [0.003, 0.07, 0], null, 'paper'],
      ['box', [0.1, 0.02, 0.001], [0.005, 0.13, 0.0155], null, 'gold'],
    ],
  },
  {
    id: 'openBook', name: 'Open book', cat: 'paper', attach: 'rightHand',
    grip: { mode: 'upright', offset: [0.14, -0.02, 0.08], rot: [-40, 0, 0] },
    parts: [
      ['box', [0.155, 0.004, 0.23], [-0.076, 0.013, 0], [0, 0, -8], 'red'],
      ['box', [0.155, 0.004, 0.23], [0.076, 0.013, 0], [0, 0, 8], 'red'],
      ['box', [0.146, 0.016, 0.22], [-0.075, 0.023, 0], [0, 0, -8], 'paper'],
      ['box', [0.146, 0.016, 0.22], [0.075, 0.023, 0], [0, 0, 8], 'paper'],
      ['cyl', [0.008, 0.008, 0.23], [0, 0.006, 0], [90, 0, 0], 'red'],
    ],
  },
  {
    id: 'notebook', name: 'Notebook', cat: 'paper', attach: 'rightHand',
    grip: FLAT(),
    parts: [
      ['box', [0.15, 0.21, 0.002], [0, 0.07, 0.004], null, 'green'],
      ['box', [0.15, 0.21, 0.002], [0, 0.07, -0.004], null, 'green'],
      ['box', [0.146, 0.206, 0.006], [0.002, 0.07, 0], null, 'paper'],
      ['box', [0.08, 0.03, 0.001], [0.01, 0.12, 0.0055], null, 'white'],
      ...[-0.09, -0.06, -0.03, 0, 0.03, 0.06, 0.09].map((y) => ['torus', [0.007, 0.0012], [-0.073, r3(0.07 + y), 0], [90, 0, 0], 'metal']),
    ],
  },
  {
    id: 'pen', name: 'Pen', cat: 'paper', attach: 'rightHand',
    grip: POINT(),
    parts: [
      ['cyl', [0.0055, 0.0055, 0.11], [0, -0.03, 0], null, 'blue'],
      ['cyl', [0.0062, 0.0062, 0.03], [0, 0.035, 0], null, 'rubber'],
      ['cone', [0.0055, 0.016], [0, 0.058, 0], null, 'metal'],
      ['cyl', [0.006, 0.006, 0.012], [0, -0.09, 0], null, 'black'],
      ['box', [0.002, 0.035, 0.003], [0, -0.065, 0.0075], null, 'metal'],
    ],
  },
  {
    id: 'envelope', name: 'Envelope', cat: 'paper', attach: 'rightHand',
    grip: FLAT(),
    parts: [
      ['box', [0.22, 0.11, 0.003], [0, 0.05, 0], null, 'white'],
      ['box', [0.125, 0.003, 0.001], [-0.055, 0.075, 0.002], [0, 0, -28.6], 'grey'],
      ['box', [0.125, 0.003, 0.001], [0.055, 0.075, 0.002], [0, 0, 28.6], 'grey'],
      ['cyl', [0.012, 0.012, 0.002], [0, 0.045, 0.002], [90, 0, 0], 'red'],
    ],
  },
  {
    id: 'newspaper', name: 'Newspaper', cat: 'paper', attach: 'rightHand',
    grip: { mode: 'upright', offset: [0, 0, 0.03] },
    parts: [
      ['box', [0.3, 0.42, 0.006], [0.15, 0, 0], null, 'paper'],
      ['box', [0.26, 0.045, 0.001], [0.15, 0.17, 0.0035], null, 'black'],
      ['box', [0.12, 0.1, 0.001], [0.08, 0.08, 0.0035], null, 'grey'],
      ['box', [0.11, 0.1, 0.001], [0.215, 0.08, 0.0035], null, '#c4beb0'],
      ['box', [0.26, 0.014, 0.001], [0.15, 0.0, 0.0035], null, 'black'],
      ['box', [0.12, 0.15, 0.001], [0.08, -0.1, 0.0035], null, '#c4beb0'],
      ['box', [0.12, 0.15, 0.001], [0.22, -0.1, 0.0035], null, '#c4beb0'],
    ],
  },
  {
    id: 'clipboard', name: 'Clipboard', cat: 'paper', attach: 'rightHand',
    grip: { mode: 'aligned', offset: [-0.03, 0, 0.02], rot: [0, 0, 0] },
    parts: [
      ['box', [0.23, 0.32, 0.006], [0, 0.12, 0], null, 'wood'],
      ['box', [0.21, 0.27, 0.001], [0, 0.1, 0.0035], null, 'paper'],
      ['box', [0.09, 0.035, 0.012], [0, 0.26, 0.006], null, 'metal'],
      ...[0.2, 0.17, 0.14, 0.11].map((y) => ['box', [0.16, 0.006, 0.001], [0, y, 0.0042], null, 'grey']),
    ],
  },
  {
    id: 'scroll', name: 'Scroll', cat: 'paper', attach: 'rightHand',
    grip: { mode: 'aligned', offset: [-0.06, -0.01, 0], rot: [0, 90, 0] },
    parts: [
      ['cyl', [0.025, 0.025, 0.24], [0, 0, 0], [0, 0, 90], 'cream'],
      ['cyl', [0.007, 0.007, 0.29], [0, 0, 0], [0, 0, 90], 'darkWood'],
      ['sphere', [0.012], [0.147, 0, 0], null, 'darkWood'],
      ['sphere', [0.012], [-0.147, 0, 0], null, 'darkWood'],
      ['torus', [0.026, 0.003], [0.04, 0, 0], [0, 90, 0], 'red'],
    ],
  },

  // ------------------------------------------------------------------ weapons
  {
    id: 'sword', name: 'Sword', cat: 'weapons', attach: 'rightHand',
    grip: FIST(),
    parts: [
      ['cyl', [0.014, 0.014, 0.18], [0, -0.03, 0], null, 'leather'],
      ['sphere', [0.025], [0, -0.135, 0], null, 'gold'],
      ['box', [0.2, 0.025, 0.035], [0, 0.07, 0], null, 'gold'],
      ['box', [0.05, 0.75, 0.008], [0, 0.4575, 0], null, 'metal'],
      ['box', [0.0354, 0.0354, 0.008], [0, 0.8325, 0], [0, 0, 45], 'metal'],
      ['box', [0.012, 0.6, 0.0085], [0, 0.4, 0], null, 'grey'],
    ],
  },
  {
    id: 'katana', name: 'Katana', cat: 'weapons', attach: 'rightHand',
    grip: FIST(),
    parts: [
      ['box', [0.032, 0.24, 0.024], [0, -0.045, 0], null, 'black'],
      ['box', [0.034, 0.015, 0.026], [0, -0.172, 0], null, 'darkMetal'],
      ...[-0.14, -0.09, -0.04, 0.01].map((y) => ['box', [0.012, 0.012, 0.0255], [0, y, 0], [0, 0, 45], 'cream']),
      ['cyl', [0.042, 0.042, 0.008], [0, 0.08, 0], null, 'darkMetal'],
      ['box', [0.03, 0.025, 0.012], [0, 0.0965, 0], null, 'gold'],
      ['box', [0.03, 0.25, 0.007], [0, 0.225, 0], null, 'metal'],
      ['box', [0.029, 0.25, 0.007], [-0.0063, 0.4598, 0], [0, 0, 3], 'metal'],
      ['box', [0.027, 0.235, 0.007], [-0.026, 0.6889, 0], [0, 0, 7], 'metal'],
      ['box', [0.019, 0.019, 0.007], [-0.0394, 0.798, 0], [0, 0, 52], 'metal'],
    ],
  },
  {
    id: 'dagger', name: 'Dagger', cat: 'weapons', attach: 'rightHand',
    grip: FIST(),
    parts: [
      ['cyl', [0.012, 0.012, 0.1], [0, -0.01, 0], null, 'leather'],
      ['sphere', [0.016], [0, -0.065, 0], null, 'metal'],
      ['box', [0.08, 0.015, 0.022], [0, 0.0475, 0], null, 'metal'],
      ['box', [0.034, 0.16, 0.006], [0, 0.135, 0], null, 'metal'],
      ['box', [0.024, 0.024, 0.006], [0, 0.215, 0], [0, 0, 45], 'metal'],
    ],
  },
  {
    id: 'bow', name: 'Bow', cat: 'weapons', attach: 'rightHand',
    grip: FIST(),
    parts: [
      ['torus', [1.4, 0.012, 55.4], [1.4, 0, 0], [0, 0, 152.3], 'wood'],
      ['cyl', [0.0015, 0.0015, 1.3], [0.161, 0, 0], null, 'white'],
      ['cyl', [0.018, 0.018, 0.12], [0, 0, 0], null, 'leather'],
      ['sphere', [0.012], [0.161, 0.651, 0], null, 'darkWood'],
      ['sphere', [0.012], [0.161, -0.651, 0], null, 'darkWood'],
    ],
  },
  {
    id: 'arrow', name: 'Arrow', cat: 'weapons', attach: 'rightHand',
    grip: FIST(),
    parts: [
      ['cyl', [0.004, 0.004, 0.76], [0, 0.25, 0], null, 'lightWood'],
      ['cone', [0.011, 0.045, 4], [0, 0.652, 0], null, 'darkMetal'],
      ...[0, 120, 240].map((a) => ['box', [0.0015, 0.09, 0.022], [r3(0.015 * Math.sin(a * D2R)), -0.08, r3(0.015 * Math.cos(a * D2R))], [0, a, 0], 'red']),
      ['cyl', [0.005, 0.005, 0.012], [0, -0.136, 0], null, 'yellow'],
    ],
  },
  {
    id: 'staff', name: 'Staff', cat: 'weapons', attach: 'rightHand',
    grip: FIST(),
    parts: [
      ['cyl', [0.018, 0.022, 1.6], [0, -0.15, 0], null, 'wood'],
      ['cyl', [0.023, 0.02, 0.04], [0, -0.95, 0], null, 'darkMetal'],
      ['cyl', [0.03, 0.02, 0.05], [0, 0.67, 0], null, 'gold'],
      ['sphere', [0.045], [0, 0.75, 0], null, 'blue'],
      ...[0, 120, 240].map((a) => seg(
        [r3(0.02 * Math.cos(a * D2R)), 0.69, r3(0.02 * Math.sin(a * D2R))],
        [r3(0.045 * Math.cos(a * D2R)), 0.8, r3(0.045 * Math.sin(a * D2R))], 0.006, 'gold')),
    ],
  },
  {
    id: 'shield', name: 'Shield', cat: 'weapons', attach: 'rightHand',
    grip: FACE(),
    parts: [
      ['cyl', [0.3, 0.3, 0.03], [0, 0, 0.06], [90, 0, 0], 'wood'],
      ['box', [0.56, 0.07, 0.004], [0, 0, 0.076], [0, 0, 45], 'red'],
      ['box', [0.56, 0.07, 0.004], [0, 0, 0.076], [0, 0, -45], 'red'],
      ['torus', [0.3, 0.016], [0, 0, 0.06], null, 'metal'],
      ['hemi', [0.07], [0, 0, 0.075], [90, 0, 0], 'metal'],
      ['box', [0.025, 0.13, 0.03], [0, 0, 0.03], null, 'darkWood'],
    ],
  },
  {
    id: 'spear', name: 'Spear', cat: 'weapons', attach: 'rightHand',
    grip: FIST(),
    parts: [
      ['cyl', [0.015, 0.016, 1.9], [0, 0.15, 0], null, 'wood'],
      ['cyl', [0.018, 0.016, 0.04], [0, -0.8, 0], null, 'darkMetal'],
      ['cyl', [0.035, 0.02, 0.06], [0, 1.03, 0], null, 'red'],
      ['cyl', [0.02, 0.017, 0.07], [0, 1.09, 0], null, 'metal'],
      ['cone', [0.028, 0.24, 6], [0, 1.23, 0], null, 'metal'],
    ],
  },
  {
    id: 'axe', name: 'Axe', cat: 'weapons', attach: 'rightHand',
    grip: FIST(),
    parts: [
      ['cyl', [0.017, 0.02, 0.7], [0, 0.15, 0], null, 'wood'],
      ['cyl', [0.022, 0.02, 0.03], [0, -0.21, 0], null, 'wood'],
      ['box', [0.045, 0.09, 0.035], [0, 0.43, 0], null, 'darkMetal'],
      ['cyl', [0.12, 0.12, 0.012, 3], [-0.06, 0.43, 0], [90, 90, 0], 'metal'],
      ['box', [0.008, 0.2, 0.013], [-0.117, 0.43, 0], null, 'white'],
      ['box', [0.035, 0.06, 0.03], [0.035, 0.43, 0], null, 'darkMetal'],
    ],
  },
  {
    id: 'hammer', name: 'Hammer', cat: 'weapons', attach: 'rightHand',
    grip: FIST(),
    parts: [
      ['cyl', [0.014, 0.016, 0.3], [0, 0.04, 0], null, 'wood'],
      ['cyl', [0.017, 0.017, 0.11], [0, -0.05, 0], null, 'rubber'],
      ['box', [0.1, 0.028, 0.028], [0, 0.205, 0], null, 'darkMetal'],
      ['cyl', [0.017, 0.017, 0.03], [-0.06, 0.205, 0], [0, 0, 90], 'darkMetal'],
      seg([0.045, 0.205, 0], [0.1, 0.17, 0], 0.01, 'darkMetal', 0.006),
    ],
  },
  {
    id: 'pistol', name: 'Pistol', cat: 'weapons', attach: 'rightHand',
    grip: FACE(),
    parts: [
      ['box', [0.028, 0.1, 0.042], [0, 0, 0], [15, 0, 0], 'black'],
      ['box', [0.028, 0.034, 0.19], [0, 0.07, 0.045], null, 'darkMetal'],
      ['box', [0.026, 0.022, 0.11], [0, 0.043, 0.08], null, 'black'],
      ['torus', [0.018, 0.004], [0, 0.03, 0.055], [0, 90, 0], 'black'],
      ['box', [0.006, 0.018, 0.006], [0, 0.03, 0.05], null, 'black'],
      ['cyl', [0.006, 0.006, 0.004], [0, 0.072, 0.141], [90, 0, 0], 'black'],
    ],
  },
  {
    id: 'wand', name: 'Magic wand', cat: 'weapons', attach: 'rightHand',
    grip: POINT(),
    parts: [
      ['cyl', [0.004, 0.007, 0.26], [0, 0.1, 0], null, 'darkWood'],
      ['cyl', [0.009, 0.008, 0.09], [0, -0.035, 0], null, 'brown'],
      ['sphere', [0.01], [0, -0.082, 0], null, 'gold'],
      ['torus', [0.009, 0.002], [0, 0.01, 0], [90, 0, 0], 'gold'],
      ['sphere', [0.007], [0, 0.233, 0], null, 'light'],
    ],
  },

  // --------------------------------------------------------- hobbies & sports
  {
    id: 'ball', name: 'Ball', cat: 'hobbies & sports', attach: 'rightHand',
    grip: PALM(),
    parts: [
      ['sphere', [0.11], [0, 0.11, 0], null, 'red'],
      ['ring', [0.1102, 0.004], [0, 0.11, 0], [90, 0, 0], 'white'],
      ['ring', [0.1102, 0.004], [0, 0.11, 0], null, 'white'],
      ['ring', [0.1102, 0.004], [0, 0.11, 0], [0, 90, 0], 'white'],
    ],
  },
  {
    id: 'basketball', name: 'Basketball', cat: 'hobbies & sports', attach: 'rightHand',
    grip: PALM(),
    parts: [
      ['sphere', [0.12], [0, 0.12, 0], null, 'orange'],
      ['ring', [0.1205, 0.0025], [0, 0.12, 0], [90, 0, 0], 'black'],
      ['ring', [0.1205, 0.0025], [0, 0.12, 0], null, 'black'],
      ['ring', [0.1205, 0.0025], [0, 0.12, 0], [0, 90, 0], 'black'],
    ],
  },
  {
    id: 'baseballBat', name: 'Baseball bat', cat: 'hobbies & sports', attach: 'rightHand',
    grip: FIST(),
    parts: [
      ['cyl', [0.022, 0.022, 0.015], [0, -0.1, 0], null, 'lightWood'],
      ['cyl', [0.0145, 0.0145, 0.12], [0, -0.035, 0], null, 'black'],
      ['cyl', [0.0135, 0.012, 0.18], [0, 0.11, 0], null, 'lightWood'],
      ['cyl', [0.031, 0.0135, 0.25], [0, 0.325, 0], null, 'lightWood'],
      ['cyl', [0.033, 0.031, 0.25], [0, 0.575, 0], null, 'lightWood'],
      ['hemi', [0.033], [0, 0.7, 0], null, 'lightWood'],
    ],
  },
  {
    id: 'tennisRacket', name: 'Tennis racket', cat: 'hobbies & sports', attach: 'rightHand',
    grip: FIST(),
    parts: [
      ['cyl', [0.016, 0.016, 0.18, 8], [0, 0, 0], null, 'black'],
      ['cyl', [0.018, 0.018, 0.01, 8], [0, -0.095, 0], null, 'black'],
      seg([0, 0.085, 0], [0.06, 0.265, 0], 0.009, 'blue'),
      seg([0, 0.085, 0], [-0.06, 0.265, 0], 0.009, 'blue'),
      ['torus', [0.13, 0.009], [0, 0.38, 0], null, 'blue'],
      ...[-0.08, -0.04, 0, 0.04, 0.08].map((x) => ['box', [0.002, r3(2 * Math.sqrt(0.13 ** 2 - x * x)), 0.002], [x, 0.38, 0], null, 'white']),
      ...[-0.08, -0.04, 0, 0.04, 0.08].map((y) => ['box', [r3(2 * Math.sqrt(0.13 ** 2 - y * y)), 0.002, 0.002], [0, r3(0.38 + y), 0], null, 'white']),
    ],
  },
  {
    id: 'skateboard', name: 'Skateboard', cat: 'hobbies & sports', attach: 'world',
    parts: [
      ['box', [0.8, 0.014, 0.2], [0, 0.09, 0], null, 'wood'],
      ['box', [0.12, 0.014, 0.2], [0.458, 0.1055, 0], [0, 0, 15], 'wood'],
      ['box', [0.12, 0.014, 0.2], [-0.458, 0.1055, 0], [0, 0, -15], 'wood'],
      ['box', [0.04, 0.025, 0.16], [0.28, 0.07, 0], null, 'metal'],
      ['box', [0.04, 0.025, 0.16], [-0.28, 0.07, 0], null, 'metal'],
      ...[[0.28, 0.085], [0.28, -0.085], [-0.28, 0.085], [-0.28, -0.085]].map(([x, z]) => ['cyl', [0.027, 0.027, 0.035], [x, 0.027, z], [90, 0, 0], 'cream']),
    ],
  },
  {
    id: 'dumbbell', name: 'Dumbbell', cat: 'hobbies & sports', attach: 'rightHand',
    grip: { mode: 'aligned', offset: [-0.06, -0.01, 0], rot: [0, 90, 0] },
    parts: [
      ['cyl', [0.016, 0.016, 0.14], [0, 0, 0], [0, 0, 90], 'metal'],
      ['cyl', [0.06, 0.06, 0.04, 6], [0.09, 0, 0], [0, 0, 90], 'black'],
      ['cyl', [0.06, 0.06, 0.04, 6], [-0.09, 0, 0], [0, 0, 90], 'black'],
      ['cyl', [0.05, 0.05, 0.03, 6], [0.125, 0, 0], [0, 0, 90], 'black'],
      ['cyl', [0.05, 0.05, 0.03, 6], [-0.125, 0, 0], [0, 0, 90], 'black'],
      ['cyl', [0.02, 0.02, 0.01], [0.145, 0, 0], [0, 0, 90], 'metal'],
      ['cyl', [0.02, 0.02, 0.01], [-0.145, 0, 0], [0, 0, 90], 'metal'],
    ],
  },
  {
    id: 'yogaMat', name: 'Yoga mat', cat: 'hobbies & sports', attach: 'world',
    parts: [
      ['box', [0.61, 0.005, 1.4], [0, 0.0025, 0.12], null, 'purple'],
      ['cyl', [0.055, 0.055, 0.61], [0, 0.055, -0.62], [0, 0, 90], 'purple'],
      ['cyl', [0.035, 0.035, 0.612], [0, 0.055, -0.62], [0, 0, 90], '#6a4a94'],
    ],
  },
  {
    id: 'guitar', name: 'Guitar', cat: 'hobbies & sports', attach: 'rightHand',
    grip: FIST(),
    parts: [
      ['cyl', [0.185, 0.185, 0.1], [0, -0.52, 0], [90, 0, 0], 'lightWood'],
      ['cyl', [0.14, 0.14, 0.1], [0, -0.32, 0], [90, 0, 0], 'lightWood'],
      ['cyl', [0.045, 0.045, 0.002], [0, -0.36, 0.051], [90, 0, 0], 'black'],
      ['box', [0.1, 0.02, 0.008], [0, -0.58, 0.053], null, 'darkWood'],
      ['box', [0.05, 0.4, 0.025], [0, 0, 0.035], null, 'darkWood'],
      ['box', [0.075, 0.15, 0.018], [0, 0.275, 0.022], [-10, 0, 0], 'darkWood'],
      ['box', [0.03, 0.78, 0.002], [0, -0.19, 0.053], null, 'metal'],
      ['box', [0.1, 0.012, 0.012], [0, 0.25, 0.02], null, 'metal'],
      ['box', [0.1, 0.012, 0.012], [0, 0.3, 0.012], null, 'metal'],
    ],
  },

  // ------------------------------------------------------------ bags & wear
  {
    id: 'backpack', name: 'Backpack', cat: 'bags & wear', attach: 'rightHand',
    grip: CARRY(),
    parts: [
      ['torus', [0.03, 0.007, 180], [0, -0.04, 0], null, 'black'],
      ['cyl', [0.075, 0.075, 0.3], [0, -0.11, 0], [0, 0, 90], 'blue'],
      ['box', [0.3, 0.38, 0.15], [0, -0.3, 0], null, 'blue'],
      ['box', [0.22, 0.16, 0.05], [0, -0.38, 0.09], null, '#3d5f96'],
      ['box', [0.05, 0.36, 0.02], [0.08, -0.29, -0.085], null, 'black'],
      ['box', [0.05, 0.36, 0.02], [-0.08, -0.29, -0.085], null, 'black'],
    ],
  },
  {
    id: 'handbag', name: 'Handbag', cat: 'bags & wear', attach: 'rightHand',
    grip: CARRY(),
    parts: [
      ['torus', [0.08, 0.008, 180], [0, -0.085, 0], null, 'leather'],
      ['box', [0.28, 0.19, 0.1], [0, -0.18, 0], null, 'red'],
      ['box', [0.284, 0.085, 0.006], [0, -0.125, 0.052], null, 'brick'],
      ['box', [0.03, 0.02, 0.008], [0, -0.165, 0.056], null, 'gold'],
      ['box', [0.02, 0.02, 0.02], [0.08, -0.085, 0], null, 'gold'],
      ['box', [0.02, 0.02, 0.02], [-0.08, -0.085, 0], null, 'gold'],
    ],
  },
  {
    id: 'briefcase', name: 'Briefcase', cat: 'bags & wear', attach: 'rightHand',
    grip: CARRY(),
    parts: [
      ['box', [0.44, 0.32, 0.1], [0, -0.21, 0], null, 'leather'],
      ['box', [0.442, 0.006, 0.102], [0, -0.1, 0], null, 'darkWood'],
      ['box', [0.13, 0.018, 0.022], [0, -0.009, 0], null, 'black'],
      ['box', [0.016, 0.04, 0.02], [0.057, -0.032, 0], null, 'black'],
      ['box', [0.016, 0.04, 0.02], [-0.057, -0.032, 0], null, 'black'],
      ['box', [0.035, 0.02, 0.008], [0.13, -0.075, 0.052], null, 'gold'],
      ['box', [0.035, 0.02, 0.008], [-0.13, -0.075, 0.052], null, 'gold'],
    ],
  },
  {
    id: 'suitcase', name: 'Suitcase', cat: 'bags & wear', attach: 'rightHand',
    grip: CARRY(),
    parts: [
      ['box', [0.4, 0.6, 0.24], [0, -0.33, 0], null, 'orange'],
      ...[-0.1, 0, 0.1].map((x) => ['box', [0.025, 0.56, 0.01], [x, -0.33, 0.122], null, 'orange']),
      ['box', [0.14, 0.02, 0.025], [0, -0.01, 0], null, 'black'],
      ['box', [0.015, 0.03, 0.02], [0.06, -0.02, 0], null, 'black'],
      ['box', [0.015, 0.03, 0.02], [-0.06, -0.02, 0], null, 'black'],
      ['cyl', [0.03, 0.03, 0.025], [0.17, -0.64, -0.09], [0, 0, 90], 'black'],
      ['cyl', [0.03, 0.03, 0.025], [-0.17, -0.64, -0.09], [0, 0, 90], 'black'],
      ['box', [0.02, 0.03, 0.02], [0.12, -0.02, -0.1], null, 'darkMetal'],
      ['box', [0.02, 0.03, 0.02], [-0.12, -0.02, -0.1], null, 'darkMetal'],
    ],
  },
  {
    id: 'shoppingBag', name: 'Shopping bag', cat: 'bags & wear', attach: 'rightHand',
    grip: CARRY(),
    parts: [
      ['box', [0.32, 0.36, 0.14], [0, -0.24, 0], null, 'lightWood'],
      ['box', [0.322, 0.06, 0.142], [0, -0.15, 0], null, 'red'],
      ['torus', [0.055, 0.005, 180], [0, -0.06, 0.05], null, 'black'],
      ['torus', [0.055, 0.005, 180], [0, -0.06, -0.05], null, 'black'],
    ],
  },
  {
    id: 'hat', name: 'Hat', cat: 'bags & wear', attach: 'rightHand',
    grip: { mode: 'upright', offset: [-0.02, -0.02, 0.04] },
    parts: [
      ['cyl', [0.17, 0.17, 0.008], [0.16, 0, 0], null, 'darkWood'],
      ['cyl', [0.085, 0.1, 0.11], [0.16, 0.06, 0], null, 'darkWood'],
      ['cyl', [0.0985, 0.101, 0.02], [0.16, 0.017, 0], null, 'black'],
      ['cyl', [0.06, 0.07, 0.008], [0.16, 0.113, 0], null, 'brown'],
    ],
  },
  {
    id: 'umbrella', name: 'Umbrella', cat: 'bags & wear', attach: 'rightHand',
    grip: FIST(),
    parts: [
      ['cyl', [0.014, 0.014, 0.12], [0, 0, 0], null, 'darkWood'],
      ['torus', [0.035, 0.012, 180], [0.035, -0.06, 0], [0, 0, 180], 'darkWood'],
      ['cyl', [0.006, 0.006, 0.74], [0, 0.43, 0], null, 'darkMetal'],
      ['cone', [0.5, 0.25, 8], [0, 0.695, 0], null, 'blue'],
      ['cyl', [0.004, 0.006, 0.05], [0, 0.845, 0], null, 'darkMetal'],
    ],
  },
  {
    id: 'glasses', name: 'Glasses', cat: 'bags & wear', attach: 'rightHand',
    grip: { mode: 'upright', offset: [-0.03, 0, 0.04] },
    parts: [
      ['ring', [0.025, 0.003], [0.032, 0, 0], null, 'black'],
      ['ring', [0.025, 0.003], [-0.032, 0, 0], null, 'black'],
      ['cyl', [0.024, 0.024, 0.002], [0.032, 0, 0], [90, 0, 0], 'glass'],
      ['cyl', [0.024, 0.024, 0.002], [-0.032, 0, 0], [90, 0, 0], 'glass'],
      ['box', [0.016, 0.003, 0.003], [0, 0.006, 0], null, 'black'],
      ['box', [0.003, 0.004, 0.14], [0.058, 0.005, -0.07], null, 'black'],
      ['box', [0.003, 0.004, 0.14], [-0.058, 0.005, -0.07], null, 'black'],
    ],
  },

  // ---------------------------------------------------------------- household
  {
    id: 'broom', name: 'Broom', cat: 'household', attach: 'rightHand',
    grip: FIST(),
    parts: [
      ['cyl', [0.013, 0.013, 1.2], [0, -0.25, 0], null, 'wood'],
      ['cyl', [0.015, 0.015, 0.03], [0, 0.36, 0], null, 'red'],
      ['cyl', [0.018, 0.016, 0.04], [0, -0.83, 0], null, 'metal'],
      ['box', [0.26, 0.05, 0.045], [0, -0.87, 0], null, 'red'],
      ['box', [0.3, 0.17, 0.03], [0, -0.98, 0], null, 'yellow'],
    ],
  },
  {
    id: 'bucket', name: 'Bucket', cat: 'household', attach: 'rightHand',
    grip: { mode: 'upright', offset: [0, -0.07, 0], rot: [0, 90, 0] },
    parts: [
      ['torus', [0.15, 0.004, 180], [0, -0.15, 0], null, 'metal'],
      ['cyl', [0.15, 0.12, 0.26], [0, -0.28, 0], null, 'blue'],
      ['torus', [0.15, 0.008], [0, -0.15, 0], [90, 0, 0], 'blue'],
      ['cyl', [0.142, 0.142, 0.002], [0, -0.149, 0], null, 'water'],
      ['box', [0.015, 0.03, 0.02], [0.15, -0.165, 0], null, 'metal'],
      ['box', [0.015, 0.03, 0.02], [-0.15, -0.165, 0], null, 'metal'],
    ],
  },
  {
    id: 'mirror', name: 'Standing mirror', cat: 'household', attach: 'world',
    parts: [
      ['box', [0.5, 1.5, 0.04], [0, 0.8, 0], [-6, 0, 0], 'wood'],
      ['box', [0.43, 1.42, 0.004], [0, 0.802, 0.021], [-6, 0, 0], '#dcecf2'],
      ['box', [0.03, 0.3, 0.001], [-0.08, 1.1, 0.055], [-6, 0, 25], 'white'],
      ['box', [0.015, 0.2, 0.001], [-0.02, 1.15, 0.06], [-6, 0, 25], 'white'],
      seg([0, 0, -0.32], [0, 1.25, -0.07], 0.018, 'darkWood'),
      ['box', [0.56, 0.06, 0.12], [0, 0.03, 0.07], null, 'darkWood'],
    ],
  },
  {
    id: 'pottedPlant', name: 'Potted plant', cat: 'household', attach: 'world',
    parts: [
      ['cyl', [0.14, 0.11, 0.26], [0, 0.13, 0], null, 'brick'],
      ['cyl', [0.155, 0.15, 0.04], [0, 0.26, 0], null, 'brick'],
      ['cyl', [0.14, 0.14, 0.01], [0, 0.276, 0], null, 'brown'],
      ['cyl', [0.015, 0.02, 0.25], [0, 0.38, 0], null, 'brown'],
      ['sphere', [0.17], [0, 0.55, 0], null, 'leaf'],
      ['sphere', [0.12], [0.13, 0.62, 0.05], null, 'green'],
      ['sphere', [0.13], [-0.11, 0.65, -0.05], null, 'leaf'],
      ['sphere', [0.11], [0.02, 0.75, 0.04], null, 'green'],
    ],
  },
  {
    id: 'vase', name: 'Flower vase', cat: 'household', attach: 'world',
    parts: [
      ['cyl', [0.04, 0.045, 0.01], [0, 0.005, 0], null, 'blue'],
      ['sphere', [0.08], [0, 0.085, 0], null, 'blue'],
      ['cyl', [0.03, 0.045, 0.1], [0, 0.19, 0], null, 'blue'],
      ['cyl', [0.04, 0.03, 0.02], [0, 0.25, 0], null, 'blue'],
      ...[[-0.06, 0.42, 0.02, 'red'], [0.05, 0.45, -0.01, 'yellow'], [0.0, 0.49, 0.05, 'pink']].flatMap(([x, y, z, m]) => [
        seg([0, 0.22, 0], [x, y, z], 0.003, 'leaf'),
        ['sphere', [0.03], [x, y, z], null, m],
      ]),
    ],
  },
  {
    id: 'candle', name: 'Candle', cat: 'household', attach: 'world',
    parts: [
      ['cyl', [0.06, 0.055, 0.012], [0, 0.006, 0], null, 'gold'],
      ['cyl', [0.022, 0.026, 0.03], [0, 0.027, 0], null, 'gold'],
      ['cyl', [0.017, 0.017, 0.13], [0, 0.105, 0], null, 'white'],
      ['cyl', [0.0015, 0.0015, 0.012], [0, 0.176, 0], null, 'black'],
      ['sphere', [0.008], [0, 0.187, 0], null, 'orange'],
      ['cone', [0.008, 0.025], [0, 0.1995, 0], null, 'light'],
    ],
  },
  {
    id: 'wallClock', name: 'Wall clock', cat: 'household', attach: 'world',
    parts: [
      ['cyl', [0.16, 0.16, 0.04], [0, 2, 0.02], [90, 0, 0], 'darkWood'],
      ['cyl', [0.142, 0.142, 0.002], [0, 2, 0.041], [90, 0, 0], 'white'],
      ['box', [0.008, 0.025, 0.002], [0, 2.115, 0.0425], null, 'black'],
      ['box', [0.008, 0.025, 0.002], [0, 1.885, 0.0425], null, 'black'],
      ['box', [0.025, 0.008, 0.002], [0.115, 2, 0.0425], null, 'black'],
      ['box', [0.025, 0.008, 0.002], [-0.115, 2, 0.0425], null, 'black'],
      ['box', [0.008, 0.07, 0.002], [-0.0303, 2.0175, 0.044], [0, 0, 60], 'black'],
      ['box', [0.006, 0.11, 0.002], [0.0476, 2.0275, 0.046], [0, 0, -60], 'black'],
      ['cyl', [0.008, 0.008, 0.01], [0, 2, 0.045], [90, 0, 0], 'red'],
    ],
  },
  {
    id: 'blanket', name: 'Blanket', cat: 'household', attach: 'world',
    parts: [
      ['plane', [1.4, 1.8], [0, 0.002, 0], null, 'red'],
      ...[-0.45, -0.15, 0.15, 0.45].map((x) => ['plane', [0.12, 1.8], [x, 0.004, 0], null, 'cream']),
      ...[-0.72, -0.36, 0, 0.36, 0.72].map((z) => ['plane', [1.4, 0.12], [0, 0.005, z], null, 'cream']),
    ],
  },
  {
    id: 'giftBox', name: 'Gift box', cat: 'household', attach: 'rightHand',
    grip: PALM(),
    parts: [
      ['box', [0.22, 0.16, 0.22], [0, 0.08, 0], null, 'red'],
      ['box', [0.23, 0.04, 0.23], [0, 0.165, 0], null, 'red'],
      ['box', [0.04, 0.187, 0.232], [0, 0.0935, 0], null, 'yellow'],
      ['box', [0.232, 0.187, 0.04], [0, 0.0935, 0], null, 'yellow'],
      ['torus', [0.03, 0.01], [-0.034, 0.21, 0], [0, 0, 35], 'yellow'],
      ['torus', [0.03, 0.01], [0.034, 0.21, 0], [0, 0, -35], 'yellow'],
      ['sphere', [0.015], [0, 0.192, 0], null, 'yellow'],
    ],
  },

  // ------------------------------------------------------------------ outdoor
  {
    id: 'tree', name: 'Tree', cat: 'outdoor', attach: 'world',
    parts: [
      ['cyl', [0.12, 0.18, 1.5], [0, 0.75, 0], null, 'brown'],
      seg([0, 1.2, 0], [0.4, 1.7, 0.1], 0.06, 'brown', 0.04),
      ['sphere', [0.85], [0, 2.05, 0], null, 'leaf'],
      ['sphere', [0.6], [0.55, 2.2, 0.15], null, 'green'],
      ['sphere', [0.6], [-0.5, 2.3, -0.1], null, 'leaf'],
      ['sphere', [0.5], [0.05, 2.6, 0.05], null, 'green'],
    ],
  },
  {
    id: 'bush', name: 'Bush', cat: 'outdoor', attach: 'world',
    parts: [
      ['sphere', [0.4], [0, 0.35, 0], null, 'leaf'],
      ['sphere', [0.32], [0.35, 0.28, 0.05], null, 'green'],
      ['sphere', [0.3], [-0.35, 0.27, -0.05], null, 'green'],
      ['sphere', [0.28], [0.05, 0.55, 0.15], null, 'green'],
      ['sphere', [0.25], [-0.15, 0.25, 0.25], null, 'leaf'],
    ],
  },
  {
    id: 'rock', name: 'Rock', cat: 'outdoor', attach: 'world',
    parts: [
      ['cyl', [0.38, 0.48, 0.3, 7], [0, 0.15, 0], [3, 0, -2], 'stone'],
      ['cyl', [0.25, 0.38, 0.2, 7], [0.02, 0.39, -0.02], [-4, 25, 5], 'stone'],
      ['cyl', [0.1, 0.25, 0.12, 7], [0.04, 0.54, 0.0], [6, 50, -6], 'stone'],
      ['cyl', [0.15, 0.22, 0.22, 6], [0.5, 0.11, 0.2], [0, 15, -8], 'grey'],
    ],
  },
  {
    id: 'streetLamp', name: 'Street lamp', cat: 'outdoor', attach: 'world',
    parts: [
      ['cyl', [0.13, 0.16, 0.4], [0, 0.2, 0], null, 'darkMetal'],
      ['cyl', [0.05, 0.075, 3.2], [0, 1.8, 0], null, 'darkMetal'],
      ['sphere', [0.06], [0, 3.42, 0], null, 'darkMetal'],
      seg([0, 3.35, 0], [0.75, 3.45, 0], 0.035, 'darkMetal'),
      ['box', [0.4, 0.08, 0.18], [0.8, 3.44, 0], null, 'darkMetal'],
      ['box', [0.34, 0.012, 0.14], [0.8, 3.395, 0], null, 'light'],
    ],
  },
  {
    id: 'signPost', name: 'Signpost', cat: 'outdoor', attach: 'world',
    parts: [
      ['box', [0.1, 2.0, 0.1], [0, 1.0, 0], null, 'darkWood'],
      ['cone', [0.075, 0.08, 4], [0, 2.04, 0], [0, 45, 0], 'darkWood'],
      ['box', [0.55, 0.15, 0.03], [0.3, 1.75, 0.065], null, 'lightWood'],
      ['box', [0.106, 0.106, 0.03], [0.575, 1.75, 0.065], [0, 0, 45], 'lightWood'],
      ['box', [0.55, 0.15, 0.03], [-0.3, 1.5, 0.065], null, 'lightWood'],
      ['box', [0.106, 0.106, 0.03], [-0.575, 1.5, 0.065], [0, 0, 45], 'lightWood'],
      ['box', [0.3, 0.02, 0.001], [0.28, 1.75, 0.081], null, 'darkWood'],
      ['box', [0.3, 0.02, 0.001], [-0.28, 1.5, 0.081], null, 'darkWood'],
    ],
  },
  {
    id: 'fence', name: 'Picket fence', cat: 'outdoor', attach: 'world',
    parts: [
      ['box', [2.0, 0.08, 0.025], [0, 0.3, -0.025], null, 'white'],
      ['box', [2.0, 0.08, 0.025], [0, 0.75, -0.025], null, 'white'],
      ...Array.from({ length: 9 }, (_, i) => ['box', [0.09, 0.9, 0.02], [r3(-0.9 + i * 0.225), 0.45, 0], null, 'white']),
      ...Array.from({ length: 9 }, (_, i) => ['box', [0.064, 0.064, 0.02], [r3(-0.9 + i * 0.225), 0.9, 0], [0, 0, 45], 'white']),
    ],
  },
  {
    id: 'trafficCone', name: 'Traffic cone', cat: 'outdoor', attach: 'world',
    parts: [
      ['box', [0.38, 0.03, 0.38], [0, 0.015, 0], null, 'orange'],
      ['cyl', [0.025, 0.14, 0.68], [0, 0.37, 0], null, 'orange'],
      ['cyl', [0.0615, 0.0784, 0.1], [0, 0.45, 0], null, 'white'],
      ['cyl', [0.0953, 0.1089, 0.08], [0, 0.26, 0], null, 'white'],
    ],
  },
  {
    id: 'car', name: 'Car', cat: 'outdoor', attach: 'world',
    parts: [
      ['box', [3.95, 0.6, 1.7], [0, 0.55, 0], null, 'blue'],
      ['cyl', [0.37, 0.37, 1.72], [1.3, 0.32, 0], [90, 0, 0], 'black'],
      ['cyl', [0.37, 0.37, 1.72], [-1.3, 0.32, 0], [90, 0, 0], 'black'],
      ['box', [1.6, 0.52, 1.5], [-0.35, 1.11, 0], null, 'screen'],
      ['box', [0.5, 0.75, 1.5], [0.52, 0.937, 0], [0, 0, 43.9], 'screen'],
      ['box', [0.5, 0.7, 1.5], [-1.102, 0.9575, 0], [0, 0, 142.4], 'screen'],
      ['box', [1.62, 0.05, 1.52], [-0.35, 1.395, 0], null, 'blue'],
      ['box', [0.08, 0.52, 1.52], [-0.3, 1.11, 0], null, 'blue'],
      ...[[1.3, 0.8], [1.3, -0.8], [-1.3, 0.8], [-1.3, -0.8]].flatMap(([x, z]) => [
        ['cyl', [0.32, 0.32, 0.2], [x, 0.32, z], [90, 0, 0], 'rubber'],
        ['cyl', [0.17, 0.17, 0.21], [x, 0.32, z], [90, 0, 0], 'metal'],
      ]),
      ['box', [0.03, 0.1, 0.32], [1.976, 0.72, 0.58], null, 'light'],
      ['box', [0.03, 0.1, 0.32], [1.976, 0.72, -0.58], null, 'light'],
      ['box', [0.03, 0.1, 0.32], [-1.976, 0.72, 0.58], null, 'red'],
      ['box', [0.03, 0.1, 0.32], [-1.976, 0.72, -0.58], null, 'red'],
      ['box', [0.1, 0.14, 1.72], [1.99, 0.33, 0], null, 'darkMetal'],
      ['box', [0.1, 0.14, 1.72], [-1.99, 0.33, 0], null, 'darkMetal'],
    ],
  },
  {
    id: 'bicycle', name: 'Bicycle', cat: 'outdoor', attach: 'world',
    parts: [
      ...[-0.52, 0.52].flatMap((x) => [
        ['torus', [0.32, 0.022], [x, 0.342, 0], null, 'rubber'],
        ['ring', [0.29, 0.006], [x, 0.342, 0], null, 'metal'],
        ['cyl', [0.02, 0.02, 0.08], [x, 0.342, 0], [90, 0, 0], 'metal'],
      ]),
      seg([-0.04, 0.3, 0], [-0.17, 0.82, 0], 0.017, 'red'),
      seg([-0.04, 0.3, 0], [0.41, 0.68, 0], 0.019, 'red'),
      seg([-0.16, 0.78, 0], [0.375, 0.79, 0], 0.016, 'red'),
      seg([-0.04, 0.3, 0], [-0.52, 0.342, 0], 0.012, 'red'),
      seg([-0.165, 0.77, 0], [-0.52, 0.342, 0], 0.011, 'red'),
      seg([0.41, 0.68, 0], [0.37, 0.82, 0], 0.022, 'red'),
      seg([0.41, 0.68, 0], [0.52, 0.342, 0], 0.014, 'red'),
      seg([-0.17, 0.82, 0], [-0.19, 0.9, 0], 0.012, 'metal'),
      ['box', [0.24, 0.05, 0.13], [-0.2, 0.93, 0], null, 'black'],
      seg([0.37, 0.82, 0], [0.34, 0.95, 0], 0.013, 'metal'),
      ['cyl', [0.012, 0.012, 0.52], [0.34, 0.95, 0], [90, 0, 0], 'black'],
      ['cyl', [0.09, 0.09, 0.012], [-0.04, 0.3, 0.04], [90, 0, 0], 'darkMetal'],
    ],
  },
];
