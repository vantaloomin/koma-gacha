// Comicalize: a parsed plot -> laid-out, staged and lettered storyboard pages.
// 1. pages get sides and page turns (first page left/right, reading direction)
// 2. each page gets the layout whose panel sizes best fit the panel tags (large, small, wide, tall, bleed)
// 3. each panel's tags become camera constraints; the gacha stages the rest and scores it

import { generateLayout, PRESETS, FORMATS } from '../layout.js';
import { buildWorld, defaultPositions, planRoles, rollProposal, SIZES } from '../gacha.js';
import { getPose } from '../pose-runtime.js';
import { makeRng } from '../rng.js';
import { norm, lookupTag, POSE_WORDS, resolvePose } from './vocab.js';
import { roomProps, roomKey, ROOMS } from '../rooms.js';



export const CAST_PALETTE = ['#e2735f', '#5a8fd8', '#5fb87a', '#c98ad6', '#e0b04a', '#4fb6b8', '#d8607f', '#8a8f9c'];
const DEG = Math.PI / 180;

export function buildCast(doc) {
  return doc.cast.map((c, i) => ({ name: c.name, height: c.height, model: c.model, color: CAST_PALETTE[i % CAST_PALETTE.length] }));
}

// Page sides and where the page turns fall. ltr books turn after a right-hand page, rtl (manga) after a left-hand one.
export function pageSides(n, dir, firstPage) {
  const first = firstPage || (dir === 'rtl' ? 'left' : 'right');
  return Array.from({ length: n }, (_, k) => {
    const side = k % 2 === 0 ? first : first === 'left' ? 'right' : 'left';
    return { side, turnAfter: dir === 'rtl' ? side === 'left' : side === 'right' };
  });
}

// ---------------------------------------------------------------- panel analysis

function analysePanel(pn, doc, chars) {
  const idxOf = (name) => chars.findIndex((c) => c.name.toLowerCase() === String(name).toLowerCase());
  const f = { role: null, tone: null, large: false, small: false, wide: false, tall: false, bleed: false, breakout: false, cliffhanger: false, balloon: null, effects: [...pn.effects], gaze: null, c: {}, poseWords: [] };
  for (const t of pn.tags) {
    if (t.c) Object.assign(f.c, structuredClone(t.c));
    if (t.role) f.role = t.role;
    if (t.tone) f.tone = t.tone;
    for (const k of ['large', 'small', 'wide', 'tall', 'bleed', 'breakout', 'cliffhanger']) if (t[k]) f[k] = true;
    if (t.balloon) f.balloon = t.balloon;
    if (t.effect) f.effects.push({ id: t.effect });
    if (t.gaze) f.gaze = t.gaze;
    if (t.kind === 'pose') f.poseWords.push(t.pose);
  }
  const listed = [];
  const add = (i) => { if (i >= 0 && !listed.includes(i)) listed.push(i); };
  const lines = [];
  for (const it of pn.items) {
    if (it.kind === 'present') add(idxOf(it.who));
    else if (['line', 'thought', 'off', 'phone', 'silent'].includes(it.kind)) {
      const i = idxOf(it.who);
      if (it.kind !== 'off' && it.kind !== 'phone') add(i);
      lines.push({ ...it, i });
    }
  }
  for (const name of Object.keys(pn.people)) add(idxOf(name));
  const backgroundOnly = pn.items.some((it) => it.kind === 'background') && !listed.length;
  return { f, listed, lines, backgroundOnly };
}

// ---------------------------------------------------------------- layout search

function wantsFor(panels) {
  return panels.map((a, i) => {
    const w = { large: a.f.large ? 3 : 0, small: a.f.small ? 2 : 0, wide: a.f.wide ? 2 : 0, tall: a.f.tall ? 2 : 0, bleed: a.f.bleed ? 2 : 0 };
    if (!a.f.large && a.f.role === 'key') w.large = 1.2;
    if (!a.f.wide && (a.f.role === 'establish' || (i === 0 && a.backgroundOnly))) w.wide = 0.6;
    if (!a.f.small && a.f.role === 'reaction' && !a.lines.length) w.small = 0.5;
    if (a.f.c.type === 'establish' && !a.f.wide) w.wide = Math.max(w.wide, 0.5);
    return w;
  });
}

function layoutScore(layout, wants, rng) {
  const ps = layout.panels;
  const areas = ps.map((p) => (p.inset ? p.area * 0.6 : p.area));
  const sorted = [...areas].sort((a, b) => b - a);
  let s = 0;
  wants.forEach((w, i) => {
    const p = ps[i];
    const asp = p.bbox.w / p.bbox.h;
    const rank = sorted.indexOf(areas[i]);
    if (w.large) s += w.large * (rank === 0 ? 1 : rank === 1 ? 0.25 : -0.6);
    if (w.small) s += w.small * (rank >= ps.length - Math.max(1, Math.round(ps.length / 3)) ? 1 : -0.5);
    if (w.wide) s += w.wide * (asp >= 1.6 ? 1 : asp >= 1.25 ? 0.4 : -0.6);
    if (w.tall) s += w.tall * (asp <= 0.72 ? 1 : asp <= 0.9 ? 0.3 : -0.6);
    if (w.bleed) s += w.bleed * (Object.keys(p.bleed || {}).length ? 1 : -0.7);
    else if (Object.keys(p.bleed || {}).length && !wants.some((x) => x.large)) s -= 0.15;
  });
  // very thin slivers read badly
  for (const p of ps) if (Math.min(p.bbox.w, p.bbox.h) < 90) s -= 0.8;
  return s + rng.next() * 0.3;
}

function presetOrder(n, pageFlags, panels) {
  const tones = panels.map((a) => a.f.tone).filter(Boolean);
  const intense = tones.some((t) => ['conflict', 'surprise', 'tension'].includes(t)) || panels.some((a) => a.f.effects.length);
  if (pageFlags.title || pageFlags.spread || n <= 2) return ['splash', 'standard'];
  if (n >= 8) return ['orderly', 'strips', 'grid', 'standard'];
  if (intense) return ['action', 'standard', 'orderly'];
  return ['standard', 'orderly', 'action'];
}

/** Candidate layouts for a page, best first. */
export function layoutCandidates({ n, wants, pageFlags, panels, format, dir, seed, max = 24 }) {
  const rng = makeRng(`${seed}|score`);
  const out = [];
  const anyBleed = wants.some((w) => w.bleed);
  for (const preset of presetOrder(n, pageFlags, panels)) {
    const base = { ...PRESETS[preset], preset, format, dir, border: 4, seed: `${seed}|${preset}` };
    if (anyBleed && base.bleedMode === 'none') { base.bleedMode = 'free'; base.bleed = 35; }
    let found = 0;
    for (let index = 1; index <= 360 && found < max; index++) {
      const layout = generateLayout(base, index - 1);
      if (layout.panels.length !== n) continue;
      found++;
      out.push({ params: base, index, layout, score: layoutScore(layout, wants, rng) + (preset === presetOrder(n, pageFlags, panels)[0] ? 0.4 : 0) });
    }
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

// ---------------------------------------------------------------- comicalize

/**
 * doc: parsePlot() output. opts: {seed, stagingSeed, format, layoutVariant: {pageIdx: n}, fixedLayouts: {pageIdx: {params, index}},
 *   edits: {'p<k>-<i>': spec}, positions: {sceneIdx: [{x, z, yaw}]}}
 * Returns {chars, pages, notices}; pages carry layout, world, prop (scored shots), scripts, cast, side, turnAfter.
 */
export function comicalize(doc, opts = {}) {
  const notices = [...doc.notices];
  const note = (line, text, level = 'warn') => notices.push({ line, level, text });
  const chars = buildCast(doc);
  const format = FORMATS[opts.format || doc.format] ? opts.format || doc.format : 'b5';
  const seed = opts.seed || 'PLOT';
  const flat = [];
  doc.scenes.forEach((sc, si) => sc.pages.forEach((pg) => flat.push({ sc, si, pg })));
  const sides = pageSides(flat.length, doc.dir, doc.firstPage);
  const pages = [];
  const builtShots = []; // [pageIdx][panelIdx] spec, for same= / standing=

  flat.forEach(({ sc, si, pg }, k) => {
    const pageFlags = {};
    for (const t of pg.tags) for (const key of ['reveal', 'spread', 'title']) if (t[key]) pageFlags[key] = true;
    if (!pg.panels.length) {
      note(pg.line, `Page ${k + 1} has no panels.`);
      return;
    }
    // the scene's cast: everyone named anywhere in the scene keeps one floor plan for the whole scene
    const sceneNames = [];
    for (const p2 of sc.pages) for (const pn of p2.panels) {
      for (const it of pn.items) if (it.who && !sceneNames.includes(it.who.toLowerCase()) && it.kind !== 'phone') sceneNames.push(it.who.toLowerCase());
      for (const nm of Object.keys(pn.people)) if (!sceneNames.includes(nm.toLowerCase())) sceneNames.push(nm.toLowerCase());
    }
    let castIdx = chars.map((c, i) => (sceneNames.includes(c.name.toLowerCase()) ? i : -1)).filter((i) => i >= 0);
    if (!castIdx.length) castIdx = [0];
    const pageChars = castIdx.map((i) => chars[i]);
    const panels = pg.panels.map((pn) => ({ pn, ...analysePanel(pn, doc, pageChars) }));
    const n = panels.length;

    // page-turn checks
    if (pageFlags.reveal && k > 0 && !sides[k - 1].turnAfter) note(pg.line, `Page ${k + 1} is tagged as a page-turn reveal, but it faces page ${k} (no page turn in between). Add or remove a page before it, or change "First page".`);
    panels.forEach((a, i) => {
      if (a.f.cliffhanger && (i !== n - 1 || !sides[k].turnAfter)) note(a.pn.line, `Cliffhanger on page ${k + 1}, panel ${i + 1}: it lands best as the last panel before a page turn${sides[k].turnAfter ? '' : ` (the page turns after page ${k + 2})`}.`, 'info');
    });
    if (pageFlags.spread) note(pg.line, `Page ${k + 1}: two-page spreads are drawn as a single page for now.`, 'info');

    // layout
    let pick;
    const fixed = opts.fixedLayouts?.[k];
    if (fixed) {
      pick = { params: fixed.params, index: fixed.index, layout: generateLayout(fixed.params, fixed.index - 1) };
      if (pick.layout.panels.length !== n) pick = null;
    }
    let cands = null;
    if (!pick) {
      cands = layoutCandidates({ n, wants: wantsFor(panels), pageFlags, panels, format, dir: doc.dir, seed: `${seed}|p${k + 1}` });
      if (!cands.length) {
        note(pg.line, `No layout with ${n} panels was found for page ${k + 1}; split it into two pages.`, 'error');
        return;
      }
      pick = cands[(opts.layoutVariant?.[k] || 0) % cands.length];
    }
    const layout = pick.layout;

    // plan: who speaks, who is in focus, which role each panel plays
    const auto = planRoles(layout, pageChars.length);
    const plan = panels.map((a, i) => {
      const speakerLine = a.lines.find((l) => l.i >= 0 && l.kind !== 'off' && l.kind !== 'phone');
      const speaker = speakerLine ? speakerLine.i : -1;
      const focus = a.listed[0] ?? (speaker >= 0 ? speaker : auto[i].focus);
      let role = a.f.role || (a.f.c.type === 'establish' || (i === 0 && k === 0 && !a.lines.length) ? 'establish' : null);
      if (!role) role = auto[i].role === 'key' && !panels.some((x) => x.f.role === 'key') ? 'key' : speaker >= 0 ? 'dialogue' : auto[i].role === 'establish' ? 'establish' : 'reaction';
      const listener = speaker >= 0 ? a.listed.find((x) => x !== speaker) ?? null : null;
      return { role, speaker, focus, listener, isLargest: auto[i].isLargest };
    });

    // constraints from tags
    const constraints = panels.map((a, i) => {
      const c = structuredClone(a.f.c);
      if (a.f.tone) c.tone = a.f.tone;
      const subject = plan[i].speaker >= 0 ? plan[i].speaker : plan[i].focus;
      if (a.listed.length === 1 && !c.type && !c.types && plan[i].role !== 'establish') c.types = { single: 3, ots: 1 };
      if (a.listed.length === 2 && !c.other && a.listed.includes(subject)) c.other = a.listed.find((x) => x !== subject);
      if (a.f.poseWords.length) c.poses = { ...(c.poses || {}), [subject]: resolvePose(a.f.poseWords[a.f.poseWords.length - 1]) || 'idle' };
      if (a.f.gaze) c.gaze = { ...(c.gaze || {}), [subject]: a.f.gaze };
      for (const [name, p] of Object.entries(a.pn.people)) {
        const j = pageChars.findIndex((ch) => ch.name.toLowerCase() === name.toLowerCase());
        if (j < 0) continue;
        if (p.pose) {
          const id = resolvePose(p.pose);
          if (!id) note(a.pn.line, `Unknown pose "${p.pose}" for ${name} (see How to write, or any pose name from the Poses library).`);
          else if (getPose(id)?.pair || getPose(id)?.trio) note(a.pn.line, `"${p.pose}" is a group pose; group poses aren't supported in plots yet.`);
          else c.poses = { ...(c.poses || {}), [j]: id };
        }
        if (p.pos || p.facing != null) {
          const base = opts.positions?.[si]?.[j] || defaultPositions(pageChars.length)[j] || { x: 0, z: 0 };
          c.place = { ...(c.place || {}), [j]: { x: p.pos?.x ?? base.x, z: p.pos?.z ?? base.z, yaw: (p.facing ?? 0) * DEG } };
        }
        if (p.gaze) c.gaze = { ...(c.gaze || {}), [j]: p.gaze };
        if (p.face) c.face = { ...(c.face || {}), [j]: p.face };
      }
      // automatic expression for the panel's lead from its intent / balloon (explicit face= wins)
      const autoFace = { joy: 'happy', comedy: 'happy', sad: 'sad', conflict: 'angry', surprise: 'surprised', intimate: 'relaxed', ominous: 'sad' }[a.f.tone] || (a.f.balloon === 'shout' ? 'angry' : null);
      if (autoFace && subject >= 0 && !c.face?.[subject]) c.face = { ...(c.face || {}), [subject]: { expr: autoFace, amount: 75 } };
      if (a.pn.camera) c.type = 'free', c.cam ={ pos: a.pn.camera.pos || [0, 1.5, 4], rot: a.pn.camera.rot || [0, 0], roll: a.pn.camera.roll || 0, lens: a.pn.camera.lens || 35 };
      if (a.backgroundOnly) { c.hide = pageChars.map((_, j) => j); c.type = c.type || 'establish'; }
      if (a.pn.same) {
        const src = builtShots[a.pn.same.page - 1]?.[a.pn.same.panel - 1];
        if (src) c.copy = src;
        else note(a.pn.line, `same=${a.pn.same.page}-${a.pn.same.panel} points at a panel that isn't built before this one.`);
      }
      if (a.pn.standing) {
        const src = builtShots[a.pn.standing.page - 1]?.[a.pn.standing.panel - 1];
        if (src?.place) c.place = { ...structuredClone(src.place), ...(c.place || {}) };
      }
      if (c.type === 'pov' && c.other == null) c.other = a.listed.find((x) => x !== subject) ?? (subject === 0 ? 1 : 0);
      return c;
    });

    // floor plan: the scene's positions, or defaults
    const pos = opts.positions?.[si] || defaultPositions(pageChars.length);
    const world = buildWorld(pageChars.map((c, j) => ({ height: c.height, x: pos[j]?.x ?? 0, z: pos[j]?.z ?? 0, yawOffset: pos[j]?.yaw || 0 })));
    // intents are per panel (constraints); a page tone only when every tagged panel agrees and most are tagged
    const tones = panels.map((a) => a.f.tone);
    const tagged = tones.filter(Boolean);
    const tone = tagged.length >= Math.ceil(panels.length * 0.6) && tagged.every((t) => t === tagged[0]) ? tagged[0] : 'auto';
    const locks = {};
    panels.forEach((_, i) => { const e = opts.edits?.[`p${k + 1}-${i + 1}`]; if (e) locks[i] = { mode: 'all', spec: e }; });
    // the scene's room (a set built from walls, windows and furniture)
    const room = sc.background?.room ? roomKey(sc.background.room) : null;
    if (sc.background?.room && !room && k === flat.findIndex((x) => x.sc === sc)) note(sc.line, `There's no "${sc.background.room}" room yet. Rooms: ${Object.keys(ROOMS).join(', ')}.`, 'info');
    const sceneProps = [...(room ? roomProps(room, sc.background.no || 0) : []), ...(opts.sceneProps?.[si] || [])].map((u) => ({ ...u, id: u.id || u.prop }));
    const prop = rollProposal({
      layout, world, plan, tone, intensity: 'normal', style: 'balance', seed: `${opts.stagingSeed || seed}|stage|p${k + 1}`,
      locks, nChars: pageChars.length, constraints, sceneProps,
    });
    builtShots[k] = prop.shots.map((s) => s.spec);

    const scripts = panels.map((a) => scriptFor(a, pageChars));
    pages.push({
      k, number: k + 1, line: pg.line, scene: sc.name, sceneIndex: si, background: sc.background, side: sides[k].side, turnAfter: sides[k].turnAfter,
      flags: pageFlags, layout, layoutParams: pick.params, layoutIndex: pick.index, candidates: cands?.length || 0,
      castIdx, chars: pageChars, positions: pos, world, prop, scripts, room,
      panels: panels.map((a, i) => ({
        line: a.pn.line, key: `p${k + 1}-${i + 1}`,
        effects: a.f.effects.map((e) => ({ ...e, centerIndex: e.center ? pageChars.findIndex((ch) => ch.name.toLowerCase() === String(e.center).toLowerCase()) : undefined })).map((e) => (e.centerIndex < 0 ? { ...e, centerIndex: undefined } : e)), breakout: a.f.breakout, cliffhanger: a.f.cliffhanger, face: constraints[i].face || null, edited: !!locks[i] })),
    });
  });
  return { title: doc.title, dir: doc.dir, format, chars, pages, notices };
}

function scriptFor(a, chars) {
  const dialogue = [];
  for (const l of a.lines) {
    const speaker = l.i >= 0 ? l.i : -1;
    const per = a.pn.balloons[chars[l.i]?.name] || null;
    let kind = per?.kind || (l.kind === 'thought' ? 'thought' : l.kind === 'phone' ? 'electronic' : a.f.balloon && a.f.balloon !== 'caption' && a.f.balloon !== 'off' ? a.f.balloon : 'speech');
    const off = l.kind === 'off' || l.kind === 'phone' || a.f.balloon === 'off' || per?.kind === 'off';
    if (kind === 'off') kind = 'speech';
    const text = l.kind === 'silent' ? '…' : l.text;
    dialogue.push({ speaker, text, kind, ...(off ? { off: true } : {}), ...(l.linked ? { linked: true } : {}), ...(per?.shape ? { shape: per.shape } : {}), ...(per?.intensity != null ? { intensity: per.intensity } : {}) });
  }
  const caption = a.pn.items.filter((it) => it.kind === 'caption').map((it) => it.text).join(' ');
  const sfx = a.pn.items.filter((it) => it.kind === 'sfx').map((it) => ({ text: it.text, size: a.f.role === 'key' ? 'large' : 'medium' }));
  return { dialogue, caption, sfx };
}

// ---------------------------------------------------------------- edits -> plot words

const SIZE_WORDS = ['Long shot', 'Full shot', 'Medium shot', 'Medium close-up', 'Close-up'];

// A panel's camera and poses as plot tags (used by "Write edits to plot").
export function specToTags(spec, chars) {
  const tags = [];
  if (spec.type === 'establish') tags.push('Establishing shot');
  else if (spec.type === 'two') tags.push('Two-shot');
  else if (spec.type === 'ots') tags.push('Over-the-shoulder shot');
  else if (spec.type === 'pov') tags.push('POV shot');
  if (spec.type !== 'free') {
    if (spec.size === 4 && spec.zoom && spec.zoom < 0.8) tags.push('Extreme close-up');
    else if (spec.size === 1 && spec.zoom && spec.zoom < 0.9) tags.push('Knee shot');
    else if (spec.size === 0 && spec.zoom && spec.zoom > 1.5) tags.push('Extreme long shot');
    else tags.push(SIZE_WORDS[spec.size] || SIZES[spec.size]);
    const e = spec.elev;
    tags.push(e > 55 ? 'Bird\'s-eye view' : e > 24 ? 'High angle' : e > 10 ? 'Slight high angle' : e < -26 ? 'Worm\'s-eye view' : e < -9 ? 'Low angle' : 'Eye level');
    if (Math.abs(spec.dutch) > 18) tags.push('Strong Dutch angle');
    else if (Math.abs(spec.dutch) > 4) tags.push('Dutch angle');
    if (spec.fx < -0.3) tags.push('Frame left');
    else if (spec.fx > 0.3) tags.push('Frame right');
  }
  const groups = [tags.join(', ')];
  if (spec.type === 'free' && spec.cam) {
    const c = spec.cam;
    groups.push(`Camera pos=${c.pos.map((v) => +v.toFixed(2)).join(',')} rot=${c.rot.map((v) => Math.round(v)).join(',')}${c.roll ? ` roll=${Math.round(c.roll)}` : ''} lens=${Math.round(c.lens)}mm`);
  }
  for (const [i, id] of Object.entries(spec.poses || {})) {
    if (typeof id !== 'string' || !chars[i]) continue;
    const name = getPose(id)?.name;
    groups.push(`${chars[i].name} pose=${name && !/[,=[\]]/.test(name) ? name : id}`);
  }
  return groups.filter(Boolean);
}

const CAMERA_KINDS = new Set(['size', 'angle', 'view', 'lens', 'tilt', 'people', 'composition', 'technique']);

// Replace a panel line's camera and pose tags with new ones, keeping its contents and every other tag
// (role, intent, panel size, page, balloon, effects, same=/standing=).
export function rewritePanelLine(text, lineNo, groups, chars = []) {
  const lines = text.split(/\r?\n/);
  const raw = lines[lineNo - 1];
  if (raw == null) return text;
  const m = /^(\s*\d+\s*[:：.)]\s*)(.*)$/.exec(raw);
  if (!m) return text;
  let body = '';
  let depth = 0;
  let cur = '';
  const old = [];
  for (const ch of m[2]) {
    if (ch === '[') { if (depth++ === 0) { cur = ''; continue; } }
    if (ch === ']') { if (--depth === 0) { old.push(cur); continue; } depth = Math.max(0, depth); }
    if (depth) cur += ch;
    else body += ch;
  }
  body = body.replace(/\s+/g, ' ').trim();
  const names = chars.map((c) => c.name.toLowerCase());
  const keptWords = [];
  const keptGroups = [];
  for (const g of old) {
    const t = g.trim();
    const head = norm(t.split(/\s+/)[0] || '');
    if (head === 'camera') continue;
    const person = names.find((n) => t.toLowerCase().startsWith(n + ' ') && /=/.test(t));
    if (person) {
      // keep the person's other settings (pos, facing, face, gaze); the pose comes from the edit
      const rest = t.replace(/\s*\bpose\s*=\s*.*?(?=\s+\w+\s*=|$)/i, '').trim();
      if (/=/.test(rest)) keptGroups.push(rest);
      continue;
    }
    if (/=/.test(t) || ['balloon', 'effect', 'effects'].includes(head)) { keptGroups.push(t); continue; }
    for (const w of t.split(/[,、，]/).map((x) => x.trim()).filter(Boolean)) {
      const tag = lookupTag(w);
      if (tag && CAMERA_KINDS.has(tag.kind)) continue;
      if (!tag && POSE_WORDS[norm(w)]) continue;
      keptWords.push(w);
    }
  }
  const [cameraWords = '', ...rest] = groups;
  const first = [cameraWords, ...keptWords].filter(Boolean).join(', ');
  // a person's kept settings merge into their new pose group
  const merged = rest.map((g) => {
    const who = names.find((n) => g.toLowerCase().startsWith(n + ' '));
    const k = who ? keptGroups.findIndex((x) => x.toLowerCase().startsWith(who + ' ')) : -1;
    if (k < 0) return g;
    const extra = keptGroups.splice(k, 1)[0].slice(who.length).trim();
    return `${g} ${extra}`;
  });
  const all = [first, ...merged, ...keptGroups].filter(Boolean);
  lines[lineNo - 1] = `${m[1]}${body}${all.length ? ' ' + all.map((g) => `[${g}]`).join('') : ''}`;
  return lines.join('\n');
}

export const SAMPLE_PLOT = `Title: Sample
Reading direction: Left to right
First page: Right
Cast: Ken=M01 (174cm), Mia=F01 (150cm)

# Scene: Classroom after school [Background classroom]

Page 1
1: Background (classroom window) [Establishing shot]
2: Mia "Hey, Ken..." Ken
3: Ken "...What?" [Reaction shot]
4: Mia "Are you free tomorrow?" [Medium close-up]
5: Mia Ken [Long shot, Beat, Cliffhanger]

Page 2 [Page-turn reveal]
1: Ken "Huh?" [Climax, Surprise, Focus lines, Close-up]
2: Mia "I said, tomorrow!" [Burst balloon]
3: Ken (What does she mean...?)
4: Mia "The library, together!" Ken [Low angle] [Mia pose=Hands behind back]
`;
