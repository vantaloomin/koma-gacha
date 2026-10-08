<p align="center"><img src="public/koma-logo.svg" width="96" alt="Koma logo"></p>

# Koma

*Koma* (コマ) is Japanese for a comic panel. Koma is a local storyboarding tool for manga and comics. It generates page layouts, points a camera at 3D mannequins in every panel, poses the characters, letters the page, and exports it for print or as a reference and prompt for an image model. An MCP server lets an AI assistant build whole comics with the same engine.

Everything runs on your own machine. No account, no uploads.

## Features

- **Page layouts:** batch-generate layouts from presets (Orderly, Standard, Action, Splash, Even grid, Strip rows). Options include slanted gutters, insets, diagonal splits, full-bleed panels, a "key panel" that is the biggest on the page, and manga (right-to-left) or western reading order. Formats: B5 manga, US Letter, US comic book, 4:5 and square.
- **Camera gacha:** roll several camera plans for a scene and Koma scores each panel: framing, look room, the 180° rule, shot variety and more. Lock the panels you like, reroll the rest, or set the camera by hand.
- **Characters:** colour-coded mannequins with their own heights, or load your own `.vrm` models.
- **Poses:** a library of 130+ poses: standing, gestures, emotions, movement, actions, dance, sitting, lying, fighting, and pair and trio poses (hugs, handshakes, carries). Upper-body gestures layer on top of a base pose, e.g. seated + drinking.
- **Pose editor:** rotate joints directly, mirror, attach props, edit pair and trio poses, and save your own poses to the library. You can send a panel's poses to the editor and back.
- **Props:** 100 props (furniture, food and drink, tech, bags, weapons, outdoor…) that characters can hold, sit on or have placed in the scene. Many use free CC0 models from Kenney.
- **Lettering:** speech, thought, shout and whisper balloons, captions and sound effects with real text. Balloons avoid faces and bodies, stay inside the panel (or deliberately break the border) and can be dragged into place.
- **Export:** PNG, layered SVG, JSON, and print-ready pages with bleed and crop marks (PNG at true size and DPI, PDF with TrimBox/BleedBox).
- **Image prompts:** export a page or a single panel as a reference image plus a prompt for an image model such as GPT Image. The mannequin colours map to your character descriptions; anything you leave out becomes a `{VARIABLE}` to fill in.
- **Video:** turn a storyboard page into an animatic. Every panel becomes a timed shot; give a shot an end keyframe and Koma blends the camera move (push in, orbit, crane…), pose changes, people walking and group poses (e.g. two people stepping into a hug). Exports MP4 with subtitles or balloons, plus matching depth, line-art and OpenPose control videos for AI video models.
- **MCP server:** create comics, add pages, direct panels, render and export through an MCP client such as Claude Code or Claude Desktop. A built-in `guide` tool gives the assistant craft tips on shots, pacing, layouts, acting, lettering and video.

## Requirements

- [Node.js](https://nodejs.org/) 20.19 or newer (22 LTS recommended)
- For the MCP server only: Microsoft Edge or Google Chrome installed (used as a headless renderer)

## Getting started

Download the latest release from the [Releases page](https://github.com/vantaloomin/koma-gacha/releases) and unzip it, or clone the repository.

**Windows:** double-click `start.bat`. On the first run it installs dependencies, then opens Koma in your browser.

| File | What it does |
| --- | --- |
| `start.bat` | Starts Koma on http://localhost:6170 and opens it. `start.bat nobrowser` skips opening the browser. |
| `stop.bat` | Stops Koma. `stop.bat mcp` also stops a stuck MCP server and its headless renderer. |
| `restart.bat` | Stop, then start. |
| `status.bat` | Shows what's running on Koma's ports. |

**Any platform:**

```bash
npm install
npm run dev
```

Then open http://localhost:6170.

Ports: the app uses **6170**. The MCP server's headless renderer uses **6171**, or the next free port.

## Using Koma

Koma has four workspaces (switch with `1` to `4`):

1. **Pages:** generate page layouts. Choose a preset, panel count range, format, bleed and reading direction, then browse the results and export one as SVG or PNG. The same layouts are available in Shots.
2. **Shots:** stage a scene on a layout. Open the **Layout** and **Characters** drawers to choose the layout and cast, set each character's base pose, then press **Roll** (`R`) for camera proposals. Click a panel to edit its camera, poses, held props and script (balloons, caption, SFX). Drag balloons to reposition them, and double-click one to reset it. Export from the toolbar: PNG, SVG, print PNG, JSON, image prompt or a shareable link.
3. **Poses:** the pose editor. Load a pose, drag the joint rings, add props, switch between solo, pair and trio, and **Save to library**. Saved poses go to `poses/custom/` and appear everywhere in Koma, including the MCP server.
4. **Video:** plays the current Shots page as an animatic. Pick a shot on the timeline and set its length, how it starts (cut, dissolve or fade), a camera move, and how the shot ends: shot size, each character's end pose, where they walk, and a group pose. **Output** sets the size (16:9, 9:16, square, 2.35:1), frame rate, lettering (subtitles, balloons or none) and a slow drift on still shots. **Export** writes the MP4 animatic, depth / line-art / OpenPose control videos with the same timing, and a shot list. Video export needs a current Chrome or Edge (WebCodecs).

Handy keys: `R` roll · `[` `]` previous/next proposal · Shift-click to multi-select · `Del` delete panels · `Ctrl+Z` undo · `Esc` deselect · `↑` `↓` walk the pose library · `Space` play/pause video · `←` `→` step a frame. The full list is in the About dialog.

### Adult pose pack

Koma includes an optional pack of adult poses for mannequins. It is off by default and never chosen by the camera gacha. It must be switched on explicitly: in the app with the pose editor's **Adult pack** switch, and in the MCP server per comic with `set_comic_options { adult_content: true }`. It only applies to characters marked as adults who are 150 cm or taller.

## MCP server (build comics with an AI assistant)

`mcp/server.js` is a standard stdio MCP server. Add it to your MCP client's configuration, replacing the path with where you put Koma:

```json
{
  "mcpServers": {
    "koma": {
      "command": "node",
      "args": ["/path/to/koma-gacha/mcp/server.js"]
    }
  }
}
```

With Claude Code you can register it from a terminal instead:

```bash
claude mcp add --scope user koma -- node "/path/to/koma-gacha/mcp/server.js"
```

Run `npm install` in the Koma folder first. The server starts its own headless renderer, so the app doesn't need to be running.

**What it can do:** `create_comic`, `add_character`, `find_layouts`, `add_page`, `roll_page`, `edit_panel` (camera, poses, pair and trio poses, held props), `set_staging` (base poses, scene props), `set_page_script` / `set_panel_script`, `render_page`, `export_comic` (PNG, PDF, HTML, print with bleed and crop marks), `export_image_prompt`, `export_panel_guides`, `set_panel_image`, `set_shot_motion` / `preview_motion` / `export_video` (animatics and control videos), plus pose and prop browsing (`list_poses`, `pose_sheet`, `list_props`, `prop_sheet`, `save_pose`) and the `guide` tool for craft advice.

A typical request: *"Make a one-page comic: a soldier comes home from the war and sees his wife for the first time in years."* The assistant creates the characters, picks a layout with the hug as the key panel, directs each panel and exports the page.

**Where comics are saved:** `comics/<id>/` inside the Koma folder (`comic.json`, renders, guides, exports). Set `NG_COMICS_DIR` to save them elsewhere, and `NG_BROWSER_PATH` to use a specific Chromium-based browser.

### From storyboard to video

1. Build the pages, then give shots motion with `set_shot_motion` (or in the app's Video workspace).
2. `export_video` with `controls: ["depth", "pose"]` writes the animatic, control videos with identical timing, and a `-shots.txt` shot list to `comics/<id>/export/video/`.
3. Feed the control videos and the shot notes to a video model (e.g. Wan VACE in ComfyUI) to get your blocking, camera moves and timing with finished characters.

### From storyboard to finished art

1. Build the page in Koma (app or MCP).
2. Either export an **image prompt** (reference image + prompt) for an image model such as GPT Image, or export **panel guides** (render, depth and line-art PNGs per panel) for ControlNet-style workflows, e.g. in ComfyUI.
3. Generate the art. To keep the lettering crisp, bring the panels back with `set_panel_image`; Koma draws the balloons over the art and exports the finished pages.

## Customising

- **Poses:** add files in `src/poses/` (format guide in [`src/poses/README.md`](src/poses/README.md)), or save them from the pose editor.
- **Props:** `src/props/catalog.js`. Props are built from simple shapes and can optionally map onto a model in `public/models/` via `src/props/models.js`.
- **Contact sheets:** `node tools/sheet.mjs poses <category|ids> out.png [--view=side] [--adult]` or `node tools/sheet.mjs props <category|ids> out.png`.
- **Scoring and layouts:** camera scoring weights live in `src/gacha.js`, the layout generator in `src/layout.js`.

## Credits

Koma is an original tool, inspired by Japanese panel-layout and storyboard ("name") gacha tools.

- 3D: [three.js](https://threejs.org/) and [@pixiv/three-vrm](https://github.com/pixiv/three-vrm) (MIT)
- Models: [Kenney](https://kenney.nl/) Furniture Kit and Food Kit (CC0; licenses in `public/models/kenney/`)
- Fonts: Comic Neue, Bangers and Inter (SIL Open Font License), via Fontsource
- Icons: [Lucide](https://lucide.dev/) (ISC)
- Video: [Mediabunny](https://mediabunny.dev/) (MPL-2.0), MP4 muxing over WebCodecs
- PDF: [pdf-lib](https://pdf-lib.js.org/) (MIT); headless rendering: [Playwright](https://playwright.dev/) (Apache-2.0); MCP: [Model Context Protocol SDK](https://github.com/modelcontextprotocol/typescript-sdk) (MIT)

## License

[MIT](LICENSE)
