// Renders storyboard pages: each panel gets its own 3D camera render, clipped to the
// panel shape, plus 2D guide overlays.

import * as THREE from 'three';
import { computeCamera, shotLabel } from './gacha.js';
import { posedWorld } from './pose-runtime.js';
import { buildProp, placeProp, setPropStyle } from './props.js';
import { extendPoly } from './print.js';

const CHAR_COLORS_FALLBACK = ['#e2735f', '#5a8fd8', '#6bb86b'];

export class StoryRenderer {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xffffff);
    const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8f9c, 1.6);
    this.scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 2.0);
    key.position.set(2, 4, 3);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xffffff, 0.6);
    rim.position.set(-3, 2, -2);
    this.scene.add(rim);
    this.floor = new THREE.GridHelper(20, 40, 0xc9ccd4, 0xe3e5ea);
    this.scene.add(this.floor);
    this.figures = [];
    this.style = 'shaded';
    this.propLayer = new THREE.Group();
    this.scene.add(this.propLayer);
    this.propPool = new Map();
  }

  setFigures(figures, chars) {
    for (const f of this.figures) this.scene.remove(f.root);
    this.figures = figures;
    figures.forEach((f, i) => {
      this.scene.add(f.root);
      f.setStyle(this.style, chars?.[i]?.color);
    });
  }

  setStyle(style, chars) {
    this.style = style;
    this.figures.forEach((f, i) => f.setStyle(style, chars?.[i]?.color || CHAR_COLORS_FALLBACK[i]));
    this.floor.visible = style !== 'silhouette';
    for (const list of this.propPool.values()) for (const g of list) setPropStyle(g, style);
  }

  poseFigures(spec, world, ctx) {
    const W = posedWorld(world, spec, ctx);
    W.people.forEach((p, i) => {
      const f = this.figures[i];
      if (!f) return;
      f.root.visible = true;
      f.root.position.copy(p.pos);
      f.root.rotation.set(0, p.yaw, 0);
      f.applyPose(p.pose, p.look);
    });
    for (let i = W.people.length; i < this.figures.length; i++) this.figures[i].root.visible = false;
    this.placeProps(W, ctx);
    return W;
  }

  // Props from poses (hands, seats...), panel holds, and page-level scene dressing.
  placeProps(W, ctx) {
    for (const list of this.propPool.values()) for (const g of list) g.visible = false;
    const used = new Map();
    const take = (id) => {
      const list = this.propPool.get(id) || [];
      this.propPool.set(id, list);
      const k = used.get(id) || 0;
      used.set(id, k + 1);
      if (!list[k]) {
        list[k] = buildProp(id, this.style);
        this.propLayer.add(list[k]);
      }
      list[k].visible = true;
      return list[k];
    };
    this.scene.updateMatrixWorld(true);
    W.people.forEach((p, i) => {
      for (const use of p.props || []) placeProp(take(use.id), use, p, this.figures[i]);
    });
    for (const use of ctx?.sceneProps || []) placeProp(take(use.id), { ...use, attach: 'world' }, null, null);
  }

  // Guide renders for image generation: 'render' (current style), 'depth', 'lineart', 'silhouette'.
  renderGuide(shot, world, w, h, kind, chars) {
    w = Math.max(2, Math.round(w));
    h = Math.max(2, Math.round(h));
    this.renderer.setSize(w, h, false);
    const { camera } = computeCamera(shot.spec, world, w / h, shot.ctx);
    this.poseFigures(shot.spec, world, shot.ctx);
    const prevStyle = this.style;
    const prevBg = this.scene.background;
    const floorVis = this.floor.visible;
    if (kind === 'depth') {
      let near = Infinity;
      let far = 0;
      for (const p of world.people) {
        const d = camera.position.distanceTo(p.head);
        near = Math.min(near, d);
        far = Math.max(far, d);
      }
      camera.near = Math.max(0.05, near - 1.2);
      camera.far = far + 2.5;
      camera.updateProjectionMatrix();
      camera.projectionMatrix.elements[8] = -shot.spec.fx;
      camera.projectionMatrix.elements[9] = -shot.spec.fy;
      this.scene.overrideMaterial = this.depthMat || (this.depthMat = new THREE.MeshDepthMaterial());
      this.scene.background = new THREE.Color(0x000000);
      this.floor.visible = false;
    } else if (kind === 'lineart' || kind === 'silhouette') {
      this.setStyle(kind, chars);
      this.floor.visible = false;
    }
    this.renderer.render(this.scene, camera);
    this.scene.overrideMaterial = null;
    this.scene.background = prevBg;
    if (kind === 'lineart' || kind === 'silhouette') this.setStyle(prevStyle, chars);
    this.floor.visible = floorVis;
    return this.renderer.domElement;
  }

  // Render one shot at w x h pixels; returns the WebGL canvas (valid until next render).
  // ext: {trim, area} boxes — frame the shot for `trim`, but render the larger `area` (print bleed).
  renderShot(shot, world, w, h, ext = null) {
    w = Math.max(2, Math.round(w));
    h = Math.max(2, Math.round(h));
    this.renderer.setSize(w, h, false);
    const { camera } = computeCamera(shot.spec, world, ext ? ext.trim.w / ext.trim.h : w / h, shot.ctx);
    if (ext) {
      const t = ext.trim;
      const e = ext.area;
      const ax = t.w / e.w;
      const ay = t.h / e.h;
      const bx = ax - 1 + (2 * (t.x - e.x)) / e.w;
      const by = 1 - ay - (2 * (t.y - e.y)) / e.h;
      const m = new THREE.Matrix4().set(ax, 0, 0, bx, 0, ay, 0, by, 0, 0, 1, 0, 0, 0, 0, 1);
      camera.projectionMatrix.premultiply(m);
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    }
    this.poseFigures(shot.spec, world, shot.ctx);
    this.renderer.render(this.scene, camera);
    return this.renderer.domElement;
  }
}

// --- page drawing ---------------------------------------------------------

function polyPath(ctx, poly, s) {
  ctx.beginPath();
  poly.forEach(([x, y], i) => (i ? ctx.lineTo(x * s, y * s) : ctx.moveTo(x * s, y * s)));
  ctx.closePath();
}

// A point just inside a panel's lower-left (or lower-right in rtl-agnostic terms) corner,
// valid for slanted quads and triangles alike.
export function labelPoint(pn, dist = 30) {
  let v = pn.poly[0];
  for (const q of pn.poly) if (q[1] - q[0] > v[1] - v[0]) v = q;
  const dx = pn.center[0] - v[0];
  const dy = pn.center[1] - v[1];
  const len = Math.hypot(dx, dy) || 1;
  const k = Math.min(dist * 1.5, len * 0.5) / len;
  return [v[0] + dx * k, v[1] + dy * k];
}

// Reading-order dot: inset from the bottom-left corner by the same amount on both axes, so it never
// straddles the frame (thin strips get it centred vertically). Page units.
export function dotPoint(pn, inset) {
  let v = pn.poly[0];
  for (const q of pn.poly) if (q[1] - q[0] > v[1] - v[0]) v = q;
  const dx = pn.center[0] - v[0];
  const dy = pn.center[1] - v[1];
  if (pn.tri) return [v[0] + dx * 0.4, v[1] + dy * 0.4];
  const b = pn.bbox;
  return [v[0] + Math.sign(dx) * Math.min(inset, b.w / 2), v[1] + Math.sign(dy) * Math.min(inset, b.h / 2)];
}

// The panel vertex nearest a corner of its box, pulled inward a little.
function cornerPoint(pn, which, dist) {
  const key = which === 'tl' ? (q) => -(q[0] + q[1]) : (q) => q[0] + q[1];
  let v = pn.poly[0];
  for (const q of pn.poly) if (key(q) > key(v)) v = q;
  const dx = pn.center[0] - v[0];
  const dy = pn.center[1] - v[1];
  // triangles have sharp corners, so walk further toward the centre
  if (pn.tri) return [v[0] + dx * 0.4, v[1] + dy * 0.4];
  return [v[0] + Math.sign(dx) * dist, v[1] + Math.sign(dy) * dist];
}

const UI_FONT = "'Inter Variable', system-ui, sans-serif";

export function scoreColor(v) {
  return v >= 85 ? '#18794e' : v >= 70 ? '#a35200' : '#cd2b31';
}

// opts: {scale, show:{...}, chars, selected:Set, hover, layoutGuide}
export function drawPage(ctx, sr, layout, prop, world, opts) {
  const s = opts.scale;
  const show = opts.show || {};
  const { W, H } = layout;
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, W * s, H * s);

  if (show.guide) {
    const f = layout.frame;
    ctx.setLineDash([6 * s, 6 * s]);
    ctx.strokeStyle = '#8fbdea';
    ctx.lineWidth = 1.5 * s;
    ctx.strokeRect(f.x * s, f.y * s, f.w * s, f.h * s);
    ctx.setLineDash([]);
  }

  // print bleed: panels touching the page edge grow out to the bleed line
  const bleedU = opts.bleed || 0;
  const outline = (pn) => (bleedU && Object.keys(pn.bleed || {}).length ? extendPoly(pn.poly, W, H, bleedU) : pn.poly);
  const boxOf = (poly) => {
    const xs = poly.map((q) => q[0]);
    const ys = poly.map((q) => q[1]);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
  };
  const drawArt = (pn, i) => {
    const shot = prop?.shots[i];
    const b = pn.bbox;
    const poly = outline(pn);
    const e = poly === pn.poly ? b : boxOf(poly);
    ctx.save();
    polyPath(ctx, poly, s);
    ctx.clip();
    const art = opts.panelImages?.[i];
    if (art) {
      // external artwork, cover-fit to the panel's bounding box (including any bleed)
      const k = Math.max(e.w / art.width, e.h / art.height);
      const dw = art.width * k;
      const dh = art.height * k;
      ctx.drawImage(art, (e.x + (e.w - dw) / 2) * s, (e.y + (e.h - dh) / 2) * s, dw * s, dh * s);
      if (shot) drawPanelOverlays(ctx, pn, shot, world, { ...opts, border: layout.border }, i);
    } else if (shot) {
      const img = sr.renderShot(shot, world, e.w * s, e.h * s, e === b ? null : { trim: b, area: e });
      ctx.drawImage(img, e.x * s, e.y * s, e.w * s, e.h * s);
      drawPanelOverlays(ctx, pn, shot, world, { ...opts, border: layout.border }, i);
    }
    ctx.restore();
    if (opts.highlight === i) {
      polyPath(ctx, pn.poly, s);
      ctx.fillStyle = 'rgba(255, 214, 0, 0.28)';
      ctx.fill();
    }
  };
  const frameOf = (pn) => {
    ctx.lineJoin = 'miter';
    ctx.strokeStyle = '#111';
    ctx.lineWidth = layout.border * s;
    if (!(bleedU && Object.keys(pn.bleed || {}).length)) {
      polyPath(ctx, pn.poly, s);
      ctx.stroke();
      return;
    }
    // print bleed: no frame line on edges that run off the page; inner edges reach the bleed line
    const ext = extendPoly(pn.poly, W, H, bleedU);
    const onEdge = ([x, y]) => [x <= 0.5 ? 'l' : x >= W - 0.5 ? 'r' : '', y <= 0.5 ? 't' : y >= H - 0.5 ? 'b' : ''];
    ctx.beginPath();
    pn.poly.forEach((p0, k) => {
      const k1 = (k + 1) % pn.poly.length;
      const a0 = onEdge(p0);
      const a1 = onEdge(pn.poly[k1]);
      const sameSide = (a0[0] && a0[0] === a1[0]) || (a0[1] && a0[1] === a1[1]);
      if (sameSide) return;
      ctx.moveTo(ext[k][0] * s, ext[k][1] * s);
      ctx.lineTo(ext[k1][0] * s, ext[k1][1] * s);
    });
    ctx.lineCap = 'butt';
    ctx.stroke();
  };

  // base panels, then their frames, then inset panels on top with a white halo
  layout.panels.forEach((pn, i) => { if (!pn.inset) drawArt(pn, i); });
  layout.panels.forEach((pn) => { if (!pn.inset) frameOf(pn); });
  layout.panels.forEach((pn, i) => {
    if (!pn.inset) return;
    polyPath(ctx, pn.poly, s);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = (layout.border + 14) * s;
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fill();
    drawArt(pn, i);
    frameOf(pn);
  });
  if (opts.selected?.size) {
    ctx.strokeStyle = opts.accent || '#0071e3';
    ctx.lineWidth = Math.max(3, layout.border + 3) * s;
    for (const i of opts.selected) {
      polyPath(ctx, layout.panels[i].poly, s);
      ctx.stroke();
    }
  }

  if (prop && (show.readLines || show.entryExit)) drawReadingFlow(ctx, layout, prop, s, show);
  if (show.orderNums) {
    layout.panels.forEach((pn, i) => {
      const u = opts.uiScale ?? s;
      const r = 10 * u;
      const [x, y] = dotPoint(pn, (20 * u) / s + layout.border).map((v) => v * s);
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
      ctx.shadowBlur = 3 * u;
      ctx.shadowOffsetY = 1 * u;
      ctx.fillStyle = opts.accent || '#0071e3';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#fff';
      ctx.font = `600 ${11.5 * u}px ${UI_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), x, y + 0.5 * u);
    });
  }
  ctx.restore();
}

function drawReadingFlow(ctx, layout, prop, s, show) {
  const pts = prop.shots.map((sh) => sh.ctx);
  if (show.readLines) {
    ctx.strokeStyle = 'rgba(235, 120, 30, 0.85)';
    ctx.lineWidth = 2.5 * s;
    ctx.setLineDash([10 * s, 6 * s]);
    ctx.beginPath();
    pts.forEach((c, i) => {
      const [x, y] = layout.panels[i].center;
      if (i === 0) ctx.moveTo(c.entryPx[0] * s, c.entryPx[1] * s);
      ctx.lineTo(x * s, y * s);
      if (i === pts.length - 1) ctx.lineTo(c.exitPx[0] * s, c.exitPx[1] * s);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  }
  if (show.entryExit) {
    for (const c of pts) {
      const [ex, ey] = c.entryPx;
      ctx.fillStyle = '#eb781e';
      ctx.beginPath();
      ctx.moveTo(ex * s, (ey - 9) * s);
      ctx.lineTo((ex + 8) * s, (ey + 6) * s);
      ctx.lineTo((ex - 8) * s, (ey + 6) * s);
      ctx.closePath();
      ctx.fill();
      const [xx, xy] = c.exitPx;
      ctx.strokeStyle = '#eb781e';
      ctx.lineWidth = 2.5 * s;
      ctx.beginPath();
      ctx.arc(xx * s, xy * s, 7 * s, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawPanelOverlays(ctx, pn, shot, world, opts, i) {
  const s = opts.scale;
  // UI chrome (chips, tags, badges) is sized in screen pixels when drawing for the screen, in page units for exports
  const u = opts.uiScale ?? s;
  const show = opts.show || {};
  const b = pn.bbox;
  const X = (u) => (b.x + u * b.w) * s;
  const Y = (v) => (b.y + v * b.h) * s;
  const an = shot.analysis;

  if (show.thirds) {
    ctx.strokeStyle = 'rgba(80, 140, 220, 0.45)';
    ctx.lineWidth = 1 * s;
    ctx.beginPath();
    for (const t of [1 / 3, 2 / 3]) {
      ctx.moveTo(X(t), Y(0)); ctx.lineTo(X(t), Y(1));
      ctx.moveTo(X(0), Y(t)); ctx.lineTo(X(1), Y(t));
    }
    ctx.stroke();
  }

  if (show.eyeLevel) {
    const cam = computeCamera(shot.spec, world, b.w / b.h, shot.ctx).camera;
    const fwd = new THREE.Vector3();
    cam.getWorldDirection(fwd);
    fwd.y = 0;
    if (fwd.lengthSq() > 1e-6) {
      fwd.normalize();
      const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      const p1 = cam.position.clone().add(fwd.clone().multiplyScalar(100)).add(right.clone().multiplyScalar(60)).project(cam);
      const p2 = cam.position.clone().add(fwd.clone().multiplyScalar(100)).add(right.clone().multiplyScalar(-60)).project(cam);
      const u1 = (p1.x + 1) / 2, v1 = (1 - p1.y) / 2, u2 = (p2.x + 1) / 2, v2 = (1 - p2.y) / 2;
      ctx.strokeStyle = 'rgba(30, 160, 150, 0.8)';
      ctx.setLineDash([5 * s, 5 * s]);
      ctx.lineWidth = 1.5 * s;
      ctx.beginPath();
      const du = u2 - u1, dv = v2 - v1;
      ctx.moveTo(X(u1 - du * 5), Y(v1 - dv * 5));
      ctx.lineTo(X(u2 + du * 5), Y(v2 + dv * 5));
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  if (show.axis && world.n >= 2) {
    const A = an.people[0];
    const B = an.people[1];
    if (!A.behind && !B.behind) {
      ctx.strokeStyle = 'rgba(150, 70, 200, 0.85)';
      ctx.setLineDash([4 * s, 4 * s]);
      ctx.lineWidth = 2 * s;
      ctx.beginPath();
      ctx.moveTo(X(A.u), Y(A.v));
      ctx.lineTo(X(B.u), Y(B.v));
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  if (show.balloons && shot.balloon && !opts.skipBalloons?.has(i)) {
    const bl = shot.balloon;
    ctx.strokeStyle = 'rgba(40, 40, 40, 0.75)';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    ctx.lineWidth = 2 * s;
    ctx.setLineDash([6 * s, 4 * s]);
    ctx.beginPath();
    ctx.ellipse(X(bl.u), Y(bl.v), bl.ru * b.w * s, bl.rv * b.h * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
  }

  if (show.gaze) {
    for (const p of an.people) {
      if (!p.inFrame) continue;
      const len = Math.hypot(p.gaze.du * b.w, p.gaze.dv * b.h);
      const L = 46;
      ctx.strokeStyle = '#d4483b';
      ctx.fillStyle = '#d4483b';
      ctx.lineWidth = 2 * s;
      if (len > 4) {
        const ux = (p.gaze.du * b.w) / len, uy = (p.gaze.dv * b.h) / len;
        const x0 = X(p.u), y0 = Y(p.v);
        const x1 = x0 + ux * L * s, y1 = y0 + uy * L * s;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 - (ux * 9 - uy * 5) * s, y1 - (uy * 9 + ux * 5) * s);
        ctx.lineTo(x1 - (ux * 9 + uy * 5) * s, y1 - (uy * 9 - ux * 5) * s);
        ctx.fill();
      }
      ctx.font = `700 ${14 * s}px ${UI_FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (p.faceVis > 0.75) ctx.fillText('◎', X(p.u), Y(p.v) - 0);
      else if (p.faceVis < -0.3) ctx.fillText('×', X(p.u), Y(p.v));
    }
  }

  // Chips, tags and badges never overlap: each one claims a rectangle, and name tags move to a free spot.
  const occ = [];
  const hits = (r) => occ.some((o) => r.x < o.x + o.w && o.x < r.x + r.w && r.y < o.y + o.h && o.y < r.y + r.h);
  const pad = 3 * u;
  const claim = (x, y, w, h) => occ.push({ x: x - pad, y: y - pad, w: w + 2 * pad, h: h + 2 * pad });
  if (show.orderNums) {
    const [lx, ly] = dotPoint(pn, (20 * u) / s + (opts.border || 0)).map((v) => v * s);
    claim(lx - 10 * u, ly - 10 * u, 20 * u, 20 * u);
  }

  if (show.roles) {
    // full label if it fits, else just the shot, else nothing
    ctx.font = `500 ${11 * u}px ${UI_FONT}`;
    const room = b.w * s - 24 * u;
    const full = shotLabel(shot);
    const label = [full, full.split(' · ').pop()].find((t) => ctx.measureText(t).width + 14 * u <= room);
    const h = 19 * u;
    if (label && b.h * s >= h + 10 * u) {
      const tw = ctx.measureText(label).width;
      const edge = (opts.border || 0) * s;
      const inset = Math.min(9 * u, (b.h * s - 2 * edge - h) / 2);
      const [vx, vy] = cornerPoint(pn, 'tl', 0);
      const [cx, cy] = pn.tri ? cornerPoint(pn, 'tl', 0).map((v) => v * s) : [vx * s + edge + 9 * u, vy * s + edge + inset];
      let x = cx;
      const y = cy;
      const w = tw + 14 * u;
      while (hits({ x, y, w, h }) && x + w < X(1) - 8 * u) x += 4 * u;
      claim(x, y, w, h);
      ctx.fillStyle = 'rgba(29, 29, 31, 0.78)';
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 6 * u);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + 7 * u, y + 10 * u);
    }
  }

  if (show.scores) {
    const t = String(shot.total) + (shot.sideOk ? '' : '!');
    ctx.font = `600 ${11 * u}px ${UI_FONT}`;
    const tw = ctx.measureText(t).width;
    const [cx, cy] = cornerPoint(pn, 'br', (9 * u) / s + (opts.border || 0));
    const w = Math.max(tw + 12 * u, 26 * u);
    const h = 18 * u;
    const x = cx * s - w;
    const y = cy * s - h;
    claim(x, y, w, h);
    ctx.fillStyle = scoreColor(shot.total);
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t, x + w / 2, y + h / 2 + 0.5 * u);
  }

  if (show.names) {
    const top = Y(0) + 4 * u;
    const bottom = Y(1) - 4 * u;
    const left = X(0) + 4 * u;
    const right = X(1) - 4 * u;
    for (const p of an.people) {
      if (!p.inFrame) continue;
      const name = opts.chars?.[p.i]?.name || `Char ${p.i + 1}`;
      ctx.font = `600 ${11 * u}px ${UI_FONT}`;
      const w = ctx.measureText(name).width + 22 * u;
      const h = 18 * u;
      if (w > right - left || h * 2 > bottom - top) continue;
      // preferred spot just above the head, then nudged down, sideways, or up until it is free
      const x0 = Math.min(right - w / 2, Math.max(left + w / 2, X(p.u)));
      const y0 = Math.min(bottom - h / 2, Math.max(top + h / 2, Y(Math.max(0.03, p.topV - 0.02))));
      const step = h + 4 * u;
      const tries = [[0, 0], [0, step], [0, 2 * step], [w * 0.6, 0], [-w * 0.6, 0], [w * 0.6, step], [-w * 0.6, step], [0, -step], [w * 1.1, 0], [-w * 1.1, 0]];
      const spot = tries.map(([dx, dy]) => [x0 + dx, y0 + dy])
        .find(([x, y]) => x - w / 2 >= left && x + w / 2 <= right && y - h / 2 >= top && y + h / 2 <= bottom && !hits({ x: x - w / 2, y: y - h / 2, w, h }));
      if (!spot) continue;
      const [x, y] = spot;
      claim(x - w / 2, y - h / 2, w, h);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
      ctx.lineWidth = 1 * u;
      ctx.beginPath();
      ctx.roundRect(x - w / 2, y - h / 2, w, h, h / 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = opts.chars?.[p.i]?.color || '#333';
      ctx.beginPath();
      ctx.arc(x - w / 2 + 8.5 * u, y, 3.5 * u, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#1d1d1f';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(name, x + 5 * u, y + 0.5 * u);
    }
  }
}

// --- SVG export: frames, panel art, balloons on separate layers -------------

export function pageToSVG(sr, layout, prop, world, show, chars) {
  const { W, H } = layout;
  const parts = [`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`];
  parts.push(`<rect id="paper" width="${W}" height="${H}" fill="#fff"/>`);
  parts.push('<defs>');
  layout.panels.forEach((pn, i) => parts.push(`<clipPath id="clip${i}"><polygon points="${pts(pn.poly)}"/></clipPath>`));
  parts.push('</defs>');
  parts.push('<g id="figures">');
  const scale = 2;
  layout.panels.forEach((pn, i) => {
    const shot = prop.shots[i];
    const b = pn.bbox;
    const c = document.createElement('canvas');
    c.width = Math.round(b.w * scale);
    c.height = Math.round(b.h * scale);
    c.getContext('2d').drawImage(sr.renderShot(shot, world, c.width, c.height), 0, 0);
    parts.push(`<image clip-path="url(#clip${i})" x="${b.x.toFixed(1)}" y="${b.y.toFixed(1)}" width="${b.w.toFixed(1)}" height="${b.h.toFixed(1)}" xlink:href="${c.toDataURL('image/png')}"/>`);
  });
  parts.push('</g>');
  parts.push('<g id="balloons" fill="#fff" stroke="#222" stroke-width="2">');
  layout.panels.forEach((pn, i) => {
    const bl = prop.shots[i].balloon;
    if (!bl) return;
    const b = pn.bbox;
    parts.push(`<ellipse cx="${(b.x + bl.u * b.w).toFixed(1)}" cy="${(b.y + bl.v * b.h).toFixed(1)}" rx="${(bl.ru * b.w).toFixed(1)}" ry="${(bl.rv * b.h).toFixed(1)}" clip-path="url(#clip${i})"/>`);
  });
  parts.push('</g>');
  parts.push(`<g id="frames" fill="none" stroke="#111" stroke-width="${layout.border}">`);
  for (const pn of layout.panels) parts.push(`<polygon points="${pts(pn.poly)}"/>`);
  parts.push('</g>');
  parts.push('<g id="labels" font-family="sans-serif" font-size="12" fill="#333">');
  layout.panels.forEach((pn, i) => parts.push(`<text x="${(pn.bbox.x + 10).toFixed(1)}" y="${(pn.bbox.y + 22).toFixed(1)}">${i + 1}. ${escapeXml(shotLabel(prop.shots[i]))}</text>`));
  parts.push('</g></svg>');
  return parts.join('');
}

const pts = (poly) => poly.map((q) => q.map((v) => v.toFixed(1)).join(',')).join(' ');
const escapeXml = (t) => t.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]);
