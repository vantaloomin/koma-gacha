// Architecture pieces for rooms: unit-sized walls, floors, windows and blocks that a scene prop
// stretches with `scale: [x, y, z]`. They have no ink outline (it would grow with the scale).

const frame = 'white';
export const ARCHITECTURE = [
  { id: 'wallPanel', name: 'Wall', cat: 'architecture', attach: 'world', noOutline: true, parts: [['box', [1, 1, 0.1], [0, 0.5, 0], null, 'cream']] },
  { id: 'wallPanelBlue', name: 'Wall (blue-grey)', cat: 'architecture', attach: 'world', noOutline: true, parts: [['box', [1, 1, 0.1], [0, 0.5, 0], null, '#c9d2dc']] },
  { id: 'wallPanelGreen', name: 'Wall (sage)', cat: 'architecture', attach: 'world', noOutline: true, parts: [['box', [1, 1, 0.1], [0, 0.5, 0], null, '#cdd8c4']] },
  { id: 'wallPanelBrick', name: 'Brick wall', cat: 'architecture', attach: 'world', noOutline: true, parts: [['box', [1, 1, 0.1], [0, 0.5, 0], null, 'brick']] },
  { id: 'skirting', name: 'Skirting board', cat: 'architecture', attach: 'world', noOutline: true, parts: [['box', [1, 0.1, 0.03], [0, 0.05, 0], null, 'darkWood']] },
  { id: 'floorWood', name: 'Wooden floor', cat: 'architecture', attach: 'world', floor: true, noOutline: true, parts: [['plane', [1, 1], [0, 0.002, 0], null, '#b48a5f']] },
  { id: 'floorLight', name: 'Light floor', cat: 'architecture', attach: 'world', floor: true, noOutline: true, parts: [['plane', [1, 1], [0, 0.002, 0], null, '#d9cbb3']] },
  { id: 'floorTile', name: 'Tiled floor', cat: 'architecture', attach: 'world', floor: true, noOutline: true, parts: [['plane', [1, 1], [0, 0.002, 0], null, '#b9bcc0']] },
  { id: 'floorCarpet', name: 'Carpet', cat: 'architecture', attach: 'world', floor: true, noOutline: true, parts: [['plane', [1, 1], [0, 0.002, 0], null, '#8e9bb0']] },
  { id: 'rug', name: 'Rug', cat: 'architecture', attach: 'world', noOutline: true, parts: [['plane', [1, 1], [0, 0.006, 0], null, '#b0605a']] },
  { id: 'road', name: 'Road', cat: 'architecture', attach: 'world', floor: true, noOutline: true, parts: [['plane', [1, 1], [0, 0.002, 0], null, '#4a4c52']] },
  { id: 'roadLine', name: 'Road marking', cat: 'architecture', attach: 'world', noOutline: true, parts: [['plane', [1, 1], [0, 0.006, 0], null, '#e9e4d0']] },
  { id: 'sidewalk', name: 'Pavement', cat: 'architecture', attach: 'world', floor: true, noOutline: true, parts: [['box', [1, 0.12, 1], [0, -0.058, 0], null, '#b6b2aa']] },
  { id: 'grass', name: 'Grass', cat: 'architecture', attach: 'world', floor: true, noOutline: true, parts: [['plane', [1, 1], [0, 0.002, 0], null, '#7aa860']] },
  { id: 'path', name: 'Gravel path', cat: 'architecture', attach: 'world', noOutline: true, parts: [['plane', [1, 1], [0, 0.006, 0], null, '#d2c19a']] },
  {
    id: 'windowPanel', name: 'Window', cat: 'architecture', attach: 'world', noOutline: true,
    parts: [
      ['box', [0.94, 0.94, 0.02], [0, 0.5, 0], null, 'glass'],
      ['box', [0.06, 1, 0.1], [-0.47, 0.5, 0], null, frame], ['box', [0.06, 1, 0.1], [0.47, 0.5, 0], null, frame],
      ['box', [1, 0.06, 0.1], [0, 0.03, 0], null, frame], ['box', [1, 0.06, 0.1], [0, 0.97, 0], null, frame],
      ['box', [0.04, 1, 0.08], [0, 0.5, 0], null, frame], ['box', [1, 0.04, 0.08], [0, 0.55, 0], null, frame],
    ],
  },
  { id: 'blackboard', name: 'Blackboard', cat: 'architecture', attach: 'world', noOutline: true, parts: [['box', [1, 1, 0.04], [0, 0.5, 0], null, '#2f4a3a'], ['box', [1.02, 0.03, 0.08], [0, -0.01, 0.03], null, 'lightWood']] },
  { id: 'poster', name: 'Poster', cat: 'architecture', attach: 'world', noOutline: true, parts: [['box', [1, 1, 0.01], [0, 0.5, 0], null, '#e9d8a6']] },
  {
    id: 'building', name: 'Building block', cat: 'architecture', attach: 'world', noOutline: true,
    parts: [
      ['box', [1, 1, 1], [0, 0.5, 0], null, 'stone'],
      ...[0.2, 0.42, 0.64, 0.86].flatMap((y) => [-0.3, -0.1, 0.1, 0.3].map((x) => ['box', [0.12, 0.1, 0.02], [x, y, 0.5], null, 'screen'])),
    ],
  },
  { id: 'hedge', name: 'Hedge', cat: 'architecture', attach: 'world', noOutline: true, parts: [['box', [1, 1, 1], [0, 0.5, 0], null, 'leaf']] },
];
