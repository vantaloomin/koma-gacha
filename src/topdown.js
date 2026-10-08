// Top-down floor plan: characters, conversation axis, and each panel's camera wedge.

import { computeCamera } from './gacha.js';

export class TopDown {
  constructor(canvas, { onMove, onSelectChar }) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.onMove = onMove;
    this.onSelectChar = onSelectChar;
    this.scale = 70; // px per metre
    this.drag = null;
    this.activeChar = null;
    this.data = null;
    canvas.tabIndex = 0;
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', () => this.up());
    canvas.addEventListener('pointercancel', () => this.up());
    canvas.addEventListener('keydown', (e) => this.key(e));
  }

  // world -> canvas: camera side (+normal) at the bottom
  toPx(x, z) {
    const { W, H } = this;
    return [W / 2 + (x - this.cx) * this.scale, H / 2 + (z - this.cz) * this.scale];
  }
  toWorld(px, py) {
    return [(px - this.W / 2) / this.scale + this.cx, (py - this.H / 2) / this.scale + this.cz];
  }

  evtPos(e) {
    const r = this.c.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * this.W, ((e.clientY - r.top) / r.height) * this.H];
  }

  down(e) {
    if (!this.data) return;
    const [px, py] = this.evtPos(e);
    const { chars } = this.data;
    for (let i = chars.length - 1; i >= 0; i--) {
      const [x, y] = this.toPx(chars[i].x, chars[i].z);
      if (Math.hypot(px - x, py - y) < 16) {
        this.drag = { i };
        this.activeChar = i;
        this.c.setPointerCapture(e.pointerId);
        this.c.focus();
        this.draw(this.data);
        return;
      }
    }
    this.activeChar = null;
    this.draw(this.data);
  }

  move(e) {
    if (!this.drag) return;
    const [px, py] = this.evtPos(e);
    const [x, z] = this.toWorld(px, py);
    this.onMove(this.drag.i, Math.round(x * 100) / 100, Math.round(z * 100) / 100, true);
  }

  up() {
    if (this.drag) {
      const ch = this.data.chars[this.drag.i];
      this.onMove(this.drag.i, ch.x, ch.z, false);
    }
    this.drag = null;
  }

  key(e) {
    if (this.activeChar == null || !this.data) return;
    const step = e.shiftKey ? 0.2 : 0.05;
    const ch = this.data.chars[this.activeChar];
    let { x, z } = ch;
    if (e.key === 'ArrowLeft') x -= step;
    else if (e.key === 'ArrowRight') x += step;
    else if (e.key === 'ArrowUp') z -= step;
    else if (e.key === 'ArrowDown') z += step;
    else return;
    e.preventDefault();
    this.onMove(this.activeChar, Math.round(x * 100) / 100, Math.round(z * 100) / 100, false);
  }

  // data: {chars, world, layout, prop, selected:Set}
  draw(data) {
    this.data = data;
    const { ctx } = this;
    // sharp at any size: draw in CSS pixels on a devicePixelRatio backing store
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = (this.W = this.c.clientWidth || 420);
    const H = (this.H = Math.round(W * 0.72));
    if (this.c.width !== Math.round(W * dpr) || this.c.height !== Math.round(H * dpr)) {
      this.c.width = Math.round(W * dpr);
      this.c.height = Math.round(H * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.scale = 70 * (W / 420);
    const { chars, world, layout, prop, selected } = data;
    if (!this.drag) {
      this.cx = world.mid.x;
      this.cz = world.mid.z + 0.9;
    }
    const css = getComputedStyle(document.documentElement);
    const v = (n) => css.getPropertyValue(n).trim();
    const accent = v('--accent') || '#0a84ff';
    ctx.fillStyle = v('--td-bg') || '#111113';
    ctx.fillRect(0, 0, W, H);

    // grid, 0.5 m
    ctx.strokeStyle = v('--td-grid');
    ctx.lineWidth = 1;
    ctx.beginPath();
    const [gx0, gz0] = this.toWorld(0, 0);
    for (let x = Math.floor(gx0 * 2) / 2; x < gx0 + W / this.scale; x += 0.5) {
      const [px] = this.toPx(x, 0);
      ctx.moveTo(px, 0); ctx.lineTo(px, H);
    }
    for (let z = Math.floor(gz0 * 2) / 2; z < gz0 + H / this.scale; z += 0.5) {
      const [, py] = this.toPx(0, z);
      ctx.moveTo(0, py); ctx.lineTo(W, py);
    }
    ctx.stroke();

    // axis
    if (world.n >= 2) {
      const a = world.people[0].pos;
      const b = world.people[1].pos;
      const dx = b.x - a.x, dz = b.z - a.z;
      const [x1, y1] = this.toPx(a.x - dx * 3, a.z - dz * 3);
      const [x2, y2] = this.toPx(b.x + dx * 3, b.z + dz * 3);
      ctx.strokeStyle = v('--td-axis');
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = v('--td-axis');
      ctx.font = '11px Inter Variable, system-ui, sans-serif';
      ctx.fillText('conversation axis', 10, 18);
    }

    // cameras
    if (prop) {
      prop.shots.forEach((shot, i) => {
        const b = layout.panels[i].bbox;
        const aspect = b.w / b.h;
        const { camera } = computeCamera(shot.spec, world, aspect, shot.ctx);
        const dir = camera.getWorldDirection(camera.position.clone());
        const yaw = Math.atan2(dir.x, dir.z);
        const vf = (camera.fov * Math.PI) / 180;
        const hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
        const [px, py] = this.toPx(camera.position.x, camera.position.z);
        const len = 46;
        const sel = selected?.has(i);
        ctx.fillStyle = sel ? accent + '40' : v('--td-cam-fill');
        ctx.strokeStyle = sel ? accent : v('--td-cam');
        ctx.lineWidth = sel ? 2 : 1;
        ctx.beginPath();
        ctx.moveTo(px, py);
        for (const a of [yaw - hf / 2, yaw + hf / 2]) ctx.lineTo(px + Math.sin(a) * len, py + Math.cos(a) * len);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = sel ? accent : v('--td-cam-dot');
        ctx.beginPath(); ctx.arc(px, py, 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = sel ? '#fff' : v('--td-cam-num');
        ctx.font = '600 11px Inter Variable, system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(i + 1), px, py + 0.5);
      });
    }

    // characters
    world.people.forEach((p, i) => {
      const [x, y] = this.toPx(p.pos.x, p.pos.z);
      const col = chars[i].color;
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(x, y, 12, 0, Math.PI * 2); ctx.fill();
      if (this.activeChar === i) {
        ctx.strokeStyle = v('--td-text'); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + p.fwd.x * 26, y + p.fwd.z * 26); ctx.stroke();
      ctx.fillStyle = v('--td-text');
      ctx.font = '600 11px Inter Variable, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(chars[i].name, x, y + 16);
    });
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = v('--td-muted');
    ctx.font = '11px Inter Variable, system-ui, sans-serif';
    ctx.fillText('grid 0.5 m', W - 66, H - 8);
  }
}
