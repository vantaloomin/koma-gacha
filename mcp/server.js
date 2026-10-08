#!/usr/bin/env node
// MCP server: build whole comics with the Koma layout/camera engine.
// Comics are JSON projects on disk; rendering happens in a headless browser (see engine.js).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import zlib from 'node:zlib';
import { PDFDocument } from 'pdf-lib';
import { Engine, dataUrlToBuffer } from './engine.js';
import { GUIDE, TOPICS } from './guide.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMICS = path.resolve(process.env.NG_COMICS_DIR || path.join(ROOT, 'comics'));
fs.mkdirSync(COMICS, { recursive: true });
const engine = new Engine(ROOT);

const PALETTE = ['#e2735f', '#5a8fd8', '#5fb87a', '#c98ad6', '#e0b04a', '#4fb6b8', '#d8607f', '#8a8f9c'];
const TONES = ['auto', 'daily', 'tension', 'conflict', 'surprise', 'intimate', 'sad', 'comedy', 'resolve', 'ominous', 'joy'];
const SIZE_KEYS = ['extreme_wide', 'full', 'medium', 'medium_closeup', 'closeup'];
const TYPE_KEYS = { establishing: 'establish', two_shot: 'two', single: 'single', over_shoulder: 'ots' };
const TYPE_NAMES = Object.fromEntries(Object.entries(TYPE_KEYS).map(([k, v]) => [v, k]));

// ---------------------------------------------------------------- storage

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'comic';
const dir = (id, ...p) => path.join(COMICS, id, ...p);
const pad = (n) => String(n).padStart(2, '0');

function load(id) {
  const f = dir(id, 'comic.json');
  if (!fs.existsSync(f)) throw new Error(`No comic "${id}". Use list_comics to see existing ids.`);
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}
function save(c) {
  fs.mkdirSync(dir(c.id), { recursive: true });
  c.updated = new Date().toISOString();
  fs.writeFileSync(dir(c.id, 'comic.json'), JSON.stringify(c, null, 2));
}
function writeFile(id, sub, name, buf) {
  const d = dir(id, sub);
  fs.mkdirSync(d, { recursive: true });
  const f = path.join(d, name);
  fs.writeFileSync(f, buf);
  return f;
}

function getPage(c, n) {
  const p = c.pages[n - 1];
  if (!p) throw new Error(`Page ${n} doesn't exist (the comic has ${c.pages.length} page${c.pages.length === 1 ? '' : 's'}).`);
  return p;
}
function getPanel(page, n) {
  const p = page.panels[n - 1];
  if (!p) throw new Error(`Panel ${n} doesn't exist (this page has ${page.panels.length} panels).`);
  return p;
}
function findChar(c, name) {
  return c.characters.find((ch) => ch.name.toLowerCase() === String(name).toLowerCase());
}

// ---------------------------------------------------------------- API adapters

function apiChars(c, page) {
  return page.cast.map((name) => {
    const ch = findChar(c, name);
    if (!ch) throw new Error(`Character "${name}" isn't in this comic. Add it with add_character.`);
    return { name: ch.name, height: ch.height, color: ch.color, description: ch.description || '', vrmUrl: ch.vrm ? engine.fileUrl(ch.vrm) : null };
  });
}

function apiPage(c, page) {
  const idx = (name) => page.cast.findIndex((n) => n.toLowerCase() === String(name).toLowerCase());
  const staging = {};
  for (const [name, id] of Object.entries(page.staging || {})) if (id && idx(name) >= 0) staging[idx(name)] = id;
  if (page.pairStaging && idx(page.pairStaging.a) >= 0 && idx(page.pairStaging.b) >= 0) {
    staging.pair = { id: page.pairStaging.pose, a: idx(page.pairStaging.a), b: idx(page.pairStaging.b) };
    if (page.pairStaging.c && idx(page.pairStaging.c) >= 0) staging.pair.c = idx(page.pairStaging.c);
  }
  return {
    staging,
    sceneProps: (page.sceneProps || []).map((sp) => ({ id: sp.prop, x: sp.x || 0, z: sp.z || 0, y: sp.y || 0, yaw: sp.yaw || 0 })),
    layout: { ...page.layout, format: c.format, dir: c.dir },
    positions: page.positions, tone: page.tone, intensity: page.intensity, style: page.style, seed: page.seed,
    panels: page.panels.map((p) => ({
      role: p.role,
      focus: p.focus != null && idx(p.focus) >= 0 ? idx(p.focus) : undefined,
      lock: p.lock && p.lock !== 'none' ? p.lock : undefined,
      spec: p.spec,
      motion: p.motion,
      script: p.script ? {
        caption: p.script.caption,
        sfx: p.script.sfx,
        dialogue: (p.script.dialogue || []).map((d) => ({
          text: d.text, kind: d.kind,
          speaker: d.speaker == null ? null : idx(d.speaker) >= 0 ? idx(d.speaker) : -1,
        })),
      } : undefined,
    })),
  };
}

function images(c, page) {
  const out = {};
  page.panels.forEach((p, i) => { if (p.image) out[i] = engine.fileUrl(dir(c.id, p.image)); });
  return out;
}

const imageContent = (dataUrl) => ({ type: 'image', data: dataUrl.slice(dataUrl.indexOf(',') + 1), mimeType: dataUrl.slice(5, dataUrl.indexOf(';')) });
const text = (t) => ({ type: 'text', text: t });

function panelLines(c, page, panels) {
  return panels.map((p) => {
    const st = page.panels[p.panel - 1] || {};
    const lock = st.lock && st.lock !== 'none' ? ` 🔒${st.lock}` : '';
    const img = st.image ? ' [art]' : '';
    const lines = (st.script?.dialogue || []).map((d) => `${d.speaker ?? 'narration'}${d.kind && d.kind !== 'speech' ? ` (${d.kind})` : ''}: "${d.text}"`);
    if (st.script?.caption) lines.unshift(`caption: "${st.script.caption}"`);
    for (const fx of st.script?.sfx || []) lines.push(`sfx: ${fx.text}`);
    const weak = Object.entries(p.criteria).filter(([, v]) => v < 60).map(([k, v]) => `${k} ${v}`).join(', ');
    const shape = p.shape ? ` [${p.shape}]` : '';
    const sp = st.spec || p.spec;
    const poseTxt = sp?.pair ? `group ${sp.pair.id} (${[sp.pair.a, sp.pair.b, sp.pair.c].filter((x) => x != null).map((x) => page.cast[x]).join(' + ')})` : Object.entries(sp?.poses || {}).map(([i, id]) => `${page.cast[i]} ${id}`).join(', ');
    const holdTxt = Object.entries(sp?.hold || {}).map(([i, h]) => `${page.cast[i]} holds ${[h.left, h.right].filter(Boolean).join(' + ')}`).join(', ');
    return `  ${p.panel}. ${p.label}${shape} — ${p.score} pts${p.axisOk ? '' : ' (crosses the 180° axis!)'}${lock}${img}\n` +
      `     camera: ${TYPE_NAMES[p.spec.type]}, ${SIZE_KEYS[p.spec.size]}, subject ${page.cast[p.spec.subject] ?? '-'}, elev ${Math.round(p.spec.elev)}°, orbit ${Math.round(p.spec.az)}°, dutch ${Math.round(p.spec.dutch)}°` +
      (poseTxt || holdTxt ? `\n     poses: ${[poseTxt, holdTxt].filter(Boolean).join('; ')}` : '') +
      (st.motion ? `\n     motion: ${motionText(page, st.motion)}` : '') +
      (weak ? `\n     weak: ${weak}` : '') +
      (lines.length ? '\n     ' + lines.join('\n     ') : '');
  }).join('\n');
}

function motionText(page, m) {
  const bits = [];
  if (m.duration) bits.push(`${m.duration}s`);
  if (m.camera && m.camera !== 'auto') bits.push(`camera ${m.camera}`);
  if (m.to?.camera) bits.push(`end camera ${Object.entries(m.to.camera).map(([k, v]) => `${k} ${typeof v === 'number' ? Math.round(v * 100) / 100 : v}`).join(', ')}`);
  for (const [i, id] of Object.entries(m.to?.poses || {})) bits.push(`${page.cast[i]} → ${id || 'base pose'}`);
  if (m.to && 'pair' in m.to) bits.push(m.to.pair ? `→ group ${m.to.pair.id}` : '→ no group pose');
  for (const [i, mv] of Object.entries(m.to?.moves || {})) {
    const parts = [mv.toward != null ? `toward ${page.cast[mv.toward]}` : '', mv.forward ? `forward ${mv.forward}m` : '', mv.side ? `side ${mv.side}m` : '', mv.turn ? `turn ${mv.turn}°` : ''].filter(Boolean);
    bits.push(`${page.cast[i]} moves ${parts.join(' ')}`);
  }
  if (m.ease && m.ease !== 'inOut') bits.push(`ease ${m.ease}`);
  if (m.start || (m.end != null && m.end !== 1)) bits.push(`moves ${Math.round((m.start || 0) * 100)}–${Math.round((m.end ?? 1) * 100)}%`);
  if (m.transition && m.transition !== 'cut') bits.push(`${m.transition} in`);
  return bits.join(', ') || 'still';
}

function pageHeader(c, n, page, total) {
  const extras = [page.layout.bleedMode && `bleed ${page.layout.bleedMode}`, page.layout.grid && page.layout.grid !== 'off' && `grid ${page.layout.grid}`].filter(Boolean).join(', ');
  const stage = [...Object.entries(page.staging || {}).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`), page.pairStaging && `${[page.pairStaging.a, page.pairStaging.b, page.pairStaging.c].filter(Boolean).join('+')}=${page.pairStaging.pose}`, ...(page.sceneProps || []).map((x) => x.prop)].filter(Boolean);
  if (stage.length) return `${pageHeaderBase(c, n, page, total, extras)}\n  staging: ${stage.join(', ')}`;
  return pageHeaderBase(c, n, page, total, extras);
}
function pageHeaderBase(c, n, page, total, extras) {
  return `Page ${n}/${c.pages.length} — layout ${page.layout.preset} seed ${page.layout.seed} #${page.layout.index}${extras ? ` (${extras})` : ''}, ${page.panels.length} panels, cast ${page.cast.join(', ')}, tone ${page.tone}, total ${total} pts`;
}

// Pose/prop metadata from the renderer (built-in + custom poses), cached.
let poseMeta = null;
let propMeta = null;
async function libraryInfo(refresh = false) {
  if (!poseMeta || refresh) {
    const info = await engine.call('info');
    poseMeta = new Map(info.poses.map((p) => [p.id, p]));
    propMeta = new Map(info.props.map((p) => [p.id, p]));
  }
  return { poses: poseMeta, props: propMeta };
}

const isAdultChar = (ch) => ch && ch.adult !== false && ch.height >= 150;

// Every pose a page uses must exist; adult-pack poses need the comic opt-in and adult characters.
async function checkPoses(c, page) {
  const { poses, props } = await libraryInfo();
  const used = [];
  for (const [name, id] of Object.entries(page.staging || {})) if (id) used.push({ id, chars: [name], where: 'staging' });
  if (page.pairStaging) used.push({ id: page.pairStaging.pose, chars: [page.pairStaging.a, page.pairStaging.b, page.pairStaging.c].filter(Boolean), where: 'group staging', pair: true, hasC: !!page.pairStaging.c });
  page.panels.forEach((p, n) => {
    for (const [i, id] of Object.entries(p.spec?.poses || {})) if (id) used.push({ id, chars: [page.cast[i]], where: `panel ${n + 1}` });
    if (p.spec?.pair) used.push({ id: p.spec.pair.id, chars: [page.cast[p.spec.pair.a], page.cast[p.spec.pair.b], p.spec.pair.c != null ? page.cast[p.spec.pair.c] : null].filter(Boolean), where: `panel ${n + 1}`, pair: true, hasC: p.spec.pair.c != null });
    for (const h of Object.values(p.spec?.hold || {})) for (const id of [h.left, h.right]) if (id && !props.has(id)) throw new Error(`Unknown prop "${id}" in panel ${n + 1}. Use list_props.`);
  });
  for (const sp of page.sceneProps || []) if (!props.has(sp.prop)) throw new Error(`Unknown prop "${sp.prop}". Use list_props.`);
  for (const u of used) {
    const m = poses.get(u.id);
    if (!m) throw new Error(`Unknown pose "${u.id}" (${u.where}). Use list_poses.`);
    const group = m.pair || m.trio;
    if (!!u.pair !== !!group) throw new Error(`Pose "${u.id}" ${group ? `is a ${m.trio ? 'trio' : 'pair'} pose: use pair_staging or edit_panel pair` : 'is not a group pose'} (${u.where}).`);
    if (m.trio && !u.hasC) throw new Error(`Pose "${u.id}" is a trio pose: give a, b and c (${u.where}).`);
    if (!m.adult) continue;
    if (!c.adultContent) throw new Error(`Pose "${u.id}" is in the adult pack. Enable it for this comic first with set_comic_options { adult_content: true }.`);
    for (const n of u.chars) {
      if (!isAdultChar(findChar(c, n))) throw new Error(`Adult-pack poses can only be used on adult characters (marked adult and at least 150 cm tall). "${n}" doesn't qualify (${u.where}).`);
    }
  }
}

// Roll the gacha for a page, keep all proposals, apply the best one.
async function rollPage(c, page, { seed, style, proposals = 6 } = {}) {
  await checkPoses(c, page);
  page.seed = seed || page.seed || `G-${Math.floor(Math.random() * 9000 + 1000)}`;
  const res = await engine.call('rollPage', { page: apiPage(c, page), chars: apiChars(c, page), proposals, seed: page.seed, style: style || page.style });
  page.positions = res.positions;
  page.proposals = res.proposals.map((p) => ({ total: p.total, specs: p.panels.map((x) => x.spec) }));
  let best = 0;
  page.proposals.forEach((p, k) => { if (p.total > page.proposals[best].total) best = k; });
  applyProposal(page, best);
  return { res, best };
}

function applyProposal(page, k) {
  const pr = page.proposals?.[k];
  if (!pr) throw new Error(`No proposal ${k + 1}; roll the page first.`);
  page.chosen = k;
  pr.specs.forEach((s, i) => { if (page.panels[i]) page.panels[i].spec = s; });
}

async function render(c, n, { width = 1400, diagnostics = false, renderStyle, previewWidth = 900, print = null } = {}) {
  const page = getPage(c, n);
  await checkPoses(c, page);
  const res = await engine.call('renderPage', {
    page: apiPage(c, page), chars: apiChars(c, page), width, diagnostics, renderStyle: renderStyle || page.renderStyle,
    images: images(c, page), caps: c.caps !== false, previewWidth, print,
  });
  if (print) return { res }; // print renders are written by the caller
  page.positions = res.positions;
  // a render may have filled in panels that had no camera yet
  res.panels.forEach((p, i) => { if (page.panels[i] && !page.panels[i].spec) page.panels[i].spec = p.spec; });
  const file = writeFile(c.id, 'renders', `page-${pad(n)}${diagnostics ? '-diagnostics' : ''}.png`, dataUrlToBuffer(res.png));
  return { res, file };
}

async function previewResult(c, n, extra = '', opts = {}) {
  const { res, file } = await render(c, n, opts);
  save(c);
  const page = getPage(c, n);
  return {
    content: [
      text(`${extra ? extra + '\n\n' : ''}${pageHeader(c, n, page, res.total)}\n${panelLines(c, page, res.panels)}\n\nSaved: ${file}`),
      imageContent(res.preview || res.png),
    ],
  };
}

async function resolveLayout(c, layout = {}, wantCount) {
  const lp = { ...layout, preset: layout.preset || 'standard', seed: layout.seed || `L-${Math.floor(Math.random() * 9000 + 1000)}`, index: layout.index, removed: [] };
  if (!lp.index) {
    if (wantCount) {
      const r = await engine.call('findLayouts', { lp: { ...lp, format: c.format, dir: c.dir }, panelCount: wantCount, keyPanel: lp.keyPanel, count: 1 });
      if (!r.matches.length) throw new Error(`No "${lp.preset}" layout with ${wantCount} panels${lp.keyPanel ? ` and panel ${lp.keyPanel} biggest` : ''} for seed ${lp.seed}. Try another preset (orderly suits 5-10 panels, splash 1-4, grid 4-12, strips 10-14) or another seed.`);
      lp.index = r.matches[0].index;
    } else lp.index = 1;
  }
  const info = await engine.call('layoutInfo', { ...lp, format: c.format, dir: c.dir });
  return { lp, count: info.panels };
}

// staging / pair_staging / scene_props args -> page fields (names canonicalised to the cast)
function applyStaging(c, page, a) {
  const canon = (name) => {
    const n = page.cast.find((x) => x.toLowerCase() === String(name).toLowerCase());
    if (!n) throw new Error(`${name} isn't in this page's cast (${page.cast.join(', ')}).`);
    return n;
  };
  if (a.staging) {
    page.staging = { ...(page.staging || {}) };
    for (const [name, id] of Object.entries(a.staging)) {
      if (id) page.staging[canon(name)] = id;
      else delete page.staging[canon(name)];
    }
  }
  if (a.pair_staging !== undefined) {
    const g = a.pair_staging;
    page.pairStaging = g ? { pose: g.pose, a: canon(g.a), b: canon(g.b), ...(g.c ? { c: canon(g.c) } : {}) } : null;
  }
  if (a.scene_props) page.sceneProps = a.scene_props;
}

function normalizeScript(p) {
  if (!p) return { script: { dialogue: [] } };
  return {
    script: { dialogue: p.dialogue || [], caption: p.caption || undefined, sfx: p.sfx || undefined },
    role: p.role, focus: p.focus,
  };
}

function checkCast(c, cast) {
  if (!cast?.length || cast.length > 3) throw new Error('A page needs a cast of 1 to 3 characters.');
  for (const n of cast) if (!findChar(c, n)) throw new Error(`Unknown character "${n}". Characters: ${c.characters.map((x) => x.name).join(', ') || '(none)'}.`);
  return cast.map((n) => findChar(c, n).name);
}

function checkSpeakers(c, page) {
  const warn = [];
  page.panels.forEach((p, i) => {
    for (const d of p.script?.dialogue || []) {
      if (d.speaker != null && !findChar(c, d.speaker)) warn.push(`panel ${i + 1}: unknown speaker "${d.speaker}" (shown as an off-panel voice)`);
      else if (d.speaker != null && !page.cast.some((n) => n.toLowerCase() === d.speaker.toLowerCase())) warn.push(`panel ${i + 1}: ${d.speaker} isn't in this page's cast, so the line is treated as an off-panel voice`);
    }
  });
  return warn;
}

// ---------------------------------------------------------------- schemas

const LineZ = z.object({
  speaker: z.string().nullable().describe('Character name, or null for narration'),
  text: z.string(),
  kind: z.enum(['speech', 'thought', 'shout', 'whisper']).optional().describe('Balloon style (default speech)'),
});
const SfxZ = z.object({
  text: z.string(),
  size: z.enum(['small', 'medium', 'large']).optional(),
  color: z.string().optional().describe('Fill colour, e.g. #ffdd33'),
  rotation: z.number().optional().describe('Degrees'),
});
const PanelZ = z.object({
  dialogue: z.array(LineZ).optional().describe('Balloons in reading order. The first speaker in the cast becomes the panel\'s speaker (the camera favours them).'),
  caption: z.string().optional().describe('Narration box'),
  sfx: z.array(SfxZ).optional(),
  role: z.enum(['establish', 'dialogue', 'reaction', 'key']).optional().describe('Override the panel\'s storytelling role'),
  focus: z.string().optional().describe('Who a silent panel is about (character name)'),
});
const PRESET_NAMES = ['orderly', 'standard', 'action', 'splash', 'grid', 'strips'];
const LayoutZ = z.object({
  preset: z.enum(PRESET_NAMES).optional().describe('orderly = calm dialogue rows; standard; action = slants/bleeds/insets; splash = 1-3 big panels; grid = even grid; strips = 5-6 thin rows with repeated slants'),
  seed: z.string().optional(),
  index: z.number().int().min(1).optional().describe('Layout number for that seed (from find_layouts)'),
  bleed: z.enum(['none', 'key', 'free']).optional().describe('none = every panel inside the margins; key = only a big key panel (the largest, if it covers 24%+ of the page) runs off the page edge; free = random edges. Default comes from the preset (standard/splash: key).'),
  grid: z.enum(['auto', '2x2', '2x3', '3x3', '2x4', '3x4', '3x2', '4x2']).optional().describe('Even grid shape, columns x rows (implies the grid preset)'),
  tiers: z.enum(['1-2', '1-3', '2-3', '2-4', '3-4', '3-5', '4-6', '5-6']).optional().describe('Number of rows'),
  steep_slants: z.number().min(0).max(100).optional().describe('Chance of steep diagonal dividers'),
  repeat_slant: z.boolean().optional().describe('Reuse the same divider on every row with the same column count'),
  insets: z.number().min(0).max(100).optional().describe('Chance of an inset panel overlapping the others'),
  diagonal_splits: z.number().min(0).max(100).optional().describe('Chance of a panel being cut corner to corner into two triangles'),
  key_panel: z.number().int().min(1).optional().describe('Pick a layout where panel N (reading order) is clearly the biggest: put the key moment there'),
});

// Tool-facing layout options -> generator params (only keys that were given).
function lpFromArgs(l = {}) {
  const out = {};
  const set = (k, v) => { if (v !== undefined) out[k] = v; };
  set('preset', l.grid && !l.preset ? 'grid' : l.preset);
  set('seed', l.seed);
  set('index', l.index);
  set('bleedMode', l.bleed);
  set('grid', l.grid);
  set('tiers', l.tiers);
  set('steep', l.steep_slants);
  set('repeat', l.repeat_slant);
  set('inset', l.insets);
  set('diag', l.diagonal_splits);
  set('keyPanel', l.key_panel);
  return out;
}
const CameraZ = z.object({
  shot_type: z.enum(['establishing', 'two_shot', 'single', 'over_shoulder']).optional(),
  size: z.enum(SIZE_KEYS).optional(),
  subject: z.string().optional().describe('Character the camera frames'),
  other: z.string().optional().describe('Foreground character for over-the-shoulder'),
  elevation: z.number().min(-40).max(75).optional().describe('Degrees; negative = low angle'),
  orbit: z.number().min(-70).max(70).optional().describe('Degrees around the subject'),
  dutch: z.number().min(-25).max(25).optional(),
  fov: z.number().min(12).max(80).optional(),
  frame_x: z.number().min(-0.8).max(0.8).optional().describe('Where the subject sits horizontally (-0.8 left … 0.8 right)'),
  frame_y: z.number().min(-0.8).max(0.8).optional().describe('Vertical position (positive = higher)'),
});
const ID = z.string().describe('Comic id');
const PAGE = z.number().int().min(1).describe('Page number (1-based)');
const PANEL = z.number().int().min(1).describe('Panel number in reading order (1-based)');

// ---------------------------------------------------------------- server

const server = new McpServer({ name: 'koma-comics', version: '1.5.0' }, {
  instructions: `Make comics with the Koma engine (koma = comic panel).
WORKFLOW: create_comic (characters with heights + descriptions) → add_page (cast, script per panel, layout) → review the preview → edit_panel / set_staging / roll_page to direct → render_page diagnostics=true to check → export_comic or export_image_prompt.
CRAFT CHEAT SHEET (call guide for details: shots, layouts, pacing, acting, lettering, groups, workflow, video, image_prompts):
- One beat per panel; 0–2 balloons and ~25 words per panel. Silent panels let emotion land.
- Open a scene with an establishing shot; move closer as emotion rises.
- Put the key moment in the biggest panel: layout.key_panel = N (bleed 'key' lets it run off the page).
- Dialogue: over_shoulder / medium_closeup; reactions: closeup; contact (hugs, fights): two_shot, full or medium.
- Don't repeat the same shot size twice in a row; stay on one side of the conversation axis.
- Angles: low = power/resolve, high = vulnerability/isolation, dutch = unease (sparingly).
- Panel count by pacing: splash 1–3, action 3–5, dialogue 5–8, rapid back-and-forth 9–12 (grid/strips).
- The gacha picks conversational gestures only; choose actions, emotions, props (hold) and group poses (pair a/b[/c]) deliberately.
- Characters are colour-coded mannequins; give each a description so image prompts and generated art stay consistent.
- Adult-pack poses need set_comic_options adult_content and adult characters (150 cm+).
- Video: each panel is a shot's start keyframe; set_shot_motion adds the end keyframe (camera_move, end_poses, moves, end_pair) and length; preview_motion to check, export_video for MP4 + control videos (guide video).`,
});

const tool = (name, description, inputSchema, fn) => server.registerTool(name, { description, inputSchema }, async (args) => {
  try {
    return await fn(args);
  } catch (e) {
    return { isError: true, content: [text(e.message)] };
  }
});

tool('guide', 'Visual-storytelling guidance for this tool: which shot, layout, pacing, pose or lettering choice to make and how to express it in the tool parameters. Call it when unsure how to direct a page.', {
  topic: z.enum(TOPICS).optional().describe('overview (default), shots, layouts, pacing, acting, lettering, groups, workflow, video, image_prompts'),
}, async (a) => ({ content: [text(GUIDE[a.topic || 'overview'])] }));

tool('list_comics', 'List comic projects on disk.', {}, async () => {
  const ids = fs.readdirSync(COMICS).filter((d) => fs.existsSync(dir(d, 'comic.json')));
  if (!ids.length) return { content: [text(`No comics yet in ${COMICS}.`)] };
  return { content: [text(ids.map((id) => { const c = load(id); return `${id} — "${c.title}", ${c.pages.length} pages, cast: ${c.characters.map((x) => x.name).join(', ')}`; }).join('\n'))] };
});

tool('create_comic', 'Create a new comic project.', {
  title: z.string(),
  format: z.enum(['b5', 'letter', 'comic', 'sns', 'square']).optional().describe('b5 = manga page (default), letter = US Letter 8.5x11, comic = US comic book, sns = 4:5 social portrait, square = 1:1'),
  reading_direction: z.enum(['ltr', 'rtl']).optional().describe('ltr = Western comics (default), rtl = manga'),
  lettering_caps: z.boolean().optional().describe('All-caps lettering (default true)'),
  characters: z.array(z.object({ name: z.string(), height_cm: z.number().min(80).max(230).optional(), color: z.string().optional(), vrm_path: z.string().optional(), adult: z.boolean().optional().describe('Default true'), description: z.string().optional().describe('Look of the character for image prompts') })).optional(),
  adult_content: z.boolean().optional().describe('Allow the adult pose pack in this comic (default false)'),
}, async (a) => {
  let id = slug(a.title);
  let k = 2;
  while (fs.existsSync(dir(id))) id = `${slug(a.title)}-${k++}`;
  const c = { id, title: a.title, format: a.format || 'b5', dir: a.reading_direction || 'ltr', caps: a.lettering_caps !== false, adultContent: a.adult_content === true, characters: [], pages: [], created: new Date().toISOString() };
  for (const ch of a.characters || []) {
    if (ch.vrm_path && !fs.existsSync(ch.vrm_path)) throw new Error(`VRM not found: ${ch.vrm_path}`);
    c.characters.push({ name: ch.name, height: ch.height_cm || 165, color: ch.color || PALETTE[c.characters.length % PALETTE.length], vrm: ch.vrm_path ? path.resolve(ch.vrm_path) : null, adult: ch.adult !== false, description: ch.description || '' });
  }
  save(c);
  return { content: [text(`Created comic "${c.title}" with id ${id} (${c.format}, ${c.dir}). Folder: ${dir(id)}`)] };
});

tool('add_character', 'Add a character to a comic, or update an existing one (same name).', {
  comic_id: ID, name: z.string(), height_cm: z.number().min(80).max(230).optional(), color: z.string().optional(),
  vrm_path: z.string().nullable().optional().describe('Path to a .vrm model; null to go back to the mannequin'),
  adult: z.boolean().optional().describe('Whether the character is an adult (default true). Adult-pack poses also require 150 cm+.'),
  description: z.string().optional().describe('Look of the character for image prompts: age, build, hair, outfit…'),
}, async (a) => {
  const c = load(a.comic_id);
  let ch = findChar(c, a.name);
  if (!ch) { ch = { name: a.name, height: 165, color: PALETTE[c.characters.length % PALETTE.length], vrm: null, adult: true }; c.characters.push(ch); }
  if (a.adult !== undefined) ch.adult = a.adult;
  if (a.description !== undefined) ch.description = a.description;
  if (a.height_cm) ch.height = a.height_cm;
  if (a.color) ch.color = a.color;
  if (a.vrm_path !== undefined) {
    if (a.vrm_path && !fs.existsSync(a.vrm_path)) throw new Error(`VRM not found: ${a.vrm_path}`);
    ch.vrm = a.vrm_path ? path.resolve(a.vrm_path) : null;
  }
  save(c);
  return { content: [text(`Characters: ${c.characters.map((x) => `${x.name} (${x.height} cm, ${x.color}${x.vrm ? ', VRM' : ''})`).join('; ')}`)] };
});

tool('find_layouts', 'Browse page layouts with a given panel count (and optionally a key_panel that must be the biggest). Returns layout indices and a contact sheet; pass the same layout options plus the chosen index to add_page.', {
  comic_id: ID.optional().describe('Use this comic\'s format and reading direction'),
  layout: LayoutZ.optional().describe('Layout options; pass the same ones plus the chosen index to add_page'),
  panel_count: z.number().int().min(1).max(18).optional(),
  count: z.number().int().min(1).max(16).optional(),
}, async (a) => {
  const c = a.comic_id ? load(a.comic_id) : { format: 'b5', dir: 'ltr' };
  const lp = lpFromArgs(a.layout);
  lp.preset = lp.preset || 'standard';
  lp.seed = lp.seed || `L-${Math.floor(Math.random() * 9000 + 1000)}`;
  delete lp.index;
  const r = await engine.call('findLayouts', { lp: { ...lp, format: c.format, dir: c.dir }, panelCount: a.panel_count, keyPanel: lp.keyPanel, count: a.count || 8 });
  if (!r.matches.length) return { content: [text('No matching layouts; try another preset or seed.')] };
  return { content: [text(`preset ${lp.preset}, seed ${lp.seed}: ${r.matches.map((m) => `index ${m.index} (${m.panels})`).join(', ')}`), imageContent(r.png)] };
});

tool('add_page', 'Add a page: picks a layout, rolls the camera gacha, keeps the best proposal, and returns a lettered preview. Write the script per panel (one beat each), set panel_count from pacing and layout.key_panel for the key moment. Then direct with edit_panel.', {
  comic_id: ID,
  cast: z.array(z.string()).min(1).max(3).describe('Characters on this page (1-3)'),
  panels: z.array(PanelZ).optional().describe('Script for each panel in reading order'),
  panel_count: z.number().int().min(1).max(18).optional().describe('Defaults to the number of scripted panels'),
  layout: LayoutZ.optional(),
  tone: z.enum(TONES).optional(),
  intensity: z.enum(['strong', 'normal', 'quiet']).optional(),
  draw_style: z.enum(['safe', 'balance', 'bold']).optional().describe('Gacha randomness'),
  render_style: z.enum(['shaded', 'toon', 'silhouette', 'lineart']).optional(),
  insert_at: z.number().int().min(1).optional().describe('Page position (default: append)'),
  seed: z.string().optional(),
  staging: z.record(z.string(), z.string().nullable()).optional().describe('Page-level base pose per character name, e.g. {"Ada": "sitChair"} (null = standing). Panel gestures overlay it.'),
  pair_staging: z.object({ pose: z.string(), a: z.string(), b: z.string(), c: z.string().optional() }).nullable().optional().describe('Page-level group pose: a pair (a, b) or a trio (a, b, c) from list_poses'),
  scene_props: z.array(z.object({ prop: z.string(), x: z.number(), z: z.number(), y: z.number().optional(), yaw: z.number().optional() })).optional().describe('Set dressing on the floor plan (metres, degrees); see list_props'),
}, async (a) => {
  const c = load(a.comic_id);
  const cast = checkCast(c, a.cast);
  const want = a.panel_count || a.panels?.length;
  const { lp, count } = await resolveLayout(c, lpFromArgs(a.layout), want);
  const notes = [];
  if (a.panels && a.panels.length !== count) notes.push(`Note: ${a.panels.length} scripts for a ${count}-panel layout; ${a.panels.length > count ? 'extra scripts were dropped' : 'the remaining panels are silent'}.`);
  const page = {
    layout: lp, cast, positions: null, tone: a.tone || 'auto', intensity: a.intensity || 'normal', style: a.draw_style || 'balance',
    renderStyle: a.render_style || 'shaded', seed: a.seed, proposals: [], chosen: 0,
    panels: Array.from({ length: count }, (_, i) => (a.panels ? normalizeScript(a.panels[i]) : {})),
  };
  applyStaging(c, page, a);
  notes.push(...checkSpeakers(c, page));
  const at = Math.min(c.pages.length, (a.insert_at || c.pages.length + 1) - 1);
  c.pages.splice(at, 0, page);
  const { res, best } = await rollPage(c, page);
  notes.unshift(`Rolled ${res.proposals.length} proposals (${res.proposals.map((p) => p.total).join(', ')}); using proposal ${best + 1}.`);
  return previewResult(c, at + 1, notes.join('\n'));
});

tool('roll_page', 'Reroll a page\'s cameras (locked panels are kept). Can also change the layout (e.g. key_panel, preset), cast, tone or seed. Returns a contact sheet of all proposals and applies the best one; use choose_proposal to pick another.', {
  comic_id: ID, page: PAGE,
  seed: z.string().optional(), proposals: z.number().int().min(1).max(9).optional(),
  draw_style: z.enum(['safe', 'balance', 'bold']).optional(),
  tone: z.enum(TONES).optional(), intensity: z.enum(['strong', 'normal', 'quiet']).optional(),
  layout: LayoutZ.extend({ panel_count: z.number().int().min(1).max(18).optional() }).optional(),
  cast: z.array(z.string()).min(1).max(3).optional(),
  staging: z.record(z.string(), z.string().nullable()).optional().describe('Page-level base pose per character name, e.g. {"Ada": "sitChair"} (null = standing). Panel gestures overlay it.'),
  pair_staging: z.object({ pose: z.string(), a: z.string(), b: z.string() }).nullable().optional().describe('Page-level pair pose (e.g. a hug) between two cast members'),
  scene_props: z.array(z.object({ prop: z.string(), x: z.number(), z: z.number(), y: z.number().optional(), yaw: z.number().optional() })).optional().describe('Set dressing on the floor plan (metres, degrees); see list_props'),
}, async (a) => {
  const c = load(a.comic_id);
  const page = getPage(c, a.page);
  const notes = [];
  applyStaging(c, page, a);
  if (a.tone) page.tone = a.tone;
  if (a.intensity) page.intensity = a.intensity;
  if (a.draw_style) page.style = a.draw_style;
  if (a.cast) {
    page.cast = checkCast(c, a.cast);
    page.positions = null;
    page.panels.forEach((p) => { delete p.spec; p.lock = undefined; });
  }
  if (a.layout) {
    const { lp, count } = await resolveLayout(c, { ...page.layout, index: undefined, ...lpFromArgs(a.layout) }, a.layout.panel_count || page.panels.length);
    page.layout = lp;
    if (count !== page.panels.length) notes.push(`Layout now has ${count} panels (was ${page.panels.length}); scripts were kept in order.`);
    page.panels = Array.from({ length: count }, (_, i) => {
      const p = page.panels[i] ? { ...page.panels[i] } : { script: { dialogue: [] } };
      delete p.spec; p.lock = undefined; delete p.image;
      return p;
    });
  }
  const { res, best } = await rollPage(c, page, { seed: a.seed || `G-${Math.floor(Math.random() * 9000 + 1000)}`, proposals: a.proposals });
  save(c);
  const sheet = writeFile(c.id, 'renders', `page-${pad(a.page)}-proposals.jpg`, dataUrlToBuffer(res.png));
  return {
    content: [
      text(`${notes.join('\n')}\nProposals: ${res.proposals.map((p, k) => `${k + 1}: ${p.total}`).join(', ')}. Applied proposal ${best + 1}; use choose_proposal to pick another. Contact sheet: ${sheet}`),
      imageContent(res.png),
    ],
  };
});

tool('choose_proposal', 'Apply one of the proposals from the last roll.', { comic_id: ID, page: PAGE, proposal: z.number().int().min(1) }, async (a) => {
  const c = load(a.comic_id);
  const page = getPage(c, a.page);
  applyProposal(page, a.proposal - 1);
  return previewResult(c, a.page, `Applied proposal ${a.proposal}.`);
});

tool('set_page_script', 'Replace the script for every panel on a page. Rerolls cameras by default, since speakers drive the shots.', {
  comic_id: ID, page: PAGE, panels: z.array(PanelZ), reroll: z.boolean().optional(),
}, async (a) => {
  const c = load(a.comic_id);
  const page = getPage(c, a.page);
  page.panels = page.panels.map((p, i) => ({ ...p, ...normalizeScript(a.panels[i]) }));
  const notes = checkSpeakers(c, page);
  if (a.panels.length !== page.panels.length) notes.push(`Note: ${a.panels.length} scripts for ${page.panels.length} panels.`);
  if (a.reroll !== false) await rollPage(c, page);
  return previewResult(c, a.page, notes.join('\n'));
});

tool('set_panel_script', 'Set the dialogue, caption and SFX of one panel.', {
  comic_id: ID, page: PAGE, panel: PANEL,
  dialogue: z.array(LineZ).optional(), caption: z.string().nullable().optional(), sfx: z.array(SfxZ).optional(),
  reroll_camera: z.boolean().optional().describe('Reroll this panel\'s camera for the new speaker'),
}, async (a) => {
  const c = load(a.comic_id);
  const page = getPage(c, a.page);
  const p = getPanel(page, a.panel);
  p.script = p.script || { dialogue: [] };
  if (a.dialogue) p.script.dialogue = a.dialogue;
  if (a.caption !== undefined) p.script.caption = a.caption || undefined;
  if (a.sfx) p.script.sfx = a.sfx;
  const notes = checkSpeakers(c, page);
  if (a.reroll_camera) {
    const r = await engine.call('rerollPanel', { page: apiPage(c, page), chars: apiChars(c, page), panel: a.panel - 1, seed: `re-${Date.now()}` });
    p.spec = r.panels[a.panel - 1].spec;
  }
  return previewResult(c, a.page, notes.join('\n'));
});

tool('edit_panel', 'Direct one panel: camera (shot type, size, angle), poses per character, a group pose (pair/trio), held props, role; or reroll just that panel. Use it after add_page to fix what reads wrong (e.g. a two_shot for a hug, a full shot so a run reads, a closeup for a reaction). Manual edits lock the panel so rerolls keep it.', {
  comic_id: ID, page: PAGE, panel: PANEL,
  camera: CameraZ.optional(),
  poses: z.record(z.string(), z.string().nullable()).optional().describe('Character name -> pose id (any non-pair pose from list_poses; upper-body poses overlay the page staging). null clears.'),
  pair: z.object({ pose: z.string(), a: z.string(), b: z.string(), c: z.string().optional() }).nullable().optional().describe('Group pose for this panel: pair (a, b) or trio (a, b, c); places b and c relative to a. null clears'),
  hold: z.record(z.string(), z.object({ left: z.string().nullable().optional(), right: z.string().nullable().optional() })).optional().describe('Character name -> props in each hand (prop ids from list_props)'),
  role: z.enum(['establish', 'dialogue', 'reaction', 'key']).optional(),
  focus: z.string().optional(),
  lock: z.enum(['none', 'all', 'camera', 'pose']).optional().describe('all = keep everything on reroll; camera/pose = keep only that part'),
  reroll: z.boolean().optional().describe('Reroll this panel\'s camera (before applying any camera edits)'),
}, async (a) => {
  const c = load(a.comic_id);
  const page = getPage(c, a.page);
  const p = getPanel(page, a.panel);
  const idx = (name) => {
    const i = page.cast.findIndex((n) => n.toLowerCase() === String(name).toLowerCase());
    if (i < 0) throw new Error(`${name} isn't in this page's cast (${page.cast.join(', ')}).`);
    return i;
  };
  if (a.role) p.role = a.role;
  if (a.focus) { idx(a.focus); p.focus = a.focus; }
  if (a.reroll || !p.spec) {
    const r = await engine.call('rerollPanel', { page: apiPage(c, page), chars: apiChars(c, page), panel: a.panel - 1, seed: `re-${Date.now()}` });
    p.spec = r.panels[a.panel - 1].spec;
  }
  if (a.camera) {
    const m = a.camera;
    const s = { ...p.spec };
    if (m.shot_type) s.type = TYPE_KEYS[m.shot_type];
    if (m.size) s.size = SIZE_KEYS.indexOf(m.size);
    if (m.subject) s.subject = idx(m.subject);
    if (m.other) s.other = idx(m.other);
    if (s.other === s.subject && page.cast.length > 1) s.other = s.subject === 0 ? 1 : 0;
    if (m.elevation != null) s.elev = m.elevation;
    if (m.orbit != null) s.az = m.orbit;
    if (m.dutch != null) s.dutch = m.dutch;
    if (m.fov != null) s.fov = m.fov;
    if (m.frame_x != null) s.fx = m.frame_x;
    if (m.frame_y != null) s.fy = m.frame_y;
    p.spec = s;
    if (!a.lock) p.lock = 'all';
  }
  if (a.poses) {
    p.spec = { ...p.spec, poses: { ...p.spec.poses } };
    for (const [name, pose] of Object.entries(a.poses)) {
      if (pose) p.spec.poses[idx(name)] = pose;
      else delete p.spec.poses[idx(name)];
    }
    if (!a.lock && !a.camera) p.lock = 'all';
  }
  if (a.pair !== undefined) {
    p.spec = { ...p.spec };
    if (a.pair) p.spec.pair = { id: a.pair.pose, a: idx(a.pair.a), b: idx(a.pair.b), ...(a.pair.c ? { c: idx(a.pair.c) } : {}) };
    else delete p.spec.pair;
    if (!a.lock && !a.camera) p.lock = 'all';
  }
  if (a.hold) {
    p.spec = { ...p.spec, hold: { ...(p.spec.hold || {}) } };
    for (const [name, h] of Object.entries(a.hold)) {
      const i = idx(name);
      const cur = { ...(p.spec.hold[i] || {}) };
      if (h.left !== undefined) cur.left = h.left || undefined;
      if (h.right !== undefined) cur.right = h.right || undefined;
      p.spec.hold[i] = cur;
    }
    if (!a.lock && !a.camera) p.lock = 'all';
  }
  if (a.lock) p.lock = a.lock === 'none' ? undefined : a.lock;
  return previewResult(c, a.page);
});

tool('set_positions', 'Move characters on the floor plan (metres; +z is toward the camera side, the axis runs between the first two cast members). Cameras follow the characters.', {
  comic_id: ID, page: PAGE,
  positions: z.record(z.string(), z.object({ x: z.number(), z: z.number(), facing_offset: z.number().optional().describe('Degrees to turn away from facing the others') })),
}, async (a) => {
  const c = load(a.comic_id);
  const page = getPage(c, a.page);
  if (!page.positions) await engine.call('scorePage', { page: apiPage(c, page), chars: apiChars(c, page) }).then((r) => { page.positions = r.positions; });
  for (const [name, pos] of Object.entries(a.positions)) {
    const i = page.cast.findIndex((n) => n.toLowerCase() === name.toLowerCase());
    if (i < 0) throw new Error(`${name} isn't in this page's cast.`);
    page.positions[i] = { x: pos.x, z: pos.z, yaw: pos.facing_offset || 0 };
  }
  return previewResult(c, a.page, `Positions: ${page.cast.map((n, i) => `${n} (${page.positions[i].x}, ${page.positions[i].z})`).join(', ')}`);
});

tool('render_page', 'Render a page to PNG (saved to disk) and return a preview. diagnostics=true overlays shot labels, scores, reading flow and the 180° axis.', {
  comic_id: ID, page: PAGE,
  width: z.number().int().min(400).max(4000).optional().describe('Saved PNG width in px (default 1400)'),
  diagnostics: z.boolean().optional(),
  render_style: z.enum(['shaded', 'toon', 'silhouette', 'lineart']).optional().describe('Also becomes the page default'),
}, async (a) => {
  const c = load(a.comic_id);
  if (a.render_style) getPage(c, a.page).renderStyle = a.render_style;
  return previewResult(c, a.page, '', { width: a.width, diagnostics: a.diagnostics });
});

tool('get_comic', 'Summarize a comic: characters, pages, panels, cameras, scripts and scores (no images).', { comic_id: ID }, async (a) => {
  const c = load(a.comic_id);
  const out = [`"${c.title}" (${c.id}) — ${c.format}, ${c.dir}, ${c.pages.length} pages`, `Characters: ${c.characters.map((x) => `${x.name} ${x.height}cm ${x.color}${x.vrm ? ' VRM' : ''}`).join('; ')}`];
  for (let n = 1; n <= c.pages.length; n++) {
    const page = c.pages[n - 1];
    const r = await engine.call('scorePage', { page: apiPage(c, page), chars: apiChars(c, page) });
    out.push('', pageHeader(c, n, page, r.total), panelLines(c, page, r.panels));
  }
  return { content: [text(out.join('\n'))] };
});

tool('export_panel_guides', 'Write per-panel guide images for image generation (img2img / ControlNet): the 3D render, a depth map, line art or silhouettes, sized to each panel\'s aspect ratio, plus a text description of each shot.', {
  comic_id: ID, page: PAGE,
  panels: z.array(z.number().int().min(1)).optional().describe('Default: all panels'),
  kinds: z.array(z.enum(['render', 'depth', 'lineart', 'silhouette'])).optional(),
  long_side: z.number().int().min(256).max(2048).optional().describe('Longest side in px, rounded to multiples of 64 (default 1024)'),
}, async (a) => {
  const c = load(a.comic_id);
  const page = getPage(c, a.page);
  const out = await engine.call('panelGuides', {
    page: apiPage(c, page), chars: apiChars(c, page), panels: a.panels?.map((n) => n - 1),
    kinds: a.kinds || ['render', 'depth', 'lineart'], longSide: a.long_side || 1024, renderStyle: page.renderStyle,
  });
  const lines = [];
  for (const g of out) {
    lines.push(`Panel ${g.panel} (${g.width}x${g.height}): ${g.description}`);
    const script = page.panels[g.panel - 1]?.script;
    if (script?.dialogue?.length) lines.push(`   leave room for ${script.dialogue.length} balloon(s)`);
    for (const [kind, url] of Object.entries(g.images)) {
      const f = writeFile(c.id, 'guides', `p${pad(a.page)}-panel${pad(g.panel)}-${kind}.png`, dataUrlToBuffer(url));
      lines.push(`   ${kind}: ${f}`);
    }
  }
  return { content: [text(lines.join('\n'))] };
});

tool('set_panel_image', 'Use an external image (e.g. generated art) as a panel\'s artwork; it is cover-fitted and lettered on top. Pass null to go back to the 3D render.', {
  comic_id: ID, page: PAGE, panel: PANEL, image_path: z.string().nullable(),
}, async (a) => {
  const c = load(a.comic_id);
  const page = getPage(c, a.page);
  const p = getPanel(page, a.panel);
  if (a.image_path) {
    if (!fs.existsSync(a.image_path)) throw new Error(`Image not found: ${a.image_path}`);
    const ext = path.extname(a.image_path).toLowerCase() || '.png';
    const name = `p${pad(a.page)}-panel${pad(a.panel)}-${Date.now()}${ext}`;
    writeFile(c.id, 'assets', name, fs.readFileSync(a.image_path));
    p.image = path.join('assets', name);
  } else delete p.image;
  return previewResult(c, a.page);
});

tool('move_page', 'Move a page to a new position.', { comic_id: ID, page: PAGE, to: z.number().int().min(1) }, async (a) => {
  const c = load(a.comic_id);
  const [p] = c.pages.splice(a.page - 1, 1);
  if (!p) throw new Error(`No page ${a.page}.`);
  c.pages.splice(Math.min(a.to - 1, c.pages.length), 0, p);
  save(c);
  return { content: [text(`Moved page ${a.page} to ${Math.min(a.to, c.pages.length)}.`)] };
});

tool('delete_page', 'Delete a page from a comic (renders on disk are left alone).', { comic_id: ID, page: PAGE }, async (a) => {
  const c = load(a.comic_id);
  getPage(c, a.page);
  c.pages.splice(a.page - 1, 1);
  save(c);
  return { content: [text(`Deleted page ${a.page}; ${c.pages.length} pages remain.`)] };
});

tool('export_comic', 'Render every page and write PNGs, a PDF and/or an HTML reader to the comic\'s export folder. With print, writes print-ready files instead: true trim size at the given DPI, full-bleed panels extended into the bleed, crop marks, and a PDF with TrimBox/BleedBox set.', {
  comic_id: ID,
  width: z.number().int().min(600).max(4000).optional().describe('Screen export page width in px (default 1600)'),
  formats: z.array(z.enum(['png', 'pdf', 'html'])).optional(),
  print: z.object({
    bleed_mm: z.number().min(0).max(10).optional().describe('Bleed beyond the trim (default 3 mm; 0.125 in = 3.175 mm)'),
    crop_marks: z.boolean().optional().describe('Crop marks and a slug label outside the bleed (default true)'),
    dpi: z.number().int().min(150).max(600).optional().describe('Default 300'),
  }).optional().describe('Print-ready export to export/print/ (png and pdf formats only)'),
}, async (a) => {
  const c = load(a.comic_id);
  if (!c.pages.length) throw new Error('The comic has no pages.');
  if (a.print) return exportPrint(c, a.print, a.formats || ['png', 'pdf']);
  const formats = a.formats || ['png', 'pdf', 'html'];
  const width = a.width || 1600;
  const pages = [];
  for (let n = 1; n <= c.pages.length; n++) {
    const { res } = await render(c, n, { width, previewWidth: 0 });
    const f = writeFile(c.id, 'export', `page-${pad(n)}.png`, dataUrlToBuffer(res.png));
    pages.push({ file: f, dataUrl: res.png });
  }
  save(c);
  const out = [];
  if (formats.includes('png')) out.push(...pages.map((p) => p.file));
  const ratio = { b5: 1.414, letter: 1.294, comic: 1.547, sns: 1.25, square: 1 }[c.format] || 1.414;
  if (formats.includes('html')) {
    const html = `<!doctype html><meta charset="utf-8"><title>${escapeHtml(c.title)}</title><style>body{margin:0;background:#222;color:#ddd;font:16px system-ui;text-align:center}h1{font-weight:600;margin:24px}img{display:block;margin:0 auto 24px;max-width:min(100%,900px);box-shadow:0 4px 24px #000}</style><h1>${escapeHtml(c.title)}</h1>${pages.map((_, i) => `<img src="page-${pad(i + 1)}.png" alt="Page ${i + 1}">`).join('')}`;
    out.push(writeFile(c.id, 'export', 'index.html', html));
  }
  if (formats.includes('pdf')) {
    const w = 794;
    const h = Math.round(w * ratio);
    const html = `<!doctype html><style>@page{margin:0}body{margin:0}img{display:block;width:${w}px;height:${h}px;page-break-after:always}</style>${pages.map((p) => `<img src="${p.dataUrl}">`).join('')}`;
    const f = dir(c.id, 'export', `${c.id}.pdf`);
    await engine.pdf(html, f, w, h);
    out.push(f);
  }
  return { content: [text(`Exported ${c.pages.length} pages:\n${out.join('\n')}`)] };
});

// ---------------------------------------------------------------- print export

// Tag a PNG with its physical resolution (pHYs chunk) so it opens at the right print size.
function pngWithDpi(buf, dpi) {
  const ppm = Math.round(dpi / 0.0254);
  const data = Buffer.alloc(9);
  data.writeUInt32BE(ppm, 0);
  data.writeUInt32BE(ppm, 4);
  data.writeUInt8(1, 8); // unit: metre
  const type = Buffer.from('pHYs', 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(9);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([type, data])) >>> 0);
  const at = 8 + 25; // after the signature and IHDR chunk
  return Buffer.concat([buf.subarray(0, at), len, type, data, crc, buf.subarray(at)]);
}

async function exportPrint(c, opts, formats) {
  const print = { bleedMm: opts.bleed_mm ?? 3, cropMarks: opts.crop_marks !== false, dpi: opts.dpi || 300 };
  const pages = [];
  let info = null;
  for (let n = 1; n <= c.pages.length; n++) {
    const label = `${c.title} — page ${n} of ${c.pages.length}`;
    const { res } = await render(c, n, { previewWidth: 0, print: { ...print, label } });
    info = res.print;
    const buf = pngWithDpi(dataUrlToBuffer(res.png), print.dpi);
    const file = formats.includes('png') ? writeFile(c.id, 'export/print', `page-${pad(n)}.png`, buf) : null;
    pages.push({ file, buf });
  }
  save(c);
  const out = pages.map((p) => p.file).filter(Boolean);
  if (formats.includes('pdf')) {
    const [mw, mh] = info.mediaMm;
    const html = `<!doctype html><style>@page{margin:0;size:${mw}mm ${mh}mm}body{margin:0}div{width:${mw}mm;height:${mh}mm;overflow:hidden;break-after:page}div:last-child{break-after:auto}img{width:100%;height:100%;display:block}</style>` +
      pages.map((p) => `<div><img src="data:image/png;base64,${p.buf.toString('base64')}"></div>`).join('');
    const f = dir(c.id, 'export', 'print', `${c.id}-print.pdf`);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    await engine.pdf(html, f, `${mw}mm`, `${mh}mm`);
    // mark trim and bleed so print tools (and printers) know where to cut
    const pt = (mm) => (mm * 72) / 25.4;
    const pdf = await PDFDocument.load(fs.readFileSync(f));
    for (const pg of pdf.getPages()) {
      const { width: W, height: H } = pg.getSize();
      const slug = pt(info.slugMm);
      const trimOff = pt(info.slugMm + info.bleedMm);
      pg.setBleedBox(slug, slug, W - 2 * slug, H - 2 * slug);
      pg.setTrimBox(trimOff, trimOff, W - 2 * trimOff, H - 2 * trimOff);
    }
    fs.writeFileSync(f, await pdf.save());
    out.push(f);
  }
  const t = info.trimMm;
  return {
    content: [text(`Print export (${c.pages.length} pages): trim ${t[0]} x ${t[1]} mm, bleed ${info.bleedMm} mm, ${info.slugMm ? `crop marks in a ${info.slugMm} mm slug, ` : ''}${info.dpi} dpi, ${info.widthPx} x ${info.heightPx} px per page.\n${out.join('\n')}`)],
  };
}

tool('set_comic_options', 'Change comic-wide options: title, all-caps lettering, and whether the adult pose pack is allowed.', {
  comic_id: ID, title: z.string().optional(), lettering_caps: z.boolean().optional(),
  adult_content: z.boolean().optional().describe('Allow adult-pack poses (still only on adult characters, 150 cm+)'),
}, async (a) => {
  const c = load(a.comic_id);
  if (a.title) c.title = a.title;
  if (a.lettering_caps !== undefined) c.caps = a.lettering_caps;
  if (a.adult_content !== undefined) c.adultContent = a.adult_content;
  save(c);
  return { content: [text(`"${c.title}": caps ${c.caps !== false}, adult content ${!!c.adultContent}.`)] };
});

tool('set_staging', 'Set how the scene is blocked for the whole page: base poses (e.g. everyone seated at a table), a page-wide group pose, and set-dressing props on the floor plan. Panel gestures from edit_panel overlay the base. Cameras are kept unless reroll is true.', {
  comic_id: ID, page: PAGE,
  staging: z.record(z.string(), z.string().nullable()).optional().describe('Page-level base pose per character name, e.g. {"Ada": "sitChair"} (null = standing). Panel gestures overlay it.'),
  pair_staging: z.object({ pose: z.string(), a: z.string(), b: z.string() }).nullable().optional().describe('Page-level pair pose (e.g. a hug) between two cast members'),
  scene_props: z.array(z.object({ prop: z.string(), x: z.number(), z: z.number(), y: z.number().optional(), yaw: z.number().optional() })).optional().describe('Set dressing on the floor plan (metres, degrees); see list_props'),
  reroll: z.boolean().optional().describe('Reroll the cameras for the new staging (default false)'),
}, async (a) => {
  const c = load(a.comic_id);
  const page = getPage(c, a.page);
  applyStaging(c, page, a);
  if (a.reroll) await rollPage(c, page);
  return previewResult(c, a.page);
});

tool('list_poses', 'List the pose library (built-in and custom) by category. Upper-body poses overlay a page\'s staging; pair poses need two characters.', {
  category: z.string().optional(), include_adult: z.boolean().optional().describe('Include the adult pack (default false)'),
}, async (a) => {
  const { poses } = await libraryInfo(true);
  const list = [...poses.values()].filter((p) => (a.include_adult || !p.adult) && (!a.category || p.cat === a.category));
  const byCat = {};
  for (const p of list) (byCat[p.cat] ||= []).push(`${p.id}${p.trio ? ' (trio)' : p.pair ? ' (pair)' : p.layer === 'upper' ? ' (upper)' : ''}${p.adult ? ' [adult]' : ''} — ${p.name || ''}`);
  return { content: [text(Object.entries(byCat).map(([k, v]) => `${k} (${v.length}):\n  ${v.join('\n  ')}`).join('\n\n') || 'No poses.')] };
});

tool('pose_sheet', 'Render a contact sheet of poses on mannequins (by ids or category).', {
  ids: z.array(z.string()).optional(), category: z.string().optional(), include_adult: z.boolean().optional(),
  view: z.enum(['3q', 'front', 'side', 'back', 'top']).optional(),
}, async (a) => {
  const { poses } = await libraryInfo();
  if (!a.include_adult && (a.ids || []).some((id) => poses.get(id)?.adult)) throw new Error('Pass include_adult: true to view adult-pack poses.');
  const r = await engine.call('poseSheet', { ids: a.ids, cat: a.category, adult: !!a.include_adult, view: a.view || '3q', cols: 6, cell: 200 });
  return { content: [text(`${r.count} poses`), imageContent(r.png)] };
});

tool('list_props', 'List the prop library by category (hand props, furniture/seats, set dressing).', { category: z.string().optional() }, async (a) => {
  const { props } = await libraryInfo(true);
  const byCat = {};
  for (const p of props.values()) if (!a.category || p.cat === a.category) (byCat[p.cat] ||= []).push(`${p.id}${p.attach ? ` [${p.attach}]` : ''}`);
  return { content: [text(Object.entries(byCat).map(([k, v]) => `${k}: ${v.join(', ')}`).join('\n') || 'No props.')] };
});

tool('prop_sheet', 'Render a contact sheet of props (by ids or category).', { ids: z.array(z.string()).optional(), category: z.string().optional() }, async (a) => {
  const r = await engine.call('propSheet', { ids: a.ids, cat: a.category, cols: 6, cell: 200 });
  return { content: [text(`${r.count} props`), imageContent(r.png)] };
});

tool('save_pose', 'Save a custom pose (JSON object in the pose format, or a .json file from the pose editor) to poses/custom/ so pages can use it.', {
  pose: z.record(z.string(), z.any()).optional(), json_path: z.string().optional(),
}, async (a) => {
  const pose = a.pose || (a.json_path ? JSON.parse(fs.readFileSync(a.json_path, 'utf8')) : null);
  if (!pose) throw new Error('Pass pose or json_path.');
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(pose.id || '')) throw new Error('Pose id must be 1-64 letters, digits, - or _.');
  const f = path.join(ROOT, 'poses', 'custom', `${pose.id}.json`);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(pose, null, 2));
  await engine.call('registerPoses', [pose]);
  await libraryInfo(true);
  return { content: [text(`Saved ${pose.id} to ${f}.`)] };
});

tool('export_image_prompt', 'Export a page or one panel as an image-model package: a clean reference render (colour-coded mannequins, placeholder balloons) plus a prompt that maps each colour to a character and asks for finished art and professional lettering in the same layout. Unset details become {VARIABLES}.', {
  comic_id: ID, page: PAGE,
  panel: z.number().int().min(1).optional().describe('Export just this panel (default: the whole page)'),
  style: z.string().optional().describe('Art style, e.g. "black-and-white manga with screentones"'),
  setting: z.string().optional().describe('Where the scene takes place'),
  blank_balloons: z.boolean().optional().describe('Ask for empty balloons (letter later) instead of the dialogue text'),
}, async (a) => {
  const c = load(a.comic_id);
  const page = getPage(c, a.page);
  if (a.panel) getPanel(page, a.panel);
  await checkPoses(c, page);
  const r = await engine.call('imagePrompt', {
    page: apiPage(c, page), chars: apiChars(c, page), panel: a.panel ? a.panel - 1 : null,
    style: a.style || '', setting: a.setting || '', blank: !!a.blank_balloons, images: images(c, page), caps: c.caps !== false,
  });
  const base = `page-${pad(a.page)}${a.panel ? `-panel-${pad(a.panel)}` : ''}`;
  const img = writeFile(c.id, 'export/prompts', `${base}-reference.png`, dataUrlToBuffer(r.png));
  const txt = writeFile(c.id, 'export/prompts', `${base}-prompt.txt`, r.prompt);
  return { content: [text(`Reference: ${img}\nPrompt: ${txt}\nSuggested output size: ${r.size}\n\n${r.prompt}`), imageContent(r.png)] };
});

// ---------------------------------------------------------------- video

// End-keyframe poses, group poses and props go through the same checks as panel poses (incl. the adult gate).
const motionCheckPage = (page, m) => ({ cast: page.cast, staging: {}, pairStaging: null, sceneProps: [], panels: [{ spec: { poses: m?.to?.poses, pair: m?.to?.pair, hold: m?.to?.hold } }] });
const CAMERA_MOVES = ['auto', 'locked', 'pushIn', 'pullOut', 'orbitLeft', 'orbitRight', 'craneUp', 'craneDown', 'slideLeft', 'slideRight', 'dutch'];
const VIDEO_SIZES = { '720p': [1280, 720], '1080p': [1920, 1080], vertical: [1080, 1920], square: [1080, 1080], scope: [1920, 816] };

tool('set_shot_motion', 'Turn a panel into a moving shot for video: the panel is the start keyframe, and this sets the end keyframe (camera move, end poses, group pose, held props, character moves), the shot\'s length, easing and the transition into it. Every frame in between is blended. Returns a strip of frames through the shot.', {
  comic_id: ID, page: PAGE, panel: PANEL,
  duration: z.number().min(0.5).max(30).optional().describe('Seconds on screen (default: from the script\'s reading time, 2–10 s)'),
  camera_move: z.enum(CAMERA_MOVES).optional().describe('auto = frame the end keyframe (follows the action); locked = camera stays put; or pushIn, pullOut, orbitLeft/Right, craneUp/Down, slideLeft/Right, dutch'),
  end_camera: CameraZ.optional().describe('Absolute end-camera settings (applied after camera_move)'),
  end_poses: z.record(z.string(), z.string().nullable()).optional().describe('Character name -> pose id at the end of the shot (null = back to the base pose)'),
  end_pair: z.object({ pose: z.string(), a: z.string(), b: z.string(), c: z.string().optional() }).nullable().optional().describe('Group pose at the end (e.g. step into a hug); null removes one'),
  end_hold: z.record(z.string(), z.object({ left: z.string().nullable().optional(), right: z.string().nullable().optional() })).optional().describe('Props in hand at the end (props swap halfway through)'),
  moves: z.record(z.string(), z.object({
    toward: z.string().optional().describe('Walk toward this character…'),
    gap: z.number().min(0.2).max(3).optional().describe('…stopping this far away (m, default 0.55)'),
    forward: z.number().min(-6).max(6).optional().describe('Metres along their facing (negative = back away)'),
    side: z.number().min(-6).max(6).optional().describe('Metres to their own left (+) or right (-)'),
    turn: z.number().min(-180).max(180).optional().describe('Degrees to turn (+ = to their left)'),
  })).optional().describe('Character name -> where they move during the shot (relative to where they start)'),
  ease: z.enum(['inOut', 'linear', 'in', 'out']).optional(),
  timing: z.object({ start: z.number().min(0).max(1), end: z.number().min(0).max(1) }).optional().describe('When the move happens, as fractions of the shot (default 0–1); e.g. 0.3–0.8 holds still first'),
  transition: z.enum(['cut', 'dissolve', 'fade']).optional().describe('How this shot starts (from the previous one)'),
  clear: z.boolean().optional().describe('Remove all motion from this panel first'),
  preview_frames: z.number().int().min(1).max(6).optional().describe('Frames in the returned strip (default 4)'),
}, async (a) => {
  const c = load(a.comic_id);
  const page = getPage(c, a.page);
  const p = getPanel(page, a.panel);
  const idx = (name) => {
    const i = page.cast.findIndex((n) => n.toLowerCase() === String(name).toLowerCase());
    if (i < 0) throw new Error(`${name} isn't in this page's cast (${page.cast.join(', ')}).`);
    return i;
  };
  if (!p.spec) {
    const r = await engine.call('scorePage', { page: apiPage(c, page), chars: apiChars(c, page) });
    r.panels.forEach((x, i) => { if (page.panels[i] && !page.panels[i].spec) page.panels[i].spec = x.spec; });
  }
  const m = a.clear || !p.motion ? {} : { ...p.motion, to: { ...(p.motion.to || {}) } };
  m.to = m.to || {};
  if (a.duration != null) m.duration = a.duration;
  if (a.camera_move) m.camera = a.camera_move;
  if (a.ease) m.ease = a.ease;
  if (a.transition) m.transition = a.transition;
  if (a.timing) { m.start = Math.min(a.timing.start, a.timing.end); m.end = Math.max(a.timing.start, a.timing.end); }
  if (a.end_camera) {
    const e = a.end_camera;
    const cam = { ...(m.to.camera || {}) };
    if (e.shot_type) cam.type = TYPE_KEYS[e.shot_type];
    if (e.size) cam.size = SIZE_KEYS.indexOf(e.size);
    if (e.subject) cam.subject = idx(e.subject);
    if (e.other) cam.other = idx(e.other);
    if (e.elevation != null) cam.elev = e.elevation;
    if (e.orbit != null) cam.az = e.orbit;
    if (e.dutch != null) cam.dutch = e.dutch;
    if (e.fov != null) cam.fov = e.fov;
    if (e.frame_x != null) cam.fx = e.frame_x;
    if (e.frame_y != null) cam.fy = e.frame_y;
    m.to.camera = cam;
  }
  if (a.end_poses) {
    m.to.poses = { ...(m.to.poses || {}) };
    for (const [name, id] of Object.entries(a.end_poses)) m.to.poses[idx(name)] = id;
  }
  if (a.end_pair !== undefined) m.to.pair = a.end_pair ? { id: a.end_pair.pose, a: idx(a.end_pair.a), b: idx(a.end_pair.b), ...(a.end_pair.c ? { c: idx(a.end_pair.c) } : {}) } : null;
  if (a.end_hold) {
    const base = m.to.hold || p.spec.hold || {};
    m.to.hold = { ...base };
    for (const [name, h] of Object.entries(a.end_hold)) {
      const i = idx(name);
      const cur = { ...(m.to.hold[i] || {}) };
      if (h.left !== undefined) cur.left = h.left || undefined;
      if (h.right !== undefined) cur.right = h.right || undefined;
      m.to.hold[i] = cur;
    }
  }
  if (a.moves) {
    m.to.moves = { ...(m.to.moves || {}) };
    for (const [name, mv] of Object.entries(a.moves)) {
      const out = { ...mv };
      if (mv.toward) out.toward = idx(mv.toward);
      m.to.moves[idx(name)] = out;
    }
  }
  if (!Object.keys(m.to).length) delete m.to;
  p.motion = Object.keys(m).length ? m : undefined;
  await checkPoses(c, motionCheckPage(page, p.motion));
  save(c);
  const r = await engine.call('motionStrip', { page: apiPage(c, page), chars: apiChars(c, page), panels: [a.panel - 1], frames: a.preview_frames || 4, renderStyle: page.renderStyle });
  const secs = r.clips[0]?.seconds;
  return { content: [text(`Page ${a.page}, panel ${a.panel}: ${p.motion ? motionText(page, p.motion) : 'still'} (${secs}s on screen). Frames run left to right from the start to the end of the shot.`), imageContent(r.png)] };
});

tool('preview_motion', 'Check a page\'s shots as video without encoding: one row of frames per panel, from the start to the end of each shot.', {
  comic_id: ID, page: PAGE,
  frames: z.number().int().min(1).max(6).optional().describe('Frames per shot (default 3)'),
}, async (a) => {
  const c = load(a.comic_id);
  const page = getPage(c, a.page);
  const r = await engine.call('motionStrip', { page: apiPage(c, page), chars: apiChars(c, page), frames: a.frames || 3, thumb: 240, renderStyle: page.renderStyle });
  const total = r.clips.reduce((s, x) => s + x.seconds, 0);
  return { content: [text(`Page ${a.page}: ${r.clips.length} shots, ${total.toFixed(1)} s.\n${r.clips.map((x) => `  ${x.panel}. ${x.seconds}s — ${page.panels[x.panel - 1]?.motion ? motionText(page, page.panels[x.panel - 1].motion) : 'still'}`).join('\n')}`), imageContent(r.png)] };
});

tool('export_video', 'Render pages as an MP4 animatic: every panel becomes a shot (reading order), moving where set_shot_motion added keyframes, with subtitles or balloons. Optionally also writes matching control videos (depth, line art, OpenPose skeleton) for AI video models such as Wan VACE in ComfyUI, plus a shot list.', {
  comic_id: ID,
  pages: z.array(z.number().int().min(1)).optional().describe('Page numbers in order (default: every page)'),
  size: z.enum(Object.keys(VIDEO_SIZES)).optional().describe('720p (default), 1080p, vertical 9:16, square, scope 2.35:1'),
  fps: z.union([z.literal(12), z.literal(24), z.literal(30)]).optional().describe('Default 24'),
  lettering: z.enum(['subtitles', 'balloons', 'none']).optional().describe('Default subtitles'),
  drift: z.number().min(0).max(0.2).optional().describe('Slow push-in on still shots, as a fraction of camera distance (default 0.04; 0 = static)'),
  page_transition: z.enum(['cut', 'dissolve', 'fade']).optional().describe('Between pages (default cut)'),
  controls: z.array(z.enum(['depth', 'lineart', 'pose'])).optional().describe('Also write these control videos (no lettering, hard cuts)'),
}, async (a) => {
  const c = load(a.comic_id);
  const nums = a.pages?.length ? a.pages : c.pages.map((_, i) => i + 1);
  const pages = [];
  for (const n of nums) {
    const page = getPage(c, n);
    await checkPoses(c, page);
    for (const p of page.panels) if (p.motion?.to) await checkPoses(c, motionCheckPage(page, p.motion));
    pages.push({ page: apiPage(c, page), chars: apiChars(c, page), pageNumber: n });
  }
  const [w, h] = VIDEO_SIZES[a.size || '720p'];
  const kinds = ['render', ...(a.controls || [])];
  const r = await engine.call('renderVideo', {
    pages, width: w, height: h, fps: a.fps || 24, kinds, lettering: a.lettering || 'subtitles',
    drift: a.drift ?? 0.04, caps: c.caps !== false, pageTransition: a.page_transition || 'cut',
  });
  const span = nums.length === c.pages.length ? 'all' : nums.length === 1 ? `p${pad(nums[0])}` : `p${pad(nums[0])}-${pad(nums[nums.length - 1])}`;
  const base = `${c.id}-${span}`;
  const files = [];
  for (const [kind, b64] of Object.entries(r.videos)) files.push(writeFile(c.id, 'export/video', `${base}${kind === 'render' ? '' : `-${kind}`}.mp4`, Buffer.from(b64, 'base64')));
  // shot list: timing + camera description per shot (handy as prompts for video models)
  const desc = {};
  for (const n of [...new Set(r.clips.map((x) => x.page))]) {
    const page = getPage(c, n);
    const s = await engine.call('scorePage', { page: apiPage(c, page), chars: apiChars(c, page) });
    desc[n] = s.panels;
  }
  const fmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;
  const shotList = r.clips.map((x) => {
    const st = getPage(c, x.page).panels[x.panel - 1];
    const lines = (st.script?.dialogue || []).map((d) => `${d.speaker ?? 'Narration'}: "${d.text}"`);
    if (st.script?.caption) lines.unshift(`Caption: "${st.script.caption}"`);
    return `${fmt(x.start)}–${fmt(x.end)}  page ${x.page} panel ${x.panel}${x.transition !== 'cut' ? ` (${x.transition} in)` : ''}\n  ${desc[x.page]?.[x.panel - 1]?.description || ''}\n  motion: ${st.motion ? motionText(getPage(c, x.page), st.motion) : 'still'}${lines.length ? '\n  ' + lines.join('\n  ') : ''}`;
  }).join('\n\n');
  files.push(writeFile(c.id, 'export/video', `${base}-shots.txt`, `${c.title} — ${r.seconds}s at ${r.fps} fps, ${r.width}x${r.height}\n\n${shotList}\n`));
  return { content: [text(`Wrote ${r.seconds}s of video (${r.width}x${r.height}, ${r.fps} fps, ${r.codec}), ${r.clips.length} shots:\n${files.map((f) => '  ' + f).join('\n')}`)] };
});

tool('reload_renderer', 'Reload the headless renderer to pick up edits to the project source.', {}, async () => {
  await engine.reload();
  return { content: [text('Renderer reloaded.')] };
});

const escapeHtml = (t) => String(t).replace(/[<>&"]/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[ch]);

process.on('SIGINT', async () => { await engine.close(); process.exit(0); });
process.stdin.on('close', async () => { await engine.close(); process.exit(0); });

await server.connect(new StdioServerTransport());
console.error('[koma] MCP server ready; comics in', COMICS);
