// Rooms: background sets built from architecture pieces and the prop catalog, as scene props.
// Pure data (no three.js), so the MCP server can expand a room name without the renderer.
// The cast stands around the origin; sets keep |x| < 1.6, |z| < 1.1 clear. The camera side is +z,
// so the main walls are behind the cast (−z) and to the sides.

export const ROOMS = {
  classroom: 'Classroom', bedroom: 'Bedroom', 'living room': 'Living room', cafe: 'Café', office: 'Office', street: 'Street', park: 'Park',
};

const P = (id, x, z, yaw = 0, extra = {}) => ({ id, x, z, yaw, ...extra });
const S = (id, x, z, sx, sy, sz, yaw = 0, y = 0) => ({ id, x, z, y, yaw, scale: [sx, sy, sz] });

// Three walls (back + sides), floor and skirting. W = half width, D = back wall depth.
function shell({ wall = 'wallPanel', floor = 'floorWood', W = 5.5, D = 3.6, H = 3, front = 3.4 } = {}) {
  const depth = D + front;
  return [
    S(floor, 0, (front - D) / 2, W * 2, 1, depth),
    S(wall, 0, -D, W * 2, H, 1),
    S(wall, -W, (front - D) / 2, depth, H, 1, 90),
    S(wall, W, (front - D) / 2, depth, H, 1, -90),
    S('skirting', 0, -D + 0.06, W * 2, 1, 1),
    S('skirting', -W + 0.06, (front - D) / 2, depth, 1, 1, 90),
    S('skirting', W - 0.06, (front - D) / 2, depth, 1, 1, -90),
  ];
}
const windowOn = (side, at, w = 1.5, h = 1.4, sill = 0.9, W = 5.5, D = 3.6) => (side === 'back'
  ? S('windowPanel', at, -D + 0.07, w, h, 1, 0, sill)
  : S('windowPanel', side === 'left' ? -W + 0.07 : W - 0.07, at, w, h, 1, side === 'left' ? 90 : -90, sill));

const BUILD = {
  classroom: (v) => {
    const out = [...shell({ wall: v % 2 ? 'wallPanelGreen' : 'wallPanel', floor: 'floorWood' })];
    out.push(S('blackboard', -0.2, -3.53, 4.2, 1.2, 1, 0, 0.95), P('wallClock', 3.2, -3.53, 0, { y: 0.4 }));
    for (const z of [-2.2, -0.2, 1.8]) out.push(windowOn('left', z, 1.6, 1.4, 0.95));
    out.push(P('door', 5.4, 1.6, -90), P('bookshelf', 5.2, -1.6, -90), P('pottedPlant', -4.9, -3.1));
    // students' desks face the board (−z): chair behind each desk
    for (const x of [-3.7, -2.3, 2.3, 3.7]) for (const z of [-2.5, -1.25]) out.push(P('desk', x, z, 180), P('chair', x, z + 0.42, 180));
    for (const x of [-3.7, 3.7]) for (const z of [0.2, 1.4]) out.push(P('desk', x, z, 180), P('chair', x, z + 0.42, 180));
    out.push(P('desk', 0.4, -3.0, 0));
    return out;
  },
  bedroom: () => [
    ...shell({ wall: 'wallPanelBlue', floor: 'floorLight', W: 4.8, D: 3.2 }),
    windowOn('back', 0.6, 1.6, 1.3, 0.95, 4.8, 3.2),
    P('bed', -2.9, -2.1, 0), P('pillow', -2.9, -2.95, 0, { y: 0.45 }), P('wardrobe', 4.1, -2.85, 0), P('desk', 2.4, -2.85, 0), P('chair', 2.4, -2.4, 180),
    P('floorLamp', -4.3, -2.85), P('bookshelf', 4.55, -0.4, -90), P('pottedPlant', -1.2, -2.85), S('rug', -0.4, -0.6, 2.4, 1, 1.6), P('deskLamp', 2.85, -2.95, 0, { y: 0.74 }),
  ],
  'living room': () => [
    ...shell({ wall: 'wallPanel', floor: 'floorWood', W: 5.2, D: 3.4 }),
    windowOn('back', -3.2, 1.5, 1.4, 0.85, 5.2, 3.4), windowOn('back', 3.4, 1.5, 1.4, 0.85, 5.2, 3.4),
    P('sofa', 0.2, -2.85, 0), P('coffeeTable', 0.2, -1.9, 0), P('floorLamp', 1.9, -3.0), P('pottedPlant', -1.9, -3.0),
    P('cabinet', -4.85, -0.6, 90), P('tv', -4.85, -0.6, 90, { y: 0.92 }), P('bookshelf', 4.95, -1.6, -90), P('armchair', 3.6, -1.7, -40),
    S('rug', 0.2, -1.6, 3, 1, 2), P('cup', 0.4, -1.85, 0, { y: 0.42 }),
  ],
  cafe: () => {
    const out = [...shell({ wall: 'wallPanelBrick', floor: 'floorTile', W: 5.5, D: 3.6 })];
    out.push(P('counter', 0.9, -3.15, 0), P('counter', 2.7, -3.15, 0), windowOn('left', -1.5, 2, 1.5, 0.8), windowOn('left', 1.2, 2, 1.5, 0.8));
    for (const x of [0.3, 1.3, 2.3, 3.3]) out.push(P('barStool', x, -2.5, 180));
    for (const [x, z] of [[-3.8, -2.2], [-3.8, 0.4], [3.9, 0.6]]) {
      out.push(P('table', x, z, 90), P('chair', x - 0.65, z, 90), P('chair', x + 0.65, z, -90), P('cup', x, z - 0.15, 0, { y: 0.75 }));
    }
    out.push(P('pottedPlant', -4.9, -3.1), P('pottedPlant', 4.9, -3.1), S('poster', -1.6, -3.53, 0.9, 1.2, 1, 0, 1.2));
    return out;
  },
  office: () => {
    const out = [...shell({ wall: 'wallPanelBlue', floor: 'floorCarpet', W: 5.5, D: 3.6 })];
    for (const x of [-2.6, -0.6, 1.4, 3.4]) out.push(windowOn('back', x, 1.6, 1.6, 0.8));
    for (const [x, z] of [[-3.6, -2.0], [-3.6, -0.3], [3.6, -2.0], [3.6, -0.3]]) out.push(P('desk', x, z, x < 0 ? 90 : -90), P('monitor', x, z, x < 0 ? 90 : -90, { y: 0.74 }), P('chair', x + (x < 0 ? 0.45 : -0.45), z, x < 0 ? -90 : 90));
    out.push(P('cabinet', 0.4, -3.25, 0), P('pottedPlant', 5.0, 1.4), P('wallClock', -4.0, -3.53, 0, { y: 0.3 }));
    return out;
  },
  street: () => {
    const out = [S('sidewalk', 0, -0.2, 16, 1, 4.4), S('road', 0, -6.2, 30, 1, 7.6), S('road', 0, 6, 30, 1, 3)];
    for (let x = -12; x <= 12; x += 3) out.push(S('roadLine', x, -6.2, 1.6, 1, 0.14));
    out.push(S('sidewalk', 0, -11, 30, 1, 2));
    [[-10, 9, 12], [-4.5, 6, 9], [1, 8, 15], [6.5, 6, 10], [11.5, 7, 13]].forEach(([x, w, h]) => out.push(S('building', x, -15, w, h, 6)));
    out.push(P('streetLamp', -4.2, -1.9), P('streetLamp', 4.4, -1.9), P('signPost', 2.4, -2.0), P('tree', -6.5, -1.6), P('tree', 7.2, -1.6), P('car', 3.0, -4.6, 0), P('trafficCone', -2.3, -2.2));
    return out;
  },
  park: () => {
    const out = [S('grass', 0, -4, 40, 1, 30), S('path', 0, 0.2, 30, 1, 2.6)];
    for (const [x, z] of [[-5.5, -3.2], [-2.8, -5.4], [3.6, -5.8], [6, -2.8], [-8, -7], [8.5, -7.5], [0.5, -8.5]]) out.push(P('tree', x, z));
    for (const [x, z] of [[-4, -2.4], [4.6, -4.4], [-1.4, -4.2]]) out.push(P('bush', x, z));
    out.push(P('parkBench', -3.0, -1.7, 0), P('parkBench', 3.4, -1.7, 0), P('streetLamp', 0.3, -2.0), P('rock', 5.6, 0.9), S('hedge', 0, -11, 24, 1.2, 1));
    return out;
  },
};

/** Scene props for a room ('classroom', 'bedroom', 'living room', 'cafe', 'office', 'street', 'park'); [] if unknown. */
export function roomProps(name, variant = 0) {
  const key = String(name || '').toLowerCase().replace(/[_-]+/g, ' ').trim();
  const fn = BUILD[key] || BUILD[Object.keys(BUILD).find((k) => key.includes(k)) || ''];
  return fn ? fn(variant || 0) : [];
}

export const roomKey = (name) => {
  const key = String(name || '').toLowerCase().replace(/[_-]+/g, ' ').trim();
  return BUILD[key] ? key : Object.keys(BUILD).find((k) => key.includes(k)) || null;
};
