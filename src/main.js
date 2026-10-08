import './style.css';
import '@fontsource-variable/inter';
import { icon, hydrateIcons, initTheme, initMenus, initPaneTabs, toast, cssVar, fadeIn, shake, spinIcon, confirmIcon, countTo, afterPaint, crossfadeCanvas, initSegThumbs, initTooltips, initValueEditing, reducedMotion } from './ui.js';
import '@fontsource/comic-neue/700.css';
import '@fontsource/comic-neue/700-italic.css';
import '@fontsource/bangers/400.css';
import { letterPanel, FONT } from './letter.js';
import { FORMATS, PRESETS, TIER_OPTIONS, GRID_SHAPES, BLEED_MODES, LAYOUT_KEYS, defaultLayoutParams, generateLayout, layoutToSVG } from './layout.js';
import {
  CRITERIA, SIZES, STYLES, TONES, TYPES, ROLES,
  buildWorld, defaultPositions, planRoles, rollProposal, rescoreProposal, rerollPanel, shotLabel,
} from './gacha.js';
import { Mannequin, loadVrmFromFile, poseLabels } from './figures.js';
import { loadCustomPoses, posesReady } from './poses/index.js';
import { StoryRenderer, drawPage, pageToSVG, scoreColor } from './renderer.js';
import { TopDown } from './topdown.js';
import { printGeometry, drawCropMarks } from './print.js';
import { PoseEditor } from './pose-editor.js';
import { buildImagePrompt, castLabels, suggestedSize } from './prompt-export.js';
import { preloadModels, listProps } from './props.js';
import { listPoses, posedWorld } from './pose-runtime.js';
import { VideoWorkspace } from './video-ui.js';

hydrateIcons();
const $ = (sel) => document.querySelector(sel);
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (v === true) e.setAttribute(k, '');
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null) e.append(k);
  return e;
};

const store = {
  get(k, d) { try { const v = localStorage.getItem('ng:' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ng:' + k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
};

// ---------------------------------------------------------------- state

const DEFAULT_CHARS = [
  { name: 'Aoi', height: 156, color: '#e2735f' },
  { name: 'Ren', height: 174, color: '#5a8fd8' },
  { name: 'Mika', height: 162, color: '#5fb87a' },
];

const DEFAULT_SHOW = {
  caps: true,
  breakBorders: false,
  names: true, balloons: true, roles: true, eyeLevel: false, guide: false,
  orderNums: true, readLines: false, entryExit: false, gaze: false, axis: false, thirds: false, scores: true,
};

const state = {
  tab: store.get('tab', 'story'),
  lp: { ...defaultLayoutParams(), count: 24, numbers: true, guide: true, ...store.get('lp', {}) },
  sl: { ...defaultLayoutParams(), index: 1, ...store.get('sl', {}) },
  nChars: store.get('nChars', 2),
  chars: DEFAULT_CHARS.map((c, i) => ({ ...c, ...(store.get('chars', [])[i] || {}), model: 'mannequin', vrmName: null })),
  gacha: { seed: 'G-1', style: 'balance', tone: 'auto', intensity: 'normal', count: 6, ...store.get('gacha', {}) },
  renderStyle: store.get('renderStyle', 'shaded'),
  show: { ...DEFAULT_SHOW, ...store.get('show', {}) },
  view: 'single',
  current: 0,
  proposals: [],
  locks: {},
  removed: [],
  undo: [],
  selected: new Set(),
  planOverrides: {},
  scripts: {}, // panel index -> {dialogue: [{speaker, text, kind}], caption, sfx: [{text, size}]}
  layoutDialogIndex: null,
};
resetPositions(true);
readHash();

function resetPositions(useStored) {
  const pos = defaultPositions(state.nChars);
  const stored = useStored ? store.get('pos:' + state.nChars, null) : null;
  state.chars.forEach((c, i) => {
    const p = stored?.[i] || pos[i] || { x: 0, z: 0 };
    c.x = p.x; c.z = p.z;
  });
}

function save() {
  store.set('tab', state.tab);
  store.set('lp', pick(state.lp, [...LAYOUT_KEYS, 'count', 'numbers', 'guide']));
  store.set('sl', pick(state.sl, [...LAYOUT_KEYS, 'index']));
  store.set('nChars', state.nChars);
  store.set('chars', state.chars.map((c) => pick(c, ['name', 'height', 'color', 'base', 'description'])));
  store.set('pos:' + state.nChars, state.chars.slice(0, state.nChars).map((c) => ({ x: c.x, z: c.z })));
  store.set('gacha', state.gacha);
  store.set('renderStyle', state.renderStyle);
  store.set('show', state.show);
}
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => k in o).map((k) => [k, o[k]]));

// ---------------------------------------------------------------- tabs

function setTab(t) {
  const changed = state.tab !== t;
  state.tab = t;
  document.querySelectorAll('.tab').forEach((b) => { b.classList.toggle('on', b.dataset.tab === t); b.setAttribute('aria-selected', String(b.dataset.tab === t)); });
  $('#tab-layout').hidden = t !== 'layout';
  $('#tab-story').hidden = t !== 'story';
  $('#tab-poses').hidden = t !== 'poses';
  $('#tab-video').hidden = t !== 'video';
  // the 3D editor builds right after the tab has painted (first visit only; later visits just resize)
  if (t === 'poses') { if (poseEditor.built) poseEditor.mount(); else afterPaint(() => { if (state.tab === 'poses') poseEditor.mount(); }); }
  if (t === 'layout' && !$('#lp-grid').childElementCount) renderLayoutGrid();
  if (t === 'story') {
    if (!state.proposals.length) rollAll();
    else if (storyStale) drawAll();
  }
  if (t === 'video') {
    if (!state.proposals.length) rollAll();
    storyStale = true; // the video preview shares the renderer
    afterPaint(() => { if (state.tab === 'video') video?.show(); });
  } else video?.hide();
  if (changed) fadeIn($('#tab-' + t), { from: 0.55, duration: 120 });
  save();
}
let storyStale = true; // something changed while Shots was hidden
let video = null; // Video workspace (created at boot)
document.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));

// ---------------------------------------------------------------- shared layout controls

function fillSelect(sel, entries, value) {
  sel.innerHTML = '';
  for (const [v, label] of entries) sel.append(el('option', { value: v }, label));
  sel.value = value;
}

function presetButtons(container, params, onChange) {
  container.innerHTML = '';
  for (const [key, p] of Object.entries(PRESETS)) {
    const b = el('button', { class: params.preset === key ? 'on' : '' }, p.label);
    b.addEventListener('click', () => {
      const { label, ...values } = p;
      Object.assign(params, values, { preset: key });
      onChange();
    });
    container.append(b);
  }
}

// ---------------------------------------------------------------- PANEL LAYOUT TAB

const LP_SLIDERS = ['hTilt', 'vTilt', 'steep', 'bleed', 'inner', 'big', 'inset', 'diag', 'border'];

function syncLayoutControls() {
  const p = state.lp;
  presetButtons($('#lp-presets'), p, () => { syncLayoutControls(); renderLayoutGrid(); });
  fillSelect($('#lp-format'), Object.entries(FORMATS).map(([k, f]) => [k, f.label]), p.format);
  $('#lp-dir').value = p.dir;
  fillSelect($('#lp-tiers'), TIER_OPTIONS.map((t) => [t, t.replace('-', '–')]), p.tiers);
  fillSelect($('#lp-gridShape'), Object.entries(GRID_SHAPES), p.grid || 'off');
  fillSelect($('#lp-bleedMode'), Object.entries(BLEED_MODES), p.bleedMode || 'none');
  $('#lp-repeat').checked = !!p.repeat;
  for (const k of LP_SLIDERS) {
    const input = $('#lp-' + k);
    input.value = p[k];
    input.nextElementSibling.value = p[k];
  }
  $('#lp-count').value = String(p.count);
  $('#lp-seed').value = p.seed;
  $('#lp-numbers').checked = p.numbers;
  $('#lp-guide').checked = p.guide;
}

function bindLayoutControls() {
  const p = state.lp;
  const rerender = () => { save(); renderLayoutGrid(); };
  $('#lp-format').addEventListener('change', (e) => { p.format = e.target.value; rerender(); });
  $('#lp-dir').addEventListener('change', (e) => { p.dir = e.target.value; rerender(); });
  $('#lp-tiers').addEventListener('change', (e) => { p.tiers = e.target.value; rerender(); });
  $('#lp-gridShape').addEventListener('change', (e) => { p.grid = e.target.value; rerender(); });
  $('#lp-bleedMode').addEventListener('change', (e) => { p.bleedMode = e.target.value; rerender(); });
  $('#lp-repeat').addEventListener('change', (e) => { p.repeat = e.target.checked; rerender(); });
  for (const k of LP_SLIDERS) {
    const input = $('#lp-' + k);
    input.addEventListener('input', () => { p[k] = Number(input.value); input.nextElementSibling.value = input.value; });
    input.addEventListener('change', rerender);
  }
  $('#lp-count').addEventListener('change', (e) => { p.count = Number(e.target.value); rerender(); });
  $('#lp-seed').addEventListener('change', (e) => { p.seed = e.target.value.trim() || 'SC-2026'; rerender(); });
  $('#lp-numbers').addEventListener('change', (e) => { p.numbers = e.target.checked; rerender(); });
  $('#lp-guide').addEventListener('change', (e) => { p.guide = e.target.checked; rerender(); });
  $('#lp-generate').addEventListener('click', () => {
    p.seed = randomSeed('SC');
    $('#lp-seed').value = p.seed;
    rerender();
  });
  $('#lp-close').addEventListener('click', () => $('#lp-dialog').close());
  $('#lp-svg').addEventListener('click', () => {
    const lay = generateLayout(state.lp, state.layoutDialogIndex);
    download(new Blob([layoutToSVG(lay, { numbers: p.numbers, guide: p.guide })], { type: 'image/svg+xml' }), `layout-${p.seed}-${pad(state.layoutDialogIndex + 1)}.svg`);
  });
  $('#lp-png').addEventListener('click', async () => {
    const lay = generateLayout(state.lp, state.layoutDialogIndex);
    const blob = await svgToPng(layoutToSVG(lay, { numbers: p.numbers, guide: p.guide }), lay.W * 2, lay.H * 2);
    download(blob, `layout-${p.seed}-${pad(state.layoutDialogIndex + 1)}.png`);
  });
  $('#lp-use').addEventListener('click', () => {
    Object.assign(state.sl, pick(state.lp, LAYOUT_KEYS));
    state.sl.index = state.layoutDialogIndex + 1;
    $('#lp-dialog').close();
    setTab('story');
    onStoryLayoutChanged();
  });
}

function renderLayoutGrid() {
  const grid = $('#lp-grid');
  grid.innerHTML = '';
  const p = state.lp;
  $('#lp-summary').textContent = `${p.count} pages · ${FORMATS[p.format].label} · ${p.dir === 'rtl' ? 'right to left' : 'left to right'}`;
  const gen = ++galleryGen;
  const addCard = (i) => {
    const lay = generateLayout(p, i);
    const box = el('div', { class: 'svgbox' });
    box.innerHTML = layoutToSVG(lay, { numbers: p.numbers, guide: p.guide });
    const card = el('div', { class: 'lcard', tabindex: 0, role: 'button', 'aria-label': `Layout ${i + 1}, ${lay.panels.length} panels` }, box,
      el('div', { class: 'cap' }, el('b', {}, pad(i + 1)), el('span', {}, `${lay.panels.length} panels`)));
    card.addEventListener('click', () => openLayoutDialog(i, box));
    card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLayoutDialog(i, box); } });
    grid.append(card);
    fadeIn(card, { from: 0, y: 8, duration: 220, delay: Math.min(i, 14) * 16 });
  };
  const first = Math.min(p.count, 10);
  for (let i = 0; i < first; i++) addCard(i);
  // the rest after the first paint, in small batches, so the tab switch itself stays instant
  let next = first;
  const more = () => {
    if (gen !== galleryGen) return;
    for (const end = Math.min(p.count, next + 6); next < end; next++) addCard(next);
    if (next < p.count) requestAnimationFrame(more);
  };
  if (next < p.count) afterPaint(more);
}
let galleryGen = 0;

function openLayoutDialog(i, fromEl) {
  state.layoutDialogIndex = i;
  const lay = generateLayout(state.lp, i);
  const big = $('#lp-big-svg');
  big.innerHTML = layoutToSVG(lay, { numbers: state.lp.numbers, guide: state.lp.guide });
  $('#lp-dlg-title').textContent = `Layout ${pad(i + 1)} · ${lay.panels.length} panels`;
  const dlg = $('#lp-dialog');
  dlg.classList.toggle('zoom', !!fromEl);
  dlg.showModal();
  // the page grows out of the thumbnail that was clicked
  if (fromEl && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const a = fromEl.getBoundingClientRect();
    const b = big.getBoundingClientRect();
    if (a.width && b.width) {
      big.animate([
        { transform: `translate(${a.left - b.left}px, ${a.top - b.top}px) scale(${a.width / b.width})` },
        { transform: 'none' },
      ], { duration: 320, easing: 'cubic-bezier(0.2, 0.9, 0.25, 1)' });
    }
  }
}

// ---------------------------------------------------------------- STORYBOARD TAB

const sr = new StoryRenderer();
const figures = DEFAULT_CHARS.map((_, i) => new Mannequin(state.chars[i].height / 100, state.chars[i].color));
let layout = null;
let world = null;

const top = new TopDown($('#sb-top'), {
  onMove(i, x, z, live) {
    state.chars[i].x = x;
    state.chars[i].z = z;
    world = buildWorld(activeChars());
    for (const p of state.proposals) rescoreProposal(p, world);
    if (live) { drawTop(); scheduleDraw(); }
    else { save(); drawAll(); }
  },
});

const activeChars = () => state.chars.slice(0, state.nChars);

function currentLayout() {
  const base = generateLayout(state.sl, Math.max(0, state.sl.index - 1));
  if (state.removed.length) {
    const rm = new Set(state.removed);
    base.panels = base.panels.filter((_, i) => !rm.has(i));
    base.panels.forEach((p, i) => { p.order = i; });
  }
  return base;
}

function currentPlan() {
  const plan = planRoles(layout, state.nChars);
  for (const [i, o] of Object.entries(state.planOverrides)) {
    if (!plan[i]) continue;
    if (o.role) plan[i].role = o.role;
    if (o.speaker != null) {
      plan[i].speaker = o.speaker;
      if (o.speaker >= 0) plan[i].focus = o.speaker;
      else plan[i].focus = (plan[i - 1]?.speaker >= 0 ? (plan[i - 1].speaker + 1) % state.nChars : 0);
    }
  }
  return plan;
}

function rollAll({ newSeed = false } = {}) {
  if (newSeed) state.gacha.seed = randomSeed('G');
  $('#g-seed').value = state.gacha.seed;
  layout = currentLayout();
  world = buildWorld(activeChars());
  const plan = currentPlan();
  state.proposals = [];
  for (let k = 0; k < state.gacha.count; k++) {
    // locks apply to every proposal so locked panels survive the reroll
    state.proposals.push(rollProposal({
      layout, world, plan, tone: state.gacha.tone, intensity: state.gacha.intensity, style: state.gacha.style,
      seed: `${state.gacha.seed}|${k}`, locks: state.locks, nChars: state.nChars, staging: stagingFor(),
    }));
  }
  state.current = Math.min(state.current, state.proposals.length - 1);
  save();
  drawAll();
}

function prop() { return state.proposals[state.current]; }

// Page-level base poses (char index -> pose id) for the active cast.
function stagingFor() {
  const out = {};
  activeChars().forEach((c, i) => { if (c.base) out[i] = c.base; });
  return out;
}

// Full-body poses that make sense as a scene's base (standing variants, seated, on the ground).
function basePoseOptions() {
  return [['', 'Standing (default)'], ...listPoses().filter((p) => !p.pair && p.layer !== 'upper' && ['standing', 'sitting', 'ground'].includes(p.cat) && p.id !== 'stand').map((p) => [p.id, `${p.cat}: ${p.name || p.id}`])];
}

// --- drawing

let resizeQueued = false;
function scheduleResize() {
  if (resizeQueued) return;
  resizeQueued = true;
  requestAnimationFrame(() => { resizeQueued = false; drawPageMain({ ifResized: true }); });
}
let drawQueued = false;
// Render generation: bumped whenever something that changes how pages look changes. Each view
// remembers the generation it was drawn at, so switching views reuses what is already rendered.
let gen = 0;
const touch = () => { gen++; };
let stripGen = -1;
let compareGen = -1;
let pageGen = -1;
let pageProp = -1;

function scheduleDraw() {
  touch();
  if (drawQueued) return;
  drawQueued = true;
  requestAnimationFrame(() => { drawQueued = false; drawPageMain(); });
}

// reuse: nothing changed, only show what is current (switching views or proposals)
function drawAll({ reuse = false } = {}) {
  if (!reuse) touch();
  if (state.tab !== 'story' || !layout) { storyStale = true; return; }
  storyStale = false;
  if (state.view === 'compare') {
    if (compareGen !== gen) drawCompare();
    else markCurrent('#sb-compare');
  } else {
    if (stripGen !== gen) drawStrip();
    else markCurrent('#sb-strip');
    if (pageGen !== gen || pageProp !== state.current) drawPageMain();
    else drawOverlay();
    drawInspector();
    drawScores();
    drawTop();
    drawMeta();
  }
}

function pageOpts(scale, extra = {}) {
  return { scale, show: state.show, chars: activeChars(), ...extra };
}

function drawPageMain(opts = {}) {
  if (!layout || !prop()) return;
  const canvas = $('#sb-page');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const wrap = canvas.closest('.page-wrap');
  const cs = getComputedStyle(wrap);
  const avail = wrap.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  if (avail <= 0) return; // tab hidden
  const availH = wrap.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
  const fit = window.matchMedia('(min-width: 981px)').matches && availH > 160;
  // narrow windows: cap the page height so the proposals and inspector below stay in view
  const cssW = Math.floor(Math.min(avail, ((fit ? availH : window.innerHeight * 0.7) * layout.W) / layout.H));
  const sizeKey = `${cssW}@${dpr}`;
  if (opts.ifResized && sizeKey === lastPageSize) return;
  const scale = (cssW / layout.W) * dpr;
  canvas.width = Math.round(layout.W * scale);
  canvas.height = Math.round(layout.H * scale);
  canvas.style.width = cssW + 'px';
  const g = canvas.getContext('2d');
  drawPage(g, sr, layout, prop(), world, pageOpts(scale, { skipBalloons: scriptedPanels(), uiScale: dpr, accent: cssVar('--accent') }));
  pageHits = letterPage(g, scale, prop());
  lastPageSize = sizeKey;
  pageGen = gen;
  pageProp = state.current;
  drawOverlay();
}
let pageHits = [];
let lastPageSize = '';

// Selection and hover outlines, drawn over the canvas in page units (cheap, so they can follow the pointer).
let overlayKey = '';
let overlayLayout = null;
function drawOverlay() {
  const svg = $('#sb-overlay');
  if (!layout) return;
  svg.setAttribute('viewBox', `0 0 ${layout.W} ${layout.H}`);
  const hover = state.hoverPanel ?? state.hoverRow;
  const key = `${[...state.selected].join(',')}|${hover}|${layout.W}|${layout.panels.length}`;
  if (key === overlayKey && overlayLayout === layout) return;
  overlayLayout = layout;
  const prevSel = new Set((overlayKey.split('|')[0] || '').split(',').filter(Boolean).map(Number));
  overlayKey = key;
  const poly = (pn, cls) => {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    el.setAttribute('points', pn.poly.map(([x, y]) => `${x},${y}`).join(' '));
    el.setAttribute('class', cls);
    el.setAttribute('vector-effect', 'non-scaling-stroke');
    return el;
  };
  svg.replaceChildren();
  if (hover != null && layout.panels[hover] && !state.selected.has(hover)) svg.append(poly(layout.panels[hover], 'hov'));
  for (const i of state.selected) if (layout.panels[i]) svg.append(poly(layout.panels[i], prevSel.has(i) ? 'sel' : 'sel new'));
}
const panelAt = ([x, y]) => {
  let hit = layout.panels.findIndex((pn) => pn.inset && pointInPoly([x, y], pn.poly));
  if (hit < 0) hit = layout.panels.findIndex((pn) => pointInPoly([x, y], pn.poly));
  return hit < 0 ? null : hit;
};

// --- drag balloons / captions / SFX on the page (double-click resets to automatic placement)

const pagePoint = (e) => {
  const c = $('#sb-page');
  const r = c.getBoundingClientRect();
  return [((e.clientX - r.left) / r.width) * layout.W, ((e.clientY - r.top) / r.height) * layout.H];
};
const hitAt = ([x, y]) => [...pageHits].reverse().find((h) => ((x - h.x) / h.ex) ** 2 + ((y - h.y) / h.ey) ** 2 <= 1.05);
function letterTarget(h) {
  const sc = state.scripts[h.panel];
  if (!sc) return null;
  if (h.kind === 'line') return { obj: sc.dialogue[h.index], key: 'pos' };
  if (h.kind === 'caption') return { obj: sc, key: 'captionPos' };
  return { obj: sc.sfx[h.index], key: 'pos' };
}
let drag = null;
let suppressClick = false;
$('#sb-page').addEventListener('pointerdown', (e) => {
  if (!layout) return;
  suppressClick = false;
  const pt = pagePoint(e);
  const h = hitAt(pt);
  if (!h) return;
  drag = { h, dx: pt[0] - h.x, dy: pt[1] - h.y, moved: false };
  $('#sb-page').setPointerCapture(e.pointerId);
  e.preventDefault();
});
$('#sb-page').addEventListener('pointermove', (e) => {
  if (!layout) return;
  const pt = pagePoint(e);
  if (!drag) {
    const over = hitAt(pt);
    $('#sb-page').style.cursor = over ? 'grab' : 'pointer';
    const hp = over ? null : panelAt(pt);
    if (hp !== state.hoverPanel) { state.hoverPanel = hp; drawOverlay(); }
    return;
  }
  $('#sb-page').style.cursor = 'grabbing';
  const t = letterTarget(drag.h);
  if (!t?.obj) return;
  const b = layout.panels[drag.h.panel].bbox;
  t.obj[t.key] = { u: (pt[0] - drag.dx - b.x) / b.w, v: (pt[1] - drag.dy - b.y) / b.h };
  drag.moved = true;
  scheduleDraw();
});
$('#sb-page').addEventListener('pointerup', () => {
  if (!drag) return;
  if (drag.moved) {
    suppressClick = true;
    saveScripts();
    drawStrip();
    if (state.selected.has(drag.h.panel)) drawInspector();
  }
  drag = null;
});
$('#sb-page').addEventListener('dblclick', (e) => {
  const h = hitAt(pagePoint(e));
  const t = h && letterTarget(h);
  if (!t?.obj?.[t.key]) return;
  delete t.obj[t.key];
  saveScripts();
  drawAll();
});

// ---------------------------------------------------------------- lettering

const hasScript = (sc) => sc && ((sc.dialogue || []).some((d) => d.text?.trim()) || sc.caption?.trim() || (sc.sfx || []).some((f) => f.text?.trim()));
const scriptedPanels = () => new Set(Object.keys(state.scripts).map(Number).filter((i) => hasScript(state.scripts[i])));

// Draw balloons, captions and SFX for every scripted panel (insets last, on top).
function letterPage(ctx, scale, p, extra = {}) {
  const hits = [];
  if (!layout || !p) return hits;
  const f = layout.frame;
  const safe = { x: f.x - 30, y: f.y - 30, w: f.w + 60, h: f.h + 60 };
  const order = [...layout.panels.keys()].sort((a, b) => (layout.panels[a].inset ? 1 : 0) - (layout.panels[b].inset ? 1 : 0));
  for (const i of order) {
    const sc = state.scripts[i];
    if (!hasScript(sc) || !p.shots[i]) continue;
    const script = {
      caption: sc.caption?.trim() || undefined,
      captionPos: sc.captionPos,
      sfx: (sc.sfx || []).filter((x) => x.text?.trim()),
      dialogue: (sc.dialogue || []).filter((d) => d.text?.trim()).map((d) => ({ ...d, speaker: d.speaker != null && d.speaker >= state.nChars ? -1 : d.speaker })),
    };
    const h = letterPanel(ctx, scale, layout.panels[i], p.shots[i], script, { dir: layout.dir, caps: state.show.caps !== false, seed: `${state.gacha.seed}|${i}`, safe, allowBreak: !!state.show.breakBorders, blank: !!extra.blank });
    for (const hit of h) hits.push({ ...hit, panel: i });
  }
  return hits;
}

const scriptsKey = () => `${state.sl.seed}|${state.sl.index}|${state.sl.format}|${state.sl.dir}|${state.removed.join(',')}`;
function saveScripts() {
  store.set('scripts', { key: scriptsKey(), scripts: state.scripts });
}
function loadScripts() {
  const s = store.get('scripts', null);
  state.scripts = s && s.key === scriptsKey() ? s.scripts || {} : {};
}

let stripTimer = null;
function scriptChanged(i, speakerChanged) {
  saveScripts();
  if (speakerChanged) {
    const first = (state.scripts[i]?.dialogue || []).find((d) => Number.isInteger(d.speaker) && d.speaker >= 0);
    state.planOverrides[i] = { ...state.planOverrides[i], speaker: first ? first.speaker : -1 };
    replan(i);
    return;
  }
  scheduleDraw();
  clearTimeout(stripTimer);
  stripTimer = setTimeout(() => { drawStrip(); if (state.view === 'compare') drawCompare(); }, 600);
}

// The "Script" part of the panel inspector.
function scriptSection(i) {
  const sc = (state.scripts[i] ||= { dialogue: [], caption: '', sfx: [] });
  sc.dialogue ||= [];
  sc.sfx ||= [];
  const chars = activeChars();
  const wrap = el('div', { class: 'script' });
  const speakerOpts = [...chars.map((c, k) => [String(k), c.name]), ['narr', 'Narration (no tail)'], ['off', 'Off-panel voice']];
  const toSpeaker = (v) => (v === 'narr' ? null : v === 'off' ? -1 : Number(v));
  const fromSpeaker = (sp) => (sp == null ? 'narr' : sp === -1 ? 'off' : String(sp));

  sc.dialogue.forEach((d, k) => {
    const sp = el('select', { title: 'Who says it' });
    for (const [v, l] of speakerOpts) sp.append(el('option', { value: v }, l));
    sp.value = fromSpeaker(d.speaker);
    sp.addEventListener('change', () => { d.speaker = toSpeaker(sp.value); scriptChanged(i, k === 0); });
    const kind = el('select', { title: 'Balloon style' });
    for (const v of ['speech', 'thought', 'shout', 'whisper']) kind.append(el('option', { value: v }, v));
    kind.value = d.kind || 'speech';
    kind.addEventListener('change', () => { d.kind = kind.value; scriptChanged(i, false); });
    const auto = el('button', { class: 'icon-btn', title: 'Back to automatic placement (or double-click the balloon)', 'aria-label': 'Reset balloon position' }, icon('reset', 15));
    auto.hidden = !d.pos;
    auto.addEventListener('click', () => { delete d.pos; scriptChanged(i, false); drawInspector(); });
    const rm = el('button', { class: 'icon-btn', title: 'Remove this line', 'aria-label': 'Remove this line' }, icon('x', 15));
    rm.addEventListener('click', () => { sc.dialogue.splice(k, 1); scriptChanged(i, k === 0); drawInspector(); });
    const tx = el('textarea', { rows: 2, placeholder: 'What they say…' });
    tx.value = d.text || '';
    tx.addEventListener('input', () => { d.text = tx.value; scriptChanged(i, false); });
    wrap.append(el('div', { class: 'script-line' }, sp, kind, el('span', {}, auto, rm), tx));
  });

  const hint = el('p', { class: 'hint' }, 'Drag balloons, captions and SFX on the page to move them; double-click one to put it back.');
  const add = el('button', { class: 'btn' }, icon('plus'), el('span', {}, 'Add balloon'));
  add.addEventListener('click', () => {
    const plan = prop()?.shots[i]?.ctx;
    const last = sc.dialogue[sc.dialogue.length - 1];
    const speaker = last ? last.speaker : plan?.speaker >= 0 ? plan.speaker : 0;
    sc.dialogue.push({ speaker, text: '', kind: 'speech' });
    saveScripts();
    drawInspector();
    const boxes = $('#sb-inspector').querySelectorAll('.script-line textarea');
    boxes[boxes.length - 1]?.focus();
  });
  const resetAll = el('button', { class: 'btn ghost', title: 'Put every balloon, caption and SFX in this panel back to automatic placement' }, icon('reset'), el('span', {}, 'Auto-place all'));
  resetAll.hidden = !(sc.dialogue.some((d) => d.pos) || sc.captionPos || sc.sfx.some((f) => f.pos));
  resetAll.addEventListener('click', () => { sc.dialogue.forEach((d) => delete d.pos); delete sc.captionPos; sc.sfx.forEach((f) => delete f.pos); scriptChanged(i, false); drawInspector(); });
  wrap.append(el('div', { class: 'btn-row' }, add, resetAll), hint);

  const cap = el('textarea', { rows: 1, placeholder: 'Narration box (optional)' });
  cap.value = sc.caption || '';
  cap.addEventListener('input', () => { sc.caption = cap.value; scriptChanged(i, false); });
  wrap.append(el('div', { class: 'script-field' }, el('span', { class: 'label' }, 'Caption'), cap));

  const fx = sc.sfx[0] || (sc.sfx[0] = { text: '', size: 'medium' });
  const fxText = el('input', { type: 'text', placeholder: 'SFX, e.g. BANG', value: fx.text || '' });
  fxText.addEventListener('input', () => { fx.text = fxText.value; scriptChanged(i, false); });
  const fxSize = el('select');
  for (const v of ['small', 'medium', 'large']) fxSize.append(el('option', { value: v }, v));
  fxSize.value = fx.size || 'medium';
  fxSize.addEventListener('change', () => { fx.size = fxSize.value; scriptChanged(i, false); });
  wrap.append(el('div', { class: 'script-field' }, el('span', { class: 'label' }, 'Sound effect'), el('div', { class: 'row' }, fxText, fxSize)));
  return wrap;
}

function markCurrent(sel) {
  document.querySelectorAll(`${sel} .thumb`).forEach((t, j) => { t.classList.toggle('on', j === state.current); t.setAttribute('aria-pressed', String(j === state.current)); });
}

function drawStrip() {
  const strip = $('#sb-strip');
  strip.innerHTML = '';
  if (!layout) return;
  stripGen = gen;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const css = Math.min(150 / layout.H, 108 / layout.W);
  const scale = css * dpr;
  const quiet = { ...state.show, names: false, roles: false, gaze: false, axis: false, thirds: false, eyeLevel: false, readLines: false, entryExit: false, orderNums: false, scores: false };
  state.proposals.forEach((p, k) => {
    const c = el('canvas', { width: Math.round(layout.W * scale), height: Math.round(layout.H * scale), style: `width:${Math.round(layout.W * css)}px` });
    drawPage(c.getContext('2d'), sr, layout, p, world, { scale, show: quiet, chars: activeChars() });
    letterPage(c.getContext('2d'), scale, p);
    const t = el('div', { class: 'thumb' + (k === state.current ? ' on' : ''), tabindex: 0, role: 'button', 'aria-label': `Proposal ${k + 1}, ${p.total} points`, 'aria-pressed': String(k === state.current) }, c,
      el('div', { class: 'cap' }, el('span', {}, String(k + 1)), el('span', { class: 'pill', style: `background:${scoreColor(p.total)}` }, String(p.total))));
    t.addEventListener('click', () => selectProposal(k));
    t.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); t.click(); } });
    strip.append(t);
    if (stripEntrance) fadeIn(t, { from: 0, y: 10, duration: 240, delay: k * 22 });
  });
  stripEntrance = false;
}
let stripEntrance = false;

// Switch proposal: the page dissolves into the new one; the rail keeps its place.
function selectProposal(k) {
  if (!state.proposals[k]) return;
  if (k === state.current) return;
  state.current = k;
  state.selected.clear();
  // the rail answers immediately; the page re-renders right after that paint, then dissolves in
  document.querySelectorAll('#sb-strip .thumb').forEach((t, j) => { t.classList.toggle('on', j === k); t.setAttribute('aria-pressed', String(j === k)); });
  document.querySelectorAll('#sb-strip .thumb')[k]?.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
  afterPaint(() => { if (state.current === k) crossfadeCanvas($('#sb-page'), () => drawAll({ reuse: true })); });
}

let compareJob = 0;
function drawCompare() {
  const grid = $('#sb-compare');
  grid.innerHTML = '';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const scale = (340 / layout.W) * dpr;
  const job = ++compareJob;
  const jobGen = gen;
  const pending = [];
  state.proposals.forEach((p, k) => {
    const c = el('canvas', { width: Math.round(layout.W * scale), height: Math.round(layout.H * scale), class: 'pending' });
    pending.push(() => {
      drawPage(c.getContext('2d'), sr, layout, p, world, { ...pageOpts(scale, { skipBalloons: scriptedPanels(), uiScale: dpr * 0.9, accent: cssVar('--accent') }), show: { ...state.show, names: false, roles: false, gaze: false, readLines: false, entryExit: false } });
      letterPage(c.getContext('2d'), scale, p);
      c.classList.remove('pending');
    });
    const t = el('div', { class: 'thumb' + (k === state.current ? ' on' : ''), tabindex: 0, role: 'button', title: 'Open this proposal' }, c,
      el('div', { class: 'cap' }, el('span', {}, `Proposal ${k + 1}`), el('span', { class: 'pill', style: `background:${scoreColor(p.total)}` }, String(p.total))));
    t.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); t.click(); } });
    t.addEventListener('click', () => { state.current = k; setView('single'); });
    grid.append(t);
  });
  // one page per frame, current proposal first; the grid is usable the whole time
  pending.unshift(...pending.splice(state.current, 1));
  const step = () => {
    if (job !== compareJob || state.view !== 'compare' || state.tab !== 'story') return;
    pending.shift()?.();
    if (pending.length) requestAnimationFrame(step);
    else if (gen === jobGen) compareGen = jobGen;
  };
  afterPaint(step);
}

function drawTop() {
  if (!world) return;
  top.draw({ chars: activeChars(), world, layout, prop: prop(), selected: state.selected });
}

function drawMeta() {
  const fmt = FORMATS[state.sl.format].label;
  const dir = state.sl.dir === 'rtl' ? 'right to left' : 'left to right';
  $('#sb-meta').textContent = `${fmt} · ${dir} · ${layout.panels.length} panels`;
  $('#sb-meta').title = `Layout ${state.sl.seed} #${state.sl.index} · gacha ${state.gacha.seed} · proposal ${state.current + 1}`;
}

let lastTotal = null;
function drawScores() {
  const p = prop();
  const box = $('#sb-scores');
  box.innerHTML = '';
  if (!p) return;
  const num = el('b', { style: `color:${scoreColor(p.total)}`, 'data-value': String(lastTotal ?? p.total) });
  box.append(el('div', { class: 'total' }, num, el('span', {}, `points · proposal ${state.current + 1}`)));
  countTo(num, p.total);
  lastTotal = p.total;
  box.append(el('h3', { class: 'group-title' }, 'Criteria (average over panels)'));
  const t = el('table');
  for (const [k, label] of CRITERIA) {
    const v = Math.round(p.shots.reduce((s, sh) => s + sh.criteria[k], 0) / p.shots.length);
    t.append(el('tr', {}, el('td', {}, label),
      el('td', {}, el('div', { class: 'bar' }, el('i', { style: `width:${v}%;background:${scoreColor(v)}` }))),
      el('td', { class: 'num' }, String(v))));
  }
  box.append(t);

  const shapes = $('#sb-shapes');
  shapes.innerHTML = '';
  const st = el('table');
  st.append(el('tr', {}, el('th', {}, '#'), el('th', {}, 'Shot'), el('th', { class: 'num' }, 'Score')));
  layout.panels.forEach((pn, i) => {
    const r = pn.bbox.w / pn.bbox.h;
    const shape = r < 0.8 ? 'Tall' : r > 1.25 ? 'Wide' : 'Squarish';
    const aspect = r >= 1 ? `${r.toFixed(1)}:1` : `1:${(1 / r).toFixed(1)}`;
    const area = (pn.areaFrac * 100).toFixed(1) + '%';
    const size = pn.areaFrac > 0.25 ? 'Large' : pn.areaFrac > 0.08 ? 'Medium' : 'Small';
    const sh = p.shots[i];
    const row = el('tr', { class: state.hoverRow === i ? 'hl' : '' }, el('td', { class: 'idx' }, String(i + 1)),
      el('td', {}, el('div', { class: 'cell2' }, el('span', {}, shotLabel(sh)), el('small', {}, `${size} ${shape.toLowerCase()} · ${aspect} · ${area} of page`))),
      el('td', { class: 'num' }, el('span', { class: 'pill', style: `background:${scoreColor(sh.total)}`, title: sh.sideOk ? '' : 'Crosses the conversation axis' }, String(sh.total) + (sh.sideOk ? '' : '!'))));
    row.addEventListener('mouseenter', () => { state.hoverRow = i; drawOverlay(); });
    row.title = 'Open this panel in the inspector';
    row.addEventListener('click', () => { state.selected = new Set([i]); paneTabs.story('panel'); drawOverlay(); drawInspector(); drawTop(); });
    row.addEventListener('mouseleave', () => { state.hoverRow = null; drawOverlay(); });
    st.append(row);
  });
  shapes.append(st);
}

// --- inspector

let lastInspected = null;
function drawInspector() {
  const box = $('#sb-inspector');
  // same-panel rebuilds (after an edit) keep keyboard focus, scroll position and running icon motion
  const focusables = () => [...box.querySelectorAll('button, select, input, textarea')];
  const keysOf = (list) => {
    const seen = {};
    return list.map((c) => {
      // tooltips move title -> data-tip and may add aria-label, so read those as one name
      const name = c.closest('label')?.firstChild?.textContent || c.textContent.trim() || c.getAttribute('title') || c.dataset.tip || c.getAttribute('aria-label') || c.placeholder || '';
      const k = `${c.tagName}|${c.type || ''}|${name}`;
      seen[k] = (seen[k] || 0) + 1;
      return `${k}#${seen[k]}`;
    });
  };
  const before = focusables();
  const beforeKeys = keysOf(before);
  const prevFocus = before.indexOf(document.activeElement);
  const prevKey = prevFocus >= 0 ? beforeKeys[prevFocus] : null;
  const prevPanel = lastInspected;
  const scroller = box.closest('.inspector-scroll');
  const prevScroll = scroller?.scrollTop ?? 0;
  const moving = new Map(before.map((c, k) => [beforeKeys[k], c.querySelector('svg')]).filter(([, svg]) => svg?.getAnimations().length));
  box.innerHTML = '';
  const restore = (i) => {
    if (i !== prevPanel) return;
    const now = focusables();
    const nowKeys = keysOf(now);
    moving.forEach((svg, key) => { const old = now[nowKeys.indexOf(key)]?.querySelector('svg'); if (old) old.replaceWith(svg); });
    if (prevKey) (now[nowKeys.indexOf(prevKey)] || now[prevFocus])?.focus({ preventScroll: true });
    if (scroller) scroller.scrollTop = prevScroll;
  };
  const p = prop();
  if (!p || state.selected.size !== 1) {
    if (lastInspected !== null) fadeIn(box, { from: 0.25, duration: 160 });
    lastInspected = null;
    const many = state.selected.size > 1;
    box.append(el('div', { class: 'empty' },
      el('div', { class: 'empty-ico' }, icon('click', 22)),
      el('b', {}, many ? `${state.selected.size} panels selected` : 'No panel selected'),
      el('p', {}, many
        ? 'Select a single panel to edit its camera, poses and script. Press Delete to remove the selected panels.'
        : 'Click a panel on the page to edit its camera, poses and script. Lock the panels you like to keep them when you roll again.')));
    return;
  }
  const i = [...state.selected][0];
  if (i !== lastInspected) fadeIn(box, { from: 0.25, y: 3, duration: 160 });
  lastInspected = i;
  const shot = p.shots[i];
  const spec = shot.spec;
  const lock = state.locks[i]?.mode || 'none';

  const head = el('div', { class: 'insp-head' },
    el('div', { class: 'title' }, el('small', {}, `Panel ${i + 1}`), el('b', {}, shotLabel(shot))),
    el('span', { class: 'pill score', style: `background:${scoreColor(shot.total)}`, title: 'Panel score' }, `${shot.total}${shot.sideOk ? '' : ' · crosses axis'}`));
  box.append(head);

  const lockSeg = el('div', { class: 'seg' });
  for (const [m, label] of [['none', 'Off'], ['all', 'All'], ['camera', 'Camera'], ['pose', 'Pose']]) {
    const b = el('button', { class: lock === m ? 'on' : '' }, label);
    b.addEventListener('click', () => {
      if (m === 'none') delete state.locks[i];
      else state.locks[i] = { mode: m, spec: structuredClone(spec) };
      for (const x of lockSeg.children) if (x.tagName === 'BUTTON') x.classList.toggle('on', x === b);
    });
    lockSeg.append(b);
  }
  const reroll = el('button', { class: 'btn', title: 'Roll a new camera for just this panel' }, icon('dices'), el('span', {}, 'Reroll panel'));
  reroll.addEventListener('click', () => {
    spinIcon(reroll);
    afterPaint(() => {
      rerollPanel(p, i, { world, style: state.gacha.style, seed: `${state.gacha.seed}|re|${i}|${Date.now()}` });
      refreshLock(i);
      crossfadeCanvas($('#sb-page'), () => drawAll());
    });
  });
  const send = el('button', { class: 'btn', title: 'Open this panel\u2019s characters in Poses; Apply brings the result back here' }, icon('pencil'), el('span', {}, 'Edit poses'));
  send.addEventListener('click', () => sendToPoseEditor(i));
  box.append(el('div', { class: 'lock-row' }, el('span', { class: 'label' }, 'Keep when rolling'), lockSeg), el('div', { class: 'insp-actions' }, reroll, send));

  const grid = el('div', { class: 'insp-grid' });
  const camGrid = el('div', { class: 'insp-grid' });
  const castGrid = el('div', { class: 'insp-grid one' });
  const plan = shot.ctx;
  const nC = state.nChars;
  const chars = activeChars();

  // role / speaker change the plan, so they reroll the panel
  grid.append(selectField('Role', Object.entries(ROLES), plan.role, (v) => {
    state.planOverrides[i] = { ...state.planOverrides[i], role: v };
    replan(i);
  }));
  grid.append(selectField('Speaker', [['-1', '— nobody (silent)'], ...chars.map((c, k) => [String(k), c.name])], String(plan.speaker), (v) => {
    state.planOverrides[i] = { ...state.planOverrides[i], speaker: Number(v) };
    replan(i);
  }));
  const typeEntries = Object.entries(TYPES).filter(([k]) => nC > 1 || (k !== 'ots' && k !== 'two'));
  grid.append(selectField('Shot type', typeEntries, spec.type, (v) => editSpec(i, { type: v })));
  grid.append(selectField('Shot size', SIZES.map((s, k) => [String(k), s]), String(spec.size), (v) => editSpec(i, { size: Number(v) })));
  camGrid.append(sliderField('Camera height (°)', -40, 75, 1, spec.elev, (v) => editSpec(i, { elev: v })));
  camGrid.append(sliderField('Orbit (°)', -70, 70, 1, spec.az, (v) => editSpec(i, { az: v })));
  camGrid.append(sliderField('Dutch tilt (°)', -25, 25, 1, spec.dutch, (v) => editSpec(i, { dutch: v })));
  if (spec.type !== 'ots') camGrid.append(sliderField('Lens FOV (°)', 12, 80, 1, spec.fov, (v) => editSpec(i, { fov: v })));
  camGrid.append(sliderField('Frame X', -0.8, 0.8, 0.01, spec.fx, (v) => editSpec(i, { fx: v })));
  camGrid.append(sliderField('Frame Y', -0.8, 0.8, 0.01, spec.fy, (v) => editSpec(i, { fy: v })));
  chars.forEach((c, k) => {
    const custom = spec.poses?.[k] && typeof spec.poses[k] === 'object';
    const poseEntries = [...(custom ? [['__custom', 'Custom (from Poses)']] : []), ...Object.entries(poseLabels(false))];
    castGrid.append(selectField(`${c.name}’s pose`, poseEntries, custom ? '__custom' : spec.poses?.[k] || 'idle', (v) => { if (v !== '__custom') editSpec(i, { poses: { ...spec.poses, [k]: v } }); }));
    const handProps = [['', '— nothing'], ...listProps().filter((p) => p.attach === 'rightHand' || p.attach === 'leftHand').map((p) => [p.id, p.name || p.id])];
    castGrid.append(selectField(`${c.name} holds in right hand`, handProps, spec.hold?.[k]?.right || '', (v) => editSpec(i, { hold: { ...spec.hold, [k]: { ...(spec.hold?.[k] || {}), right: v || undefined } } })));
  });
  box.append(el('h3', { class: 'group-title' }, 'Shot'), grid, el('h3', { class: 'group-title' }, 'Camera'), camGrid, el('h3', { class: 'group-title' }, 'Cast'), castGrid);

  // panel score: what needs attention first, everything else behind a disclosure
  const rows = CRITERIA.map(([k, label]) => [label, Math.round(shot.criteria[k])]);
  const critTable = (list) => {
    const t = el('table');
    for (const [label, v] of list) t.append(el('tr', {}, el('td', {}, label), el('td', {}, el('div', { class: 'bar' }, el('i', { style: `width:${v}%;background:${scoreColor(v)}` }))), el('td', { class: 'num' }, String(v))));
    return t;
  };
  const weak = rows.filter(([, v]) => v < 85).sort((x, y) => x[1] - y[1]);
  queueMicrotask(() => restore(i));
  box.append(el('h3', { class: 'group-title' }, 'Script'), scriptSection(i));
  box.append(el('h3', { class: 'group-title' }, 'Panel score'),
    weak.length ? critTable(weak) : el('p', { class: 'ok-note' }, icon('ok', 15), el('span', {}, 'Every criterion scores 85 or more.')),
    el('details', { class: 'disclosure' }, el('summary', {}, `All ${rows.length} criteria`), critTable(rows)),
    el('button', { class: 'link-btn', onclick: () => paneTabs.story('score') }, el('span', {}, 'Page score and all panels'), icon('right', 14)));
}

function selectField(label, entries, value, onChange) {
  const s = el('select');
  for (const [v, l] of entries) s.append(el('option', { value: v }, l));
  s.value = value;
  s.addEventListener('change', () => onChange(s.value));
  return el('label', {}, label, s);
}

function sliderField(label, min, max, step, value, onChange) {
  const input = el('input', { type: 'range', min, max, step, value: String(value) });
  const out = el('output', {}, fmtNum(value));
  input.addEventListener('input', () => { out.value = fmtNum(Number(input.value)); onChange(Number(input.value), true); });
  input.addEventListener('change', () => drawAll());
  return el('label', { class: 'slider' }, label, input, out);
}
const fmtNum = (v) => (Math.abs(v) < 2 && v % 1 !== 0 ? v.toFixed(2) : String(Math.round(v)));

function editSpec(i, patch) {
  const p = prop();
  const shot = p.shots[i];
  shot.spec = { ...shot.spec, ...patch };
  rescoreProposal(p, world);
  refreshLock(i);
  // live slider drags redraw only the page; selects rebuild everything
  if ('type' in patch || 'size' in patch || 'poses' in patch || 'hold' in patch) drawAll();
  else {
    scheduleDraw();
    drawTop();
    const head = $('#sb-inspector .insp-head .score');
    if (head) {
      head.textContent = `${shot.total}${shot.sideOk ? '' : ' · crosses axis'}`;
      head.style.background = scoreColor(shot.total);
    }
  }
}

function refreshLock(i) {
  if (state.locks[i]) state.locks[i].spec = structuredClone(prop().shots[i].spec);
}

function replan(i) {
  const plan = currentPlan();
  const p = prop();
  // update every proposal's context for this panel then reroll that panel
  for (const pr of state.proposals) {
    const ctx = pr.shots[i].ctx;
    Object.assign(ctx, plan[i]);
    const prevSpeaker = plan.slice(0, i).reverse().find((x) => x.speaker >= 0 && x.speaker !== plan[i].speaker)?.speaker;
    ctx.listener = plan[i].speaker >= 0 ? prevSpeaker ?? (plan[i].speaker === 0 ? 1 : 0) : null;
  }
  rerollPanel(p, i, { world, style: state.gacha.style, seed: `${state.gacha.seed}|plan|${i}|${Date.now()}` });
  drawAll();
}

// --- page interaction

$('#sb-page').addEventListener('click', (e) => {
  if (!layout) return;
  if (suppressClick) { suppressClick = false; return; }
  // insets sit on top, so they win the hit test
  const hit = panelAt(pagePoint(e)) ?? -1;
  if (hit < 0) state.selected.clear();
  else if (e.shiftKey) state.selected.has(hit) ? state.selected.delete(hit) : state.selected.add(hit);
  else state.selected = new Set([hit]);
  if (hit >= 0) paneTabs.story?.('panel');
  drawOverlay();
  drawInspector();
  drawTop();
});
$('#sb-page').addEventListener('pointerleave', () => { if (state.hoverPanel != null) { state.hoverPanel = null; drawOverlay(); } });

function pointInPoly([x, y], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function deleteSelected() {
  if (!state.selected.size || layout.panels.length - state.selected.size < 1) { shake($('#sb-del')); return; }
  // map current indices back to original layout indices
  const base = generateLayout(state.sl, Math.max(0, state.sl.index - 1));
  const rm = new Set(state.removed);
  const alive = base.panels.map((_, i) => i).filter((i) => !rm.has(i));
  state.undo.push({ removed: [...state.removed], locks: structuredClone(state.locks), planOverrides: structuredClone(state.planOverrides), scripts: structuredClone(state.scripts) });
  state.scripts = {};
  for (const i of state.selected) state.removed.push(alive[i]);
  state.locks = {};
  state.planOverrides = {};
  state.selected.clear();
  rollAll();
}

function undo() {
  const u = state.undo.pop();
  if (!u) { shake($('#sb-undo')); return; }
  state.removed = u.removed;
  state.locks = u.locks;
  state.planOverrides = u.planOverrides;
  state.scripts = u.scripts || {};
  state.selected.clear();
  rollAll();
}

$('#sb-del').addEventListener('click', deleteSelected);
$('#sb-undo').addEventListener('click', undo);
// true while a dialog, popover menu or the setup sheet owns the keyboard
const overlayOpen = () => !!document.querySelector('dialog[open], .menu:popover-open') || $('#drawer').classList.contains('open');
document.addEventListener('keydown', (e) => {
  if (state.tab !== 'story' || overlayOpen() || e.target.matches('input, select, textarea, canvas#sb-top')) return;
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelected(); }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key.toLowerCase() === 'r') { e.preventDefault(); $('#g-roll').classList.add('kbd-press'); setTimeout(() => $('#g-roll').classList.remove('kbd-press'), 140); rollWithFeedback(); }
  if (e.key === ']' || e.key === '[') { e.preventDefault(); selectProposal((state.current + (e.key === ']' ? 1 : -1) + state.proposals.length) % state.proposals.length); }
  if (e.key === 'Escape' && state.selected.size) { state.selected.clear(); drawOverlay(); drawInspector(); drawTop(); }
});
// 1 / 2 / 3 switch workspaces (anywhere except while typing)
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey || e.target.matches('input, select, textarea') || overlayOpen()) return;
  const t = { 1: 'layout', 2: 'story', 3: 'poses', 4: 'video' }[e.key];
  if (t) { e.preventDefault(); setTab(t); }
});

// --- view toggle

function setView(v) {
  state.view = v;
  document.querySelectorAll('#sb-view button').forEach((b) => b.classList.toggle('on', b.dataset.v === v));
  $('#tab-story').classList.toggle('is-compare', v === 'compare');
  $('#sb-single').hidden = v !== 'single';
  $('#sb-compare').hidden = v !== 'compare';
  if (v === 'single' && (pageGen !== gen || pageProp !== state.current)) {
    // show the last page straight away, then dissolve into the up-to-date one
    afterPaint(() => { if (state.view === 'single') crossfadeCanvas($('#sb-page'), () => drawAll({ reuse: true })); });
  } else drawAll({ reuse: true });
}
document.querySelectorAll('#sb-view button').forEach((b) => b.addEventListener('click', () => setView(b.dataset.v)));

// --- story layout controls

function syncStoryLayoutControls() {
  const p = state.sl;
  presetButtons($('#sl-presets'), p, () => { syncStoryLayoutControls(); onStoryLayoutChanged(); });
  fillSelect($('#sl-format'), Object.entries(FORMATS).map(([k, f]) => [k, f.label]), p.format);
  $('#sl-dir').value = p.dir;
  $('#sl-seed').value = p.seed;
  $('#sl-index').value = p.index;
}

function onStoryLayoutChanged() {
  state.removed = [];
  state.undo = [];
  state.locks = {};
  state.planOverrides = {};
  state.scripts = {};
  state.selected.clear();
  syncStoryLayoutControls();
  save();
  rollAll();
}

$('#sl-format').addEventListener('change', (e) => { state.sl.format = e.target.value; onStoryLayoutChanged(); });
$('#sl-dir').addEventListener('change', (e) => { state.sl.dir = e.target.value; onStoryLayoutChanged(); });
$('#sl-seed').addEventListener('change', (e) => { state.sl.seed = e.target.value.trim() || 'SC-2026'; onStoryLayoutChanged(); });
$('#sl-index').addEventListener('change', (e) => { state.sl.index = Math.max(1, Number(e.target.value) || 1); onStoryLayoutChanged(); });
$('#sl-prev').addEventListener('click', () => { state.sl.index = Math.max(1, state.sl.index - 1); onStoryLayoutChanged(); });
$('#sl-next').addEventListener('click', () => { state.sl.index += 1; onStoryLayoutChanged(); });
$('#sl-random').addEventListener('click', () => { state.sl.index = 1 + Math.floor(Math.random() * 48); state.sl.seed = randomSeed('SC'); onStoryLayoutChanged(); });
$('#sl-open').addEventListener('click', () => {
  Object.assign(state.lp, pick(state.sl, LAYOUT_KEYS));
  state.lp.count = Math.max(state.lp.count, state.sl.index <= 12 ? 12 : state.sl.index <= 24 ? 24 : 48);
  syncLayoutControls();
  renderLayoutGrid();
  setTab('layout');
  openLayoutDialog(Math.min(state.sl.index - 1, state.lp.count - 1));
});

// --- characters

function renderCharList() {
  const list = $('#ch-list');
  list.innerHTML = '';
  $('#ch-count').textContent = `${state.nChars} of ${state.chars.length}`;
  queueMicrotask(() => {
    if (state.nChars < state.chars.length && !list.querySelector('.add-char')) list.append(el('button', { class: 'add-char', onclick: addCharacter }, icon('plus'), el('span', {}, `Add ${state.chars[state.nChars].name}`)));
  });
  activeChars().forEach((c, i) => {
    const name = el('input', { type: 'text', class: 'name', value: c.name });
    name.addEventListener('change', () => { c.name = name.value.trim() || `Char ${i + 1}`; save(); drawAll(); });
    const h = el('input', { type: 'number', class: 'h', min: 80, max: 230, value: c.height });
    h.addEventListener('change', async () => {
      c.height = Math.max(80, Math.min(230, Number(h.value) || 160));
      await rebuildFigure(i);
      save();
      rollAll();
    });
    const col = el('input', { type: 'color', value: c.color });
    col.addEventListener('input', () => { c.color = col.value; figures[i].setColor(col.value); sr.setStyle(state.renderStyle, activeChars()); save(); scheduleDraw(); drawTop(); });
    col.addEventListener('change', () => drawAll());
    const model = el('select');
    model.append(el('option', { value: 'mannequin' }, 'Mannequin'));
    if (c.vrmName) model.append(el('option', { value: 'vrm' }, c.vrmName));
    model.append(el('option', { value: 'load' }, 'Load .vrm file…'));
    model.value = c.model;
    const file = el('input', { type: 'file', accept: '.vrm', hidden: true });
    const status = el('div', { class: 'status' });
    model.addEventListener('change', async () => {
      if (model.value === 'load') { model.value = c.model; file.click(); return; }
      c.model = model.value;
      await rebuildFigure(i);
      drawAll();
    });
    file.addEventListener('change', async () => {
      const f = file.files[0];
      if (!f) return;
      status.textContent = `Loading ${f.name} (${(f.size / 1048576).toFixed(1)} MB)…`;
      try {
        const fig = await loadVrmFromFile(f, c.height / 100);
        c.vrmFigure?.dispose();
        c.vrmFigure = fig;
        c.vrmName = f.name;
        c.model = 'vrm';
        await rebuildFigure(i);
        renderCharList();
        drawAll();
      } catch (err) {
        status.textContent = `Couldn’t load that file: ${err.message}`;
      }
    });
    col.title = 'Colour';
    name.setAttribute('aria-label', 'Name');
    h.setAttribute('aria-label', 'Height in cm');
    const remove = state.nChars > 1
      ? el('button', { class: 'icon-btn', title: `Remove ${c.name}`, 'aria-label': `Remove ${c.name}`, onclick: () => removeCharacter(i) }, icon('trash', 16))
      : null;
    list.append(el('div', { class: 'ch' },
      el('div', { class: 'ch-head' }, col, name, el('span', { class: 'unit-input' }, h, el('span', {}, 'cm')), remove),
      el('div', { class: 'list' },
        el('label', { class: 'field' }, 'Model', model, file),
        el('label', { class: 'field' }, 'Base pose', baseSelect(c))),
      status));
  });
}

function baseSelect(c) {
  const s = el('select');
  for (const [v, l] of basePoseOptions()) s.append(el('option', { value: v }, l));
  s.value = c.base || '';
  s.addEventListener('change', () => { c.base = s.value || null; save(); rollAll(); });
  return s;
}

async function rebuildFigure(i) {
  const c = state.chars[i];
  if (c.model === 'vrm' && c.vrmFigure) {
    c.vrmFigure.setHeight(c.height / 100);
    figures[i] = c.vrmFigure;
  } else {
    figures[i]?.kind === 'mannequin' && figures[i].dispose();
    figures[i] = new Mannequin(c.height / 100, c.color);
  }
  sr.setFigures(figures.slice(0, state.nChars), activeChars());
  sr.setStyle(state.renderStyle, activeChars());
}

// The cast is the first nChars entries of state.chars (up to three). Removing someone moves them to
// the end of the list, so their name, colour, height and model come back if they are added again.
function castChanged() {
  resetPositions(true);
  state.planOverrides = {};
  state.locks = {};
  state.selected.clear();
  sr.setFigures(figures.slice(0, state.nChars), activeChars());
  sr.setStyle(state.renderStyle, activeChars());
  renderCharList();
  saveScripts();
  save();
  rollAll();
}

function removeCharacter(i) {
  if (state.nChars <= 1) return;
  const snapshot = { chars: [...state.chars], figures: [...figures], nChars: state.nChars, scripts: structuredClone(state.scripts) };
  const [c] = state.chars.splice(i, 1);
  state.chars.push(c);
  const [f] = figures.splice(i, 1);
  figures.push(f);
  state.nChars -= 1;
  // their lines become off-panel voices; later speakers shift down one
  for (const sc of Object.values(state.scripts)) {
    for (const d of sc.dialogue || []) {
      if (d.speaker === i) d.speaker = -1;
      else if (Number.isInteger(d.speaker) && d.speaker > i) d.speaker -= 1;
    }
  }
  castChanged();
  toast(`Removed ${c.name}`, {
    icon: 'trash',
    action: {
      label: 'Undo',
      onClick: () => {
        state.chars.splice(0, state.chars.length, ...snapshot.chars);
        figures.splice(0, figures.length, ...snapshot.figures);
        state.nChars = snapshot.nChars;
        state.scripts = snapshot.scripts;
        castChanged();
      },
    },
  });
}

function addCharacter() {
  if (state.nChars >= state.chars.length) return;
  state.nChars += 1;
  castChanged();
  const cards = document.querySelectorAll('#ch-list .ch');
  const card = cards[cards.length - 1];
  fadeIn(card, { from: 0, y: 8, duration: 220 });
  card?.querySelector('input.name')?.select();
}

$('#sb-resetpos').addEventListener('click', () => {
  const pos = defaultPositions(state.nChars);
  activeChars().forEach((c, i) => { c.x = pos[i].x; c.z = pos[i].z; });
  world = buildWorld(activeChars());
  for (const p of state.proposals) rescoreProposal(p, world);
  save();
  drawAll();
});

// --- gacha controls

function syncGachaControls() {
  $('#g-seed').value = state.gacha.seed;
  const st = $('#g-style');
  st.innerHTML = '';
  for (const [k, s] of Object.entries(STYLES)) {
    const b = el('button', { class: state.gacha.style === k ? 'on' : '' }, s.label);
    b.addEventListener('click', () => { state.gacha.style = k; syncGachaControls(); rollAll(); });
    st.append(b);
  }
  fillSelect($('#g-tone'), Object.entries(TONES).map(([k, t]) => [k, t.label]), state.gacha.tone);
  document.querySelectorAll('#g-intensity button').forEach((b) => b.classList.toggle('on', b.dataset.v === state.gacha.intensity));
}
function rollWithFeedback() {
  spinIcon($('#g-roll'));
  afterPaint(() => {
    stripEntrance = true;
    crossfadeCanvas($('#sb-page'), () => rollAll({ newSeed: true }));
  });
}
$('#g-roll').addEventListener('click', rollWithFeedback);
$('#g-seed').addEventListener('change', (e) => { state.gacha.seed = e.target.value.trim() || 'G-1'; rollAll(); });
$('#g-tone').addEventListener('change', (e) => { state.gacha.tone = e.target.value; rollAll(); });
document.querySelectorAll('#g-intensity button').forEach((b) => b.addEventListener('click', () => {
  state.gacha.intensity = b.dataset.v;
  syncGachaControls();
  rollAll();
}));

// --- rendering controls

const SHOW_GROUPS = [
  ['Display', [['caps', 'All-caps lettering'], ['breakBorders', 'Let balloons break panel borders'], ['names', 'Names'], ['balloons', 'Balloon spots'], ['roles', 'Panel roles'], ['eyeLevel', 'Eye level'], ['guide', 'Inner frame guide']]],
  ['Diagnostics', [['orderNums', 'Reading-order numbers'], ['readLines', 'Reading-flow line'], ['entryExit', 'Entry / exit'], ['gaze', 'Gaze arrows'], ['axis', 'Conversation axis'], ['thirds', 'Rule of thirds'], ['scores', 'Panel scores']]],
];

function syncRenderControls() {
  document.querySelectorAll('#r-style button').forEach((b) => b.classList.toggle('on', b.dataset.v === state.renderStyle));
  const box = $('#r-show');
  box.innerHTML = '';
  for (const [grp, items] of SHOW_GROUPS) {
    box.append(el('h3', { class: 'group-title' }, grp));
    const list = el('div', { class: 'list' });
    for (const [k, label] of items) {
      const cb = el('input', { type: 'checkbox' });
      cb.checked = !!state.show[k];
      cb.addEventListener('change', () => { state.show[k] = cb.checked; save(); touch(); if (state.view === 'compare') drawCompare(); else drawPageMain(); });
      list.append(el('label', { class: 'field switch-field' }, label, cb));
    }
    box.append(list);
  }
}
document.querySelectorAll('#r-style button').forEach((b) => b.addEventListener('click', () => {
  state.renderStyle = b.dataset.v;
  sr.setStyle(state.renderStyle, activeChars());
  syncRenderControls();
  save();
  drawAll();
}));

// --- export

$('#sb-png').addEventListener('click', () => {
  const scale = 2400 / layout.H;
  const c = el('canvas', { width: Math.round(layout.W * scale), height: 2400 });
  drawPage(c.getContext('2d'), sr, layout, prop(), world, pageOpts(scale, { skipBalloons: scriptedPanels() }));
  letterPage(c.getContext('2d'), scale, prop());
  c.toBlob((b) => download(b, `storyboard-${state.gacha.seed}-p${state.current + 1}.png`), 'image/png');
});
$('#sb-print').addEventListener('click', () => {
  const g = printGeometry(layout, { label: `${state.sl.seed} #${state.sl.index} — proposal ${state.current + 1}` });
  const c = el('canvas', { width: g.width, height: g.height });
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, g.width, g.height);
  ctx.translate(g.offsetPx, g.offsetPx);
  drawPage(ctx, sr, layout, prop(), world, { scale: g.scale, show: {}, chars: activeChars(), bleed: g.bleedU });
  letterPage(ctx, g.scale, prop());
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawCropMarks(ctx, g, g.label);
  c.toBlob((b) => download(b, `storyboard-${state.gacha.seed}-p${state.current + 1}-print.png`), 'image/png');
});
$('#sb-svg').addEventListener('click', () => {
  const svg = pageToSVG(sr, layout, prop(), world, state.show, activeChars());
  download(new Blob([svg], { type: 'image/svg+xml' }), `storyboard-${state.gacha.seed}-p${state.current + 1}.svg`);
});
$('#sb-json').addEventListener('click', () => {
  const p = prop();
  const data = {
    layout: { ...pick(state.sl, ['preset', 'format', 'dir', 'seed', 'index']), removed: state.removed },
    characters: activeChars().map((c) => pick(c, ['name', 'height', 'x', 'z'])),
    gacha: state.gacha, proposal: state.current + 1, total: p.total,
    panels: p.shots.map((s, i) => ({
      panel: i + 1, label: shotLabel(s), role: s.ctx.role, speaker: s.ctx.speaker >= 0 ? activeChars()[s.ctx.speaker].name : null,
      score: s.total, camera: s.spec, script: state.scripts[i] || null, criteria: Object.fromEntries(Object.entries(s.criteria).map(([k, v]) => [k, Math.round(v)])),
    })),
  };
  download(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `storyboard-${state.gacha.seed}-p${state.current + 1}.json`);
});
$('#sb-link').addEventListener('click', async () => {
  const data = {
    sl: pick(state.sl, [...LAYOUT_KEYS, 'index']),
    rm: state.removed, n: state.nChars,
    ch: activeChars().map((c) => pick(c, ['name', 'height', 'color', 'x', 'z'])),
    g: state.gacha, cur: state.current,
  };
  const url = location.origin + location.pathname + '#s=' + btoa(unescape(encodeURIComponent(JSON.stringify(data))));
  history.replaceState(null, '', url);
  try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch { toast('The link is in the address bar', { icon: 'info' }); }
});

function readHash() {
  const m = location.hash.match(/#s=(.+)$/);
  if (!m) return;
  try {
    const d = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
    Object.assign(state.sl, d.sl);
    state.removed = d.rm || [];
    state.nChars = d.n || 2;
    (d.ch || []).forEach((c, i) => Object.assign(state.chars[i], c));
    Object.assign(state.gacha, d.g);
    state.current = d.cur || 0;
    state.tab = 'story';
  } catch { /* ignore malformed links */ }
}


// ---------------------------------------------------------------- utils

function randomSeed(prefix) {
  return `${prefix}-${Math.floor(Math.random() * 9000 + 1000)}`;
}
const pad = (n) => String(n).padStart(2, '0');

function download(blob, name) {
  const a = el('a', { href: URL.createObjectURL(blob), download: name });
  document.body.append(a);
  a.click();
  toast(`Saved ${name}`, { icon: 'download' });
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

function svgToPng(svg, w, h) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = el('canvas', { width: w, height: h });
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      c.toBlob(resolve, 'image/png');
    };
    img.onerror = reject;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}

window.__ng = { state, get world() { return world; }, get layout() { return layout; }, get hits() { return pageHits; } };

window.addEventListener('resize', () => { if (state.tab === 'story' && state.view === 'single') scheduleResize(); });

// ---------------------------------------------------------------- image prompt export

const ipOpts = { scope: 'page', setting: '', style: '', blank: false, ...store.get('imagePrompt', {}) };
let ipRef = null; // {blob url, w, h}

// Clean reference render: no diagnostics, colour-coded mannequins, lettering (or blank balloons).
function renderReference(scope) {
  const p = prop();
  const LONG = 1536;
  if (scope === 'page') {
    const scale = LONG / Math.max(layout.W, layout.H);
    const c = el('canvas', { width: Math.round(layout.W * scale), height: Math.round(layout.H * scale) });
    const g = c.getContext('2d');
    drawPage(g, sr, layout, p, world, { scale, show: {}, chars: activeChars() });
    letterPage(g, scale, p, { blank: ipOpts.blank });
    return { canvas: c, w: layout.W, h: layout.H };
  }
  const i = [...state.selected][0];
  const pn = layout.panels[i];
  const b = pn.bbox;
  const scale = LONG / Math.max(b.w, b.h);
  const full = el('canvas', { width: Math.round(layout.W * scale), height: Math.round(layout.H * scale) });
  const fg = full.getContext('2d');
  drawPage(fg, sr, layout, p, world, { scale, show: {}, chars: activeChars() });
  letterPage(fg, scale, p, { blank: ipOpts.blank });
  const pad = 10;
  const c = el('canvas', { width: Math.round((b.w + 2 * pad) * scale), height: Math.round((b.h + 2 * pad) * scale) });
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.fillRect(0, 0, c.width, c.height);
  g.save();
  g.translate((pad - b.x) * scale, (pad - b.y) * scale);
  g.beginPath();
  pn.poly.forEach(([x, y], k) => (k ? g.lineTo(x * scale, y * scale) : g.moveTo(x * scale, y * scale)));
  g.closePath();
  g.save();
  g.clip();
  g.drawImage(full, 0, 0);
  g.restore();
  g.strokeStyle = '#111';
  g.lineWidth = layout.border * scale;
  g.stroke();
  g.restore();
  return { canvas: c, w: b.w, h: b.h };
}

function refreshImagePrompt() {
  const scope = ipOpts.scope === 'panel' && state.selected.size === 1 ? 'panel' : 'page';
  document.querySelectorAll('#ip-scope button').forEach((b) => {
    b.classList.toggle('on', b.dataset.v === scope);
    if (b.dataset.v === 'panel') b.disabled = state.selected.size !== 1;
  });
  const ref = renderReference(scope);
  ref.canvas.toBlob((blob) => {
    if (ipRef?.url) URL.revokeObjectURL(ipRef.url);
    ipRef = { url: URL.createObjectURL(blob), blob, w: ref.canvas.width, h: ref.canvas.height, scope };
    $('#ip-ref').src = ipRef.url;
    fadeIn($('#ip-ref'), { from: 0.2, duration: 200 });
    $('#ip-size').textContent = `${ref.canvas.width} \u00d7 ${ref.canvas.height} px · closest GPT Image size: ${suggestedSize(ref.w, ref.h)}`;
  }, 'image/png');
  const p = prop();
  $('#ip-prompt').value = buildImagePrompt({
    scope: scope === 'page' ? 'page' : [...state.selected][0],
    layout, shots: p.shots, chars: activeChars(), scripts: state.scripts,
    style: ipOpts.style, setting: ipOpts.setting, tone: state.gacha.tone, blankBalloons: ipOpts.blank, dir: layout.dir,
    size: { w: Math.round(ref.w), h: Math.round(ref.h) },
  });
}

function renderPromptChars() {
  const box = $('#ip-chars');
  box.innerHTML = '';
  const chars = activeChars();
  const labels = castLabels(chars);
  chars.forEach((c, i) => {
    const ta = el('textarea', { rows: 2, placeholder: `Describe ${c.name}: age, build, hair, outfit… (blank = {CHARACTER ${i + 1}} variable)` });
    ta.value = c.description || '';
    ta.addEventListener('input', () => { c.description = ta.value; save(); clearTimeout(ipTimer); ipTimer = setTimeout(refreshImagePromptText, 250); });
    box.append(el('div', { class: 'ip-char' }, el('span', { class: 'sw', style: `background:${c.color}` }), el('b', {}, `${labels[i]} = ${c.name}`), ta));
  });
}
let ipTimer = null;
// text-only refresh (no re-render) while typing
function refreshImagePromptText() {
  const scope = ipRef?.scope || 'page';
  const p = prop();
  $('#ip-prompt').value = buildImagePrompt({
    scope: scope === 'page' ? 'page' : [...state.selected][0],
    layout, shots: p.shots, chars: activeChars(), scripts: state.scripts,
    style: ipOpts.style, setting: ipOpts.setting, tone: state.gacha.tone, blankBalloons: ipOpts.blank, dir: layout.dir,
    size: ipRef ? { w: ipRef.w, h: ipRef.h } : null,
  });
}

$('#sb-prompt').addEventListener('click', () => {
  if (!layout || !prop()) return;
  $('#ip-setting').value = ipOpts.setting;
  $('#ip-style').value = ipOpts.style;
  $('#ip-blank').checked = ipOpts.blank;
  renderPromptChars();
  refreshImagePrompt();
  $('#ip-dialog').showModal();
});
document.querySelectorAll('#ip-scope button').forEach((b) => b.addEventListener('click', () => { ipOpts.scope = b.dataset.v; store.set('imagePrompt', ipOpts); refreshImagePrompt(); }));
for (const [id, key] of [['#ip-setting', 'setting'], ['#ip-style', 'style']]) {
  $(id).addEventListener('input', (e) => { ipOpts[key] = e.target.value; store.set('imagePrompt', ipOpts); clearTimeout(ipTimer); ipTimer = setTimeout(refreshImagePromptText, 250); });
}
$('#ip-blank').addEventListener('change', (e) => { ipOpts.blank = e.target.checked; store.set('imagePrompt', ipOpts); refreshImagePrompt(); });
$('#ip-close').addEventListener('click', () => $('#ip-dialog').close());
$('#ip-copy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText($('#ip-prompt').value); confirmIcon($('#ip-copy')); toast('Prompt copied'); } catch { toast('Select the text and copy it', { icon: 'info' }); }
});
const ipName = () => `storyboard-${state.gacha.seed}-p${state.current + 1}${ipRef?.scope === 'panel' ? `-panel${[...state.selected][0] + 1}` : ''}`;
$('#ip-dl-img').addEventListener('click', () => { if (ipRef?.blob) download(ipRef.blob, `${ipName()}-reference.png`); });
$('#ip-dl-txt').addEventListener('click', () => download(new Blob([$('#ip-prompt').value], { type: 'text/plain' }), `${ipName()}-prompt.txt`));

// ---------------------------------------------------------------- pose editor round trip

function sendToPoseEditor(i) {
  const p = prop();
  const shot = p?.shots[i];
  if (!shot) return;
  const W = posedWorld(world, shot.spec, shot.ctx);
  const chars = activeChars();
  const proposalAtSend = state.current;
  setTab('poses');
  poseEditor.beginSession({
    label: `panel ${i + 1} of proposal ${state.current + 1}`,
    figures: chars.map((c) => ({ h: c.height / 100, color: c.color, name: c.name })),
    poses: W.people.map((q) => q.pose),
    places: W.people.map((q) => ({ x: q.pos.x, z: q.pos.z, yaw: q.yaw })),
    onApply: (defs, places) => {
      state.current = proposalAtSend;
      const target = prop();
      const s0 = target.shots[i].spec;
      const spec = { ...s0, poses: Object.fromEntries(defs.map((d, k) => [k, d])), place: Object.fromEntries(places.map((pl, k) => [k, pl]).filter(([k]) => Number(k) > 0)) };
      delete spec.pair;
      target.shots[i].spec = spec;
      rescoreProposal(target, world);
      state.locks[i] = { mode: 'all', spec: structuredClone(spec) };
      setTab('story');
      state.selected = new Set([i]);
      drawAll();
    },
    onCancel: () => setTab('story'),
  });
}

// ---------------------------------------------------------------- drawer (layout + characters)

let drawerReturn = null;
function openDrawer(pane) {
  const d = $('#drawer');
  if (!d.classList.contains('open')) drawerReturn = document.activeElement;
  d.classList.add('open');
  d.setAttribute('aria-hidden', 'false');
  $('#drawer-backdrop').getAnimations().forEach((a) => a.cancel());
  $('#drawer-backdrop').hidden = false;
  $('#drawer-backdrop').style.pointerEvents = '';
  d.querySelectorAll('.drawer-body > section').forEach((sec) => { sec.hidden = sec.dataset.pane !== pane; });
  document.querySelectorAll('#drawer-tabs button, .drawer-open').forEach((b) => b.classList.toggle('on', b.dataset.pane === pane));
  d.querySelector(`#drawer-tabs button[data-pane="${pane}"]`)?.focus({ preventScroll: true });
}
function closeDrawer() {
  $('#drawer').classList.remove('open');
  $('#drawer').setAttribute('aria-hidden', 'true');
  const bd = $('#drawer-backdrop');
  bd.style.pointerEvents = 'none';
  if (reducedMotion()) bd.hidden = true;
  else bd.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 260, easing: 'ease-out' }).onfinish = () => { if (!$('#drawer').classList.contains('open')) bd.hidden = true; };
  document.querySelectorAll('.drawer-open').forEach((b) => b.classList.remove('on'));
  drawerReturn?.focus?.({ preventScroll: true });
  drawerReturn = null;
}
document.querySelectorAll('.drawer-open').forEach((b) => b.addEventListener('click', () => {
  const isOpen = $('#drawer').classList.contains('open') && b.classList.contains('on');
  isOpen ? closeDrawer() : openDrawer(b.dataset.pane);
}));
document.querySelectorAll('#drawer-tabs button').forEach((b) => b.addEventListener('click', () => openDrawer(b.dataset.pane)));
$('#drawer-close').addEventListener('click', closeDrawer);
$('#drawer-backdrop').addEventListener('click', closeDrawer);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#drawer').classList.contains('open')) closeDrawer(); });

// ---------------------------------------------------------------- app chrome

initTheme();
initMenus();
const paneTabs = initPaneTabs(document, (group, pane) => {
  if (group === 'story' && pane === 'scene') drawTop();
  if (group === 'story' && pane === 'score' && state.tab === 'story') drawScores();
});
$('#about-open').addEventListener('click', () => $('#about-dialog').showModal());
$('#about-close').addEventListener('click', () => $('#about-dialog').close());
for (const d of document.querySelectorAll('dialog.sheet')) d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
new ResizeObserver(() => { if (state.tab === 'story' && state.view === 'single') scheduleResize(); }).observe($('#sb-stage'));
initSegThumbs();
initTooltips();
initValueEditing();
window.addEventListener('ng-theme', () => { if (state.tab === 'story') { drawTop(); scheduleDraw(); } else storyStale = true; });

// ---------------------------------------------------------------- boot

const poseEditor = new PoseEditor($('#tab-poses'), { onLibraryChange: () => { if (state.selected.size === 1) drawInspector(); } });
video = new VideoWorkspace({
  sr,
  scene: () => ({
    shots: prop()?.shots || [], world, scripts: state.scripts, chars: activeChars(),
    dir: state.sl.dir, caps: state.show.caps, key: scriptsKey(), name: `koma-${state.gacha.seed}-p${state.current + 1}`.replace(/[^\w.-]+/g, '-'),
  }),
  editPanel: (i) => {
    setTab('story');
    state.selected = new Set([i]);
    paneTabs.story('panel');
    drawOverlay();
    drawInspector();
  },
});
loadCustomPoses().then((list) => { if (list.length && state.tab === 'story') drawInspector(); });
preloadModels().then(() => { if (state.tab === 'story') drawAll(); });

sr.setFigures(figures.slice(0, state.nChars), activeChars());
sr.setStyle(state.renderStyle, activeChars());
syncLayoutControls();
bindLayoutControls();
syncStoryLayoutControls();
syncGachaControls();
syncRenderControls();
loadScripts();
Promise.all([document.fonts.load(`700 18px ${FONT}`), document.fonts.load('40px "Bangers"'), document.fonts.load("600 12px 'Inter Variable'")]).then(() => { if (state.tab === 'story') drawAll(); });
posesReady.then(() => {
  renderCharList();
  setTab(state.tab);
});
