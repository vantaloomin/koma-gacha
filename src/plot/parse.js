// Plot parser: text script -> comic structure (cast, scenes, pages, panels, lines, staging tags).
//
//   Title: …                         Reading direction: Right to left | Left to right
//   First page: Left | Right         Format: b5 | letter | comic | sns | square
//   Cast: Ken=M01 (174cm), Mia=F01 (137cm)
//   # Scene: Classroom after school [Background classroom]
//   Page 1 [Page-turn reveal]
//   1: Mia "Line" Ken [Close-up, Low angle]
//
// Panel contents in written order: Name "line" · Name (thought) · Name <off-panel> · Name {phone} ·
// Name (present, silent) · Caption "…" · SFX "…" · Background (…) · [tags] · [Camera …] · [Name pose=…] ·
// [Balloon Name=…] · [Effect …] · [same=1-2] · [standing=1-2]

import { lookupTag, norm, POSE_WORDS, GAZES, resolvePose } from './vocab.js';

const HEIGHTS = { m01: 174, f01: 160, doll: 120 };
const QUOTES = { '"': '"', '“': '”', '「': '」', '『': '』' };
const PAIRS = { '(': ')', '（': '）', '<': '>', '＜': '＞', '{': '}', '｛': '｝' };
const KIND_OF = { '(': 'thought', '（': 'thought', '<': 'off', '＜': 'off', '{': 'phone', '｛': 'phone' };
const SPECIAL = { caption: 'caption', narration: 'caption', narrator: 'caption', sfx: 'sfx', sound: 'sfx', fx: 'sfx', background: 'background', bg: 'background' };

export function parsePlot(text) {
  const doc = { title: '', dir: 'rtl', firstPage: null, format: null, cast: [], scenes: [], notices: [] };
  const note = (line, text, level = 'warn') => doc.notices.push({ line, level, text });
  let scene = null;
  let page = null;
  const lines = String(text || '').split(/\r?\n/);
  const ensureScene = (line) => {
    if (!scene) {
      scene = { name: '', background: null, line, pages: [] };
      doc.scenes.push(scene);
    }
    return scene;
  };
  const ensurePage = (line) => {
    ensureScene(line);
    if (!page) {
      page = { line, tags: [], panels: [] };
      scene.pages.push(page);
    }
    return page;
  };

  lines.forEach((raw, idx) => {
    const ln = idx + 1;
    const line = raw.replace(/\s+\/\/.*$/, '').trim();
    if (!line || line.startsWith('//')) return;
    let m;
    if ((m = /^(title|reading direction|direction|first page|cast|language|format|paper|paper size)\s*[:：]\s*(.*)$/i.exec(line))) {
      const key = m[1].toLowerCase();
      const val = m[2].trim();
      if (key === 'title') doc.title = val;
      else if (key.includes('direction')) doc.dir = /left to right|ltr|western/i.test(val) ? 'ltr' : 'rtl';
      else if (key === 'first page') doc.firstPage = /left/i.test(val) ? 'left' : 'right';
      else if (key === 'cast') doc.cast = parseCast(val, ln, note);
      else if (key.startsWith('format') || key.startsWith('paper')) doc.format = norm(val).split(' ')[0] || null;
      return;
    }
    if ((m = /^#+\s*(?:scene\s*[:：]?)?\s*(.*)$/i.exec(line))) {
      const { rest, groups } = splitBrackets(m[1]);
      scene = { name: rest.trim(), background: null, line: ln, pages: [] };
      for (const g of groups) {
        const bm = /^(?:background|bg|room)\s+(.+)$/i.exec(g.trim());
        if (bm) {
          const kv = keyValues(bm[1]);
          scene.background = { room: norm(kv._ || bm[1]).replace(/ no.*$/, ''), no: kv.no ? Number(kv.no) : null };
        } else note(ln, `Scene tag "${g}" isn't recognised (try [Background classroom]).`);
      }
      doc.scenes.push(scene);
      page = null;
      return;
    }
    if ((m = /^(?:page|p\.?)\s*(\d+)?\s*(.*)$/i.exec(line)) && !/^\d+\s*[:：]/.test(line) && (m[1] || /^page\b/i.test(line))) {
      ensureScene(ln);
      page = { line: ln, tags: [], panels: [] };
      const { groups } = splitBrackets(m[2] || '');
      for (const g of groups) for (const w of splitWords(g)) {
        const t = lookupTag(w);
        if (t) page.tags.push(t);
        else note(ln, `Page tag "${w}" isn't recognised.`);
      }
      scene.pages.push(page);
      return;
    }
    if ((m = /^(\d+)\s*[:：.)]\s*(.*)$/.exec(line))) {
      ensurePage(ln);
      page.panels.push(parsePanel(m[2], ln, doc, note));
      return;
    }
    note(ln, `Couldn't read this line. Panels start with a number ("1: …"), pages with "Page", scenes with "#".`);
  });

  // cast members mentioned but not declared are added with defaults
  const known = new Set(doc.cast.map((c) => c.name.toLowerCase()));
  for (const sc of doc.scenes) for (const pg of sc.pages) for (const pn of pg.panels) for (const it of pn.items) {
    if (it.who && !known.has(it.who.toLowerCase())) {
      known.add(it.who.toLowerCase());
      doc.cast.push({ name: it.who, model: 'M01', height: 170, line: pn.line, implicit: true });
      note(pn.line, `"${it.who}" isn't in the Cast line; added as a 170 cm mannequin.`, 'info');
    }
  }
  if (!doc.scenes.length) note(1, 'No panels yet. Write a page ("Page 1") and panels ("1: Name \\"Line\\"").', 'info');
  return doc;
}

function parseCast(val, ln, note) {
  return val.split(/[,、，]/).map((s) => s.trim()).filter(Boolean).map((s) => {
    const m = /^(.+?)\s*(?:=\s*([A-Za-z0-9_-]+))?\s*(?:\(\s*(\d+(?:\.\d+)?)\s*cm\s*\))?\s*$/i.exec(s);
    if (!m) {
      note(ln, `Couldn't read cast entry "${s}".`);
      return null;
    }
    const model = m[2] || 'M01';
    return { name: m[1].trim(), model, height: m[3] ? Number(m[3]) : HEIGHTS[model.toLowerCase()] || 170, line: ln };
  }).filter(Boolean);
}

// "text [a, b] more [c]" -> {rest: "text  more ", groups: ["a, b", "c"]}
function splitBrackets(s) {
  const groups = [];
  let rest = '';
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '[' || ch === '［') { if (depth++ === 0) { cur = ''; continue; } }
    if (ch === ']' || ch === '］') { if (--depth === 0) { groups.push(cur); continue; } }
    if (depth > 0) cur += ch;
    else rest += ch;
  }
  if (depth > 0) groups.push(cur);
  return { rest, groups };
}

const splitWords = (g) => g.split(/[,、，]/).map((w) => w.trim()).filter(Boolean);

// "pos=1.2,1.5,3 rot=30,-10 lens=35mm" -> {pos: '1.2,1.5,3', rot: '30,-10', lens: '35mm'}; leading text -> _
function keyValues(s) {
  const out = {};
  const re = /([A-Za-z_][\w-]*)\s*=\s*/g;
  const marks = [];
  let m;
  while ((m = re.exec(s))) marks.push({ key: m[1], start: m.index, valStart: re.lastIndex });
  if (!marks.length) {
    out._ = s.trim();
    return out;
  }
  if (marks[0].start > 0) out._ = s.slice(0, marks[0].start).trim();
  marks.forEach((mk, k) => { out[mk.key.toLowerCase()] = s.slice(mk.valStart, k + 1 < marks.length ? marks[k + 1].start : s.length).trim(); });
  return out;
}
export { keyValues };

const nums = (v) => String(v || '').split(/[,\s]+/).map(Number).filter((x) => Number.isFinite(x));

function parsePanel(src, ln, doc, note) {
  const panel = { line: ln, items: [], tags: [], camera: null, people: {}, balloons: {}, effects: [], same: null, standing: null, unknown: [] };
  const castNames = () => doc.cast.map((c) => c.name).sort((a, b) => b.length - a.length);
  let i = 0;
  let pendingName = null;
  const flushName = () => {
    if (pendingName) panel.items.push({ kind: 'present', who: pendingName });
    pendingName = null;
  };
  const special = (name) => SPECIAL[norm(name)] || null;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '[' || ch === '［') {
      const close = findClose(src, i, ch === '[' ? ']' : '］');
      flushName();
      parseTagGroup(src.slice(i + 1, close), panel, doc, ln, note);
      i = close + 1;
      continue;
    }
    if (QUOTES[ch] || PAIRS[ch]) {
      const closeCh = QUOTES[ch] || PAIRS[ch];
      const close = src.indexOf(closeCh, i + 1);
      const end = close < 0 ? src.length : close;
      const body = src.slice(i + 1, end).replace(/\\n/g, '\n');
      i = end + 1;
      const who = pendingName;
      pendingName = null;
      const sp = who && special(who);
      if (sp === 'caption') panel.items.push({ kind: 'caption', text: body });
      else if (sp === 'sfx') panel.items.push({ kind: 'sfx', text: body });
      else if (sp === 'background') panel.items.push({ kind: 'background', text: body });
      else if (!who) {
        // text with no name: narration for quotes, otherwise unreadable
        if (QUOTES[ch]) panel.items.push({ kind: 'caption', text: body });
        else note(ln, `"${body}" has no speaker name in front of it.`);
      } else {
        let kind = QUOTES[ch] ? 'line' : KIND_OF[ch];
        if (kind === 'line' && /^[.…・。\s]+$/.test(body)) kind = 'silent';
        // "Line / Line" = linked balloons from one speaker
        const parts = kind === 'silent' ? [body] : body.split(/\s+\/\s+/);
        parts.forEach((t, k) => panel.items.push({ kind, who, text: t.trim(), linked: k > 0 }));
      }
      continue;
    }
    // a name: the longest cast name that matches here, else one word
    flushName();
    const rest = src.slice(i);
    const cast = castNames().find((n) => rest.toLowerCase().startsWith(n.toLowerCase()) && !/[\w]/.test(rest[n.length] || ''));
    let name;
    if (cast) name = cast;
    else {
      const wm = /^[^\s"“「『(（<＜{｛[［]+/.exec(rest);
      name = wm ? wm[0] : rest[0];
    }
    i += name.length;
    pendingName = name;
    if (special(name) === 'background') {
      // Background with no text
      const nx = src.slice(i).trimStart()[0];
      if (!nx || !(PAIRS[nx] || QUOTES[nx])) { panel.items.push({ kind: 'background', text: '' }); pendingName = null; }
    }
  }
  flushName();
  return panel;
}

function findClose(s, i, closeCh) {
  let depth = 0;
  for (let k = i; k < s.length; k++) {
    if (s[k] === s[i]) depth++;
    else if (s[k] === closeCh && --depth === 0) return k;
  }
  return s.length;
}

function parseTagGroup(g, panel, doc, ln, note) {
  const text = g.trim();
  if (!text) return;
  const head = text.split(/\s+/)[0];
  const headN = norm(head);
  const castName = doc.cast.map((c) => c.name).sort((a, b) => b.length - a.length).find((n) => text.toLowerCase().startsWith(n.toLowerCase() + ' ') || text.toLowerCase() === n.toLowerCase());
  if (headN === 'camera') {
    const kv = keyValues(text.slice(head.length));
    panel.camera = { pos: kv.pos ? nums(kv.pos) : null, rot: kv.rot ? nums(kv.rot) : null, roll: kv.roll ? Number(kv.roll) || 0 : 0, lens: kv.lens ? parseFloat(kv.lens) : null };
    return;
  }
  if (headN === 'balloon') {
    const kv = keyValues(text.slice(head.length));
    for (const [k, v] of Object.entries(kv)) {
      if (k === '_') continue;
      const [type, intensity, shape] = v.split(',').map((x) => x.trim());
      const who = doc.cast.find((c) => c.name.toLowerCase() === k)?.name || k;
      const t = lookupTag(type);
      panel.balloons[who] = { kind: t?.balloon || null, intensity: intensity ? Number(intensity) : null, shape: shape || null };
    }
    return;
  }
  if (headN === 'effect' || headN === 'effects') {
    const kv = keyValues(text.slice(head.length));
    const t = lookupTag(kv._ || '');
    if (!t || t.kind !== 'effect') note(ln, `Unknown effect "${kv._}".`);
    else panel.effects.push({ id: t.effect, density: kv.density ? Number(kv.density) : null, center: kv.center || null });
    return;
  }
  if (/^(same|standing)\s*=/i.test(text)) {
    const kv = keyValues(text);
    for (const key of ['same', 'standing']) {
      if (!kv[key]) continue;
      const [pg, pn] = nums(kv[key].replace('-', ','));
      panel[key] = { page: pg, panel: pn };
    }
    return;
  }
  if (castName && (text.length === castName.length || /=/.test(text))) {
    const kv = keyValues(text.slice(castName.length));
    const person = {};
    if (kv.pos) { const [x, z] = nums(kv.pos); person.pos = { x, z }; }
    if (kv.facing != null) person.facing = Number(kv.facing);
    if (kv.pose) {
      person.pose = resolvePose(kv.pose) || kv.pose.trim();
    }
    if (kv.face) { const [expr, amt] = kv.face.split(',').map((x) => x.trim()); person.face = { expr: norm(expr), amount: amt ? Number(amt) : 100 }; }
    if (kv.gaze) person.gaze = GAZES[norm(kv.gaze)] || null;
    panel.people[castName] = { ...(panel.people[castName] || {}), ...person };
    return;
  }
  for (const w of splitWords(text)) {
    const t = lookupTag(w);
    if (t) panel.tags.push(t);
    else if (resolvePose(w)) panel.tags.push({ id: 'pose', kind: 'pose', pose: resolvePose(w), label: w });
    else {
      panel.unknown.push(w);
      note(ln, `"${w}" isn't a staging word Koma knows (see How to write).`);
    }
  }
}
