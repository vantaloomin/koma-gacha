// Image-generation prompt export: turns a storyboard page or panel into a reference image + a prompt
// for an image model (e.g. GPT Image). Mannequins are colour-coded stand-ins; the prompt maps each colour
// to a character and asks for finished art and professional lettering in the same places.

import { SIZES, TYPES, ROLES, TONES, visibleAt } from './gacha.js';
import { getPose } from './pose-runtime.js';
import { getProp } from './props.js';

// --- colour names for the colour-coded mannequins --------------------------------------------

export function colorName(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return 'GRAY';
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
  if (s < 0.15) return l > 0.8 ? 'WHITE' : l < 0.25 ? 'BLACK' : 'GRAY';
  let h = max === r ? ((g - b) / (max - min)) % 6 : max === g ? (b - r) / (max - min) + 2 : (r - g) / (max - min) + 4;
  h = (h * 60 + 360) % 360;
  if (h < 15 || h >= 345) return 'RED';
  if (h < 40) return 'ORANGE';
  if (h < 65) return 'YELLOW';
  if (h < 160) return 'GREEN';
  if (h < 195) return 'TEAL';
  if (h < 255) return 'BLUE';
  if (h < 290) return 'PURPLE';
  return 'PINK';
}

// Unique colour labels for a cast (two reds become RED and RED 2).
export function castLabels(chars) {
  const seen = {};
  return chars.map((c) => {
    const base = colorName(c.color);
    seen[base] = (seen[base] || 0) + 1;
    return seen[base] > 1 ? `${base} ${seen[base]}` : base;
  });
}

// GPT Image sizes; pick the closest aspect.
export function suggestedSize(w, h) {
  const r = w / h;
  if (r > 1.2) return '1536x1024 (landscape)';
  if (r < 0.83) return '1024x1536 (portrait)';
  return '1024x1024 (square)';
}

// --- shot descriptions ---------------------------------------------------------------------

// Prompt wording for a pose. A pose may carry `prompt` (a string, or {tone: text, default: text});
// otherwise its name is used with "(a / b)" alternatives dropped, so the image model isn't left to pick.
function poseName(p, tone) {
  if (typeof p !== 'string') return p ? 'a custom pose' : null;
  const def = getPose(p);
  if (!def) return p;
  if (typeof def.prompt === 'string') return def.prompt;
  if (def.prompt) return def.prompt[tone] || def.prompt.default;
  return def.name.replace(/\s*\([^)]*\/[^)]*\)/g, '');
}

// Held props: when the character description already names an item of the same kind
// ("carries a canvas duffel"), use the description's wording so the prompt doesn't contradict it.
const PROP_FAMILIES = [
  { match: /suitcase|briefcase|backpack|bag|purse|luggage/i, words: ['duffel bag', 'duffle bag', 'duffel', 'duffle', 'suitcase', 'briefcase', 'backpack', 'rucksack', 'knapsack', 'satchel', 'handbag', 'purse', 'tote', 'carpetbag', 'valise', 'luggage', 'bag'] },
  { match: /cup|mug|glass|bottle|can$|flask/i, words: ['teacup', 'cup', 'mug', 'glass', 'bottle', 'flask', 'canteen', 'tankard'] },
  { match: /sword|katana|knife|dagger|blade/i, words: ['katana', 'sword', 'sabre', 'saber', 'blade', 'dagger', 'knife'] },
  { match: /phone/i, words: ['smartphone', 'cellphone', 'phone'] },
  { match: /umbrella|parasol/i, words: ['umbrella', 'parasol'] },
];
function propName(id, description) {
  const prop = getProp(id);
  const base = prop?.name?.toLowerCase() || id;
  const fam = PROP_FAMILIES.find((f) => f.match.test(`${id} ${prop?.name || ''}`));
  if (fam && description) {
    for (const w of fam.words) {
      const m = new RegExp(`\\b(?:a|an|the|his|her|their|its)\\s+((?:[\\w-]+\\s+){0,2}?${w})\\b`, 'i').exec(description)
        || new RegExp(`\\b(${w})\\b`, 'i').exec(description);
      if (m) return `the ${m[1].toLowerCase()} from the character description`;
    }
  }
  return `${/^[aeiou]/.test(base) ? 'an' : 'a'} ${base}`;
}

// Is a character visible even though their head is out of frame (e.g. a foreground back cropped at the top)?
function bodyInFrame(p, ctx) {
  const b = p.body;
  const u0 = Math.max(0, b.u0), u1 = Math.min(1, b.u1), v0 = Math.max(0, b.v0), v1 = Math.min(1, b.v1);
  if (u1 <= u0 || v1 <= v0) return false;
  if ((u1 - u0) * (v1 - v0) < 0.05) return false;
  return visibleAt((u0 + u1) / 2, (v0 + v1) / 2, ctx);
}

function facing(p) {
  if (p.faceVis > 0.35) return 'facing the viewer';
  if (p.faceVis < -0.3) return 'seen from behind';
  return 'in profile';
}

function describePanel(shot, chars, labels, script, tone) {
  const sp = shot.spec;
  const who = (i) => `${chars[i]?.name} (${labels[i]})`;
  const parts = [];
  const size = SIZES[sp.size]?.toLowerCase() || 'medium';
  const angle = sp.elev > 22 ? 'high angle looking down' : sp.elev < -10 ? 'low angle looking up' : 'eye level';
  const shotType = sp.type === 'ots' ? `over-the-shoulder shot past ${who(sp.other)} onto ${who(sp.subject)}`
    : sp.type === 'two' ? `two-shot`
      : sp.type === 'establish' ? 'establishing shot'
        : `${size} of ${who(sp.subject)}`;
  parts.push(`Camera: ${shotType}${sp.type === 'single' ? '' : `, ${size}`}, ${angle}${Math.abs(sp.dutch) > 3 ? ', tilted (dutch angle)' : ''}.`);
  const vis = shot.analysis.people.filter((p) => p.inFrame || bodyInFrame(p, shot.ctx));
  if (vis.length) {
    const bits = vis.map((p) => {
      const i = p.i;
      const pose = sp.pair ? null : poseName(sp.poses?.[i], tone);
      const hold = sp.hold?.[i] ? Object.values(sp.hold[i]).filter(Boolean).map((id) => propName(id, chars[i]?.description)) : [];
      const look = shot.ctx.speaker === i ? (shot.ctx.listener != null && chars[shot.ctx.listener] ? `, speaking to ${chars[shot.ctx.listener].name}` : ', speaking')
        : shot.ctx.speaker >= 0 ? `, looking at ${chars[shot.ctx.speaker].name}` : '';
      const where = p.inFrame ? facing(p) : `${facing(p)}, in the foreground with the head cropped out of frame`;
      return `${who(i)} ${where}${pose ? `, ${pose.toLowerCase()}` : ''}${hold.length ? `, holding ${hold.join(' and ')}` : ''}${look}`;
    });
    parts.push(`In frame: ${bits.join('; ')}.`);
  } else {
    parts.push('No characters in frame (scenery or detail shot).');
  }
  if (sp.pair) {
    const g = getPose(sp.pair.id);
    const members = [sp.pair.a, sp.pair.b, sp.pair.c].filter((x) => x != null).map(who).join(', ');
    parts.push(`Group pose: ${g?.name || sp.pair.id} (${members}).`);
  }
  parts.push(`Purpose: ${(ROLES[shot.ctx.role] || 'dialogue').toLowerCase()}.`);
  const lines = [];
  for (const d of script?.dialogue || []) {
    if (!d.text?.trim()) continue;
    const kind = d.kind && d.kind !== 'speech' ? ` (${d.kind} balloon)` : '';
    const speaker = d.speaker == null ? 'Narration' : d.speaker === -1 ? 'Off-panel voice' : chars[d.speaker]?.name || 'Someone';
    const offPanel = d.speaker >= 0 && !vis.some((p) => p.i === d.speaker) ? ' (off-panel, tail points out of the panel)' : '';
    lines.push(`${speaker}${kind}${offPanel}: "${d.text.trim()}"`);
  }
  if (script?.caption?.trim()) lines.push(`Caption box: "${script.caption.trim()}"`);
  for (const fx of script?.sfx || []) if (fx.text?.trim()) lines.push(`Sound effect (${fx.size || 'medium'}): "${fx.text.trim()}"`);
  return { parts, lines };
}

/**
 * Build the prompt text.
 * opts: {scope: 'page' | panelIndex, layout, shots, chars: [{name, color, description}], scripts: {i: script},
 *        style, setting, tone, blankBalloons, dir, size: {w, h}}
 */
export function buildImagePrompt(opts) {
  const { layout, shots, chars, scripts = {}, style, setting, tone, blankBalloons, dir } = opts;
  const labels = castLabels(chars);
  const onePanel = opts.scope !== 'page';
  const indices = onePanel ? [opts.scope] : shots.map((_, i) => i);
  const V = (name, fallback) => (fallback && fallback.trim() ? fallback.trim() : `{${name}}`);
  const out = [];

  out.push(onePanel
    ? 'Create one finished comic panel based on the attached storyboard reference image.'
    : 'Create one finished comic page based on the attached storyboard reference image.');
  out.push('');
  out.push('CHARACTERS (the reference uses colour-coded jointed mannequins as stand-ins)');
  chars.forEach((c, i) => out.push(`- ${labels[i]} mannequin = ${c.name}: ${V(`CHARACTER ${i + 1}: describe ${c.name}`, c.description)}`));
  out.push('Draw each character with the same design in every panel. The mannequins only show position, pose and where each character faces; they are not the characters’ look.');
  out.push('');
  out.push('KEEP FROM THE REFERENCE');
  if (!onePanel) {
    out.push(`- The page layout exactly: ${layout.panels.length} panels with the same shapes, borders, gutters and positions. Reading order is ${dir === 'rtl' ? 'right to left (manga)' : 'left to right'}, top to bottom.`);
    out.push('- Panels that run off the page edge stay full-bleed; inset panels stay on top of the panels beneath.');
  } else {
    out.push('- The panel shape and its border.');
  }
  out.push('- Each panel’s camera framing and angle, where each character stands, their poses, and which way they face and look.');
  out.push(blankBalloons
    ? '- The speech balloons, thought clouds and caption boxes as positions only: redraw them as clean, empty balloons in the same places, with tails pointing at the same speakers. Lettering will be added later, so leave them blank.'
    : '- The speech balloons, thought clouds, captions and sound effects as positions only: redraw them as clean, professional comic lettering in the same places, with tails pointing at the same speakers. Use exactly the dialogue listed below, spelled exactly, in a clear comic lettering font.');
  out.push('');
  out.push('REPLACE');
  out.push(`- The grey floor grid and blank background with a real setting: ${V('SETTING: where this takes place', setting)}.`);
  out.push('- The mannequins with the finished characters described above.');
  out.push('- The rough placeholder balloons with polished, consistent lettering (smooth ovals, tapered tails, clean outlines). Thought balloons are cloud-shaped; shouts are spiky; whispers have dashed outlines.');
  out.push('');
  out.push(`STYLE: ${V('STYLE: e.g. black-and-white manga with screentones, or full-colour western comic', style)}`);
  if (tone && TONES[tone] && tone !== 'auto') out.push(`MOOD: ${TONES[tone].label.toLowerCase()}`);
  out.push('');
  out.push(onePanel ? 'THE PANEL' : 'PANELS (in reading order)');
  for (const i of indices) {
    const shot = shots[i];
    if (!shot) continue;
    const { parts, lines } = describePanel(shot, chars, labels, scripts[i], tone);
    out.push(onePanel ? '' : `${i + 1}.`);
    for (const p of parts) out.push(`   ${p}`);
    if (lines.length) {
      out.push(blankBalloons ? '   Balloons (leave blank): ' + lines.length : '   Lettering:');
      if (!blankBalloons) for (const l of lines) out.push(`   - ${l}`);
    }
  }
  out.push('');
  out.push('DO NOT draw the mannequins, the floor grid, colour names, panel numbers, character name labels, watermarks or any text that isn’t in the lettering list.');
  if (opts.size) out.push(`Output aspect: ${opts.size.w}:${opts.size.h} (closest GPT Image size: ${suggestedSize(opts.size.w, opts.size.h)}).`);
  return out.join('\n');
}
