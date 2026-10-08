// 3D figures: a procedural wooden-mannequin style figure, plus optional user VRM models.
// Both are built on the shared skeleton in pose-runtime.js, so poses, props and the
// camera/scoring maths all agree.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { JOINTS, BONES, HIPS_Y, HEAD_R, listPoses } from './pose-runtime.js';

export { BONES };

// Head geometry used by scoring for unposed (standing) figures.
export const headRadius = (h) => h * HEAD_R;
export const headCenterY = (h) => h * (HIPS_Y + 0.05 + 0.1 + 0.17 + 0.04 + HEAD_R);

// Pose names for UI pickers (non-adult unless asked).
export const poseLabels = (adult = false) => Object.fromEntries(listPoses({ adult }).filter((p) => !p.pair).map((p) => [p.id, p.name || p.id]));

const ink = new THREE.MeshBasicMaterial({ color: 0x15161a, side: THREE.BackSide });

function capsule(r, len, mat) {
  const g = new THREE.CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 6, 12);
  return new THREE.Mesh(g, mat);
}

// Neck/head look applied on top of the pose (matches pose-runtime fk()).
function withLook(name, q, look) {
  if (!look || (name !== 'neck' && name !== 'head')) return q;
  const k = name === 'neck' ? 0.4 : 0.6;
  return q.clone().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(look.pitch * k, look.yaw * k, 0, 'YXZ')));
}

export class Mannequin {
  constructor(heightM, color) {
    this.kind = 'mannequin';
    this.root = new THREE.Group(); // placement: position + yaw
    this.posed = new THREE.Group(); // pose root: hip height offset + whole-body rotation
    this.root.add(this.posed);
    this.bones = {};
    this.meshes = [];
    this.outlines = [];
    this.color = new THREE.Color(color);
    this.mats = {
      shaded: new THREE.MeshStandardMaterial({ color: this.color, roughness: 0.75, metalness: 0 }),
      toon: new THREE.MeshToonMaterial({ color: this.color }),
      flat: new THREE.MeshBasicMaterial({ color: this.color }),
    };
    this.darkMats = {
      shaded: new THREE.MeshStandardMaterial({ color: this.color.clone().multiplyScalar(0.55), roughness: 0.8 }),
      toon: new THREE.MeshToonMaterial({ color: this.color.clone().multiplyScalar(0.55) }),
      flat: new THREE.MeshBasicMaterial({ color: this.color.clone().multiplyScalar(0.55) }),
    };
    this.build(heightM);
  }

  build(h) {
    this.height = h;
    const m = this.mats.shaded;
    const dm = this.darkMats.shaded;
    const reg = (mesh, dark = false) => {
      mesh.userData.dark = dark;
      this.meshes.push(mesh);
      const o = new THREE.Mesh(mesh.geometry, ink);
      o.scale.setScalar(1.07);
      o.visible = false;
      mesh.add(o);
      this.outlines.push(o);
      return mesh;
    };
    // bone groups from the shared joint table
    for (const name of BONES) {
      const [parent, off] = JOINTS[name];
      const g = new THREE.Group();
      g.name = name;
      g.position.set(off[0] * h, off[1] * h, off[2] * h);
      (parent ? this.bones[parent] : this.posed).add(g);
      this.bones[name] = g;
    }
    this.posed.position.y = HIPS_Y * h;
    const B = this.bones;
    const add = (bone, mesh, pos, rot, dark) => {
      if (pos) mesh.position.set(...pos);
      if (rot) mesh.rotation.set(...rot);
      B[bone].add(reg(mesh, dark));
      return mesh;
    };

    add('hips', capsule(h * 0.07, h * 0.15, m), [0, h * 0.01, 0], [0, 0, Math.PI / 2]);
    add('spine', capsule(h * 0.06, h * 0.13, m), [0, h * 0.06, 0]);
    add('chest', capsule(h * 0.085, h * 0.2, m), [0, h * 0.08, 0]).scale.set(1.25, 1, 0.75);
    add('neck', capsule(h * 0.022, h * 0.06, m), [0, h * 0.02, 0]);

    const r = HEAD_R * h;
    add('head', new THREE.Mesh(new THREE.SphereGeometry(r, 24, 18), m), [0, r, 0]).scale.set(0.92, 1.05, 1);
    // hair cap: shows which way the head faces from behind
    add('head', new THREE.Mesh(new THREE.SphereGeometry(r * 1.06, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), dm), [0, r * 1.08, -r * 0.08], [-0.5, 0, 0], true);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1b1c22 });
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(r * 0.13, 10, 8), eyeMat);
      eye.position.set(sx * r * 0.36, r * 1.0, r * 0.88);
      eye.scale.set(1, 1.4, 0.5);
      B.head.add(eye);
    }
    add('head', new THREE.Mesh(new THREE.ConeGeometry(r * 0.12, r * 0.3, 8), m), [0, r * 0.72, r * 0.98], [Math.PI / 2, 0, 0]);

    for (const side of ['left', 'right']) {
      const s = side === 'left' ? 1 : -1;
      add(`${side}UpperArm`, capsule(h * 0.028, h * 0.165, m), [s * h * 0.0825, 0, 0], [0, 0, Math.PI / 2]);
      add(`${side}LowerArm`, capsule(h * 0.024, h * 0.15, m), [s * h * 0.075, 0, 0], [0, 0, Math.PI / 2]);
      add(`${side}Hand`, new THREE.Mesh(new THREE.SphereGeometry(h * 0.032, 12, 10), m), [s * h * 0.022, 0, 0]).scale.set(1.2, 0.8, 0.6);
      add(`${side}UpperLeg`, capsule(h * 0.045, h * 0.255, m), [0, -h * 0.1275, 0]);
      add(`${side}LowerLeg`, capsule(h * 0.035, h * 0.25, m), [0, -h * 0.125, 0]);
      add(`${side}Foot`, capsule(h * 0.028, h * 0.11, m), [0, h * 0.022, h * 0.03], [Math.PI / 2, 0, 0], true);
    }
  }

  setStyle(style) {
    for (const mesh of this.meshes) {
      const set = mesh.userData.dark ? this.darkMats : this.mats;
      mesh.material = set[style === 'silhouette' ? 'flat' : style === 'toon' || style === 'lineart' ? 'toon' : 'shaded'];
    }
    for (const o of this.outlines) o.visible = style === 'toon' || style === 'lineart';
    if (style === 'lineart') {
      this.mats.toon.color.set(0xffffff);
      this.darkMats.toon.color.set(0xe8e8e8);
    } else {
      this.mats.toon.color.copy(this.color);
      this.darkMats.toon.color.copy(this.color).multiplyScalar(0.55);
    }
  }

  setColor(color) {
    this.color.set(color);
    this.mats.shaded.color.copy(this.color);
    this.mats.flat.color.copy(this.color);
    this.mats.toon.color.copy(this.color);
    for (const k of Object.keys(this.darkMats)) this.darkMats[k].color.copy(this.color).multiplyScalar(0.55);
  }

  // pose: compiled pose (pose-runtime). look: {yaw, pitch} or null.
  applyPose(pose, look) {
    const h = this.height;
    this.posed.position.y = (HIPS_Y + (pose?.root.y || 0)) * h;
    this.posed.quaternion.copy(pose?.root.q || new THREE.Quaternion());
    for (const name of BONES) {
      const q = pose?.bones[name] || new THREE.Quaternion();
      this.bones[name].quaternion.copy(withLook(name, q, look));
    }
  }

  // World matrix of a bone (after applyPose + updateMatrixWorld).
  boneMatrix(name) {
    return this.bones[name]?.matrixWorld || this.root.matrixWorld;
  }

  dispose() {
    this.root.traverse((o) => o.geometry?.dispose?.());
  }
}

// --- VRM ------------------------------------------------------------------

export class VrmFigure {
  constructor(vrm, heightM) {
    this.kind = 'vrm';
    this.vrm = vrm;
    this.root = new THREE.Group();
    this.posed = new THREE.Group();
    this.offset = new THREE.Group();
    this.inner = vrm.scene;
    this.root.add(this.posed);
    this.posed.add(this.offset);
    this.offset.add(this.inner);
    this.originalMats = new Map();
    this.inner.traverse((o) => {
      if (o.isMesh) {
        o.frustumCulled = false;
        this.originalMats.set(o, o.material);
      }
    });
    this.flatMat = new THREE.MeshBasicMaterial({ color: 0x888888 });
    this.lineMat = new THREE.MeshToonMaterial({ color: 0xffffff });
    this.setHeight(heightM);
  }

  setHeight(h) {
    this.height = h;
    this.inner.scale.setScalar(1);
    this.vrm.humanoid.resetNormalizedPose();
    this.vrm.update(0);
    this.inner.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(this.inner);
    const raw = Math.max(0.1, box.max.y - Math.min(0, box.min.y));
    this.inner.scale.setScalar(h / raw);
    this.inner.updateMatrixWorld(true);
    // pivot whole-body rotations around the hips, like the mannequin
    const hips = this.vrm.humanoid.getNormalizedBoneNode('hips');
    this.hipsY = hips ? new THREE.Vector3().setFromMatrixPosition(hips.matrixWorld).y : h * HIPS_Y;
    this.offset.position.y = -this.hipsY;
    this.posed.position.y = this.hipsY;
  }

  setStyle(style, color) {
    if (color) this.flatMat.color.set(color);
    this.inner.traverse((o) => {
      if (!o.isMesh) return;
      if (style === 'silhouette') o.material = this.flatMat;
      else if (style === 'lineart') o.material = this.lineMat;
      else o.material = this.originalMats.get(o);
    });
  }

  setColor(color) {
    this.flatMat.color.set(color);
  }

  applyPose(pose, look) {
    const hum = this.vrm.humanoid;
    hum.resetNormalizedPose();
    this.posed.position.y = this.hipsY + (pose?.root.y || 0) * this.height;
    this.posed.quaternion.copy(pose?.root.q || new THREE.Quaternion());
    for (const name of BONES) {
      const node = hum.getNormalizedBoneNode(name);
      if (!node) continue;
      node.quaternion.copy(withLook(name, pose?.bones[name] || new THREE.Quaternion(), look));
    }
    this.vrm.update(0);
  }

  boneMatrix(name) {
    return this.vrm.humanoid.getNormalizedBoneNode(name)?.matrixWorld || this.root.matrixWorld;
  }

  dispose() {
    VRMUtils.deepDispose(this.inner);
  }
}

export async function loadVrmFromUrl(url, heightM) {
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMLoaderPlugin(parser));
  const gltf = await loader.loadAsync(url);
  const vrm = gltf.userData.vrm;
  if (!vrm) throw new Error('Not a VRM file');
  VRMUtils.removeUnnecessaryVertices(gltf.scene);
  if (VRMUtils.combineSkeletons) VRMUtils.combineSkeletons(gltf.scene);
  VRMUtils.rotateVRM0(vrm);
  return new VrmFigure(vrm, heightM);
}

export async function loadVrmFromFile(file, heightM) {
  const url = URL.createObjectURL(file);
  try {
    return await loadVrmFromUrl(url, heightM);
  } finally {
    URL.revokeObjectURL(url);
  }
}
