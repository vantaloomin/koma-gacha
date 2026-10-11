// The Script workspace: write a plot, get a multi-page storyboard (laid out, staged, lettered),
// tweak panels, write the tweaks back to the plot, and hand pages to Shots or the whole comic to Video.

import { icon, toast, fadeIn, spinIcon, afterPaint } from './ui.js';
import { parsePlot } from './plot/parse.js';
import { comicalize, specToTags, rewritePanelLine, SAMPLE_PLOT } from './plot/build.js';
import { TAG_LIST, TAG_KINDS, POSE_WORDS, ROOMS, MODELS } from './plot/vocab.js';
import { drawPlotPage } from './plot/draw.js';
import { StoryRenderer, scoreColor } from './renderer.js';
import { Mannequin } from './figures.js';
import { SIZES, TYPES, shotLabel, rescoreProposal, rerollPanel } from './gacha.js';
import { listPoses } from './pose-runtime.js';
import { pointInPolygon } from './layout.js';

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
const FACE_OPTIONS = [['', 'Default'], ['happy', 'Happy'], ['angry', 'Angry'], ['sad', 'Sad'], ['surprised', 'Surprised'], ['relaxed', 'Relaxed']];
const GAZE_OPTIONS = [['', 'Auto (at the speaker)'], ['camera', 'At the reader'], ['forward', 'Straight ahead'], ['down', 'Down'], ['up', 'Up'], ['away', 'Away']];

/**
 * host: {importPage(page) -> Promise<boolean>, playVideo()}
 */
export class ScriptWorkspace {
  constructor(host) {
    this.host = host;
    const saved = store.get('script', null);
    this.doc = {
      plot: SAMPLE_PLOT, seed: 'PLOT-1', stagingSeed: 'STAGE-1', edits: {}, layoutVariant: {}, fixedLayouts: {}, auto: true,
      renderStyle: 'shaded', zoom: 'fit', ...(saved || {}),
    };
    this.sr = new StoryRenderer();
    this.figCache = new Map();
    this.result = null;
    this.sel = null; // {page: k, panel: i}
    this.pageIdx = 0;
    this.canvases = [];
    this.bind();
  }

  persist() { store.set('script', this.doc); }

  // ---------------------------------------------------------------- build

  show() {
    this.shown = true;
    if (!this.result) this.build();
    else this.layoutPages();
  }

  hide() { this.shown = false; }

  build({ keepSelection = true } = {}) {
    const t0 = performance.now();
    const doc = parsePlot(this.doc.plot);
    try {
      this.result = comicalize(doc, {
        seed: this.doc.seed, stagingSeed: this.doc.stagingSeed, edits: this.doc.edits,
        layoutVariant: this.doc.layoutVariant, fixedLayouts: this.revivedFixed(),
      });
    } catch (e) {
      console.error(e);
      this.result = { pages: [], chars: [], notices: [{ line: 1, level: 'error', text: `Couldn't build: ${e.message}` }] };
    }
    this.buildMs = performance.now() - t0;
    if (!keepSelection || (this.sel && !this.result.pages[this.sel.page]?.prop.shots[this.sel.panel])) this.sel = null;
    this.pageIdx = Math.min(this.pageIdx, Math.max(0, this.result.pages.length - 1));
    this.drawNotices();
    this.drawSummary();
    this.layoutPages();
    this.drawInspector();
    this.host.onBuilt?.();
  }

  revivedFixed() {
    const out = {};
    for (const [k, v] of Object.entries(this.doc.fixedLayouts || {})) out[k] = v;
    return out;
  }

  drawSummary() {
    const r = this.result;
    const panels = r.pages.reduce((s, p) => s + p.prop.shots.length, 0);
    const errs = r.notices.filter((n) => n.level === 'error').length;
    $('#sc-summary').textContent = r.pages.length ? `${r.pages.length} page${r.pages.length === 1 ? '' : 's'} · ${panels} panels · ${Math.round(this.buildMs)} ms${errs ? ` · ${errs} error${errs === 1 ? '' : 's'}` : ''}` : 'No pages yet';
  }

  drawNotices() {
    const box = $('#sc-notices');
    box.innerHTML = '';
    const list = this.result.notices;
    if (!list.length) {
      box.append(el('p', { class: 'ok-note' }, icon('ok', 15), el('span', {}, 'No notices')));
      return;
    }
    for (const n of list) {
      const b = el('button', { class: `notice ${n.level}`, title: 'Go to this line' }, icon(n.level === 'info' ? 'info' : 'warn', 14), el('span', {}, el('b', {}, `Line ${n.line}`), ` ${n.text}`));
      b.addEventListener('click', () => this.gotoLine(n.line));
      box.append(b);
    }
  }

  gotoLine(line, focus = true) {
    const ta = $('#sc-plot');
    const lines = ta.value.split('\n');
    const start = lines.slice(0, line - 1).reduce((s, l) => s + l.length + 1, 0);
    if (focus) ta.focus({ preventScroll: true });
    ta.setSelectionRange(start, start + (lines[line - 1] || '').length);
    const lh = parseFloat(getComputedStyle(ta).lineHeight) || 18;
    ta.scrollTop = Math.max(0, (line - 4) * lh);
  }

  // ---------------------------------------------------------------- pages (spreads)

  pageWidth() {
    const stage = $('#sc-pages');
    const r = stage.getBoundingClientRect();
    if (this.doc.zoom === 'fit') {
      const p = this.result.pages[0];
      const aspect = p ? p.layout.H / p.layout.W : 1.414;
      const byH = (r.height - 90) / aspect;
      const byW = (r.width - 96) / 2;
      return Math.max(180, Math.min(byH, byW));
    }
    return Number(this.doc.zoom) || 360;
  }

  layoutPages() {
    const box = $('#sc-pages');
    box.innerHTML = '';
    this.canvases = [];
    const pages = this.result?.pages || [];
    if (!pages.length) {
      box.append(el('div', { class: 'empty' }, el('div', { class: 'empty-ico' }, icon('type', 22)), el('b', {}, 'Write a plot to see pages'),
        el('p', {}, 'Start with a cast line, then "Page 1" and numbered panels, e.g. 1: Mia "Hi!" Ken [Close-up]. Use How to write for every tag.')));
      return;
    }
    const w = this.pageWidth();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    // spreads: pages between page turns sit side by side, left page on the left
    const spreads = [];
    let cur = [];
    pages.forEach((p) => {
      cur.push(p);
      if (p.turnAfter) { spreads.push(cur); cur = []; }
    });
    if (cur.length) spreads.push(cur);
    spreads.forEach((sp, si) => {
      const row = el('div', { class: 'spread' });
      const left = sp.find((p) => p.side === 'left');
      const right = sp.find((p) => p.side === 'right');
      for (const p of [left, right]) {
        if (!p) { row.append(el('div', { class: 'page-slot empty-slot', style: `width:${w}px` })); continue; }
        const h = (w * p.layout.H) / p.layout.W;
        const cv = el('canvas', { width: Math.round(w * dpr), height: Math.round(h * dpr), style: `width:${w}px;height:${h}px` });
        const ov = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        ov.setAttribute('viewBox', `0 0 ${p.layout.W} ${p.layout.H}`);
        ov.setAttribute('class', 'page-ov');
        const tags = [p.scene && p.k === pages.findIndex((x) => x.sceneIndex === p.sceneIndex) ? p.scene : null, p.flags.reveal ? 'Page-turn reveal' : null, p.flags.title ? 'Title page' : null].filter(Boolean);
        const slot = el('div', { class: 'page-slot' + (p.k === this.pageIdx ? ' on' : ''), 'data-k': p.k },
          el('div', { class: 'page-box' }, cv, ov),
          el('div', { class: 'page-cap' }, el('b', {}, `p.${p.number}`), el('span', {}, `${p.side} · ${p.layoutParams.preset}`), tags.length ? el('span', { class: 'tag' }, tags.join(' · ')) : null));
        cv.addEventListener('click', (e) => this.onPageClick(p, cv, e));
        row.append(slot);
        this.canvases[p.k] = { cv, ov, slot, scale: (w * dpr) / p.layout.W };
      }
      box.append(row);
      if (si < spreads.length - 1) box.append(el('div', { class: 'turn' }, el('span', {}, '↓ Page turn')));
    });
    this.renderQueue = pages.map((p) => p.k);
    this.renderNext();
    this.drawOverlay();
  }

  renderNext() {
    const k = this.renderQueue?.shift();
    if (k == null) return;
    requestAnimationFrame(() => {
      this.renderPage(k);
      this.renderNext();
    });
  }

  figuresFor(chars) {
    return chars.map((c) => {
      const key = `${c.name}|${c.height}|${c.color}`;
      if (!this.figCache.has(key)) this.figCache.set(key, new Mannequin(c.height / 100, c.color));
      return this.figCache.get(key);
    });
  }

  renderPage(k) {
    const p = this.result.pages[k];
    const c = this.canvases[k];
    if (!p || !c?.cv.isConnected) return;
    this.sr.setFigures(this.figuresFor(p.chars), p.chars);
    this.sr.setStyle(this.doc.renderStyle, p.chars);
    const g = c.cv.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    drawPlotPage(g, this.sr, p, { scale: c.scale, caps: true });
  }

  drawOverlay() {
    for (const [k, c] of this.canvases.entries()) {
      if (!c) continue;
      c.ov.innerHTML = '';
      c.slot.classList.toggle('on', k === this.pageIdx);
      if (!this.sel || this.sel.page !== k) continue;
      const pn = this.result.pages[k].layout.panels[this.sel.panel];
      if (!pn) continue;
      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      poly.setAttribute('points', pn.poly.map((q) => q.join(',')).join(' '));
      poly.setAttribute('class', 'sel');
      c.ov.append(poly);
    }
  }

  onPageClick(p, cv, e) {
    const r = cv.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * p.layout.W;
    const y = ((e.clientY - r.top) / r.height) * p.layout.H;
    // insets sit on top, so test them first
    const order = [...p.layout.panels.keys()].sort((a, b) => (p.layout.panels[b].inset ? 1 : 0) - (p.layout.panels[a].inset ? 1 : 0));
    const hit = order.find((i) => pointInPolygon([x, y], p.layout.panels[i].poly));
    this.pageIdx = p.k;
    this.sel = hit == null ? null : { page: p.k, panel: hit };
    this.drawOverlay();
    this.drawInspector();
    if (hit != null) this.gotoLine(p.panels[hit].line, false);
  }

  // ---------------------------------------------------------------- panel inspector

  drawInspector() {
    const box = $('#sc-inspector');
    box.innerHTML = '';
    const p = this.result?.pages[this.sel?.page];
    const page = this.result?.pages[this.pageIdx];
    if (!p) {
      box.append(el('div', { class: 'empty' }, el('div', { class: 'empty-ico' }, icon('click', 22)), el('b', {}, 'No panel selected'),
        el('p', {}, 'Click a panel to change its shot, poses and gaze. Edited panels are locked: they keep their staging when you rebuild or roll other staging.')));
      if (page) box.append(this.pageSection(page));
      return;
    }
    const i = this.sel.panel;
    const shot = p.prop.shots[i];
    const spec = shot.spec;
    const meta = p.panels[i];
    const edited = !!this.doc.edits[meta.key];
    box.append(el('div', { class: 'insp-head' },
      el('div', { class: 'title' }, el('small', {}, `Page ${p.number} · panel ${i + 1}${edited ? ' · edited' : ''}`), el('b', {}, shotLabel(shot))),
      el('span', { class: 'pill score', style: `background:${scoreColor(shot.total)}` }, String(shot.total))));
    const lineText = this.doc.plot.split('\n')[meta.line - 1] || '';
    box.append(el('button', { class: 'plot-line', title: 'Go to this line in the plot', onclick: () => this.gotoLine(meta.line) }, el('small', {}, `Line ${meta.line}`), el('code', {}, lineText.trim())));

    const another = el('button', { class: 'btn', title: 'Roll another camera for just this panel' }, icon('dices'), el('span', {}, 'Another option'));
    another.addEventListener('click', () => {
      spinIcon(another);
      rerollPanel(p.prop, i, { world: p.world, style: 'balance', seed: `${meta.key}|${Date.now()}` });
      this.commitEdit(p, i);
    });
    const auto = el('button', { class: 'btn', disabled: !edited, title: 'Drop the edits and stage this panel from the plot again' }, icon('reset'), el('span', {}, 'Back to auto'));
    auto.addEventListener('click', () => { delete this.doc.edits[meta.key]; this.persist(); this.build(); });
    const write = el('button', { class: 'btn primary block', title: 'Describe this panel’s camera and poses with plot tags' }, icon('pencil'), el('span', {}, 'Write edits to plot'));
    write.addEventListener('click', () => {
      this.doc.plot = rewritePanelLine(this.doc.plot, meta.line, specToTags(spec, p.chars), p.chars);
      $('#sc-plot').value = this.doc.plot;
      this.doc.edits[meta.key] = structuredClone(spec);
      this.persist();
      this.build();
      toast('Plot line updated');
    });
    box.append(el('div', { class: 'insp-actions' }, another, auto), write);

    const g = el('div', { class: 'insp-grid' });
    const types = Object.entries(TYPES).filter(([k]) => p.chars.length > 1 || (k !== 'ots' && k !== 'two' && k !== 'pov'));
    if (spec.type === 'free') types.push(['free', 'Free camera']);
    g.append(selectField('Shot type', types, spec.type, (v) => this.editSpec(p, i, { type: v }, true)));
    g.append(selectField('Shot size', SIZES.map((s, k) => [String(k), s]), String(spec.size), (v) => this.editSpec(p, i, { size: Number(v), zoom: undefined }, true)));
    g.append(selectField('Subject', p.chars.map((c, k) => [String(k), c.name]), String(spec.subject), (v) => this.editSpec(p, i, { subject: Number(v) }, true)));
    const cam = el('div', { class: 'insp-grid' });
    cam.append(sliderField('Camera height (°)', -40, 80, 1, spec.elev, (v, live) => this.editSpec(p, i, { elev: v }, !live)));
    cam.append(sliderField('Orbit (°)', -70, 70, 1, spec.az, (v, live) => this.editSpec(p, i, { az: v }, !live)));
    cam.append(sliderField('Dutch tilt (°)', -25, 25, 1, spec.dutch, (v, live) => this.editSpec(p, i, { dutch: v }, !live)));
    cam.append(sliderField('Lens FOV (°)', 8, 80, 1, spec.fov, (v, live) => this.editSpec(p, i, { fov: v }, !live)));
    cam.append(sliderField('Frame X', -0.8, 0.8, 0.01, spec.fx, (v, live) => this.editSpec(p, i, { fx: v }, !live)));
    cam.append(sliderField('Frame Y', -0.8, 0.8, 0.01, spec.fy, (v, live) => this.editSpec(p, i, { fy: v }, !live)));
    box.append(el('h3', { class: 'group-title' }, 'Shot'), g, el('h3', { class: 'group-title' }, 'Camera'), cam);

    const poseEntries = Object.entries(Object.fromEntries(listPoses({ adult: false }).filter((x) => !x.pair && !x.trio).map((x) => [x.id, x.name || x.id])));
    const people = el('div', { class: 'insp-grid' });
    p.chars.forEach((c, k) => {
      people.append(selectField(`${c.name}’s pose`, poseEntries, typeof spec.poses?.[k] === 'string' ? spec.poses[k] : 'idle', (v) => this.editSpec(p, i, { poses: { ...spec.poses, [k]: v } }, true)));
      people.append(selectField(`${c.name}’s face`, FACE_OPTIONS, spec.face?.[k]?.expr || '', (v) => {
        const face = { ...(spec.face || {}) };
        if (v) face[k] = { expr: v, amount: 80 };
        else delete face[k];
        this.editSpec(p, i, { face }, true);
      }));
      people.append(selectField(`${c.name} looks`, GAZE_OPTIONS, spec.gaze?.[k] || '', (v) => {
        const gaze = { ...(spec.gaze || {}) };
        if (v) gaze[k] = v;
        else delete gaze[k];
        this.editSpec(p, i, { gaze }, true);
      }));
    });
    box.append(el('h3', { class: 'group-title' }, 'People'), people);
    box.append(this.pageSection(p));
  }

  pageSection(p) {
    const s = el('div', { class: 'sc-page-tools' });
    const fixed = !!this.doc.fixedLayouts[p.k];
    s.append(el('h3', { class: 'group-title' }, `Page ${p.number}`),
      el('p', { class: 'hint' }, `${p.side === 'left' ? 'Left' : 'Right'}-hand page${p.turnAfter ? ', page turn after it' : ''}. Layout: ${p.layoutParams.preset} #${p.layoutIndex}${p.candidates ? ` (best of ${p.candidates})` : ''}. Cast: ${p.chars.map((c) => c.name).join(', ')}.`));
    const other = el('button', { class: 'btn', disabled: fixed, title: fixed ? 'Unpin the layout first' : 'The next-best layout for these panels' }, icon('layout'), el('span', {}, 'Other layout'));
    other.addEventListener('click', () => { this.doc.layoutVariant[p.k] = (this.doc.layoutVariant[p.k] || 0) + 1; this.persist(); this.build(); });
    const staging = el('button', { class: 'btn', title: 'Restage this page’s unedited panels' }, icon('dices'), el('span', {}, 'Other staging'));
    staging.addEventListener('click', () => { this.doc.stagingSeed = `STAGE-${Math.random().toString(36).slice(2, 6)}`; this.persist(); this.build(); });
    const fix = el('button', { class: 'btn' + (fixed ? ' on' : ''), title: 'Keep this layout even when panels change elsewhere' }, icon(fixed ? 'lock' : 'unlock'), el('span', {}, fixed ? 'Layout pinned' : 'Pin layout'));
    fix.addEventListener('click', () => {
      if (fixed) delete this.doc.fixedLayouts[p.k];
      else this.doc.fixedLayouts[p.k] = { params: p.layoutParams, index: p.layoutIndex };
      this.persist();
      this.build();
    });
    s.append(el('div', { class: 'btn-row' }, other, staging, fix));
    return s;
  }

  editSpec(p, i, patch, commit) {
    const shot = p.prop.shots[i];
    shot.spec = { ...shot.spec, ...patch };
    for (const [k, v] of Object.entries(shot.spec)) if (v === undefined) delete shot.spec[k];
    rescoreProposal(p.prop, p.world);
    this.renderPage(p.k);
    if (commit) this.commitEdit(p, i);
  }

  commitEdit(p, i) {
    this.doc.edits[p.panels[i].key] = structuredClone(p.prop.shots[i].spec);
    p.panels[i].edited = true;
    this.persist();
    this.renderPage(p.k);
    this.drawInspector();
  }

  // ---------------------------------------------------------------- handing pages on

  async openInShots() {
    const p = this.result?.pages[this.pageIdx];
    if (!p) return;
    if (p.chars.length > 3) {
      toast(`Shots holds up to 3 characters; page ${p.number} has ${p.chars.length}.`, { icon: 'warn' });
      return;
    }
    const scripts = Object.fromEntries(p.scripts.map((s, i) => [i, structuredClone(s)]));
    await this.host.importPage({
      chars: p.chars, positions: p.positions, layoutParams: p.layoutParams, layoutIndex: p.layoutIndex, room: p.room,
      specs: p.prop.shots.map((s) => s.spec), plan: p.prop.shots.map((s) => ({ role: s.ctx.role, speaker: s.ctx.speaker })), scripts,
    });
  }

  // Clips for the Video workspace: every panel of every page, in reading order.
  videoScene() {
    const r = this.result;
    if (!r?.pages.length) return null;
    const clips = [];
    for (const p of r.pages) {
      const figs = this.figuresFor(p.chars);
      const setup = () => { this.sr.setFigures(figs, p.chars); this.sr.setStyle(this.doc.renderStyle, p.chars); };
      p.prop.shots.forEach((shot, i) => clips.push({ shot, world: p.world, chars: p.chars, script: p.scripts[i], fx: p.panels[i], setup, label: `p.${p.number} panel ${i + 1}` }));
    }
    return { clips, sr: this.sr, chars: r.chars, dir: r.dir, caps: true, key: `script|${this.doc.seed}|${hash(this.doc.plot)}`, name: (r.title || 'koma-script').replace(/[^\w.-]+/g, '-') };
  }

  // ---------------------------------------------------------------- files

  exportProject() {
    download(new Blob([JSON.stringify({ koma: 'script', version: 1, ...this.doc }, null, 2)], { type: 'application/json' }), `${slug(this.result?.title)}.koma.json`);
  }

  exportPlot() {
    download(new Blob([this.doc.plot], { type: 'text/plain' }), `${slug(this.result?.title)}-plot.txt`);
  }

  async exportPngs() {
    const pages = this.result?.pages || [];
    for (const p of pages) {
      const W = 1600;
      const c = el('canvas', { width: W, height: Math.round((W * p.layout.H) / p.layout.W) });
      this.sr.setFigures(this.figuresFor(p.chars), p.chars);
      this.sr.setStyle(this.doc.renderStyle, p.chars);
      drawPlotPage(c.getContext('2d'), this.sr, p, { scale: W / p.layout.W, caps: true });
      const blob = await new Promise((res) => c.toBlob(res, 'image/png'));
      download(blob, `${slug(this.result.title)}-p${String(p.number).padStart(2, '0')}.png`);
    }
    this.layoutPages();
    toast(`Exported ${pages.length} page${pages.length === 1 ? '' : 's'}`);
  }

  async openFile(file) {
    const text = await file.text();
    try {
      const j = JSON.parse(text);
      if (j.koma !== 'script' || typeof j.plot !== 'string') throw new Error('not a Koma script project');
      const { koma, version, ...doc } = j;
      this.doc = { ...this.doc, ...doc };
    } catch {
      // plain text = a plot
      this.doc = { ...this.doc, plot: text, edits: {}, layoutVariant: {}, fixedLayouts: {} };
    }
    $('#sc-plot').value = this.doc.plot;
    this.persist();
    this.build({ keepSelection: false });
  }

  // ---------------------------------------------------------------- wiring

  bind() {
    const ta = $('#sc-plot');
    ta.value = this.doc.plot;
    let timer = null;
    ta.addEventListener('input', () => {
      this.doc.plot = ta.value;
      this.persist();
      clearTimeout(timer);
      if (this.doc.auto) timer = setTimeout(() => this.build(), 650);
    });
    ta.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); this.build(); }
      if (e.key === 'Tab') {
        e.preventDefault();
        ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end');
        ta.dispatchEvent(new Event('input'));
      }
    });
    const auto = $('#sc-auto');
    auto.checked = this.doc.auto;
    auto.addEventListener('change', () => { this.doc.auto = auto.checked; this.persist(); });
    $('#sc-build').addEventListener('click', () => { spinIcon($('#sc-build')); afterPaint(() => this.build()); });
    $('#sc-shots').addEventListener('click', () => this.openInShots());
    $('#sc-video').addEventListener('click', () => this.host.playVideo());
    $('#sc-sample').addEventListener('click', () => {
      this.doc = { ...this.doc, plot: SAMPLE_PLOT, edits: {}, layoutVariant: {}, fixedLayouts: {} };
      ta.value = this.doc.plot;
      this.persist();
      this.build({ keepSelection: false });
    });
    $('#sc-save').addEventListener('click', () => this.exportProject());
    $('#sc-save-txt').addEventListener('click', () => this.exportPlot());
    $('#sc-png').addEventListener('click', () => this.exportPngs());
    const file = $('#sc-file');
    $('#sc-open').addEventListener('click', () => file.click());
    file.addEventListener('change', () => { if (file.files[0]) this.openFile(file.files[0]); file.value = ''; });
    $('#sc-help').addEventListener('click', () => { this.fillHelp(); $('#sc-help-dialog').showModal(); });
    $('#sc-help-close').addEventListener('click', () => $('#sc-help-dialog').close());
    const style = $('#sc-style');
    style.value = this.doc.renderStyle;
    style.addEventListener('change', () => { this.doc.renderStyle = style.value; this.persist(); this.layoutPages(); });
    const zoom = $('#sc-zoom');
    zoom.value = String(this.doc.zoom);
    zoom.addEventListener('change', () => { this.doc.zoom = zoom.value; this.persist(); this.layoutPages(); });
    let rt = null;
    new ResizeObserver(() => {
      if (!this.shown || this.doc.zoom !== 'fit' || !this.result) return;
      clearTimeout(rt);
      rt = setTimeout(() => this.layoutPages(), 120);
    }).observe($('#sc-pages'));
  }

  fillHelp() {
    const box = $('#sc-help-words');
    if (box.childElementCount) return;
    const byKind = {};
    for (const t of TAG_LIST) (byKind[t.kind] ||= []).push(t.label);
    for (const [kind, label] of Object.entries(TAG_KINDS)) {
      if (!byKind[kind]) continue;
      box.append(el('h4', {}, label), el('p', {}, byKind[kind].join(', ')));
    }
    box.append(el('h4', {}, 'Poses (pose=… or as a tag)'), el('p', {}, Object.keys(POSE_WORDS).map((w) => w.replace(/\b\w/, (c) => c.toUpperCase())).join(', ') + '. Any pose id or name from the Poses library works too.'));
    box.append(el('h4', {}, 'Gaze'), el('p', {}, 'partner, camera, forward, down, away, up'));
    box.append(el('h4', {}, 'Models'), el('p', {}, Object.entries(MODELS).map(([k, v]) => `${k} (${v.label})`).join(', ')));
    box.append(el('h4', {}, 'Background rooms'), el('p', {}, ROOMS.join(', ')));
  }
}

function selectField(label, entries, value, onChange) {
  const s = el('select');
  for (const [v, l] of entries) s.append(el('option', { value: v }, l));
  s.value = value;
  s.addEventListener('change', () => onChange(s.value));
  return el('label', {}, label, s);
}

function sliderField(label, min, max, step, value, onChange) {
  const input = el('input', { type: 'range', min, max, step, value: String(value ?? 0) });
  const fmt = (v) => (Math.abs(v) < 2 && v % 1 !== 0 ? Number(v).toFixed(2) : String(Math.round(v)));
  const out = el('output', {}, fmt(value ?? 0));
  input.addEventListener('input', () => { out.value = fmt(Number(input.value)); onChange(Number(input.value), true); });
  input.addEventListener('change', () => onChange(Number(input.value), false));
  return el('label', { class: 'slider' }, label, input, out);
}

const slug = (t) => String(t || 'koma-script').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'koma-script';
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}
function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
