// Pose editor: pose a mannequin (or a pair / trio) by dragging joint rotation gizmos or with sliders,
// load/overlay/mirror library poses, attach props, and save poses to poses/custom/.

import { icon, confirmIcon } from './ui.js';

// "rightUpperArm" -> "Right upper arm"
const humanize = (id) => { const t = String(id).replace(/([a-z0-9])([A-Z])/g, '$1 $2').toLowerCase(); return t[0].toUpperCase() + t.slice(1); };
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { Mannequin } from './figures.js';
import { BONES, JOINTS, UPPER_BONES, compileDef, mirrorDef, getPose, listPoses, registerPoses, poseCategories, mergePoses } from './pose-runtime.js';
import { buildProp, placeProp, listProps, propCategories } from './props.js';

const DEG = Math.PI / 180;
const r1 = (v) => Math.round(v * 10) / 10;
const H = [1.65, 1.75, 1.7];
const metaSel = (k) => (k === 'cat' ? '#pe-metacat' : `#pe-${k}`);

export class PoseEditor {
  constructor(root, { onLibraryChange } = {}) {
    this.root = root;
    this.onLibraryChange = onLibraryChange;
    this.adult = false;
    this.members = 1; // 1 solo, 2 pair, 3 trio
    this.figures = [new Mannequin(H[0], '#e2735f'), new Mannequin(H[1], '#5a8fd8'), new Mannequin(H[2], '#5fb87a')];
    this.state = [this.blank(), this.blank(), this.blank()];
    this.offset = { x: 0, z: 0.6, yaw: 180 };
    this.offsetC = { x: 0.6, z: 0.3, yaw: -90 };
    this.sel = { fig: 0, bone: 'rightUpperArm' };
    this.props = [[], [], []]; // per figure: [{id, attach, mode?, offset, rot}]
    this.propObjs = [];
    this.meta = { id: 'myPose', name: 'My pose', cat: 'custom', layer: 'full', tags: '', look: 1 };
    this.built = false;
  }

  get pair() { return this.members > 1; }

  blank() {
    return { rootY: 0, rootRot: [0, 0, 0], bones: Object.fromEntries(BONES.map((b) => [b, new THREE.Quaternion()])) };
  }

  // ---------------------------------------------------------------- setup

  mount() {
    if (this.built) { this.resize(); return; }
    this.built = true;
    const view = this.root.querySelector('.pe-view');
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    view.append(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color();
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8f9c, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 2);
    key.position.set(2, 4, 3);
    this.scene.add(key);
    this.grid = new THREE.GridHelper(10, 20, 0xc4c8d0, 0xe0e3e8);
    this.scene.add(this.grid);
    this.applyTheme();
    window.addEventListener('ng-theme', () => this.applyTheme());
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.05, 100);
    this.camera.position.set(2.4, 1.6, 3.2);
    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.target.set(0, 0.9, 0);
    this.orbit.update();

    // joint handles for picking
    this.handles = [];
    const hm = new THREE.MeshBasicMaterial({ color: 0x2f8cff, depthTest: false, transparent: true, opacity: 0.85 });
    this.handleMat = hm;
    this.figures.forEach((f, fi) => this.attachFigure(f, fi));

    this.gizmo = new TransformControls(this.camera, this.renderer.domElement);
    this.gizmo.setMode('rotate');
    this.gizmo.setSpace('local');
    this.gizmo.setSize(0.7);
    this.scene.add(this.gizmo.getHelper());
    this.gizmo.addEventListener('dragging-changed', (e) => { this.orbit.enabled = !e.value; });
    this.gizmo.addEventListener('objectChange', () => {
      const { fig, bone } = this.sel;
      this.state[fig].bones[bone] = this.figures[fig].bones[bone].quaternion.clone();
      this.syncSliders();
      this.placeProps();
    });

    const ray = new THREE.Raycaster();
    let down = null;
    this.renderer.domElement.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; });
    this.renderer.domElement.addEventListener('pointerup', (e) => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4 || this.gizmo.dragging) return;
      const r = this.renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), this.camera);
      const hit = ray.intersectObjects(this.handles.filter((h) => h.userData.fig < this.members), false)[0];
      if (hit) this.select(hit.object.userData.fig, hit.object.userData.bone);
    });

    new ResizeObserver(() => this.resize()).observe(view);
    this.buildUI();
    this.loadPose('stand');
    this.resize();
    const loop = () => {
      requestAnimationFrame(loop);
      if (this.root.offsetParent) this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  attachFigure(f, fi) {
    this.scene.add(f.root);
    for (const b of BONES) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(b === 'hips' ? 0.03 : 0.022, 12, 8), this.handleMat.clone());
      s.renderOrder = 999;
      s.userData = { fig: fi, bone: b };
      f.bones[b].add(s);
      this.handles.push(s);
    }
  }

  // Swap the figures for ones with these heights/colours (a storyboard panel's cast), or back to defaults.
  rebuildFigures(specs) {
    this.gizmo.detach();
    for (const f of this.figures) { this.scene.remove(f.root); f.dispose(); }
    this.handles = [];
    const defaults = [{ h: H[0], color: '#e2735f' }, { h: H[1], color: '#5a8fd8' }, { h: H[2], color: '#5fb87a' }];
    const list = [0, 1, 2].map((k) => specs?.[k] || defaults[k]);
    this.figures = list.map((sp) => new Mannequin(sp.h, sp.color));
    this.figures.forEach((f, fi) => this.attachFigure(f, fi));
  }

  // --- storyboard round trip: edit a panel's poses, then apply them back -------------------
  // opts: {label, figures: [{h, color, name}], poses: [compiled], places: [{x, z, yaw(rad)}], onApply(defs, places)}
  beginSession(opts) {
    this.mount();
    this.session = opts;
    const n = opts.figures.length;
    this.rebuildFigures(opts.figures);
    this.state = [this.blank(), this.blank(), this.blank()];
    this.props = [[], [], []];
    opts.poses.forEach((c, i) => c && this.fromCompiled(i, c));
    const A = opts.places[0];
    const rel = (p) => {
      const v = new THREE.Vector3(p.x - A.x, 0, p.z - A.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), -A.yaw);
      return { x: r1(v.x * 100) / 100, z: r1(v.z * 100) / 100, yaw: r1(((p.yaw - A.yaw) / DEG + 540) % 360 - 180) };
    };
    if (n > 1) this.offset = rel(opts.places[1]);
    if (n > 2) this.offsetC = rel(opts.places[2]);
    this.sel = { fig: 0, bone: 'rightUpperArm' };
    this.setMembers(n);
    const $ = (s) => this.root.querySelector(s);
    $('#pe-group').disabled = true;
    const names = opts.figures.map((f, k) => `${'ABC'[k]} = ${f.name}`).join(', ');
    $('#pe-session-text').textContent = `Editing ${opts.label} (${names}). Changes go back to that panel when you apply.`;
    $('#pe-session').hidden = false;
    this.apply();
    this.syncAll();
  }

  endSession() {
    const $ = (s) => this.root.querySelector(s);
    this.session = null;
    $('#pe-session').hidden = true;
    $('#pe-group').disabled = false;
    this.rebuildFigures(null);
    this.state = [this.blank(), this.blank(), this.blank()];
    this.props = [[], [], []];
    this.loadPose('stand');
  }

  applySession() {
    const ses = this.session;
    if (!ses) return;
    const n = ses.figures.length;
    const defs = [];
    for (let i = 0; i < n; i++) {
      const st = this.state[i];
      const bones = {};
      for (const b of BONES) {
        const e = new THREE.Euler().setFromQuaternion(st.bones[b], 'XYZ');
        bones[b] = [r1(e.x / DEG), r1(e.y / DEG), r1(e.z / DEG)];
      }
      defs.push({ id: `panelEdit${i}`, name: 'Edited in Poses', layer: 'full', look: 0, bones, root: { y: st.rootY, rot: [...st.rootRot] }, props: this.props[i].map((p) => ({ ...p })) });
    }
    const A = ses.places[0];
    const place = (off) => {
      const v = new THREE.Vector3(off.x, 0, off.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), A.yaw);
      return { x: A.x + v.x, z: A.z + v.z, yaw: A.yaw + off.yaw * DEG };
    };
    const places = [{ ...A }, n > 1 ? place(this.offset) : null, n > 2 ? place(this.offsetC) : null].slice(0, n);
    const cb = ses.onApply;
    this.endSession();
    cb?.(defs, places);
  }

  // viewport colours follow the app theme
  applyTheme() {
    const dark = document.documentElement.dataset.scheme === 'dark';
    this.scene.background.set(dark ? 0x1b1c20 : 0xeceef2);
    if (this.grid) { this.scene.remove(this.grid); this.grid.dispose(); }
    this.grid = dark ? new THREE.GridHelper(10, 20, 0x3a3c44, 0x2a2b31) : new THREE.GridHelper(10, 20, 0xc4c8d0, 0xdcdfe5);
    this.scene.add(this.grid);
  }

  resize() {
    const view = this.root.querySelector('.pe-view');
    const w = view.clientWidth || 600;
    const h = view.clientHeight > 200 ? view.clientHeight : Math.max(380, Math.min(720, w * 0.8));
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- pose state

  apply() {
    this.figures.forEach((f, i) => {
      const st = this.state[i];
      const pose = { root: { y: st.rootY, q: new THREE.Quaternion().setFromEuler(new THREE.Euler(...st.rootRot.map((v) => v * DEG))) }, bones: st.bones };
      f.applyPose(pose, null);
    });
    const B = this.figures[1].root;
    B.visible = this.members >= 2;
    B.position.set(this.offset.x, 0, this.offset.z);
    B.rotation.set(0, this.offset.yaw * DEG, 0);
    const C = this.figures[2].root;
    C.visible = this.members === 3;
    C.position.set(this.offsetC.x, 0, this.offsetC.z);
    C.rotation.set(0, this.offsetC.yaw * DEG, 0);
    this.figures[0].root.position.set(0, 0, 0);
    this.figures[0].root.rotation.set(0, 0, 0);
    this.placeProps();
  }

  fromCompiled(i, c) {
    this.state[i] = {
      rootY: c.root.y,
      rootRot: new THREE.Euler().setFromQuaternion(c.root.q, 'XYZ').toArray().slice(0, 3).map((v) => r1(v / DEG)),
      bones: Object.fromEntries(BONES.map((b) => [b, c.bones[b].clone()])),
    };
    this.props[i] = (c.props || []).map((p) => ({ ...p }));
  }

  // Load replaces the scene (a solo pose returns to Solo); apply / overlay change only the selected figure.
  loadPose(id, { overlay = false, apply = false } = {}) {
    const def = getPose(id);
    if (!def) return;
    if (def.pair || def.trio) {
      this.setMembers(def.trio ? 3 : 2);
      this.fromCompiled(0, compileDef({ ...def.a, id: id + ':a' }));
      this.fromCompiled(1, compileDef({ ...def.b, id: id + ':b' }));
      this.offset = { x: 0, z: 0.6, yaw: 180, ...def.offset };
      if (def.trio) {
        this.fromCompiled(2, compileDef({ ...def.c, id: id + ':c' }));
        this.offsetC = { x: 0.6, z: 0.3, yaw: -90, ...def.offsetC };
      }
    } else if (overlay) {
      const cur = this.toCompiled(this.sel.fig);
      this.fromCompiled(this.sel.fig, mergePoses(cur, compileDef(def)));
    } else if (apply) {
      this.fromCompiled(this.sel.fig, compileDef(def));
    } else {
      this.setMembers(1);
      this.sel.fig = 0;
      this.fromCompiled(0, compileDef(def));
    }
    if (!overlay && !apply) { this.loadedId = id; this.markLoaded(); }
    if (!overlay && !apply) Object.assign(this.meta, { id: def.id + 'Edit', name: def.name || def.id, cat: def.cat || 'custom', layer: def.pair || def.trio ? 'full' : def.layer || 'full', tags: (def.tags || []).join(', '), look: def.look ?? 1 });
    this.apply();
    this.syncAll();
  }

  toCompiled(i) {
    const st = this.state[i];
    return { id: 'edit', layer: 'full', bones: st.bones, defined: new Set(BONES), root: { y: st.rootY, q: new THREE.Quaternion().setFromEuler(new THREE.Euler(...st.rootRot.map((v) => v * DEG))) }, look: 1, props: this.props[i] };
  }

  // Pose JSON (raw bone eulers in degrees) for one figure, or the pair.
  toDef() {
    const one = (i, layer) => {
      const st = this.state[i];
      const names = layer === 'upper' ? UPPER_BONES : BONES;
      const bones = {};
      for (const b of names) {
        const e = new THREE.Euler().setFromQuaternion(st.bones[b], 'XYZ');
        const d = [r1(e.x / DEG), r1(e.y / DEG), r1(e.z / DEG)];
        if (d.some((v) => Math.abs(v) > 0.05)) bones[b] = d;
      }
      const out = { bones };
      if (layer !== 'upper' && (st.rootY || st.rootRot.some((v) => v))) out.root = { y: r1(st.rootY * 1000) / 1000, rot: st.rootRot };
      if (this.props[i].length) out.props = this.props[i].map((p) => ({ ...p }));
      return out;
    };
    const m = this.meta;
    const head = { id: m.id, name: m.name, cat: m.cat, tags: m.tags.split(',').map((t) => t.trim()).filter(Boolean), look: Number(m.look) };
    if (this.adult && m.cat === 'adult') head.adult = true;
    if (this.members === 3) return { ...head, trio: true, a: { ...one(0, 'full'), look: head.look }, b: { ...one(1, 'full'), look: head.look }, c: { ...one(2, 'full'), look: head.look }, offset: { ...this.offset }, offsetC: { ...this.offsetC } };
    if (this.members === 2) return { ...head, pair: true, a: { ...one(0, 'full'), look: head.look }, b: { ...one(1, 'full'), look: head.look }, offset: { ...this.offset } };
    return { ...head, layer: m.layer, ...one(this.sel.fig, m.layer) };
  }

  setMembers(n) {
    this.members = n;
    if (this.sel.fig >= n) this.sel.fig = 0;
    this.root.querySelector('#pe-group').value = String(n);
    this.root.querySelector('.pe-offset').hidden = n < 2;
    this.root.querySelector('.pe-offsetc').hidden = n < 3;
    this.refreshApplyButtons();
    this.apply();
  }

  select(fig, bone) {
    this.sel = { fig, bone };
    this.refreshApplyButtons();
    this.gizmo.attach(this.figures[fig].bones[bone]);
    for (const h of this.handles) h.material.color.set(h.userData.fig === fig && h.userData.bone === bone ? 0xff7a1a : 0x2f8cff);
    this.syncSliders();
  }

  // ---------------------------------------------------------------- props

  placeProps() {
    if (!this.scene) return;
    for (const o of this.propObjs) this.scene.remove(o);
    this.propObjs = [];
    this.scene.updateMatrixWorld(true);
    this.figures.forEach((f, i) => {
      if (i >= this.members) return;
      const person = { pos: f.root.position.clone(), yaw: f.root.rotation.y };
      for (const use of this.props[i]) {
        const g = buildProp(use.id, 'shaded');
        placeProp(g, use, person, f);
        this.scene.add(g);
        this.propObjs.push(g);
      }
    });
  }

  // ---------------------------------------------------------------- UI

  buildUI() {
    const $ = (s) => this.root.querySelector(s);
    // library
    $('#pe-adult').addEventListener('change', (e) => { this.adult = e.target.checked; this.fillLibrary(); });
    $('#pe-cat').addEventListener('change', () => this.fillLibrary());
    $('#pe-search').addEventListener('input', () => this.fillLibrary());
    this.fillLibrary();

    // bone sliders
    const bs = $('#pe-bone');
    for (const b of BONES) bs.append(new Option(humanize(b), b));
    bs.addEventListener('change', () => this.select(this.sel.fig, bs.value));
    $('#pe-fig').addEventListener('change', (e) => this.select(Number(e.target.value), this.sel.bone));
    for (const ax of [0, 1, 2]) {
      const s = $(`#pe-r${ax}`);
      s.addEventListener('input', () => {
        const e = [0, 1, 2].map((k) => Number($(`#pe-r${k}`).value) * DEG);
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(e[0], e[1], e[2], 'XYZ'));
        this.state[this.sel.fig].bones[this.sel.bone] = q;
        this.apply();
        this.syncSliders(true);
      });
    }
    $('#pe-zero').addEventListener('click', () => { this.state[this.sel.fig].bones[this.sel.bone] = new THREE.Quaternion(); this.apply(); this.syncSliders(); });

    // root
    $('#pe-rooty').addEventListener('input', (e) => { this.state[this.sel.fig].rootY = Number(e.target.value); this.apply(); this.syncSliders(true); });
    for (const ax of [0, 1, 2]) $(`#pe-rr${ax}`).addEventListener('input', (e) => { this.state[this.sel.fig].rootRot[ax] = Number(e.target.value); this.apply(); this.syncSliders(true); });

    $('#pe-session-apply').addEventListener('click', () => this.applySession());
    $('#pe-session-cancel').addEventListener('click', () => { const cb = this.session?.onCancel; this.endSession(); cb?.(); });
    // pair
    $('#pe-group').addEventListener('change', (e) => this.setMembers(Number(e.target.value)));
    for (const k of ['x', 'z', 'yaw']) $(`#pe-o${k}`).addEventListener('input', (e) => { this.offset[k] = Number(e.target.value); this.apply(); this.syncSliders(true); });
    for (const k of ['x', 'z', 'yaw']) $(`#pe-oc${k}`).addEventListener('input', (e) => { this.offsetC[k] = Number(e.target.value); this.apply(); this.syncSliders(true); });

    // props
    const pc = $('#pe-propcat');
    for (const c of propCategories()) pc.append(new Option(c, c));
    pc.addEventListener('change', () => this.fillPropList());
    this.fillPropList();
    $('#pe-addprop').addEventListener('click', () => {
      const id = $('#pe-prop').value;
      if (!id) return;
      this.props[this.sel.fig].push({ id, attach: $('#pe-attach').value });
      this.placeProps();
      this.renderPropRows();
    });

    // meta + actions
    for (const k of ['id', 'name', 'cat', 'tags', 'look']) $(metaSel(k)).addEventListener('input', (e) => { this.meta[k] = e.target.value; });
    $('#pe-layer').addEventListener('change', (e) => { this.meta.layer = e.target.value; });
    $('#pe-reset').addEventListener('click', () => { this.state[this.sel.fig] = this.blank(); this.props[this.sel.fig] = []; this.loadPose('stand'); });
    $('#pe-tpose').addEventListener('click', () => { this.state[this.sel.fig] = this.blank(); this.apply(); this.syncAll(); });
    $('#pe-mirror').addEventListener('click', () => {
      const def = mirrorDef(this.toDef());
      if (def.pair || def.trio) {
        this.fromCompiled(0, compileDef(def.a));
        this.fromCompiled(1, compileDef(def.b));
        this.offset = { ...this.offset, ...def.offset };
        if (def.trio) { this.fromCompiled(2, compileDef(def.c)); this.offsetC = { ...this.offsetC, ...def.offsetC }; }
      }
      else this.fromCompiled(this.sel.fig, compileDef(def));
      this.apply();
      this.syncAll();
    });
    $('#pe-copy').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(JSON.stringify(this.toDef(), null, 2)); confirmIcon($('#pe-copy')); this.status('Copied pose JSON.'); } catch { this.status('Clipboard unavailable; use Download.'); }
    });
    $('#pe-download').addEventListener('click', () => {
      const def = this.toDef();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(def, null, 2)], { type: 'application/json' }));
      a.download = `${def.id}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
    $('#pe-import').addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        const def = JSON.parse(await f.text());
        registerPoses([def]);
        this.loadPose(def.id);
        this.fillLibrary();
        this.status(`Imported ${def.id}.`);
      } catch (err) { this.status(`Import failed: ${err.message}`); }
      e.target.value = '';
    });
    $('#pe-save').addEventListener('click', async () => {
      const def = this.toDef();
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(def.id)) { this.status('Id must be letters, digits, - or _.'); return; }
      try {
        const r = await fetch('/__poses/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(def) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || r.status);
        registerPoses([def]);
        this.fillLibrary();
        this.onLibraryChange?.();
        this.status(`Saved to ${j.file}. It's now in the library (Shots and the MCP).`);
      } catch (err) { this.status(`Save failed: ${err.message}`); }
    });
  }

  // "Apply to A/B/C" buttons follow the selected figure and only show for pairs/trios.
  refreshApplyButtons() {
    for (const b of this.root.querySelectorAll('.pe-apply')) {
      b.hidden = this.members < 2;
      b.textContent = `Apply to ${'ABC'[this.sel.fig]}`;
    }
  }

  status(t) { this.root.querySelector('#pe-status').textContent = t; }

  fillLibrary() {
    const $ = (s) => this.root.querySelector(s);
    const cats = poseCategories(this.adult);
    const sel = $('#pe-cat');
    const cur = sel.value;
    sel.innerHTML = '';
    sel.append(new Option('All categories', ''));
    for (const c of cats) sel.append(new Option(c, c));
    sel.value = cats.includes(cur) ? cur : '';
    const q = $('#pe-search').value.trim().toLowerCase();
    const list = $('#pe-list');
    list.innerHTML = '';
    for (const p of listPoses({ adult: this.adult, cat: sel.value || null })) {
      if (q && !`${p.id} ${p.name}`.toLowerCase().includes(q)) continue;
      const row = document.createElement('div');
      row.className = 'pe-item';
      row.innerHTML = `<span><b></b><small></small></span>`;
      row.querySelector('b').textContent = p.name || p.id;
      const sub = humanize(p.cat || 'custom');
      row.querySelector('small').textContent = sub === (p.name || p.id) ? '' : sub;
      row.dataset.id = p.id;
      row.classList.toggle('on', p.id === this.loadedId);
      for (const t of [p.trio ? 'trio' : p.pair ? 'pair' : p.layer === 'upper' ? 'upper' : '', p.adult ? '18+' : ''].filter(Boolean)) {
        const tg = document.createElement('i');
        tg.className = 'tag' + (t === '18+' ? ' adult' : '');
        tg.textContent = t;
        row.querySelector('b').append(tg);
      }
      const load = document.createElement('button');
      load.textContent = 'Load';
      load.className = 'pe-load';
      load.title = p.pair || p.trio ? 'Load this group pose' : 'Start fresh with this pose (Solo)';
      load.addEventListener('click', (e) => { e.stopPropagation(); this.loadPose(p.id); });
      // the whole row loads; Enter loads; arrow keys walk the list
      row.tabIndex = 0;
      row.addEventListener('click', (e) => { if (!e.target.closest('button')) this.loadPose(p.id); });
      row.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); this.loadPose(p.id); }
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          const sib = e.key === 'ArrowDown' ? row.nextElementSibling : row.previousElementSibling;
          sib?.focus();
          sib?.scrollIntoView({ block: 'nearest' });
        }
      });
      row.append(load);
      if (!p.pair && !p.trio) {
        const ap = document.createElement('button');
        ap.className = 'pe-apply';
        ap.hidden = this.members < 2;
        ap.textContent = `Apply to ${'ABC'[this.sel.fig]}`;
        ap.title = 'Put this pose on the selected figure, keeping the group';
        ap.addEventListener('click', () => this.loadPose(p.id, { apply: true }));
        row.append(ap);
        const ov = document.createElement('button');
        ov.textContent = 'Overlay';
        ov.title = 'Apply only its upper body onto the current pose';
        ov.addEventListener('click', () => this.loadPose(p.id, { overlay: true }));
        row.append(ov);
      }
      list.append(row);
    }
  }

  fillPropList() {
    const $ = (s) => this.root.querySelector(s);
    const sel = $('#pe-prop');
    sel.innerHTML = '';
    for (const p of listProps($('#pe-propcat').value || null)) sel.append(new Option(p.name || p.id, p.id));
  }

  // highlight the library row of the pose that was last loaded
  markLoaded() {
    for (const r of this.root.querySelectorAll('.pe-item')) r.classList.toggle('on', r.dataset.id === this.loadedId);
  }

  renderPropRows() {
    const box = this.root.querySelector('#pe-props');
    box.innerHTML = '';
    this.props[this.sel.fig].forEach((p, k) => {
      const row = document.createElement('div');
      row.className = 'pe-proprow';
      const label = document.createElement('span');
      const name = listProps().find((q) => q.id === p.id)?.name || humanize(p.id);
      label.textContent = `${name} · ${humanize(p.attach)}`;
      row.append(label);
      for (const [key, title, lo, hi, step] of [['offset', 'Position (m)', -0.6, 0.6, 0.01], ['rot', 'Rotation (°)', -180, 180, 1]]) {
        const h = document.createElement('small');
        h.className = 'pe-prophead';
        h.textContent = title;
        row.append(h);
        for (let a = 0; a < 3; a++) {
          const cell = document.createElement('label');
          cell.className = 'pe-axis';
          const s = document.createElement('input');
          s.type = 'range'; s.min = lo; s.max = hi; s.step = step;
          s.value = (p[key] || [0, 0, 0])[a];
          s.setAttribute('aria-label', `${title} ${'XYZ'[a]}`);
          s.addEventListener('input', () => { p[key] = [...(p[key] || [0, 0, 0])]; p[key][a] = Number(s.value); this.placeProps(); });
          cell.append(Object.assign(document.createElement('i'), { textContent: 'XYZ'[a] }), s);
          row.append(cell);
        }
      }
      const rm = document.createElement('button');
      rm.className = 'icon-btn';
      rm.title = 'Remove prop';
      rm.setAttribute('aria-label', 'Remove prop');
      rm.append(icon('x', 15));
      rm.addEventListener('click', () => { this.props[this.sel.fig].splice(k, 1); this.placeProps(); this.renderPropRows(); });
      row.append(rm);
      box.append(row);
    });
  }

  syncSliders(skipBone = false) {
    const $ = (s) => this.root.querySelector(s);
    const st = this.state[this.sel.fig];
    $('#pe-bone').value = this.sel.bone;
    $('#pe-fig').value = String(this.sel.fig);
    if (!skipBone) {
      const e = new THREE.Euler().setFromQuaternion(st.bones[this.sel.bone], 'XYZ');
      [e.x, e.y, e.z].forEach((v, k) => { $(`#pe-r${k}`).value = r1(v / DEG); });
    }
    [0, 1, 2].forEach((k) => { $(`#pe-r${k}`).nextElementSibling.value = $(`#pe-r${k}`).value; });
    $('#pe-rooty').value = st.rootY;
    $('#pe-rooty').nextElementSibling.value = Number(st.rootY).toFixed(3);
    st.rootRot.forEach((v, k) => { $(`#pe-rr${k}`).value = v; $(`#pe-rr${k}`).nextElementSibling.value = v; });
    for (const k of ['x', 'z', 'yaw']) { $(`#pe-o${k}`).value = this.offset[k]; $(`#pe-o${k}`).nextElementSibling.value = this.offset[k]; }
    for (const k of ['x', 'z', 'yaw']) { $(`#pe-oc${k}`).value = this.offsetC[k]; $(`#pe-oc${k}`).nextElementSibling.value = this.offsetC[k]; }
  }

  syncAll() {
    const $ = (s) => this.root.querySelector(s);
    for (const k of ['id', 'name', 'cat', 'tags', 'look']) $(metaSel(k)).value = this.meta[k];
    $('#pe-layer').value = this.meta.layer;
    this.select(this.sel.fig, this.sel.bone);
    this.renderPropRows();
  }
}

export { JOINTS };
