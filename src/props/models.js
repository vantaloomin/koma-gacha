// CC0 model files (Kenney Furniture Kit 2.0 and Food Kit 2.0, public/models/kenney/*/License.txt)
// mapped onto catalog props. Each model is scaled to the primitive prop's size and aligned to its
// origin; modelRot fixes models authored in a different orientation. Props not listed here keep
// their primitive shapes.

const F = (name, extra = {}) => ({ model: `kenney/furniture/${name}.glb`, ...extra });
const FOOD = (name, extra = {}) => ({ model: `kenney/food/${name}.glb`, ...extra });

export const MODELS = {
  // furniture
  chair: F('chair'),
  barStool: F('stoolBar'),
  armchair: F('loungeChair'),
  sofa: F('loungeSofa'),
  desk: F('desk'),
  coffeeTable: F('tableCoffee'),
  counter: F('kitchenBar'),
  bed: F('bedDouble', { fit: 'max' }),
  bookshelf: F('bookcaseOpen'),
  wardrobe: F('bookcaseClosedDoors'),
  cabinet: F('sideTableDrawers'),
  floorLamp: F('lampRoundFloor'),
  deskLamp: F('lampSquareTable'),
  pillow: F('pillow'),
  pottedPlant: F('pottedPlant'),
  // tech
  laptop: F('laptop'),
  radio: F('radio'),
  tv: F('televisionModern'),
  monitor: F('computerScreen'),
  // food & drink
  cup: FOOD('cup-coffee'),
  teacup: FOOD('cup-tea'),
  bottle: FOOD('soda-bottle'),
  can: FOOD('soda-can'),
  plate: FOOD('plate'),
  bowl: FOOD('bowl'),
  fork: FOOD('utensil-fork'),
  burger: FOOD('burger'),
  sandwich: FOOD('sandwich'),
  apple: FOOD('apple'),
  iceCream: FOOD('ice-cream'),
  cake: FOOD('cake-birthday'),
};
