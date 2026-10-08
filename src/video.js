// Video composer: lays storyboard shots on a timeline and draws any moment of it as a frame
// (storyboard render, depth, line art or OpenPose skeleton), with lettering and transitions.
// Used by the app's Video workspace and by the headless MCP renderer.

import { ShotSampler, layoutTimeline, clipAt, drawOpenPose, TRANSITION_SECONDS } from './motion.js';
import { letterPanel } from './letter.js';
import { encodeFrames } from './video-encode.js';

export const VIDEO_SIZES = {
  '720p': { label: '1280 × 720 (16:9)', w: 1280, h: 720 },
  '1080p': { label: '1920 × 1080 (16:9)', w: 1920, h: 1080 },
  vertical: { label: '1080 × 1920 (9:16)', w: 1080, h: 1920 },
  square: { label: '1080 × 1080 (1:1)', w: 1080, h: 1080 },
  scope: { label: '1920 × 816 (2.35:1)', w: 1920, h: 816 },
};
export const LETTERING = { subtitles: 'Subtitles', balloons: 'Balloons', none: 'None' };
export const VIDEO_KINDS = { render: 'Storyboard', depth: 'Depth', lineart: 'Line art', pose: 'OpenPose skeleton' };

const VW = 640; // lettering is laid out on a 640-unit-wide frame and scaled (about 2× page size at 720p)
const SUB_FONT = "'Inter Variable', 'Segoe UI', system-ui, sans-serif";
const words = (t) => (String(t || '').trim().match(/\S+/g) || []).length;

// Dialogue lines and the fraction of the shot where each one starts (spread by length).
function lineTimes(script) {
  const lines = (script?.dialogue || []).filter((d) => d.text?.trim());
  const weights = lines.map((d) => words(d.text) + 2);
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  return lines.map((d, k) => {
    const start = 0.04 + (acc / total) * 0.9;
    acc += weights[k];
    return { line: d, start, end: 0.04 + (acc / total) * 0.9 };
  });
}

function wrapText(g, text, maxW) {
  const out = [];
  let cur = '';
  for (const w of String(text).split(/\s+/)) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && g.measureText(next).width > maxW) {
      out.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) out.push(cur);
  return out;
}

/**
 * clips: [{shot: {spec, ctx}, world, script, motion, duration, transition, chars, setup?}]
 *   setup(): called before drawing a clip whose figures differ from the last one (multi-page comics).
 * opts: {width, height, lettering, drift, caps, dir}
 */
export class VideoComposer {
  constructor(sr, opts = {}) {
    this.sr = sr;
    this.opts = { lettering: 'subtitles', drift: 0.04, caps: true, dir: 'ltr', ...opts };
    this.width = opts.width || 1280;
    this.height = opts.height || 720;
    this.samplers = new Map();
    this.timeline = { clips: [], total: 0 };
  }

  setSize(w, h) {
    this.width = Math.round(w / 2) * 2;
    this.height = Math.round(h / 2) * 2;
    this.samplers.clear();
  }

  setClips(clips) {
    this.timeline = layoutTimeline(clips);
    this.samplers.clear();
    this.lastSetup = null;
  }

  invalidate(k = null) {
    if (k == null) this.samplers.clear();
    else this.samplers.delete(k);
  }

  sampler(k) {
    let s = this.samplers.get(k);
    if (!s) {
      const c = this.timeline.clips[k];
      this.prepare(c);
      s = new ShotSampler(c.shot, c.world, this.width / this.height, c.motion, { drift: this.opts.drift });
      this.samplers.set(k, s);
    }
    return s;
  }

  prepare(c) {
    if (c.setup && this.lastSetup !== c.setup) {
      c.setup();
      this.lastSetup = c.setup;
    }
  }

  // Draw the frame at `time` seconds into a 2D context of width × height.
  drawFrame(g, time, kind = 'render') {
    const tl = this.timeline;
    const w = this.width;
    const h = this.height;
    g.save();
    g.globalAlpha = 1;
    g.fillStyle = kind === 'render' ? '#fff' : '#000';
    g.fillRect(0, 0, w, h);
    const k = clipAt(tl, time);
    if (k < 0) {
      g.restore();
      return;
    }
    const clip = tl.clips[k];
    const u = Math.min(1, Math.max(0, (time - clip.t0) / clip.duration));
    const into = time - clip.t0;
    const T = TRANSITION_SECONDS;
    const trans = kind === 'render' ? clip.transition : 'cut';
    if (k > 0 && trans === 'dissolve' && into < T) {
      this.drawClip(g, k - 1, 1, kind);
      g.globalAlpha = into / T;
      this.drawClip(g, k, u, kind);
      g.globalAlpha = 1;
    } else {
      this.drawClip(g, k, u, kind);
    }
    // fade through black: out over the end of the previous shot, in over the start of this one
    if (kind === 'render') {
      let black = 0;
      if (k > 0 && trans === 'fade' && into < T / 2) black = 1 - into / (T / 2);
      const next = tl.clips[k + 1];
      if (next?.transition === 'fade' && clip.t1 - time < T / 2) black = Math.max(black, 1 - (clip.t1 - time) / (T / 2));
      if (black > 0) {
        g.fillStyle = `rgba(0,0,0,${black.toFixed(3)})`;
        g.fillRect(0, 0, w, h);
      }
    }
    g.restore();
  }

  drawClip(g, k, u, kind) {
    const clip = this.timeline.clips[k];
    const s = this.sampler(k);
    this.prepare(clip);
    const { world: W, camera } = s.at(u);
    const w = this.width;
    const h = this.height;
    if (kind === 'pose') {
      drawOpenPose(g, W, camera, w, h);
      return;
    }
    const cam = kind === 'depth' ? camera.clone() : camera;
    const img = this.sr.renderPosed(W, s.ctx, cam, w, h, kind, clip.chars);
    g.drawImage(img, 0, 0, w, h);
    if (kind === 'render' && this.opts.lettering !== 'none') this.letter(g, k, u);
  }

  // Lettering: captions and SFX as on the page; dialogue as timed subtitles, or balloons that appear in turn.
  letter(g, k, u) {
    const clip = this.timeline.clips[k];
    const script = clip.script;
    if (!script) return;
    const w = this.width;
    const h = this.height;
    const sc = w / VW;
    const VH = h / sc;
    const s = this.sampler(k);
    if (!s.letterShot) {
      // obstacles from the start, middle and end of the shot; tails aim at the middle
      const people = [...s.analysis(1).people, ...s.analysis(0).people, ...s.analysis(0.5).people];
      s.letterShot = { analysis: { people } };
    }
    const pn = { poly: [[0, 0], [VW, 0], [VW, VH], [0, VH]], bbox: { x: 0, y: 0, w: VW, h: VH }, center: [VW / 2, VH / 2], occluders: [] };
    const times = lineTimes(script);
    const balloons = this.opts.lettering === 'balloons';
    const shown = balloons ? times.filter((x) => u >= x.start).map((x) => x.line) : [];
    const part = { ...script, dialogue: shown };
    if (part.dialogue.length || part.caption || part.sfx?.length) {
      letterPanel(g, sc, pn, s.letterShot, part, { dir: this.opts.dir, caps: this.opts.caps, seed: `video|${k}`, safe: { x: 0, y: 0, w: VW, h: VH } });
    }
    if (!balloons) {
      const cur = times.find((x) => u >= x.start && u < x.end + 0.03) || null;
      if (cur) this.subtitle(g, cur.line, clip.chars);
    }
  }

  subtitle(g, line, chars) {
    const w = this.width;
    const h = this.height;
    const fs = Math.max(14, Math.round(Math.min(w, h * 1.6) * 0.036));
    const name = line.speaker == null ? '' : line.speaker === -1 ? 'Off screen' : chars?.[line.speaker]?.name || '';
    const text = line.text.trim();
    g.save();
    g.font = `${line.speaker == null ? 'italic ' : ''}600 ${fs}px ${SUB_FONT}`;
    const lines = wrapText(g, (name ? `${name}: ` : '') + text, w * 0.8).slice(0, 3);
    const lh = fs * 1.3;
    const y0 = h - h * 0.07 - lines.length * lh;
    g.textAlign = 'center';
    g.textBaseline = 'top';
    g.lineJoin = 'round';
    g.lineWidth = Math.max(3, fs * 0.18);
    g.strokeStyle = 'rgba(0,0,0,0.85)';
    lines.forEach((l, i) => g.strokeText(l, w / 2, y0 + i * lh));
    g.fillStyle = '#fff';
    lines.forEach((l, i) => g.fillText(l, w / 2, y0 + i * lh));
    // speaker name in their colour
    if (name && lines.length) {
      const first = lines[0];
      const lw = g.measureText(first).width;
      const nm = `${name}:`;
      g.textAlign = 'left';
      g.fillStyle = chars?.[line.speaker]?.color || '#fff';
      g.strokeText(nm, w / 2 - lw / 2, y0);
      g.fillText(nm, w / 2 - lw / 2, y0);
    }
    g.restore();
  }

  // Encode the whole timeline. kind: 'render' | 'depth' | 'lineart' | 'pose'.
  async encode({ kind = 'render', fps = 24, onProgress, signal } = {}) {
    const c = document.createElement('canvas');
    c.width = this.width;
    c.height = this.height;
    const g = c.getContext('2d');
    const count = Math.max(1, Math.round(this.timeline.total * fps));
    return encodeFrames({ canvas: c, fps, count, signal, onProgress, draw: (i, t) => this.drawFrame(g, t, kind) });
  }
}
