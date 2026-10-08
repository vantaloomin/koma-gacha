// Headless rendering API used by the MCP server (loaded by comic.html in a headless browser).
// Every call is stateless: the server passes the full page + cast, and gets JSON / PNG data URLs back.

import '@fontsource/comic-neue/700.css';
import '@fontsource/comic-neue/700-italic.css';
import '@fontsource/bangers/400.css';
import { PRESETS, generateLayout, layoutToSVG } from './layout.js';
import {
  CRITERIA, SIZES, TYPES, ROLES, buildWorld, defaultPositions, planRoles, panelContexts,
  rollProposal, rescoreProposal, rerollPanel, shotLabel,
} from './gacha.js';
import { Mannequin, loadVrmFromUrl } from './figures.js';
import { loadCustomPoses, posesReady } from './poses/index.js';
import * as THREE from 'three';
import { registerPoses, listPoses, getPose, compileDef, fk, poseCategories } from './pose-runtime.js';
import { listProps, getProp, buildProp, propCategories, preloadModels } from './props.js';
import { StoryRenderer, drawPage } from './renderer.js';
import { letterPanel, FONT } from './letter.js';
import { printGeometry, drawCropMarks } from './print.js';
import { buildImagePrompt, suggestedSize } from './prompt-export.js';
import { VideoComposer } from './video.js';
import { defaultDuration, hasMotion } from './motion.js';

const sr = new StoryRenderer();
const figCache = new Map();

const DIAG_SHOW = { names: true, roles: true, scores: true, orderNums: true, readLines: true, axis: true };

// ---------------------------------------------------------------- setup helpers

function makeLayout(lp) {
  const preset = PRESETS[lp.preset] || PRESETS.standard;
  const params = { ...preset, preset: lp.preset || 'standard', border: 4, ...lp };
  const layout = generateLayout(params, Math.max(0, (lp.index || 1) - 1));
  if (lp.removed?.length) {
    const rm = new Set(lp.removed);
    layout.panels = layout.panels.filter((_, i) => !rm.has(i));
    layout.panels.forEach((p, i) => { p.order = i; });
  }
  return layout;
}

async function getFigures(chars) {
  const figs = [];
  for (const c of chars) {
    const key = `${c.vrmUrl || 'mannequin'}|${c.height}|${c.color}`;
    let f = figCache.get(key);
    if (!f) {
      f = c.vrmUrl ? await loadVrmFromUrl(c.vrmUrl, c.height / 100) : new Mannequin(c.height / 100, c.color);
      figCache.set(key, f);
    }
    figs.push(f);
  }
  return figs;
}

function buildPlan(layout, page, n) {
  const auto = planRoles(layout, n);
  return auto.map((a, i) => {
    const p = page.panels?.[i] || {};
    let speaker = a.speaker;
    if (Number.isInteger(p.speaker)) speaker = p.speaker;
    else if (p.script) {
      const d = (p.script.dialogue || []).find((x) => Number.isInteger(x.speaker) && x.speaker >= 0);
      speaker = d ? d.speaker : -1;
    }
    if (speaker >= n) speaker = -1;
    let role = p.role || a.role;
    if (!p.role && speaker < 0 && role === 'dialogue') role = 'reaction';
    let focus = Number.isInteger(p.focus) ? p.focus : speaker >= 0 ? speaker : a.focus;
    if (focus >= n || focus < 0) focus = 0;
    return { role, speaker, focus, isLargest: a.isLargest };
  });
}

async function setup(page, chars, style) {
  const layout = makeLayout(page.layout);
  const positions = chars.map((_, i) => page.positions?.[i] || defaultPositions(chars.length)[i]);
  const world = buildWorld(chars.map((c, i) => ({ height: c.height, x: positions[i].x, z: positions[i].z, yawOffset: positions[i].yaw || 0 })));
  const figs = await getFigures(chars);
  sr.setFigures(figs, chars);
  sr.setStyle(style || 'shaded', chars);
  const plan = buildPlan(layout, page, chars.length);
  return { layout, world, plan, positions };
}

function locksFor(page, all = false) {
  const locks = {};
  (page.panels || []).forEach((p, i) => {
    if (p.spec && (all || p.lock)) locks[i] = { mode: all ? 'all' : p.lock, spec: p.spec };
  });
  return locks;
}

// Rebuild a scored proposal from stored specs, rolling any panel that has none.
function currentShots(page, ctx) {
  const { layout, world, plan } = ctx;
  const missing = layout.panels.some((_, i) => !page.panels?.[i]?.spec);
  if (missing) {
    return rollProposal({ layout, world, plan, tone: page.tone, intensity: page.intensity, style: page.style || 'balance', seed: `${page.seed || 'G'}|fill`, locks: locksFor(page, true), nChars: world.n, staging: page.staging, sceneProps: page.sceneProps });
  }
  const ctxs = panelContexts(layout, plan, page.tone, page.intensity, { staging: page.staging, sceneProps: page.sceneProps });
  const prop = { shots: ctxs.map((c, i) => ({ spec: page.panels[i].spec, ctx: c })) };
  return rescoreProposal(prop, world);
}

const round = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v)]));

function describeShot(shot, chars) {
  const sp = shot.spec;
  const size = SIZES[sp.size].toLowerCase();
  const angle = sp.elev > 22 ? 'high angle' : sp.elev < -10 ? 'low angle' : 'eye level';
  const subj = chars[sp.subject]?.name;
  const other = chars[sp.other]?.name;
  let what;
  if (sp.type === 'ots') what = `over-the-shoulder shot of ${subj}, ${other}'s shoulder in the foreground`;
  else if (sp.type === 'two' || sp.type === 'establish') what = `${sp.type === 'establish' ? 'establishing' : 'two'} shot of ${chars.map((c) => c.name).join(' and ')}`;
  else what = `${size} of ${subj}`;
  const poses = Object.entries(sp.poses || {}).filter(([k]) => chars[k]).map(([k, v]) => `${chars[k].name}: ${v}`).join(', ');
  const visible = shot.analysis.people.filter((p) => p.inFrame).map((p) => `${chars[p.i].name} (${p.faceVis > 0.3 ? 'facing camera' : p.faceVis < -0.3 ? 'back to camera' : 'profile'})`);
  return `${what}, ${size}, ${angle}${Math.abs(sp.dutch) > 3 ? ', dutch angle' : ''}. Visible: ${visible.join(', ') || 'nobody'}. Poses: ${poses}.`;
}

function shapeOf(pn) {
  if (!pn) return null;
  const tags = [];
  if (pn.inset) tags.push('inset');
  if (pn.tri) tags.push('triangle');
  if (Object.keys(pn.bleed || {}).length) tags.push(`bleeds ${Object.keys(pn.bleed).join('/')}`);
  return tags.join(', ') || null;
}

function summarize(shots, chars, layout) {
  return shots.map((s, i) => ({
    panel: i + 1, label: shotLabel(s), role: s.ctx.role, shape: shapeOf(layout?.panels[i]),
    speaker: s.ctx.speaker >= 0 ? chars[s.ctx.speaker]?.name : null, focus: chars[s.ctx.focus]?.name,
    score: s.total, axisOk: s.sideOk, criteria: round(s.criteria), spec: s.spec, description: describeShot(s, chars),
    people: s.analysis.people.map((p) => ({ name: chars[p.i]?.name, u: +p.u.toFixed(3), v: +p.v.toFixed(3), r: +p.rv.toFixed(3), face: +p.faceVis.toFixed(2), behind: p.behind, inFrame: p.inFrame, depth: +p.depth.toFixed(2) })),
  }));
}

async function loadImages(urls) {
  const out = {};
  await Promise.all(Object.entries(urls || {}).map(async ([i, url]) => {
    if (!url) return;
    const img = new Image();
    img.src = url;
    await img.decode();
    out[i] = img;
  }));
  return out;
}

function drawLettering(ctx2d, scale, layout, prop, page, opts = {}) {
  const order = [...layout.panels.keys()].sort((x, y) => (layout.panels[x].inset ? 1 : 0) - (layout.panels[y].inset ? 1 : 0));
  order.forEach((i) => {
    const pn = layout.panels[i];
    const script = page.panels?.[i]?.script;
    if (script) letterPanel(ctx2d, scale, pn, prop.shots[i], script, { dir: layout.dir, caps: opts.caps !== false, allowBreak: !!opts.allowBreak, blank: !!opts.blank, seed: `${page.seed}|${i}`, safe: { x: layout.frame.x - 30, y: layout.frame.y - 30, w: layout.frame.w + 60, h: layout.frame.h + 60 } });
  });
}

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.round(w);
  c.height = Math.round(h);
  return c;
}

// ---------------------------------------------------------------- API

// ---------------------------------------------------------------- pose / prop sheets

const sheetFigs = [new Mannequin(1.65, '#e2735f'), new Mannequin(1.75, '#5a8fd8'), new Mannequin(1.7, '#5fb87a')];

function sheetCamera(box, view, aspect) {
  const c = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const dirs = { '3q': [0.75, 0.32, 1], front: [0, 0.12, 1], side: [1, 0.12, 0], top: [0.3, 1.6, 0.6], back: [-0.6, 0.3, -1] };
  const d = new THREE.Vector3(...(dirs[view] || dirs['3q'])).normalize();
  const cam = new THREE.PerspectiveCamera(30, aspect, 0.05, 100);
  const radius = Math.max(size.length() / 2, 0.15);
  const dist = (radius / Math.sin((15 * Math.PI) / 180)) * 1.05;
  cam.position.copy(c).add(d.multiplyScalar(dist));
  cam.lookAt(c);
  cam.updateMatrixWorld(true);
  return cam;
}

function labelCell(g, x, y, w, text, sub) {
  g.fillStyle = '#222';
  g.font = '600 13px system-ui, sans-serif';
  g.fillText(text, x + 6, y + 16, w - 12);
  if (sub) {
    g.fillStyle = '#777';
    g.font = '11px system-ui, sans-serif';
    g.fillText(sub, x + 6, y + 31, w - 12);
  }
}

const ComicAPI = {
  async loadCustom() {
    return (await loadCustomPoses()).length;
  },

  registerPoses(list) {
    registerPoses(list || []);
    return listPoses({ adult: true }).length;
  },

  // Contact sheet of poses on mannequins (pairs use two figures). ids: pose ids, or {cat} filter.
  async poseSheet({ ids, cat, adult = false, cols = 6, cell = 240, view = '3q', withProps = true }) {
    const list = ids?.length ? ids.map(getPose).filter(Boolean) : listPoses({ adult, cat });
    const rows = Math.ceil(list.length / cols) || 1;
    const c = canvas(cols * cell, rows * (cell + 36));
    const g = c.getContext('2d');
    g.fillStyle = '#f4f5f7';
    g.fillRect(0, 0, c.width, c.height);
    sr.setFigures(sheetFigs, [{ color: '#e2735f' }, { color: '#5a8fd8' }, { color: '#5fb87a' }]);
    sr.setStyle('shaded');
    sr.floor.visible = true;
    for (let k = 0; k < list.length; k++) {
      const def = list[k];
      const people = [];
      if (def.pair || def.trio) {
        const parts = def.trio ? [def.a, def.b, def.c] : [def.a, def.b];
        const offs = [{ x: 0, z: 0, yaw: 0 }, def.offset || { x: 0, z: 0.6, yaw: 180 }, def.offsetC || { x: 0.6, z: 0.3, yaw: -90 }];
        parts.forEach((part, k) => people.push({ h: [1.65, 1.75, 1.7][k], pose: compileDef({ ...part, id: def.id + ':' + k }), place: { x: offs[k].x || 0, z: offs[k].z || 0, yaw: ((offs[k].yaw || 0) * Math.PI) / 180 } }));
      } else {
        people.push({ h: 1.65, pose: compileDef(def), place: { x: 0, z: 0, yaw: 0 } });
      }
      const box = new THREE.Box3();
      sheetFigs.forEach((f, i) => {
        const p = people[i];
        f.root.visible = !!p;
        if (!p) return;
        f.root.position.set(p.place.x, 0, p.place.z);
        f.root.rotation.set(0, p.place.yaw, 0);
        f.applyPose(p.pose, null);
        box.union(fk(p.h, p.pose, p.place).box);
      });
      // props carried by the pose
      const W = { people: people.map((p, i) => ({ pos: new THREE.Vector3(p.place.x, 0, p.place.z), yaw: p.place.yaw, props: withProps ? p.pose.props : [] })) };
      sr.placeProps({ people: W.people }, null);
      for (const list2 of sr.propPool.values()) for (const pg of list2) if (pg.visible) box.union(new THREE.Box3().setFromObject(pg));
      box.expandByScalar(0.05);
      const cam = sheetCamera(box, view, 1);
      sr.renderer.setSize(cell, cell, false);
      sr.renderer.render(sr.scene, cam);
      const x = (k % cols) * cell;
      const y = Math.floor(k / cols) * (cell + 36);
      g.drawImage(sr.renderer.domElement, x, y + 36);
      g.strokeStyle = '#d0d3d9';
      g.strokeRect(x + 0.5, y + 0.5, cell - 1, cell + 35);
      labelCell(g, x, y, cell, def.id, `${def.cat}${def.layer && def.layer !== 'full' ? ' · ' + def.layer : ''}${def.pair ? ' · pair' : ''}${def.trio ? ' · trio' : ''}${def.adult ? ' · adult' : ''}`);
    }
    for (const list2 of sr.propPool.values()) for (const pg of list2) pg.visible = false;
    return { count: list.length, png: c.toDataURL('image/png') };
  },

  // Contact sheet of props, each next to a 1.7 m scale figure (floor props) or alone (hand props).
  async propSheet({ ids, cat, cols = 6, cell = 220 }) {
    const list = ids?.length ? ids.map(getProp).filter(Boolean) : listProps(cat);
    const rows = Math.ceil(list.length / cols) || 1;
    const c = canvas(cols * cell, rows * (cell + 36));
    const g = c.getContext('2d');
    g.fillStyle = '#f4f5f7';
    g.fillRect(0, 0, c.width, c.height);
    sr.setFigures([], []);
    sr.setStyle('shaded');
    for (let k = 0; k < list.length; k++) {
      const def = list[k];
      for (const l of sr.propPool.values()) for (const pg of l) pg.visible = false;
      const obj = buildProp(def.id, 'shaded');
      sr.propLayer.add(obj);
      const box = new THREE.Box3().setFromObject(obj);
      const size = box.getSize(new THREE.Vector3());
      sr.floor.visible = def.attach !== 'rightHand' && def.attach !== 'leftHand';
      const cam = sheetCamera(box.clone().expandByScalar(0.02), '3q', 1);
      sr.renderer.setSize(cell, cell, false);
      sr.renderer.render(sr.scene, cam);
      sr.propLayer.remove(obj);
      const x = (k % cols) * cell;
      const y = Math.floor(k / cols) * (cell + 36);
      g.drawImage(sr.renderer.domElement, x, y + 36);
      g.strokeStyle = '#d0d3d9';
      g.strokeRect(x + 0.5, y + 0.5, cell - 1, cell + 35);
      labelCell(g, x, y, cell, def.id, `${def.cat} · ${(size.x * 100).toFixed(0)}×${(size.y * 100).toFixed(0)}×${(size.z * 100).toFixed(0)} cm`);
    }
    sr.floor.visible = true;
    return { count: list.length, png: c.toDataURL('image/png') };
  },

  ready: (async () => {
    await Promise.all([
      document.fonts.load(`700 18px ${FONT}`),
      document.fonts.load(`italic 700 18px ${FONT}`),
      document.fonts.load('40px "Bangers"'),
      preloadModels(),
      posesReady,
    ]);
    return true;
  })(),

  info() {
    return { presets: Object.keys(PRESETS), poses: listPoses({ adult: true }).map((p) => ({ id: p.id, name: p.name, cat: p.cat, layer: p.layer, pair: !!p.pair, trio: !!p.trio, adult: !!p.adult, tags: p.tags || [] })), props: listProps().map((p) => ({ id: p.id, name: p.name, cat: p.cat, attach: p.attach })), sizes: SIZES, types: TYPES, roles: ROLES, criteria: CRITERIA.map(([k, l]) => ({ key: k, label: l })) };
  },

  layoutInfo(lp) {
    const l = makeLayout(lp);
    return { panels: l.panels.length, W: l.W, H: l.H, shapes: l.panels.map((p) => ({ w: Math.round(p.bbox.w), h: Math.round(p.bbox.h), area: +(p.areaFrac * 100).toFixed(1) })) };
  },

  // Scan layout numbers for ones with the wanted panel count; returns matches + a contact sheet.
  async findLayouts({ lp, panelCount, keyPanel = null, count = 8, start = 1 }) {
    const found = [];
    for (let idx = start; idx < start + 2000 && found.length < count; idx++) {
      const l = makeLayout({ ...lp, index: idx });
      if (panelCount && l.panels.length !== panelCount) continue;
      if (keyPanel) {
        // the key panel must be clearly the biggest (insets don't count)
        const areas = l.panels.map((p) => (p.inset ? 0 : p.area));
        const k = keyPanel - 1;
        if (!(k < areas.length && areas.every((a, i) => i === k || a < areas[k] * 0.95))) continue;
      }
      found.push({ index: idx, panels: l.panels.length, layout: l });
    }
    const cols = Math.min(4, Math.max(1, found.length));
    const tw = 220;
    const th = Math.round((tw * (found[0]?.layout.H || 1414)) / (found[0]?.layout.W || 1000));
    const rows = Math.ceil(found.length / cols);
    const c = canvas(cols * (tw + 16) + 16, rows * (th + 40) + 16);
    const g = c.getContext('2d');
    g.fillStyle = '#e9ebef';
    g.fillRect(0, 0, c.width, c.height);
    for (let k = 0; k < found.length; k++) {
      const f = found[k];
      const img = new Image();
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(layoutToSVG(f.layout, { numbers: true, guide: false }));
      await img.decode();
      const x = 16 + (k % cols) * (tw + 16);
      const y = 16 + Math.floor(k / cols) * (th + 40);
      g.drawImage(img, x, y, tw, th);
      g.fillStyle = '#222';
      g.font = '600 15px system-ui, sans-serif';
      g.fillText(`index ${f.index} · ${f.panels} panels`, x, y + th + 22);
    }
    return { matches: found.map(({ index, panels }) => ({ index, panels })), png: found.length ? c.toDataURL('image/png') : null };
  },

  async rollPage({ page, chars, proposals = 6, seed, style, renderStyle }) {
    const ctx = await setup(page, chars, renderStyle);
    const { layout, world, plan } = ctx;
    const locks = locksFor(page);
    const props = [];
    for (let k = 0; k < proposals; k++) {
      props.push(rollProposal({ layout, world, plan, tone: page.tone, intensity: page.intensity, style: style || page.style || 'balance', seed: `${seed}|${k}`, locks, nChars: world.n, staging: page.staging, sceneProps: page.sceneProps }));
    }
    // contact sheet of all proposals, lettered
    const cols = Math.min(3, props.length);
    const scale = 300 / layout.W;
    const pw = layout.W * scale;
    const ph = layout.H * scale;
    const rows = Math.ceil(props.length / cols);
    const c = canvas(cols * (pw + 16) + 16, rows * (ph + 40) + 16);
    const g = c.getContext('2d');
    g.fillStyle = '#e9ebef';
    g.fillRect(0, 0, c.width, c.height);
    props.forEach((p, k) => {
      const pc = canvas(pw, ph);
      const pg = pc.getContext('2d');
      drawPage(pg, sr, layout, p, world, { scale, show: { scores: true }, chars });
      drawLettering(pg, scale, layout, p, page, {});
      const x = 16 + (k % cols) * (pw + 16);
      const y = 16 + Math.floor(k / cols) * (ph + 40);
      g.drawImage(pc, x, y);
      g.fillStyle = '#222';
      g.font = '600 15px system-ui, sans-serif';
      g.fillText(`Proposal ${k + 1} · ${p.total} pts`, x, y + ph + 22);
    });
    return {
      positions: ctx.positions,
      proposals: props.map((p) => ({ total: p.total, panels: summarize(p.shots, chars, layout) })),
      png: c.toDataURL('image/jpeg', 0.86),
    };
  },

  async rerollPanel({ page, chars, panel, seed, style }) {
    const ctx = await setup(page, chars, 'shaded');
    const prop = currentShots(page, ctx);
    rerollPanel(prop, panel, { world: ctx.world, style: style || page.style || 'balance', seed });
    return { total: prop.total, panels: summarize(prop.shots, chars, ctx.layout) };
  },

  async scorePage({ page, chars }) {
    const ctx = await setup(page, chars, 'shaded');
    const prop = currentShots(page, ctx);
    return { total: prop.total, positions: ctx.positions, panels: summarize(prop.shots, chars, ctx.layout) };
  },

  // print: {bleedMm, cropMarks, dpi, label} renders at trim size + bleed (+ slug with crop marks).
  async renderPage({ page, chars, width = 1200, diagnostics = false, renderStyle, images, caps = true, previewWidth = 0, print = null }) {
    const ctx = await setup(page, chars, renderStyle || page.renderStyle || 'shaded');
    const { layout, world } = ctx;
    const prop = currentShots(page, ctx);
    const pg = print ? printGeometry(layout, print) : null;
    const scale = pg ? pg.scale : width / layout.W;
    const c = pg ? canvas(pg.width, pg.height) : canvas(width, layout.H * scale);
    const g = c.getContext('2d');
    const panelImages = await loadImages(images);
    if (pg) {
      g.fillStyle = '#fff';
      g.fillRect(0, 0, c.width, c.height);
      g.translate(pg.offsetPx, pg.offsetPx);
    }
    drawPage(g, sr, layout, prop, world, { scale, show: diagnostics ? DIAG_SHOW : {}, chars, panelImages, bleed: pg?.bleedU || 0 });
    drawLettering(g, scale, layout, prop, page, { caps, allowBreak: page.balloonsBreak });
    if (pg) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      drawCropMarks(g, pg, print.label);
    }
    let preview = null;
    if (previewWidth > 0) {
      const pc = canvas(previewWidth, (c.height * previewWidth) / c.width);
      const pg = pc.getContext('2d');
      pg.imageSmoothingQuality = 'high';
      pg.drawImage(c, 0, 0, pc.width, pc.height);
      preview = pc.toDataURL('image/jpeg', 0.86);
    }
    const printInfo = pg && { dpi: pg.dpi, trimMm: pg.trim, bleedMm: pg.bleedMm, slugMm: pg.slug, mediaMm: pg.mediaMm, widthPx: c.width, heightPx: c.height };
    return { total: prop.total, positions: ctx.positions, panels: summarize(prop.shots, chars, layout), png: c.toDataURL('image/png'), preview, print: printInfo };
  },

  // Reference image + image-model prompt for a page (panel = null) or one panel.
  async imagePrompt({ page, chars, panel = null, style = '', setting = '', blank = false, images, caps = true }) {
    const ctx = await setup(page, chars, 'shaded');
    const { layout, world } = ctx;
    const prop = currentShots(page, ctx);
    const LONG = 1536;
    const pn = panel != null ? layout.panels[panel] : null;
    if (panel != null && !pn) throw new Error(`No panel ${panel + 1}`);
    const box = pn ? pn.bbox : { x: 0, y: 0, w: layout.W, h: layout.H };
    const scale = LONG / Math.max(box.w, box.h);
    const full = canvas(layout.W * scale, layout.H * scale);
    const fg = full.getContext('2d');
    drawPage(fg, sr, layout, prop, world, { scale, show: {}, chars, panelImages: await loadImages(images) });
    drawLettering(fg, scale, layout, prop, page, { caps, blank, allowBreak: page.balloonsBreak });
    let out = full;
    if (pn) {
      const pad = 10;
      out = canvas((box.w + 2 * pad) * scale, (box.h + 2 * pad) * scale);
      const g = out.getContext('2d');
      g.fillStyle = '#fff';
      g.fillRect(0, 0, out.width, out.height);
      g.translate((pad - box.x) * scale, (pad - box.y) * scale);
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
    }
    const scripts = Object.fromEntries((page.panels || []).map((p, i) => [i, p.script]).filter(([, s]) => s));
    const prompt = buildImagePrompt({
      scope: pn ? panel : 'page', layout, shots: prop.shots, chars, scripts, style, setting, tone: page.tone, blankBalloons: blank, dir: layout.dir,
      size: { w: Math.round(box.w), h: Math.round(box.h) },
    });
    return { png: out.toDataURL('image/png'), prompt, size: suggestedSize(box.w, box.h) };
  },

  // Per-panel guide images (for img2img / ControlNet), sized to the panel's aspect ratio.
  async panelGuides({ page, chars, panels, kinds = ['render', 'depth', 'lineart'], longSide = 1024, renderStyle }) {
    const ctx = await setup(page, chars, renderStyle || 'shaded');
    const { layout, world } = ctx;
    const prop = currentShots(page, ctx);
    const want = panels?.length ? panels : layout.panels.map((_, i) => i);
    const out = [];
    for (const i of want) {
      const pn = layout.panels[i];
      if (!pn) continue;
      const a = pn.bbox.w / pn.bbox.h;
      const r64 = (v) => Math.max(64, Math.round(v / 64) * 64);
      const w = a >= 1 ? r64(longSide) : r64(longSide * a);
      const h = a >= 1 ? r64(longSide / a) : r64(longSide);
      const images = {};
      for (const kind of kinds) {
        const src = sr.renderGuide(prop.shots[i], world, w, h, kind, chars);
        const c = canvas(w, h);
        c.getContext('2d').drawImage(src, 0, 0);
        images[kind] = c.toDataURL('image/png');
      }
      out.push({ panel: i + 1, width: w, height: h, description: describeShot(prop.shots[i], chars), images });
    }
    return out;
  },

  // ---------------------------------------------------------------- video

  /**
   * Animatic / control videos for a run of pages. pages: [{page, chars, pageNumber}].
   * kinds: any of render, depth, lineart, pose. Returns base64 MP4s plus the clip timings.
   */
  async renderVideo({ pages, width = 1280, height = 720, fps = 24, kinds = ['render'], lettering = 'subtitles', drift = 0.04, caps = true, pageTransition = 'cut', renderStyle, panels = null }) {
    const composer = await buildComposer({ pages, width, height, lettering, drift, caps, pageTransition, renderStyle, panels });
    const out = {};
    let codec = null;
    for (const kind of kinds) {
      const r = await composer.encode({ kind, fps });
      codec = r.codec;
      out[kind] = await blobToBase64(r.blob);
    }
    const tl = composer.timeline;
    return {
      videos: out, codec, fps, width: composer.width, height: composer.height, seconds: +tl.total.toFixed(2),
      clips: tl.clips.map((c) => ({ page: c.pageNumber, panel: c.panel + 1, start: +c.t0.toFixed(2), end: +c.t1.toFixed(2), moving: hasMotion(c.motion), transition: c.transition })),
    };
  },

  // A strip of frames through one shot (or each shot of a page) so motion can be checked without a video.
  async motionStrip({ page, chars, panels = null, frames = 3, width = 1280, height = 720, thumb = 320, lettering = 'subtitles', renderStyle }) {
    const composer = await buildComposer({ pages: [{ page, chars, pageNumber: 1 }], width, height, lettering, drift: 0.04, caps: true, pageTransition: 'cut', renderStyle, panels });
    const clips = composer.timeline.clips;
    const th = Math.round((thumb * composer.height) / composer.width);
    const c = canvas(frames * (thumb + 8) + 8 + 40, clips.length * (th + 8) + 8);
    const g = c.getContext('2d');
    g.fillStyle = '#e9ebef';
    g.fillRect(0, 0, c.width, c.height);
    const frame = canvas(composer.width, composer.height);
    const fg = frame.getContext('2d');
    clips.forEach((clip, r) => {
      g.fillStyle = '#222';
      g.font = '600 14px system-ui, sans-serif';
      g.fillText(String(clip.panel + 1), 12, 8 + r * (th + 8) + th / 2 + 5);
      for (let k = 0; k < frames; k++) {
        const u = frames === 1 ? 0 : k / (frames - 1);
        const t = clip.t0 + Math.min(clip.duration - 0.001, u * clip.duration);
        composer.drawFrame(fg, t, 'render');
        g.drawImage(frame, 40 + k * (thumb + 8), 8 + r * (th + 8), thumb, th);
      }
    });
    return { png: c.toDataURL('image/jpeg', 0.86), clips: clips.map((cl) => ({ panel: cl.panel + 1, seconds: cl.duration })) };
  },
};

async function blobToBase64(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

// Clips for every panel of every page, in reading order. Panel motion lives in page.panels[i].motion:
// {duration, ease, start, end, camera, transition, to: {camera, poses, pair, hold, moves}}.
async function buildComposer({ pages, width, height, lettering, drift, caps, pageTransition, renderStyle, panels }) {
  const composer = new VideoComposer(sr, { width, height, lettering, drift, caps });
  composer.setSize(width, height);
  const clips = [];
  for (let pi = 0; pi < pages.length; pi++) {
    const { page, chars, pageNumber } = pages[pi];
    const style = renderStyle || page.renderStyle || 'shaded';
    const ctx = await setup(page, chars, style);
    const prop = currentShots(page, ctx);
    const figs = await getFigures(chars);
    const setupFn = () => { sr.setFigures(figs, chars); sr.setStyle(style, chars); };
    composer.opts.dir = ctx.layout.dir || 'ltr';
    prop.shots.forEach((shot, i) => {
      if (panels && !panels.includes(i)) return;
      const p = page.panels?.[i] || {};
      const m = p.motion || null;
      const first = clips.length === 0;
      const pageStart = !first && clips[clips.length - 1].pageNumber !== pageNumber;
      clips.push({
        shot, world: ctx.world, script: p.script, motion: m, chars, setup: setupFn, pageNumber, panel: i,
        duration: m?.duration || defaultDuration(p.script, shot.ctx.role),
        transition: m?.transition || (pageStart ? pageTransition : 'cut'),
      });
    });
  }
  composer.setClips(clips);
  return composer;
}

window.ComicAPI = ComicAPI;
