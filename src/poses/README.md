# Pose format

Each file in `src/poses/*.js` default-exports an array of poses. They are registered automatically (`index.js` globs the folder). Custom poses saved from the pose editor are JSON files in `/poses/custom/`.

## Body frame and skeleton

The **body frame** has +X = the character's **left**, +Y = up, +Z = forward (the way the face points). The rest pose is a T-pose: arms along ±X, legs straight down, feet pointing +Z.

Bones: `hips, spine, chest, neck, head, leftUpperArm, leftLowerArm, leftHand, rightUpperArm, rightLowerArm, rightHand, leftUpperLeg, leftLowerLeg, leftFoot, rightUpperLeg, rightLowerLeg, rightFoot`.

Proportions are fractions of body height h: the hip joint is 0.5h above the floor, upper and lower legs are 0.255h and 0.25h, upper arm and forearm are 0.165h and 0.15h, shoulders sit 0.115h either side at chest + 0.165h, and the head centre is at about 0.93h.

## Fields

```js
{
  id: 'drinkCup',              // unique camelCase id
  name: 'Drinking from a cup', // label
  cat: 'actions',              // category (see the list below)
  layer: 'upper',              // 'full' (whole body) or 'upper' (arms/chest/head only, overlays any base)
  tags: ['speak', 'listen', 'standing'],
  tones: ['daily', 'joy'],     // gacha weighting: auto daily tension conflict surprise intimate sad comedy resolve ominous joy
  adult: false,
  root: { y: -0.18, rot: [0, 0, 0] }, // y: hip-height offset as a fraction of h (sitting ≈ -0.18); rot: whole-body degrees around the hips
  bones: { spine: [10, 0, 0], head: [-5, 20, 0] }, // local euler degrees (XYZ)
  limbs: {                     // body-frame direction vectors: [upper, lower, hand/foot?]
    rightArm: [[-0.2, -0.85, 0.35], [-0.1, 0.9, 0.4]],
    leftLeg: [[0.05, -0.2, 1], [0.05, -1, 0.1]],
  },
  look: 1,                     // 0..1: how much the head turns toward the conversation
  props: [{ id: 'cup', attach: 'rightHand' }],
}
```

- `limbs` directions are in the **body frame after `root.rot`**, so "arm hanging" is always `[±0.15, -1, 0]` even when lying down.
  - Bone rotations in `bones` for `hips`, `spine` or `chest` are applied **before** the limbs are solved, so limb directions stay what you wrote.
  - Arms: `leftArm` x is positive outward, `rightArm` x is negative outward. Legs point down (`[0, -1, 0]`); a thigh forward and level is `[0, 0, 1]`.
  - The third entry (hand/foot direction) is optional.
- **Rotation signs (local, degrees):** `x+` bends forward (spine/chest/neck/head nod down); `y+` turns toward the character's left; `z+` tilts the top toward the character's right.
- `root.rot`: `[-90, 0, 0]` = lying on the back (face up); `[90, 0, 0]` = face down; `[0, 0, 90]` = lying on the right side. `root.y` then lowers the hips to the floor (lying ≈ `-0.44`).
- `layer: 'upper'` poses must only use spine/chest/neck/head/arms. They overlay a page's base pose (e.g. a seated base + a drinking gesture).
- Tags: `speak` / `listen` make a pose eligible for the camera gacha (speaker vs listener). `standing` marks full-body poses that keep both feet planted (eligible as gacha gestures when the base is standing).
- Props: `attach` is `rightHand`, `leftHand` (hand-held; offsets are authored for the right hand and mirrored for the left) or `body` (placed relative to the character's floor position and facing, e.g. a chair). `offset` (metres) and `rot` (degrees) override the prop's default grip.

## Pair poses

```js
{
  id: 'hug', name: 'Hug', cat: 'pairs', pair: true,
  a: { /* pose for character A */ },
  b: { /* pose for character B */ },
  offset: { x: 0, z: 0.35, yaw: 180 }, // B's position and facing relative to A (A's body frame, metres/degrees)
}
```

## Trio poses

```js
{
  id: 'groupHug', name: 'Group hug', cat: 'groups', trio: true,
  a: { ... }, b: { ... }, c: { ... },
  offset: { x, z, yaw },  // B relative to A
  offsetC: { x, z, yaw }, // C relative to A
}
```

Group offsets are authored for 1.65 m (A), 1.75 m (B) and 1.70 m (C) figures; the runtime scales the spacing to the real cast. Roles are body positions only, so any characters can fill any role.

## Target-based authoring (`src/pose-ik.js`)

`solve({ h, root, bones, hands: {left, right}, feet: {left, right}, elbows, knees })` turns wrist and ankle targets (metres, in the character's own floor frame) into `limbs`. `toLocal(point, place)` converts a point from A's frame into a partner's frame, and `jointOf(pose, h, place, joint)` gives a solved pose's joint position, for example to rest a hand on a partner's shoulder. `src/poses/groups.js` and `src/poses/adult-more.js` are written this way.

## Categories

`standing`, `gestures`, `emotions`, `movement`, `actions`, `dance`, `sitting`, `ground` (kneel/crouch/lie), `fighting`, `pairs`, `groups` (trios).

Adult-pack poses use these same categories and set `adult: true`. That flag hides them everywhere (library lists, editor, gacha) unless the adult pack is enabled.

## Props available

- **furniture:** chair, stool, barStool, armchair, sofa, bench, parkBench, table, desk, coffeeTable, counter, bed, futon, bookshelf, wardrobe, cabinet, door, floorLamp, deskLamp, pillow
- **food & drink:** cup, teacup, wineGlass, beerMug, bottle, can, plate, bowl, chopsticks, fork, burger, sandwich, pizzaSlice, apple, iceCream, cake
- **tech:** phone, laptop, tablet, camera, headphones, microphone, tv, gameController, monitor, radio
- **paper:** book, openBook, notebook, pen, envelope, newspaper, clipboard, scroll
- **weapons:** sword, katana, dagger, bow, arrow, staff, shield, spear, axe, hammer, pistol, wand
- **hobbies & sports:** ball, basketball, baseballBat, tennisRacket, skateboard, dumbbell, yogaMat, guitar
- **bags & wear:** backpack, handbag, briefcase, suitcase, shoppingBag, hat, umbrella, glasses
- **household:** broom, bucket, mirror, pottedPlant, vase, candle, wallClock, blanket, giftBox
- **outdoor:** tree, bush, rock, streetLamp, signPost, fence, trafficCone, car, bicycle

Seats (`seat` = sitting height in metres): chair 0.46, stool 0.46, barStool 0.75, armchair 0.42, sofa 0.42, bench 0.45, parkBench 0.45, bed 0.5, futon 0.15.

## Checking poses

```bash
node tools/sheet.mjs poses <category|id,id,...> out.png [--view=3q|front|side|top|back] [--adult]
```

This renders a contact sheet on mannequins. Every pose should read clearly from the 3/4 view and the side view.
