// Craft guidance for people and LLMs using the comic MCP (served by the `guide` tool).
// Practical rules of thumb for visual storytelling, tied to this tool's parameters.

export const GUIDE = {
  overview: `HOW TO MAKE A GOOD PAGE (short version)
1. Write the page as beats first: what changes from panel to panel? One beat per panel.
2. Choose the panel count from pacing (see "layouts"). Fewer, bigger panels = slower, heavier moments.
3. Decide which panel carries the page's key moment and make it the biggest: add_page / roll_page layout.key_panel = N.
4. Script each panel: 0–2 balloons, ~25 words max per panel; silent panels are allowed and powerful.
5. Stage the bodies: set_staging for the scene's base poses (seated, lying...), edit_panel poses/pair/hold for acting beats.
6. Roll the gacha, look at the preview, fix what reads wrong with edit_panel (camera, poses) and lock good panels.
7. render_page diagnostics=true to check reading flow, the 180° axis and weak scores. Then export.
8. For video: set_shot_motion per panel (camera move, end poses, moves, length), preview_motion, then export_video.
Topics: shots, layouts, pacing, acting, lettering, groups, workflow, video, image_prompts.`,

  shots: `SHOT SIZES (edit_panel camera.size) — what each one says
- extreme_wide: where we are; characters are small in a big world. Openers, isolation, scale.
- full: whole bodies; posture and movement read clearly (walking, fighting, a run toward someone).
- medium: waist up; the workhorse for conversation and gesture.
- medium_closeup: chest up; conversation with emotion, the default for important lines.
- closeup: face fills the panel; reactions, realisations, the line that matters most.

SHOT TYPES (camera.shot_type)
- establishing: first panel of a scene or after a location change; show the space before the drama.
- two_shot: both characters at once; relationship, distance between them, physical contact (a hug).
- over_shoulder: back-and-forth dialogue; keeps the listener present while we watch the speaker.
- single: one character; isolate a reaction or a declaration.

ANGLE (camera.elevation, degrees)
- Eye level (−5…+10): neutral, the default.
- High angle (+20…+45, looking down): smallness, vulnerability, loneliness; also good for establishing.
- Low angle (−10…−30, looking up): power, resolve, threat, a hero moment.
- Dutch tilt (camera.dutch 5–15): unease, chaos, a world off balance. Use sparingly.

RULES OF THUMB
- Don't use the same size twice in a row unless you mean to (a slow push-in from medium to closeup is fine).
- Stay on one side of the conversation axis (the 180° rule). The tool keeps cameras on one side; a "!" score means a manual edit crossed it.
- Leave look room: put space in front of the face, in the direction they look (camera.frame_x).
- Reactions are often more powerful than the line that caused them: give a silent closeup after a big line.`,

  layouts: `PANEL COUNT BY PACING (add_page panel_count / layout preset)
- 1–3 panels (preset splash): reveals, arrivals, the climax of a chapter.
- 3–5 (standard/action): action beats, emotional turns. Big panels slow the reader down.
- 5–8 (standard/orderly): normal conversation pages.
- 9–12 (grid/strips): rapid back-and-forth, montage, comedy timing, many small beats.

PRESETS
- orderly: calm, regular rows; dialogue-heavy scenes.
- standard: varied rows, occasional big key panel bleeding off the page.
- action: slanted dividers, insets, diagonal splits; fights, chaos, speed.
- splash: one or two huge panels; reveals and title pages.
- grid (grid: '3x3' etc.): even rhythm; deadpan comedy, time passing, formal or tense calm.
- strips: 5–6 thin rows with a repeated slant; quick cuts, phone calls, a sense of momentum.

LAYOUT DEVICES
- key_panel = N: make panel N the biggest. Put the emotional peak or the reveal there.
- bleed 'key': only the key panel runs off the page; reads as "this moment is bigger than the frame".
- insets: a small panel over a big one; a detail, a thought, or a reaction during a big moment.
- diagonal_splits: two triangles; simultaneous action or a clash of two sides.
- The last panel of a right-hand page sets up the page turn; save surprises for the next page's first panel.
Use find_layouts to preview candidates (contact sheet) before committing.`,

  pacing: `PACING
- One beat per panel. If a panel needs two actions, it is two panels.
- Time between panels is decided by the reader: a big gap (closeup → wide shot elsewhere) implies time passing; a small change implies a moment later.
- Silent panels (no balloons) slow time and let emotion land. Put one right after a big line or before the reveal.
- Build to the key panel: smaller, faster panels before it, then the biggest panel.
- Open a scene wide (establishing), move in as emotion rises (medium → closeup), pull back to end or to show consequences.
- Captions are for time/place jumps and narration ("Autumn, 1945."), not for describing what the picture already shows.`,

  acting: `ACTING (poses)
- Base vs moment: set_staging gives each character a base for the page (sitChair, kneel, lieBack...). edit_panel poses add the moment (upper-body overlays like talk, facepalm, drinkCup stack on the base).
- The gacha only picks conversational gestures. Choose actions, fights, dances and emotions deliberately with edit_panel poses.
- Listeners act too: a reaction pose (armsCrossed, coverMouth, slump) often says more than the speaker.
- Props make actions readable: edit_panel hold {Name: {right: 'cup'}}; scene_props place furniture and set dressing.
- Group poses (edit_panel pair / pair_staging) place characters together for contact: handshakes, hugs, carries, fights. Trios use a, b and c.
- list_poses and pose_sheet show what exists; save_pose adds your own (or use the app's Poses tab).
- Emotion cheatsheet: joy → arms up, open gestures; sadness → slump, head down, high angle; anger → fist, point, low angle; fear → cower, step back; love → closeness, two-shot, eye-level closeups.`,

  lettering: `LETTERING
- Keep it short: 1–2 balloons and ~25 words per panel. Split long speeches across panels.
- Order matters: balloons are placed in reading order; the first speaker in a panel is the panel's speaker (the camera favours them).
- Balloon kinds: speech (default), thought (inner voice), shout (anger, alarm), whisper (secrets, shock, tenderness).
- speaker null = narration (no tail); a name not in the panel's cast = off-panel voice (tail points out of the panel).
- Captions: time, place, narration. SFX: sounds as art, large for impact (size 'large'), small for texture.
- Leave room: big closeups of faces leave little space for balloons; give dialogue-heavy beats a medium shot.`,

  groups: `GROUPS (pairs and trios)
- Pair poses need a and b; trio poses need a, b and c (pair_staging / edit_panel pair).
- Roles are body positions, not genders: any characters can fill any role.
- Group poses override the members' individual poses for that panel (or page with pair_staging).
- Contact is tuned for 1.65/1.75/1.70 m figures and scaled to the cast; very different heights can leave small gaps.
- For contact moments (hug, handshake, carry) prefer a two_shot or full/medium framing so both bodies read.`,

  workflow: `WORKED EXAMPLE (one page, 6 panels: a soldier comes home)
1. create_comic {title, format: 'letter', reading_direction: 'ltr', characters: [{name, height_cm, color, description}]}
2. add_page {cast, tone: 'intimate', panel_count: 6, layout: {preset: 'standard', key_panel: 5, bleed: 'key'},
   scene_props: [{prop: 'door', x, z}], panels: [
     {caption: 'Autumn, 1945.', role: 'establish'},            ← establishing, caption sets time/place
     {dialogue: [{speaker: 'June', text: 'Walter...?', kind: 'whisper'}]},
     {dialogue: [{speaker: 'Walter', text: 'Hello, June.'}]},
     {focus: 'June', role: 'reaction'},                          ← silent beat
     {caption: 'Neither of them said anything for a long time.', role: 'key'},   ← the biggest panel
     {dialogue: [{speaker: 'June', text: "You're home."}, {speaker: 'Walter', text: "I'm home."}]}]}
3. edit_panel for acting: walking + hold suitcase (1), coverMouth (2), running with a full shot (4),
   pair hugFriendly with a two_shot medium camera (5).
4. render_page diagnostics=true → fix weak panels → render_page → export_image_prompt or export_comic.`,

  video: `VIDEO (set_shot_motion, preview_motion, export_video)
- Every panel becomes a shot, in reading order. The panel is the START keyframe; set_shot_motion sets the END keyframe and the timing. Frames in between blend: joints rotate smoothly, people slide to new spots, the camera arcs around its subject.
- Length: defaults to reading time (~3 words/s, 2–10 s). Give silent beats and key moments extra time (duration), and quick reactions less (1–1.5 s).
- Camera moves: pushIn for rising emotion or a realisation; pullOut to reveal or to leave a scene; orbitLeft/Right for a slow reveal around a hug or a standoff; craneUp/Down for scale or an ending; slideLeft/Right to follow someone walking; dutch for unease. auto (default) reframes for the end keyframe, i.e. the camera follows the action; locked keeps the start camera.
- Acting: end_poses changes poses (stand → sit, idle → coverMouth); moves walks people (toward: another character, stopping at gap metres; or forward/side/turn); end_pair blends into a group pose (two people stepping into a hug). Big pose changes in one move can pass limbs through the body: split them over two panels or use timing.
- timing {start, end} holds before or after the move (e.g. 0.4–1 = a beat of stillness, then the move) — stillness before a move makes it land.
- Transitions: cut by default; dissolve for time passing within a scene; fade for the end of a scene. Use them rarely.
- Check with preview_motion (frames per shot) before export_video. Keep moves simple: one clear motion per shot reads best.
- Control videos (controls: depth, lineart, pose) share the animatic's timing for AI video models (e.g. Wan VACE in ComfyUI); the -shots.txt file has each shot's camera notes and lines as prompt material.`,

  image_prompts: `IMAGE PROMPTS (export_image_prompt)
- Give every character a description (add_character description): age, build, hair, clothing. Unset ones become {CHARACTER n} variables.
- Set style ("black-and-white manga with screentones", "painted 1940s comic") and setting; unset ones become {STYLE} / {SETTING}.
- blank_balloons: true when you want to letter the final art yourself (more reliable than model-drawn text).
- Export per panel for the best fidelity; whole pages are fine for layout-faithful drafts.`,
};

export const TOPICS = Object.keys(GUIDE);
