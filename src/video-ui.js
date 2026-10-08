// The Video workspace: plays the current storyboard page as an animatic, edits each shot's
// motion (end keyframe, length, transition) and exports MP4 animatics and control videos.

import { icon, toast, fadeIn } from './ui.js';
import { shotLabel, SIZES } from './gacha.js';
import { listPoses } from './pose-runtime.js';
import { VideoComposer, VIDEO_SIZES, LETTERING, VIDEO_KINDS } from './video.js';
import { CAMERA_MOVES, EASES, TRANSITIONS, defaultDuration, hasMotion } from './motion.js';
import { canEncodeVideo } from './video-encode.js';

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
const fmtTime = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}`;
const PX_PER_SEC = 34;

/**
 * host: {
 *   sr: StoryRenderer,
 *   scene(): {shots, world, scripts, chars, dir, caps, key, name} for the current storyboard page,
 *   editPanel(i): jump to Shots with panel i selected,
 * }
 */
export class VideoWorkspace {
  constructor(host) {
    this.host = host;
    this.settings = { size: '720p', fps: 24, lettering: 'subtitles', drift: 0.04, loop: true, ...store.get('video:settings', {}) };
    this.time = 0;
    this.selected = 0;
    this.playing = false;
    this.canvas = $('#vd-canvas');
    this.g = this.canvas.getContext('2d');
    this.preview = new VideoComposer(host.sr, {});
    this.thumbs = new VideoComposer(host.sr, { lettering: 'none', drift: 0 });
    this.bind();
  }

  // ---------------------------------------------------------------- data

  get motions() { return this.data.motions; }

  load() {
    const sc = this.host.scene();
    this.sc = sc;
    const saved = store.get('video:' + sc.key, null);
    this.data = saved && saved.motions ? saved : { motions: {} };
  }

  persist() {
    store.set('video:' + this.sc.key, this.data);
    store.set('video:settings', this.settings);
  }

  clips() {
    const { shots, world, scripts, chars } = this.sc;
    return shots.map((shot, i) => {
      const m = this.motions[i] || null;
      return {
        shot, world, chars, script: scripts[i], motion: m, panel: i,
        duration: m?.duration || defaultDuration(scripts[i], shot.ctx.role),
        transition: m?.transition || 'cut',
      };
    });
  }

  size() {
    const s = VIDEO_SIZES[this.settings.size] || VIDEO_SIZES['720p'];
    return [s.w, s.h];
  }

  // ---------------------------------------------------------------- show / rebuild

  show() {
    this.load();
    this.rebuild();
    this.layoutCanvas();
    this.drawInspector();
  }

  hide() {
    this.pause();
  }

  rebuild({ keepThumbs = false } = {}) {
    const clips = this.clips();
    const opts = { lettering: this.settings.lettering, drift: this.settings.drift, caps: this.sc.caps, dir: this.sc.dir };
    Object.assign(this.preview.opts, opts);
    this.preview.setClips(clips);
    this.thumbs.setClips(clips.map((c) => ({ ...c })));
    this.total = this.preview.timeline.total;
    this.time = Math.min(this.time, Math.max(0, this.total - 0.001));
    this.selected = Math.min(this.selected, Math.max(0, clips.length - 1));
    const moving = clips.filter((c) => hasMotion(c.motion)).length;
    $('#vd-summary').textContent = clips.length ? `${clips.length} shots · ${fmtTime(this.total)}${moving ? ` · ${moving} moving` : ''}` : 'No shots yet';
    $('#vd-total').textContent = fmtTime(this.total);
    this.drawTimeline(keepThumbs);
    this.draw();
  }

  layoutCanvas() {
    const wrap = this.canvas.closest('.video-wrap');
    const [vw, vh] = this.size();
    const r = wrap.getBoundingClientRect();
    const maxW = Math.max(160, r.width - 64);
    const maxH = Math.max(90, r.height - 36);
    const k = Math.min(maxW / vw, maxH / vh);
    const cssW = Math.round(vw * k);
    const cssH = Math.round(vh * k);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const pw = Math.min(vw, Math.round(cssW * dpr));
    const ph = Math.round((pw * vh) / vw);
    this.canvas.style.width = cssW + 'px';
    this.canvas.style.height = cssH + 'px';
    if (this.canvas.width !== pw || this.canvas.height !== ph) {
      this.canvas.width = pw;
      this.canvas.height = ph;
    }
    this.preview.setSize(pw, ph);
    this.draw();
  }

  // ---------------------------------------------------------------- drawing

  draw() {
    if (!this.preview.timeline.clips.length) {
      this.g.fillStyle = '#fff';
      this.g.fillRect(0, 0, this.canvas.width, this.canvas.height);
      return;
    }
    this.preview.drawFrame(this.g, this.time, 'render');
    $('#vd-time').textContent = fmtTime(this.time);
    const scrub = $('#vd-scrub');
    if (document.activeElement !== scrub) scrub.value = String(Math.round((this.time / (this.total || 1)) * 1000));
    this.movePlayhead();
  }

  drawTimeline(keepThumbs) {
    const box = $('#vd-timeline');
    const clips = this.preview.timeline.clips;
    const old = keepThumbs ? [...box.querySelectorAll('canvas')] : [];
    box.innerHTML = '';
    clips.forEach((c, k) => {
      const w = Math.max(92, c.duration * PX_PER_SEC);
      const cv = old[k] || el('canvas', { width: 192, height: 112 });
      const b = el('button', { class: 'vclip' + (k === this.selected ? ' on' : ''), style: `width:${w}px`, title: shotLabel(c.shot) },
        cv,
        el('span', { class: 'cap' }, el('b', {}, String(k + 1)), `${c.duration.toFixed(1)}s`, hasMotion(c.motion) ? icon('move', 12) : null,
          c.transition !== 'cut' ? el('span', { class: 'tr' }, c.transition === 'dissolve' ? 'dissolve' : 'fade') : null));
      b.addEventListener('click', () => this.select(k, true));
      box.append(b);
      if (!old[k]) this.queueThumb(k, cv);
    });
    this.playhead = el('i', { class: 'playhead' });
    box.append(this.playhead);
    this.movePlayhead();
  }

  queueThumb(k, cv) {
    // thumbnails render after the current frame so the timeline appears at once
    setTimeout(() => {
      if (!cv.isConnected) return;
      this.thumbs.setSize(cv.width, cv.height);
      const t = this.thumbs.timeline.clips[k];
      if (!t) return;
      const g = cv.getContext('2d');
      this.thumbs.drawFrame(g, t.t0 + t.duration * 0.02, 'render');
      // the shared renderer was resized; the preview redraws at its own size on the next frame
    }, 0);
  }

  movePlayhead() {
    if (!this.playhead) return;
    const clips = this.preview.timeline.clips;
    const k = clips.findIndex((c) => this.time < c.t1);
    const idx = k < 0 ? clips.length - 1 : k;
    const btn = $('#vd-timeline').children[idx];
    if (!btn || !clips[idx]) return;
    const f = (this.time - clips[idx].t0) / clips[idx].duration;
    this.playhead.style.left = `${btn.offsetLeft + Math.min(1, Math.max(0, f)) * btn.offsetWidth}px`;
    if (this.playing && idx !== this.selected) {
      this.selected = idx;
      [...$('#vd-timeline').querySelectorAll('.vclip')].forEach((b, j) => b.classList.toggle('on', j === idx));
      this.drawInspector();
    }
  }

  // ---------------------------------------------------------------- playback

  play() {
    if (!this.total) return;
    if (this.time >= this.total - 0.05) this.time = 0;
    this.playing = true;
    this.syncPlayButton();
    let last = performance.now();
    const tick = (now) => {
      if (!this.playing) return;
      this.time += (now - last) / 1000;
      last = now;
      if (this.time >= this.total) {
        if (this.settings.loop) this.time %= this.total;
        else {
          this.time = this.total - 0.001;
          this.pause();
        }
      }
      this.draw();
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  pause() {
    this.playing = false;
    cancelAnimationFrame(this.raf);
    this.syncPlayButton();
  }

  toggle() { this.playing ? this.pause() : this.play(); }

  syncPlayButton() {
    const b = $('#vd-play');
    b.replaceChildren(icon(this.playing ? 'pause' : 'play'), el('span', {}, this.playing ? 'Pause' : 'Play'));
    b.setAttribute('title', this.playing ? 'Pause' : 'Play');
  }

  seek(t) {
    this.time = Math.max(0, Math.min(this.total - 0.001, t));
    this.draw();
  }

  step(frames) {
    this.pause();
    this.seek(this.time + frames / this.settings.fps);
  }

  select(k, seek = false) {
    this.selected = k;
    [...$('#vd-timeline').querySelectorAll('.vclip')].forEach((b, j) => b.classList.toggle('on', j === k));
    if (seek) {
      this.pause();
      this.seek(this.preview.timeline.clips[k].t0);
    }
    this.drawInspector();
  }

  // ---------------------------------------------------------------- editing

  setMotion(i, patch, { rebuildThumbs = false } = {}) {
    const m = { ...(this.motions[i] || {}), ...patch };
    for (const [k, v] of Object.entries(m)) if (v === undefined) delete m[k];
    if (m.to) {
      for (const [k, v] of Object.entries(m.to)) if (v === undefined || (typeof v === 'object' && v && !Array.isArray(v) && !Object.keys(v).length && k !== 'pair')) delete m.to[k];
      if (!Object.keys(m.to).length) delete m.to;
    }
    if (Object.keys(m).length) this.motions[i] = m;
    else delete this.motions[i];
    this.persist();
    // keep the playhead at the same moment of the edited shot
    const before = this.preview.timeline.clips[i];
    const f = before ? (this.time - before.t0) / before.duration : 0;
    this.rebuild({ keepThumbs: !rebuildThumbs });
    const after = this.preview.timeline.clips[i];
    if (after && f >= 0 && f <= 1) this.seek(after.t0 + f * after.duration);
  }

  setTo(i, patch) {
    const to = { ...(this.motions[i]?.to || {}), ...patch };
    this.setMotion(i, { to });
  }

  drawInspector() {
    const box = $('#vd-inspector');
    box.innerHTML = '';
    const clips = this.preview.timeline.clips;
    const c = clips[this.selected];
    if (!c) {
      box.append(el('div', { class: 'empty' }, el('div', { class: 'empty-ico' }, icon('film', 22)), el('b', {}, 'No shots yet'),
        el('p', {}, 'Storyboard a page in Shots first. Every panel becomes a shot here, in reading order.')));
      return;
    }
    const i = c.panel;
    const m = this.motions[i] || {};
    const to = m.to || {};
    const chars = this.sc.chars;
    const auto = defaultDuration(c.script, c.shot.ctx.role);

    box.append(el('div', { class: 'insp-head' },
      el('div', { class: 'title' }, el('small', {}, `Shot ${this.selected + 1} · ${fmtTime(c.t0)}`), el('b', {}, shotLabel(c.shot))),
      el('span', { class: 'pill soft' }, `${c.duration.toFixed(1)} s`)));

    // timing
    const timing = el('div', { class: 'insp-grid one' });
    timing.append(slider(`Length (s)${m.duration ? '' : ' · auto'}`, 0.5, 15, 0.1, c.duration, (v) => this.setMotion(i, { duration: v })));
    const trSeg = el('div', { class: 'seg full' });
    for (const [k, label] of Object.entries(TRANSITIONS)) {
      const b = el('button', { class: (m.transition || 'cut') === k ? 'on' : '' }, label.replace(' through black', ''));
      b.addEventListener('click', () => this.setMotion(i, { transition: k === 'cut' ? undefined : k }));
      trSeg.append(b);
    }
    timing.append(el('label', {}, 'Starts with', trSeg));
    box.append(el('h3', { class: 'group-title' }, 'Timing'), timing);
    if (m.duration) box.append(el('button', { class: 'link-btn', onclick: () => this.setMotion(i, { duration: undefined }) }, el('span', {}, `Back to reading time (${auto.toFixed(1)} s)`)));

    // camera
    const cam = el('div', { class: 'insp-grid' });
    cam.append(select('Camera move', Object.entries(CAMERA_MOVES).map(([k, v]) => [k, v.label]), m.camera || 'auto', (v) => this.setMotion(i, { camera: v === 'auto' ? undefined : v })));
    cam.append(select('Easing', Object.entries(EASES).map(([k, v]) => [k, v.label]), m.ease || 'inOut', (v) => this.setMotion(i, { ease: v === 'inOut' ? undefined : v })));
    const endSize = to.camera?.size ?? null;
    cam.append(select('End shot size', [['', '— same'], ...SIZES.map((s, k) => [String(k), s])], endSize == null ? '' : String(endSize), (v) => {
      const camera = { ...(to.camera || {}) };
      if (v === '') delete camera.size;
      else camera.size = Number(v);
      this.setTo(i, { camera: Object.keys(camera).length ? camera : undefined });
    }));
    cam.append(select('End subject', [['', '— same'], ...chars.map((ch, k) => [String(k), ch.name])], to.camera?.subject == null ? '' : String(to.camera.subject), (v) => {
      const camera = { ...(to.camera || {}) };
      if (v === '') delete camera.subject;
      else camera.subject = Number(v);
      this.setTo(i, { camera: Object.keys(camera).length ? camera : undefined });
    }));
    const span = el('div', { class: 'insp-grid one' });
    span.append(slider('Move starts (% of shot)', 0, 100, 1, Math.round((m.start ?? 0) * 100), (v) => this.setMotion(i, { start: v ? v / 100 : undefined, end: Math.max(v / 100, m.end ?? 1) })));
    span.append(slider('Move ends (% of shot)', 0, 100, 1, Math.round((m.end ?? 1) * 100), (v) => this.setMotion(i, { end: v === 100 ? undefined : v / 100, start: Math.min(v / 100, m.start ?? 0) || undefined })));
    box.append(el('h3', { class: 'group-title' }, 'Camera'), cam, span);
    box.append(el('p', { class: 'hint' }, '“Follow the action” reframes for the end of the shot the way the gacha would; “Locked off” keeps the start camera.'));

    // cast at the end of the shot
    const poseEntries = [['', '— same as start'], ...listPoses({ adult: false }).filter((p) => !p.pair && !p.trio).map((p) => [p.id, p.name || p.id])];
    const castBox = el('div');
    chars.forEach((ch, k) => {
      const mv = to.moves?.[k] || {};
      const g = el('div', { class: 'insp-grid' });
      g.append(select('End pose', poseEntries, to.poses?.[k] || '', (v) => {
        const poses = { ...(to.poses || {}) };
        if (v) poses[k] = v;
        else delete poses[k];
        this.setTo(i, { poses: Object.keys(poses).length ? poses : undefined });
      }));
      const others = chars.map((o, j) => [String(j), `Walk to ${o.name}`]).filter(([j]) => Number(j) !== k);
      g.append(select('Moves', [['', '— stays'], ...others], mv.toward == null ? '' : String(mv.toward), (v) => this.setMove(i, k, { toward: v === '' ? undefined : Number(v) })));
      const s = el('div', { class: 'insp-grid one' });
      s.append(slider('Step forward (m)', -3, 3, 0.05, mv.forward || 0, (v) => this.setMove(i, k, { forward: v || undefined })));
      s.append(slider('Step sideways (m, + = their left)', -3, 3, 0.05, mv.side || 0, (v) => this.setMove(i, k, { side: v || undefined })));
      s.append(slider('Turn (°)', -180, 180, 5, mv.turn || 0, (v) => this.setMove(i, k, { turn: v || undefined })));
      castBox.append(el('div', { class: 'vd-cast' }, el('h4', {}, el('i', { style: `background:${ch.color}` }), ch.name), g, s));
    });
    box.append(el('h3', { class: 'group-title' }, 'Cast at the end'), castBox);

    if (chars.length >= 2) {
      const groups = listPoses({ adult: false }).filter((p) => (p.pair && !p.trio) || (p.trio && chars.length >= 3));
      const cur = 'pair' in to ? (to.pair ? to.pair.id : '__none') : '';
      const g = el('div', { class: 'insp-grid one' });
      g.append(select('Group pose at the end', [['', '— same as start'], ['__none', '— none'], ...groups.map((p) => [p.id, `${p.name || p.id}${p.trio ? ' (trio)' : ''}`])], cur, (v) => {
        if (v === '') {
          const next = { ...to };
          delete next.pair;
          this.setMotion(i, { to: next });
        } else if (v === '__none') this.setTo(i, { pair: null });
        else {
          const def = groups.find((p) => p.id === v);
          this.setTo(i, { pair: { id: v, a: 0, b: 1, ...(def?.trio ? { c: 2 } : {}) } });
        }
      }));
      box.append(g, el('p', { class: 'hint' }, `Group poses place ${chars[1].name}${chars.length >= 3 ? ` and ${chars[2].name}` : ''} relative to ${chars[0].name}; everyone walks into place during the move.`));
    }

    const edit = el('button', { class: 'btn', title: 'The start of the shot is the panel itself' }, icon('board'), el('span', {}, 'Edit start in Shots'));
    edit.addEventListener('click', () => this.host.editPanel(i));
    const clear = el('button', { class: 'btn', disabled: !this.motions[i] }, icon('reset'), el('span', {}, 'Clear motion'));
    clear.addEventListener('click', () => this.setMotion(i, { duration: undefined, transition: undefined, camera: undefined, ease: undefined, start: undefined, end: undefined, to: undefined }, { rebuildThumbs: true }));
    box.append(el('div', { class: 'vd-actions' }, edit, clear));
  }

  setMove(i, k, patch) {
    const moves = { ...(this.motions[i]?.to?.moves || {}) };
    const mv = { ...(moves[k] || {}), ...patch };
    for (const [key, v] of Object.entries(mv)) if (v === undefined) delete mv[key];
    if (Object.keys(mv).length) moves[k] = mv;
    else delete moves[k];
    this.setTo(i, { moves: Object.keys(moves).length ? moves : undefined });
  }

  // ---------------------------------------------------------------- export

  async export(kind) {
    if (kind === 'shots') return this.exportShotList();
    if (!canEncodeVideo()) {
      toast('This browser can’t encode video. Use a current Chrome or Edge.', { icon: 'warn' });
      return;
    }
    if (!this.preview.timeline.clips.length) return;
    this.pause();
    const kinds = kind === 'all' ? ['render', 'depth', 'lineart', 'pose'] : [kind];
    const [w, h] = this.size();
    const comp = new VideoComposer(this.host.sr, { lettering: this.settings.lettering, drift: this.settings.drift, caps: this.sc.caps, dir: this.sc.dir });
    comp.setSize(w, h);
    comp.setClips(this.clips());
    const ac = new AbortController();
    this.abort = ac;
    const busy = $('#vd-busy');
    busy.hidden = false;
    fadeIn(busy, { from: 0, duration: 140 });
    try {
      for (let n = 0; n < kinds.length; n++) {
        const k = kinds[n];
        $('#vd-busy-title').textContent = `Exporting ${VIDEO_KINDS[k].toLowerCase()}${kinds.length > 1 ? ` (${n + 1} of ${kinds.length})` : ''}`;
        const t0 = performance.now();
        const r = await comp.encode({
          kind: k, fps: Number(this.settings.fps), signal: ac.signal,
          onProgress: (p) => {
            $('#vd-busy-bar').style.width = `${(p * 100).toFixed(1)}%`;
            const el2 = (performance.now() - t0) / 1000;
            $('#vd-busy-text').textContent = p > 0.02 ? `${Math.round(p * 100)}% · about ${Math.max(1, Math.round((el2 / p) * (1 - p)))} s left` : `${w} × ${h}, ${this.settings.fps} fps`;
          },
        });
        download(r.blob, `${this.sc.name}${k === 'render' ? '' : `-${k}`}.mp4`);
      }
      toast(kinds.length > 1 ? 'Exported 4 videos' : 'Exported MP4');
    } catch (e) {
      if (e.name !== 'AbortError') toast(`Export failed: ${e.message}`, { icon: 'warn' });
    } finally {
      busy.hidden = true;
      $('#vd-busy-bar').style.width = '0';
      this.abort = null;
      this.layoutCanvas();
    }
  }

  exportShotList() {
    const clips = this.preview.timeline.clips;
    const chars = this.sc.chars;
    const name = (s) => (s == null ? 'Narration' : s === -1 ? 'Off screen' : chars[s]?.name || '?');
    const lines = clips.map((c, k) => {
      const m = c.motion;
      const bits = [];
      if (m?.camera && m.camera !== 'auto') bits.push(CAMERA_MOVES[m.camera]?.label.toLowerCase());
      for (const [j, id] of Object.entries(m?.to?.poses || {})) bits.push(`${chars[j]?.name} → ${id}`);
      if (m?.to && 'pair' in m.to) bits.push(m.to.pair ? `→ ${m.to.pair.id}` : '→ no group pose');
      for (const [j, mv] of Object.entries(m?.to?.moves || {})) bits.push(`${chars[j]?.name} moves${mv.toward != null ? ` to ${chars[mv.toward]?.name}` : ''}${mv.forward ? ` ${mv.forward} m forward` : ''}${mv.side ? ` ${mv.side} m sideways` : ''}${mv.turn ? ` turns ${mv.turn}°` : ''}`);
      const script = c.script || {};
      const said = (script.dialogue || []).filter((d) => d.text?.trim()).map((d) => `${name(d.speaker)}: "${d.text.trim()}"`);
      if (script.caption?.trim()) said.unshift(`Caption: "${script.caption.trim()}"`);
      return `${fmtTime(c.t0)}–${fmtTime(c.t1)}  shot ${k + 1}${c.transition !== 'cut' ? ` (${c.transition} in)` : ''}: ${shotLabel(c.shot)}\n  motion: ${bits.join(', ') || 'still'}${said.length ? '\n  ' + said.join('\n  ') : ''}`;
    });
    const [w, h] = this.size();
    const txt = `${this.sc.name} — ${this.total.toFixed(1)} s, ${w}x${h}, ${this.settings.fps} fps\n\n${lines.join('\n\n')}\n`;
    download(new Blob([txt], { type: 'text/plain' }), `${this.sc.name}-shots.txt`);
  }

  // ---------------------------------------------------------------- wiring

  bind() {
    $('#vd-play').addEventListener('click', () => this.toggle());
    $('#vd-start').addEventListener('click', () => { this.pause(); this.seek(0); });
    const loop = $('#vd-loop');
    const syncLoop = () => { loop.classList.toggle('on', this.settings.loop); loop.setAttribute('aria-pressed', String(this.settings.loop)); };
    loop.addEventListener('click', () => { this.settings.loop = !this.settings.loop; syncLoop(); this.persist(); });
    syncLoop();
    const scrub = $('#vd-scrub');
    scrub.addEventListener('input', () => { this.pause(); this.seek((Number(scrub.value) / 1000) * this.total); });
    for (const b of document.querySelectorAll('#vd-export-menu [data-export]')) {
      b.addEventListener('click', () => { $('#vd-export-menu').hidePopover?.(); this.export(b.dataset.export); });
    }
    $('#vd-busy-cancel').addEventListener('click', () => this.abort?.abort());

    const size = $('#vd-size');
    for (const [k, v] of Object.entries(VIDEO_SIZES)) size.append(el('option', { value: k }, v.label));
    size.value = this.settings.size;
    size.addEventListener('change', () => { this.settings.size = size.value; this.persist(); this.thumbs.invalidate(); this.layoutCanvas(); this.rebuild(); });
    const fps = $('#vd-fps');
    fps.value = String(this.settings.fps);
    fps.addEventListener('change', () => { this.settings.fps = Number(fps.value); this.persist(); });
    const lett = $('#vd-lettering');
    for (const [k, v] of Object.entries(LETTERING)) lett.append(el('option', { value: k }, v));
    lett.value = this.settings.lettering;
    lett.addEventListener('change', () => { this.settings.lettering = lett.value; this.persist(); this.rebuild({ keepThumbs: true }); });
    const drift = $('#vd-drift');
    const out = drift.nextElementSibling;
    drift.value = String(this.settings.drift);
    out.value = `${Math.round(this.settings.drift * 100)}%`;
    drift.addEventListener('input', () => { out.value = `${Math.round(Number(drift.value) * 100)}%`; });
    drift.addEventListener('change', () => { this.settings.drift = Number(drift.value); this.persist(); this.rebuild({ keepThumbs: true }); });

    new ResizeObserver(() => { if (!$('#tab-video').hidden) this.layoutCanvas(); }).observe($('#vd-stage'));
    document.addEventListener('keydown', (e) => {
      if ($('#tab-video').hidden || e.ctrlKey || e.metaKey || e.altKey || e.target.matches('input:not([type=range]), select, textarea') || document.querySelector('dialog[open]')) return;
      if (e.key === ' ') { e.preventDefault(); this.toggle(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); this.step(e.shiftKey ? this.settings.fps : 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); this.step(e.shiftKey ? -this.settings.fps : -1); }
      else if (e.key === 'Home') { e.preventDefault(); this.pause(); this.seek(0); }
    });
  }
}

function select(label, entries, value, onChange) {
  const s = el('select');
  for (const [v, l] of entries) s.append(el('option', { value: v }, l));
  s.value = value;
  s.addEventListener('change', () => onChange(s.value));
  return el('label', {}, label, s);
}

// Applies on release (each change re-blends the shot); the readout follows the drag.
function slider(label, min, max, step, value, onChange) {
  const input = el('input', { type: 'range', min, max, step, value: String(value) });
  const fmt = (v) => (step < 1 ? Number(v).toFixed(step < 0.1 ? 2 : 1) : String(Math.round(v)));
  const out = el('output', {}, fmt(value));
  input.addEventListener('input', () => { out.value = fmt(Number(input.value)); });
  input.addEventListener('change', () => onChange(Number(input.value)));
  return el('label', { class: 'slider' }, label, input, out);
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
