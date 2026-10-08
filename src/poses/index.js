// Pose library: every built-in pose file, registered with the pose runtime.
// Files load independently, so a broken file is skipped (with a warning) instead of breaking the app.
// Custom poses saved from the pose editor live in /poses/custom/*.json and are registered at runtime.

import { registerPoses } from '../pose-runtime.js';
import base from './base.js';

registerPoses(base); // always available, even before the other files load

const files = import.meta.glob(['./*.js', '!./index.js', '!./base.js']);
export const posesReady = Promise.all(
  Object.entries(files).map(([path, load]) =>
    load()
      .then((mod) => registerPoses(mod.default || []))
      .catch((e) => console.warn(`Pose file ${path} failed to load and was skipped:`, e.message)),
  ),
);

// Fetch custom poses from the dev server (pose editor saves); safe to call when unavailable.
export async function loadCustomPoses() {
  await posesReady;
  try {
    const r = await fetch('/__poses');
    if (!r.ok) return [];
    const list = await r.json();
    registerPoses(list);
    return list;
  } catch {
    return [];
  }
}
