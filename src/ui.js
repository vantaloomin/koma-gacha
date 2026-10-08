// Shared UI chrome: icons, theme, toasts, popover menus and pane tabs.
import {
  createElement, Dices, LayoutGrid, Clapperboard, PersonStanding, Sun, Moon, Monitor, Info, Undo2, Trash2, Download,
  Image as ImageIcon, Link, FileJson, Printer, FileImage, Users, X, RotateCcw, Plus, Lock, LockOpen, Pencil, Check, ChevronDown,
  ChevronLeft, ChevronRight, Search, Sparkles, Copy, Upload, FlipHorizontal2, Save, Camera, Map as MapIcon, Eye, Gauge,
  SlidersHorizontal, Shuffle, ExternalLink, MousePointerClick, Columns2, Square, PanelsTopLeft, FileCode, Accessibility,
  Package, CircleCheck, TriangleAlert, Wand2, Type,
} from 'lucide';

const ICONS = {
  dices: Dices, grid: LayoutGrid, board: Clapperboard, pose: PersonStanding, sun: Sun, moon: Moon, monitor: Monitor,
  info: Info, undo: Undo2, trash: Trash2, download: Download, image: ImageIcon, link: Link, json: FileJson, print: Printer,
  png: FileImage, svg: FileCode, users: Users, x: X, reset: RotateCcw, plus: Plus, lock: Lock, unlock: LockOpen,
  pencil: Pencil, check: Check, down: ChevronDown, left: ChevronLeft, right: ChevronRight, search: Search,
  sparkles: Sparkles, copy: Copy, upload: Upload, mirror: FlipHorizontal2, save: Save, camera: Camera, map: MapIcon,
  eye: Eye, gauge: Gauge, sliders: SlidersHorizontal, shuffle: Shuffle, external: ExternalLink, click: MousePointerClick,
  compare: Columns2, single: Square, layout: PanelsTopLeft, tpose: Accessibility, prop: Package, ok: CircleCheck,
  warn: TriangleAlert, wand: Wand2, type: Type,
};

export function icon(name, size = 16) {
  const node = ICONS[name];
  if (!node) return document.createTextNode('');
  const svg = createElement(node, { width: size, height: size, 'stroke-width': size <= 14 ? 2.25 : 2, 'aria-hidden': 'true', class: 'ico' });
  return svg;
}

// <i data-icon="name" data-size="16"></i> → inline SVG
export function hydrateIcons(root = document) {
  for (const i of root.querySelectorAll('i[data-icon]')) {
    const svg = icon(i.dataset.icon, Number(i.dataset.size) || 16);
    if (i.className) svg.classList.add(...i.classList);
    i.replaceWith(svg);
  }
}

// ---------------------------------------------------------------- theme

const THEME_KEY = 'ng:theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');
const readTheme = () => { try { return JSON.parse(localStorage.getItem(THEME_KEY)) || 'system'; } catch { return 'system'; } };
let themePref = readTheme();

export const isDark = () => document.documentElement.dataset.scheme === 'dark';

function applyTheme() {
  const html = document.documentElement;
  const scheme = themePref === 'system' ? (media.matches ? 'dark' : 'light') : themePref;
  if (themePref === 'system') delete html.dataset.theme;
  else html.dataset.theme = themePref;
  const changed = html.dataset.scheme !== scheme;
  html.dataset.scheme = scheme;
  const btn = document.getElementById('theme-toggle');
  for (const b of document.querySelectorAll('[data-theme-pick]')) b.setAttribute('aria-checked', String(b.dataset.themePick === themePref));
  if (btn) {
    btn.replaceChildren(icon(themePref === 'system' ? 'monitor' : themePref === 'dark' ? 'moon' : 'sun', 18));
    const label = `Appearance: ${themePref === 'system' ? 'match system' : themePref}`;
    btn.title = label;
    btn.setAttribute('aria-label', label);
  }
  if (changed) window.dispatchEvent(new CustomEvent('ng-theme', { detail: { scheme } }));
}
media.addEventListener('change', applyTheme);
applyTheme();

export function initTheme() {
  applyTheme();
  for (const b of document.querySelectorAll('[data-theme-pick]')) {
    b.addEventListener('click', () => {
      themePref = b.dataset.themePick;
      try { localStorage.setItem(THEME_KEY, JSON.stringify(themePref)); } catch { /* storage unavailable */ }
      applyTheme();
    });
  }
}

// CSS custom property as a string (for canvas drawing that follows the theme)
export const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// ---------------------------------------------------------------- toasts

export function toast(text, { icon: ic = 'ok', ms, action } = {}) {
  ms ??= action ? 5000 : 2200;
  let host = document.getElementById('toasts');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toasts';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    host.popover = 'manual';
    document.body.append(host);
  }
  // re-show so the host sits above whatever modal is open now (top layer is last-shown-on-top)
  if (host.matches(':popover-open')) host.hidePopover();
  host.showPopover();
  const t = document.createElement('div');
  t.className = 'toast';
  t.append(icon(ic, 16), Object.assign(document.createElement('span'), { textContent: text }));
  const dismiss = () => {
    if (t.__gone) return;
    t.__gone = true;
    t.classList.remove('in');
    setTimeout(() => { t.remove(); if (!host.childElementCount && host.matches(':popover-open')) host.hidePopover(); }, 300);
  };
  if (action) {
    const b = Object.assign(document.createElement('button'), { className: 'toast-action', textContent: action.label });
    b.addEventListener('click', () => { action.onClick(); dismiss(); });
    t.append(b);
    t.classList.add('has-action');
  }
  host.append(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(dismiss, ms);
}

// ---------------------------------------------------------------- popover menus

// <button data-menu="id"> opens <div id="id" popover class="menu">, anchored under the button.
export function initMenus(root = document) {
  for (const btn of root.querySelectorAll('[data-menu]')) {
    const menu = document.getElementById(btn.dataset.menu);
    if (!menu) continue;
    btn.setAttribute('aria-haspopup', 'menu');
    btn.addEventListener('click', () => {
      if (menu.matches(':popover-open')) { menu.hidePopover(); return; }
      menu.showPopover();
      const r = btn.getBoundingClientRect();
      const mw = menu.offsetWidth;
      const left = Math.max(8, Math.min(window.innerWidth - mw - 8, r.right - mw));
      menu.style.left = left + 'px';
      menu.style.top = r.bottom + 6 + 'px';
      menu.querySelector('button:not([disabled])')?.focus({ preventScroll: true });
    });
    menu.addEventListener('toggle', (e) => btn.setAttribute('aria-expanded', String(e.newState === 'open')));
    menu.addEventListener('click', (e) => { if (e.target.closest('button')) menu.hidePopover(); });
    menu.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      const items = [...menu.querySelectorAll('button:not([disabled])')];
      const k = items.indexOf(document.activeElement);
      items[(k + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
    });
  }
}

// ---------------------------------------------------------------- pane tabs

// <div class="ptabs" data-ptabs="group"><button data-pane="a">…</button></div> toggles [data-ptab-group="group"][data-pane]
export function initPaneTabs(root = document, onChange = () => {}) {
  const api = {};
  for (const bar of root.querySelectorAll('[data-ptabs]')) {
    const group = bar.dataset.ptabs;
    const show = (pane) => {
      for (const b of bar.querySelectorAll('button[data-pane]')) {
        const on = b.dataset.pane === pane;
        b.classList.toggle('on', on);
        b.setAttribute('aria-selected', String(on));
      }
      for (const p of root.querySelectorAll(`[data-ptab-group="${group}"]`)) p.hidden = p.dataset.pane !== pane;
      try { localStorage.setItem('ng:ptab:' + group, JSON.stringify(pane)); } catch { /* storage unavailable */ }
      onChange(group, pane);
    };
    bar.setAttribute('role', 'tablist');
    for (const b of bar.querySelectorAll('button[data-pane]')) {
      b.setAttribute('role', 'tab');
      b.addEventListener('click', () => show(b.dataset.pane));
    }
    let initial = bar.querySelector('button[data-pane]')?.dataset.pane;
    try { initial = JSON.parse(localStorage.getItem('ng:ptab:' + group)) || initial; } catch { /* storage unavailable */ }
    if (!bar.querySelector(`button[data-pane="${initial}"]`)) initial = bar.querySelector('button[data-pane]')?.dataset.pane;
    show(initial);
    api[group] = show;
  }
  return api;
}

// ---------------------------------------------------------------- range fill

// Sliders draw their filled part from --p; keep it in sync however the value changes.
function fillRange(r) {
  const min = Number(r.min || 0);
  const max = Number(r.max || 100);
  const p = max > min ? ((Number(r.value) - min) / (max - min)) * 100 : 0;
  r.style.setProperty('--p', `${Math.max(0, Math.min(100, p))}%`);
}
const valueDesc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
Object.defineProperty(HTMLInputElement.prototype, 'value', {
  ...valueDesc,
  set(v) { valueDesc.set.call(this, v); if (this.type === 'range') fillRange(this); },
});
document.addEventListener('input', (e) => { if (e.target.type === 'range') fillRange(e.target); }, true);
new MutationObserver((muts) => {
  for (const m of muts) for (const n of m.addedNodes) {
    if (n.nodeType !== 1) continue;
    if (n.matches('input[type=range]')) fillRange(n);
    n.querySelectorAll?.('input[type=range]').forEach(fillRange);
  }
}).observe(document.documentElement, { childList: true, subtree: true });
document.querySelectorAll('input[type=range]').forEach(fillRange);

// ---------------------------------------------------------------- motion helpers
// Everything here decorates an action that has already happened: nothing waits for an animation,
// nothing blocks input, and prefers-reduced-motion turns it all off.

export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE_OUT = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

export function fadeIn(el, { from = 0.35, y = 0, scale = 1, duration = 160, delay = 0 } = {}) {
  if (!el || reducedMotion()) return;
  el.animate([{ opacity: from, transform: `translateY(${y}px) scale(${scale})` }, { opacity: 1, transform: 'none' }],
    { duration, delay, easing: EASE_OUT, fill: 'backwards' });
}

// A small "no" for actions that cannot run (nothing selected, nothing to undo).
export function shake(el) {
  if (!el || reducedMotion()) return;
  el.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-4px)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(2px)' }, { transform: 'translateX(0)' }],
    { duration: 320, easing: 'ease-out' });
}

// Spin the icon inside a button (dice on roll).
export function spinIcon(btn) {
  const svg = btn?.querySelector('svg');
  if (!svg || reducedMotion()) return;
  svg.animate([{ transform: 'rotate(0deg) scale(1)' }, { transform: 'rotate(200deg) scale(0.86)', offset: 0.45 }, { transform: 'rotate(360deg) scale(1)' }],
    { duration: 520, easing: EASE_OUT });
}

// Swap a button's icon for a check mark for a moment (copy confirmations).
export function confirmIcon(btn, name = 'check', ms = 1300) {
  const svg = btn?.__origIcon || btn?.querySelector('svg');
  if (!svg) return;
  btn.__origIcon = svg;
  const shown = btn.querySelector('svg');
  const next = icon(name, Number(svg.getAttribute('width')) || 16);
  next.classList.add('pop');
  shown.replaceWith(next);
  clearTimeout(btn.__iconTimer);
  btn.__iconTimer = setTimeout(() => { next.replaceWith(svg); btn.__origIcon = null; }, ms);
}

// Animate a number in an element from its previous value to `to`.
export function countTo(el, to, duration = 380) {
  const from = Number(el.dataset.value ?? to);
  el.dataset.value = to;
  if (from === to || reducedMotion()) { el.textContent = String(to); return; }
  const t0 = performance.now();
  const step = (t) => {
    const k = Math.min(1, (t - t0) / duration);
    const e = 1 - (1 - k) ** 3;
    el.textContent = String(Math.round(from + (to - from) * e));
    if (k < 1 && el.isConnected) requestAnimationFrame(step);
  };
  el.textContent = String(from);
  requestAnimationFrame(step);
}

// Run `fn` right after the browser paints the current frame, so a pressed state or icon motion is on
// screen before heavy work starts. One frame, never more.
export const afterPaint = (fn) => requestAnimationFrame(() => setTimeout(fn, 0));

// Snapshot a canvas, let `redraw` replace its contents, then dissolve the old picture away.
export function crossfadeCanvas(canvas, redraw) {
  if (reducedMotion() || !canvas.width || !canvas.offsetWidth) { redraw(); return; }
  const snap = document.createElement('canvas');
  snap.width = canvas.width;
  snap.height = canvas.height;
  snap.getContext('2d').drawImage(canvas, 0, 0);
  const w = canvas.style.width;
  redraw();
  if (canvas.width !== snap.width || canvas.height !== snap.height || canvas.style.width !== w) return;
  snap.className = 'crossfade';
  snap.style.width = w;
  canvas.after(snap);
  snap.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 220, easing: 'ease-out' }).onfinish = () => snap.remove();
}

// ---------------------------------------------------------------- sliding segmented controls

// .tabs, .seg and .ptabs get one "thumb" that slides to the selected button instead of the
// highlight jumping. Selection itself is instant; only the thumb travels.
export function initSegThumbs() {
  const setup = (c) => {
    if (c.__thumb) return;
    const t = document.createElement('span');
    t.className = 'seg-thumb';
    t.setAttribute('aria-hidden', 'true');
    c.prepend(t);
    c.__thumb = t;
    c.classList.add('has-thumb');
    let shown = false;
    const place = (animate) => {
      const on = c.querySelector(':scope > button.on');
      if (!on || !on.offsetWidth) { t.style.opacity = '0'; shown = false; return; }
      const anim = animate && shown && !reducedMotion();
      if (!anim) t.style.transition = 'none';
      t.style.width = on.offsetWidth + 'px';
      t.style.height = on.offsetHeight + 'px';
      t.style.transform = `translate(${on.offsetLeft}px, ${on.offsetTop}px)`;
      t.style.opacity = '1';
      if (!anim) { void t.offsetWidth; t.style.transition = ''; }
      shown = true;
    };
    new MutationObserver(() => place(true)).observe(c, { subtree: true, attributes: true, attributeFilter: ['class'], childList: true });
    new ResizeObserver(() => place(false)).observe(c);
    place(false);
  };
  const scan = (root) => {
    if (root.matches?.('.tabs, .seg, .ptabs')) setup(root);
    root.querySelectorAll?.('.tabs, .seg, .ptabs').forEach(setup);
  };
  scan(document);
  new MutationObserver((muts) => { for (const m of muts) for (const n of m.addedNodes) if (n.nodeType === 1) scan(n); })
    .observe(document.body, { childList: true, subtree: true });
}

// ---------------------------------------------------------------- tooltips

// Native title tooltips are slow and unstyled. Anything with a title (or data-tip) gets a quick,
// styled tooltip instead: 450 ms the first time, instant while moving between controls, also on
// keyboard focus. data-kbd adds a shortcut hint.
export function initTooltips() {
  const tip = document.createElement('div');
  tip.id = 'tooltip';
  tip.setAttribute('role', 'tooltip');
  document.body.append(tip);
  let timer = null;
  let current = null;
  let warmUntil = 0;
  const adopt = (el) => {
    if (el.hasAttribute('title')) {
      const t = el.getAttribute('title');
      el.removeAttribute('title');
      if (t) el.dataset.tip = t;
      const field = el.matches('input, select, textarea');
      const labelled = el.hasAttribute('aria-label') || el.hasAttribute('aria-labelledby') || (field && (el.closest('label') || (el.id && document.querySelector(`label[for="${el.id}"]`))));
      if (t && !labelled && (field || !el.textContent.trim())) el.setAttribute('aria-label', t);
      else if (t && !el.hasAttribute('aria-description')) el.setAttribute('aria-description', t);
    }
    return el.dataset.tip;
  };
  const hide = () => {
    clearTimeout(timer);
    if (tip.classList.contains('in')) warmUntil = performance.now() + 700;
    current = null;
    tip.classList.remove('in');
  };
  const show = (el) => {
    const text = el.dataset.tip;
    if (!text || !el.isConnected || !el.offsetWidth) return;
    tip.replaceChildren(document.createTextNode(text));
    if (el.dataset.kbd) tip.append(Object.assign(document.createElement('kbd'), { textContent: el.dataset.kbd }));
    const r = el.getBoundingClientRect();
    const tw = tip.offsetWidth;
    const th = tip.offsetHeight;
    const below = r.bottom + 8 + th < window.innerHeight;
    tip.style.left = Math.round(Math.max(8, Math.min(window.innerWidth - tw - 8, r.left + r.width / 2 - tw / 2))) + 'px';
    tip.style.top = Math.round(below ? r.bottom + 8 : r.top - th - 8) + 'px';
    tip.dataset.side = below ? 'below' : 'above';
    tip.classList.add('in');
  };
  const enter = (el) => {
    if (el === current) return;
    clearTimeout(timer);
    if (!adopt(el)) return;
    const warm = performance.now() < warmUntil || tip.classList.contains('in');
    current = el;
    tip.classList.remove('in');
    timer = setTimeout(() => show(el), warm ? 0 : 450);
  };
  const targetOf = (n) => n?.closest?.('[title], [data-tip]');
  document.addEventListener('pointerover', (e) => {
    if (e.pointerType === 'touch') return;
    const el = targetOf(e.target);
    if (el) enter(el);
    else if (current) hide();
  });
  document.addEventListener('pointerout', (e) => { if (current && !current.contains(e.relatedTarget)) hide(); });
  document.addEventListener('pointerdown', hide, true);
  document.addEventListener('keydown', (e) => { if (e.key !== 'Tab' && e.key !== 'Shift') hide(); }, true);
  document.addEventListener('scroll', hide, true);
  document.addEventListener('focusin', (e) => {
    const el = targetOf(e.target);
    if (el && e.target.matches(':focus-visible')) enter(el);
  });
  document.addEventListener('focusout', hide);
}

// ---------------------------------------------------------------- type-in slider values

// Every `label.slider` shows its value in an <output>. Clicking that number (or pressing Enter on a
// focused slider) swaps it for a small text field: type a value, Enter or click away to apply, Esc to
// cancel. The value is clamped to the slider's range and fed back through the slider's own
// input/change events, so every existing handler (and undo, saving, redraws) just works.
export function initValueEditing() {
  const open = (range, output) => {
    if (!range || !output || output.hidden || range.disabled) return;
    const field = document.createElement('input');
    field.type = 'text';
    field.inputMode = 'decimal';
    field.className = 'value-edit';
    field.value = range.value;
    field.setAttribute('aria-label', `${output.closest('label')?.firstChild?.textContent?.trim() || 'Value'} (type a number)`);
    output.hidden = true;
    output.after(field);
    field.focus();
    field.select();
    let done = false;
    const close = (apply) => {
      if (done) return;
      done = true;
      // put focus back on the slider first, so a handler that rebuilds the panel restores it there
      field.remove();
      output.hidden = false;
      if (range.isConnected) range.focus({ preventScroll: true });
      if (apply) {
        const v = parseFloat(field.value.replace(',', '.'));
        if (Number.isFinite(v)) {
          const min = range.min === '' ? -Infinity : Number(range.min);
          const max = range.max === '' ? Infinity : Number(range.max);
          range.value = String(Math.min(max, Math.max(min, v)));
          range.dispatchEvent(new Event('input', { bubbles: true }));
          range.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    };
    field.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { e.preventDefault(); close(true); }
      if (e.key === 'Escape') { e.preventDefault(); close(false); }
    });
    field.addEventListener('blur', () => close(true));
    field.addEventListener('click', (e) => e.preventDefault());
  };
  document.addEventListener('click', (e) => {
    const output = e.target.closest?.('label.slider output');
    if (!output) return;
    e.preventDefault(); // don't let the label activate the slider
    open(output.parentElement.querySelector('input[type=range]'), output);
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.target.type !== 'range') return;
    const output = e.target.closest('label.slider')?.querySelector('output');
    if (!output) return;
    e.preventDefault();
    open(e.target, output);
  });
  // say so in the tooltip
  document.addEventListener('pointerover', (e) => {
    const output = e.target.closest?.('label.slider output');
    if (output && !output.dataset.tip) output.dataset.tip = 'Click to type a value';
  }, true);
}
