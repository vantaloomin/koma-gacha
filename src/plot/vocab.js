// Plot vocabulary: staging words (and common abbreviations) mapped onto Koma's camera, layout,
// balloon, effect and pose settings. Words are matched case-insensitively, ignoring punctuation.

import { lensFov } from '../gacha.js';
import { getPose, listPoses } from '../pose-runtime.js';

export const norm = (s) => String(s).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// kind: size | angle | view | lens | tilt | people | composition | technique | role | intent | panel | page | balloon | effect
// c: constraint fields for the camera gacha (see gacha.sampleSpec); other fields are read by the builder.
const T = [
  // shot size
  ['Extreme long shot', 'size', { c: { size: 0, zoom: 2.2 } }, ['els', 'ews', 'extreme wide shot']],
  ['Long shot', 'size', { c: { size: 0 } }, ['ls', 'wide shot', 'ws']],
  ['Full shot', 'size', { c: { size: 1 } }, ['fs', 'full body shot']],
  ['Knee shot', 'size', { c: { size: 1, zoom: 0.74 } }, ['ks', 'mls', 'medium long shot', 'medium full shot', 'cowboy shot']],
  ['Medium shot', 'size', { c: { size: 2 } }, ['ms', 'mid shot', 'waist shot']],
  ['Medium close-up', 'size', { c: { size: 3 } }, ['mcu', 'bust shot']],
  ['Close-up', 'size', { c: { size: 4 } }, ['cu', 'closeup']],
  ['Extreme close-up', 'size', { c: { size: 4, zoom: 0.55 } }, ['ecu', 'xcu', 'bcu', 'extreme closeup']],
  // angle
  ['Bird\'s-eye view', 'angle', { c: { elev: [62, 76] } }, ['birds eye', 'overhead', 'top down', 'bev']],
  ['High angle', 'angle', { c: { elev: [28, 42] } }, ['ha', 'high']],
  ['Slight high angle', 'angle', { c: { elev: [12, 20] } }, ['slightly high']],
  ['Eye level', 'angle', { c: { elev: [-3, 5] } }, ['el', 'eye level angle']],
  ['Low angle', 'angle', { c: { elev: [-22, -12] } }, ['la', 'low']],
  ['Worm\'s-eye view', 'angle', { c: { elev: [-38, -28] } }, ['worms eye', 'extreme low angle']],
  ['Low position', 'angle', { c: { elev: [-7, 0] } }, ['low camera']],
  ['High position', 'angle', { c: { elev: [8, 14] } }, ['high camera']],
  // view (around the subject)
  ['Front', 'view', { c: { view: 0 } }, ['front view', 'frontal']],
  ['Three-quarter', 'view', { c: { view: 40 } }, ['3 4', 'three quarter view', '3q']],
  ['Profile', 'view', { c: { view: 88 } }, ['side view', 'side']],
  ['Three-quarter back', 'view', { c: { view: 135 } }, ['3 4 back', 'three quarter back view']],
  ['From behind', 'view', { c: { view: 178 } }, ['back view', 'rear view']],
  // lens
  ['Ultra-wide lens', 'lens', { c: { fov: lensFov(16) } }, ['ultra wide', 'fisheye']],
  ['Wide-angle lens', 'lens', { c: { fov: lensFov(24) } }, ['wide angle', 'wide lens']],
  ['Normal lens', 'lens', { c: { fov: lensFov(45) } }, ['standard lens', 'normal']],
  ['Telephoto lens', 'lens', { c: { fov: lensFov(100) } }, ['telephoto', 'tele', 'long lens']],
  ['Super-telephoto lens', 'lens', { c: { fov: 8 } }, ['super telephoto']],
  // tilt
  ['Dutch angle', 'tilt', { c: { dutch: 12 } }, ['dutch', 'canted angle', 'tilted']],
  ['Strong Dutch angle', 'tilt', { c: { dutch: 24 } }, ['strong dutch', 'extreme dutch']],
  // people in shot
  ['Two-shot', 'people', { c: { type: 'two' } }, ['2s', 'two shot']],
  ['Group shot', 'people', { c: { type: 'two', zoom: 1.1 } }, ['group']],
  // composition
  ['Centered composition', 'composition', { c: { frame: 'center' } }, ['centered', 'centre', 'center']],
  ['Lead room', 'composition', { c: {} }, ['look room', 'nose room']],
  ['Cornered framing', 'composition', { c: { frame: 'corner' } }, ['corner']],
  ['Frame left', 'composition', { c: { frame: 'left' } }, ['left of frame']],
  ['Frame right', 'composition', { c: { frame: 'right' } }, ['right of frame']],
  // technique
  ['Establishing shot', 'technique', { c: { type: 'establish' }, role: 'establish' }, ['establishing']],
  ['Over-the-shoulder shot', 'technique', { c: { type: 'ots' } }, ['ots', 'over the shoulder', 'over shoulder']],
  ['Foreground framing', 'technique', { c: { type: 'ots' } }, ['foreground frame']],
  ['POV shot', 'technique', { c: { type: 'pov' } }, ['pov', 'point of view']],
  ['Shot reverse shot', 'technique', { c: { types: { ots: 3, single: 1 } } }, ['reverse shot', 'shot reverse']],
  ['Reaction shot', 'technique', { c: { types: { single: 3, ots: 1 } }, role: 'reaction' }, ['reaction']],
  ['Punch-in', 'technique', { c: { copy: 'prev', sizeDelta: 1 } }, ['punch in', 'push in']],
  ['Axial cut', 'technique', { c: { copy: 'prev', sizeDelta: 2 } }, ['axial']],
  ['Pull-back', 'technique', { c: { copy: 'prev', sizeDelta: -1 } }, ['pull back', 'pull out']],
  ['Same-position shot', 'technique', { c: { copy: 'prev' } }, ['same position', 'same framing']],
  ['Hold beat', 'technique', { c: { copy: 'prev' }, role: 'reaction', small: true }, ['hold']],
  ['Power-dynamic framing', 'technique', { c: { elev: [-24, -14] } }, ['power dynamic', 'power framing']],
  ['Symmetrical composition', 'technique', { c: { frame: 'center', az: 0, view: 0 } }, ['symmetrical', 'symmetry']],
  ['Averted gaze', 'technique', { gaze: 'away' }, ['averted']],
  ['Partial framing', 'technique', { c: { frame: 'corner', zoom: 0.8 } }, ['partial']],
  ['Eyeline match', 'technique', { c: { type: 'pov' } }, ['eyeline']],
  ['Profile two-shot', 'technique', { c: { type: 'two', az: 0 } }, ['profile two shot']],
  ['Deep staging', 'technique', { c: { type: 'two', az: 55 } }, ['depth staging']],
  ['Back shot', 'technique', { c: { type: 'single', view: 178 } }, ['back']],
  ['Negative space', 'technique', { c: { frame: 'negative', zoom: 1.35 } }, ['empty space']],
  ['Insert shot', 'technique', { c: { size: 4, zoom: 0.5, fy: -0.35 } }, ['insert', 'detail shot', 'cutaway']],
  ['Eye close-up', 'technique', { c: { size: 4, zoom: 0.4, fy: 0.05, frame: 'center' } }, ['eyes close up', 'eye cu']],
  ['Telephoto compression', 'technique', { c: { fov: 12 } }, ['compression']],
  ['Wide-angle exaggeration', 'technique', { c: { fov: 70 } }, ['wide angle exaggeration', 'exaggerated perspective']],
  ['Looking at the camera', 'technique', { gaze: 'camera', c: { view: 0 } }, ['looking at camera', 'looking at the reader', 'breaking the fourth wall']],
  ['Dolly zoom', 'technique', { c: { fov: 60 } }, ['vertigo shot']],
  ['Intimate two-shot', 'technique', { c: { type: 'two', size: 3 } }, ['intimate two shot', 'close two shot']],
  // panel role
  ['Establishing', 'role', { role: 'establish' }, []],
  ['Dialogue', 'role', { role: 'dialogue' }, []],
  ['Climax', 'role', { role: 'key', large: true }, ['key moment', 'key']],
  ['Reaction', 'role', { role: 'reaction' }, []],
  ['Beat', 'role', { role: 'reaction', small: true }, ['pause', 'silent beat']],
  // staging intent -> tone
  ['Calm', 'intent', { tone: 'daily' }, ['everyday', 'daily']],
  ['Tension', 'intent', { tone: 'tension' }, ['tense']],
  ['Conflict', 'intent', { tone: 'conflict' }, []],
  ['Surprise', 'intent', { tone: 'surprise' }, ['shock']],
  ['Intimacy', 'intent', { tone: 'intimate' }, ['intimate', 'romance']],
  ['Sadness', 'intent', { tone: 'sad' }, ['sad', 'lonely']],
  ['Comedy', 'intent', { tone: 'comedy' }, ['funny', 'gag']],
  ['Resolve', 'intent', { tone: 'resolve' }, ['determination']],
  ['Unease', 'intent', { tone: 'ominous' }, ['ominous', 'creepy']],
  ['Joy', 'intent', { tone: 'joy' }, ['happy']],
  // panel size & shape
  ['Large panel', 'panel', { large: true }, ['large', 'big panel', 'big']],
  ['Small panel', 'panel', { small: true }, ['small']],
  ['Wide panel', 'panel', { wide: true }, ['wide']],
  ['Tall panel', 'panel', { tall: true }, ['tall']],
  ['Bleed', 'panel', { bleed: true }, ['full bleed']],
  ['Breakout figure', 'panel', { breakout: true }, ['breakout', 'break the frame', 'pop out']],
  // page
  ['Page-turn reveal', 'page', { reveal: true }, ['page turn reveal', 'reveal']],
  ['Cliffhanger', 'page', { cliffhanger: true }, ['cliff hanger']],
  ['Two-page spread', 'page', { spread: true }, ['spread', 'double page spread']],
  ['Title page', 'page', { title: true }, ['title', 'splash page', 'splash']],
  // balloons
  ['Normal balloon', 'balloon', { balloon: 'speech' }, ['speech balloon', 'normal']],
  ['Burst balloon', 'balloon', { balloon: 'shout' }, ['shout', 'burst', 'scream']],
  ['Wavy balloon', 'balloon', { balloon: 'wavy' }, ['wavy', 'shaky balloon', 'trembling balloon']],
  ['Whisper balloon', 'balloon', { balloon: 'whisper' }, ['whisper']],
  ['Thought balloon', 'balloon', { balloon: 'thought' }, ['thought']],
  ['Off-panel voice', 'balloon', { balloon: 'off' }, ['off panel', 'off screen', 'offscreen']],
  ['Electronic balloon', 'balloon', { balloon: 'electronic' }, ['electronic', 'phone', 'radio balloon']],
  ['Eerie balloon', 'balloon', { balloon: 'eerie' }, ['eerie', 'ghostly']],
  ['Caption', 'balloon', { balloon: 'caption' }, ['narration box']],
];

const EFFECTS = ['Focus lines', 'Light rays', 'Beta flash', 'Uni flash', 'Speed lines', 'Curved speed lines', 'Wind lines', 'Vertical gloom lines', 'Rain', 'Cross-hatching', 'Cross-hatch gradient', 'Black-edge hatching', 'Rope hatching', 'Rope hatching gradient', 'Radial rope hatching', 'Halftone dots', 'Line tone', 'Gradient tone', 'Pattern tone', 'Stipple', 'Sand grain tone', 'Sparkles', 'Flower background', 'Hearts', 'Petals', 'Bubbles', 'Snow'];
export const EFFECT_IDS = Object.fromEntries(EFFECTS.map((e) => [norm(e).replace(/ (.)/g, (_, ch) => ch.toUpperCase()), e]));
for (const [id, label] of Object.entries(EFFECT_IDS)) T.push([label, 'effect', { effect: id }, []]);

export const TAGS = {};
export const TAG_LIST = [];
for (const [label, kind, data, aliases] of T) {
  const id = norm(label);
  const tag = { id, label, kind, ...data };
  TAG_LIST.push(tag);
  for (const a of [label, ...aliases]) TAGS[norm(a)] = tag;
}
export const lookupTag = (word) => TAGS[norm(word)] || null;
export const TAG_KINDS = { size: 'Shot size', angle: 'Camera angle', view: 'View', lens: 'Lens', tilt: 'Tilt', people: 'People in shot', composition: 'Composition', technique: 'Technique', role: 'Panel role', intent: 'Staging intent', panel: 'Panel size & shape', page: 'Page', balloon: 'Balloons', effect: 'Effect lines' };

// Balloon shapes accepted by [Balloon Name=type,intensity,shape].
export const BALLOON_SHAPES = ['ellipse', 'rect', 'cloud', 'thought', 'wave', 'electronic', 'fuzz', 'aura', 'sparkle', 'spike', 'explosion', 'tremble', 'flash', 'urchin', 'fude', 'crack'];

// Pose words -> Koma pose ids (any pose id or pose name from the library also works).
export const POSE_WORDS = {
  'natural stance': 'stand', stand: 'stand', 'weight on one leg': 'weightShift', 'hands behind back': 'handsBehindBack',
  'hands in pockets': 'handsInPockets', 'hand on hip': 'handOnHip', 'hands on hips': 'handsOnHips', 'arms crossed': 'armsCrossed',
  'hand on chin': 'thinkChin', 'scratching head': 'sheepish', 'finger to temple': 'thinkChin', 'holding one arm': 'holdArm',
  'palm up': 'gesture', 'pointing at self': 'pointSelf', 'arms spread': 'armsSpread', 'raising a hand': 'raiseHand', waving: 'waveHello',
  offering: 'offering', 'stop gesture': 'stopGesture', shrugging: 'shrug', pointing: 'point', 'reaching out': 'reachOut',
  'recoiling in surprise': 'surprised', 'hand to mouth': 'coverMouth', 'covering face': 'facepalm', 'head in hands': 'cryIntoHands',
  'hand on chest': 'handOnChest', bow: 'bow', 'head hung low': 'slump', 'leaning in': 'leanIn', 'pulling back': 'dodge',
  'half turned away': 'sulk', 'head tilt': 'headTilt', 'hugging oneself': 'hugSelf', 'clenched fists': 'angry', 'both hands up': 'surprised',
  'fist pump': 'fistPump', walking: 'walking', running: 'running', 'looking back': 'lookBack', 'landing knee and fist': 'kneelOne',
  squatting: 'crouch', 'kneeling on one knee': 'kneelOne', 'hugging knees': 'sitHugKnees', seiza: 'seiza', 'seiza formal kneeling': 'seiza',
  'sitting cross legged': 'sitCrossLegged', 'slumped on the floor': 'collapsed', skip: 'jumping', jump: 'jumping', punch: 'punch',
  kick: 'highKick', throw: 'throw', fall: 'fallingBack', sit: 'sitChair', 'look at phone': 'texting', 'phone call': 'phoneCall',
  eat: 'eatFork', drink: 'drinkCup', write: 'writeNotebook', read: 'readBook', stretch: 'stretch', 'lie down': 'lieBack',
  cry: 'cryIntoHands', angry: 'angry', shy: 'shy', kneel: 'kneel', crouch: 'crouch', wave: 'waveHello', point: 'point', think: 'thinkChin',
};

export const EXPRESSIONS = ['happy', 'angry', 'sad', 'relaxed', 'surprised', 'neutral', 'default'];
export const GAZES = { partner: 'partner', camera: 'camera', reader: 'camera', forward: 'forward', down: 'down', away: 'away', up: 'up' };
export const ROOMS = ['classroom', 'bedroom', 'living room', 'cafe', 'street', 'office', 'park'];
// Cast models: built-in mannequin builds (heights are given per character).
export const MODELS = { M01: { label: 'Mannequin (male build)' }, F01: { label: 'Mannequin (female build)' }, Doll: { label: 'Doll (small mannequin)' } };

// A pose word, id or library name -> pose id (null if unknown).
export function resolvePose(word) {
  if (!word) return null;
  const w = String(word).trim();
  if (getPose(w)) return w;
  const mapped = POSE_WORDS[norm(w)];
  if (mapped && getPose(mapped)) return mapped;
  const byName = listPoses({ adult: true }).find((p) => norm(p.name || '') === norm(w) || norm(p.id) === norm(w));
  return byName?.id || null;
}
