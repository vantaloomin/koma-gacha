// Plot -> storyboard through the headless renderer: parses the sample plot (and a stress plot),
// builds every page and writes lettered previews.
//   node mcp/test-plot.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Engine, dataUrlToBuffer } from './engine.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '..');
const out = path.join(root, 'comics', '_plot-previews');
fs.mkdirSync(out, { recursive: true });

const SAMPLE = await (async () => {
  const src = fs.readFileSync(path.join(root, 'src', 'plot', 'build.js'), 'utf8');
  return src.slice(src.indexOf('`', src.indexOf('SAMPLE_PLOT')) + 1, src.lastIndexOf('`'));
})();

const STRESS = `Title: Stress
Reading direction: Right to left
Cast: Ada=F01 (165cm), Bram=M01 (180cm), Cass=F01 (170cm), Dot=Doll (120cm)

# Scene: Rooftop at night
Page 1 [Title page]
1: Background (city skyline) [Extreme long shot, Bird's-eye view]
2: Ada "We shouldn't be up here." Bram [Two-shot, Low angle, Wide panel]

Page 2
1: Bram "Relax." [Close-up, Dutch angle, Frame left]
2: Cass <Who's there?> Ada [POV shot]
3: Ada (Oh no.) [Extreme close-up, Tension]
4: Caption "Three floors down..." SFX "CLANG" [Insert shot, Small panel]
5: Dot {Battery low.} Bram [Knee shot, Profile] [Bram pose=Arms crossed gaze=camera]
6: Ada "Run!" [Burst balloon, Speed lines, Tall panel, Cliffhanger]

Page 3 [Page-turn reveal]
1: Ada Bram Cass Dot [Group shot, High angle, Large panel, Bleed]
2: Bram "...……" [Punch-in]
3: Cass "Linked / balloons\\nwith a break" [Camera pos=0,1.6,3 rot=0,-5 lens=50mm]
4: Ada [Same-position shot] [Ada pose=Bow face=happy,80]
`;

const LOOK = `Title: Look
Reading direction: Left to right
Format: comic
Cast: Ada=F01 (165cm), Bram=M01 (180cm)
Page 1
1: Ada "Focus!" [Close-up, Focus lines]
2: Bram "Beta!" [Medium shot, Beta flash] [Balloon Bram=Burst balloon,90,explosion]
3: Ada "Uni..." [Uni flash, Wavy balloon]
4: Bram {Phone voice} Ada [Speed lines]
5: Ada "Gloom." [Vertical gloom lines, Eerie balloon]
6: Bram "Sparkly!" [Sparkles, Flower background] [Balloon Bram=Normal balloon,50,sparkle]
Page 2
1: Ada "Hatched" [Cross-hatching] [Balloon Ada=Normal balloon,50,rect]
2: Bram "Toned" [Gradient tone] [Balloon Bram=Normal balloon,50,fude]
3: Ada "One / two / three" [Halftone dots, Rain]
4: Bram "Flash" [Light rays, Snow] [Balloon Bram=Normal balloon,50,flash]
5: Ada "Out of the box!" [Breakout figure, Full shot, Low angle, Large panel, Curved speed lines] [Balloon Ada=Burst balloon,90,urchin]
`;

const ROOMS_PLOT = `Title: Rooms
Reading direction: Left to right
Format: comic
Cast: Ada=F01 (165cm), Bram=M01 (180cm)
# Scene: School [Background classroom]
Page 1
1: Background (classroom) [Establishing shot]
2: Ada "Happy!" Bram [Medium shot, Joy]
3: Bram "Angry." [Close-up, Conflict]
# Scene: Home [Background living room]
Page 2
1: Ada Bram [Establishing shot, High angle]
2: Ada "Sad..." [Close-up, Sadness]
3: Bram "What?!" [Close-up, Surprise] [Bram face=surprised,100]
# Scene: Night [Background bedroom]
Page 3
1: Ada Bram [Long shot]
# Scene: Coffee [Background cafe]
Page 4
1: Ada "Latte?" Bram [Two-shot]
# Scene: Work [Background office]
Page 5
1: Ada Bram [Long shot, High angle]
# Scene: Out [Background street]
Page 6
1: Ada Bram [Establishing shot]
# Scene: Green [Background park]
Page 7
1: Ada "Nice day." Bram [Long shot]
`;

const engine = new Engine(root);
try {
  for (const [name, plot, style] of [['sample', SAMPLE], ['stress', STRESS], ['look', LOOK], ['look-tone', LOOK, 'tone'], ['rooms', ROOMS_PLOT]]) {
    const t0 = Date.now();
    const r = await engine.call('comicalize', { plot, opts: { seed: 'TEST' }, renderStyle: style || 'shaded' });
    console.log(`\n=== ${name}: "${r.title}" ${r.dir}, ${r.pages.length} pages, ${Date.now() - t0} ms`);
    for (const n of r.notices) console.log(`  [${n.level}] line ${n.line}: ${n.text}`);
    for (const p of r.pages) {
      console.log(`  p.${p.number} ${p.side}${p.turnAfter ? ' (turn after)' : ''} ${p.layout.preset}#${p.layout.index} cast ${p.cast.join('+')} total ${p.total}`);
      for (const pn of p.panels) console.log(`    ${pn.label.padEnd(34)} ${String(pn.score).padStart(3)}  ${pn.script.dialogue.map((d) => `${d.speaker}:${d.kind}${d.off ? '/off' : ''} "${d.text}"`).join(' ')}${pn.script.caption ? ` cap "${pn.script.caption}"` : ''}`);
      fs.writeFileSync(path.join(out, `${name}-p${p.number}.jpg`), dataUrlToBuffer(p.png));
    }
  }
  console.log(`\nOK — previews in ${out}`);
} finally {
  await engine.close();
}
