# CLAUDE.md

Personalized birthday RPG inspired by Stardew Valley. Loved ones submit custom character sprites via an invite link; the birthday person explores a village meeting them.

## Tech Stack

- **Build**: Vite 8, TypeScript 5.9 (strict), base path `/mosaic/`
- **Game**: PixiJS 8 + @pixi/tilemap, 480x270 internal resolution, integer-scaled
- **Portal**: React 19 (submission form with pixel sprite editor)
- **Editor**: Vanilla Canvas-based Tiled map editor (dev-only)
- **Backend**: Firebase Realtime Database (public read, token-gated write)
- **Tests**: Vitest 4
- **Browser automation**: Playwright MCP (`@playwright/mcp`) for visual debugging
- **Deploy**: GitHub Pages via `.github/workflows/deploy.yml`

## Project Structure

```
index.html              -> src/game/main.ts       (PixiJS game, /mosaic/)
submit/index.html       -> src/portal/main.tsx     (React portal, /mosaic/submit/?token=...)
editor/index.html       -> editor/main.ts          (map editor, /mosaic/editor/)

src/
  game/                 # PixiJS game engine
    main.ts             # Boot: init app, load tilemap + NPC sprites, camera loop
    tilemap.ts          # TMJ loader, renders ground/buildings/decoration layers
    camera.ts           # Arrow/WASD input, 2px/frame speed, clamped to map bounds
    viewport.ts         # Integer-scaled 480x270 viewport with letterboxing
    npcs.ts             # Fetches submissions from Firebase, renders sprites on map
  portal/               # React submission form
    App.tsx             # PasswordGate -> SubmissionForm
    components/
      PasswordGate.tsx  # SHA-256 password gate (sessionStorage cached)
      SubmissionForm.tsx # Name input + sprite editor + save button
      PixelEditor.tsx   # 16x32 canvas pixel editor with undo/redo
      PalettePicker.tsx # Color palette swatches (168 colors from Ninja Adventure)
    hooks/
      useSubmission.ts  # Firebase load/save for /submissions/{token}
  shared/               # Shared between game + portal
    types.ts            # Submission, SpriteData interfaces
    palette.ts          # PALETTE constant (168 hex colors), TRANSPARENT = ""
    firebase.ts         # Firebase client init (env vars: VITE_FIREBASE_*)

editor/                 # Standalone map editor (not bundled in prod)
  main.ts               # Editor state, events, GID keyboard input, auto-save
  renderer.ts           # Canvas rendering: renderMap, renderPalette, drawTile
  tmj.ts                # TMJ types + createEmptyMap helper
  style.css             # Dark theme (Ubuntu Mono, #300A24 bg, #E95420 accent)

public/
  maps/                 # TMJ map files (village.tmj, home.tmj, bedroom.tmj)
  tilesets/             # 20 PNG tilesets from Ninja Adventure (CC0)
```

## Commands

```bash
npx vite              # Dev server (usually http://localhost:5173/mosaic/)
npx vite build        # Production build -> dist/
npx vitest            # Run tests
npx vitest run        # Run tests once (CI)
```

## Key Conventions

- **Tile size**: 16x16 pixels. Sprite size: 16x32 pixels.
- **Maps**: 40x30 tiles (640x480 pixels). TMJ format (Tiled JSON).
- **Layers**: ground, buildings, decoration, collision (in render order). Collision is non-rendered; parsed into a Set of blocked tile indices.
- **GIDs**: Global tile IDs across all 20 tilesets. GID 1 = first tile of TilesetFloor. Each tileset's `firstgid` is computed by summing previous tileset tile counts.
- **Map files**: Saved to `public/maps/{name}.tmj`. The editor auto-saves via POST `/api/save-map/{name}` (dev-only Vite middleware).
- **Firebase path**: `/submissions/{token}` where token comes from the URL query param `?token=...`

## Vite Dev Plugins (vite.config.ts)

The `mapWriterPlugin` provides two dev-only features:
1. **POST `/api/save-map/{name}`**: Writes JSON body to `public/maps/{name}.tmj`
2. **File watcher**: Watches `public/maps/` and sends `map-update` HMR events so the editor hot-reloads maps without full page refresh

## Editor Keyboard Shortcuts

- **Digits (0-9)**: Type a GID number rapidly (600ms timeout) to jump to that tile. Switches tileset dropdown, highlights tile, scrolls palette into view.
- **Ctrl+Scroll**: Zoom map canvas or palette independently (scale 1-16x)
- **Click palette**: Select tile by clicking in the tileset palette
- **Click/drag map**: Paint (with selected tile), erase, or inspect tiles

## End-to-End Testing Workflow

### 1. Paint the village map
Start the dev server (`npx vite`), open `/mosaic/editor/`. Paint tiles on the village map. Every stroke auto-saves to `public/maps/village.tmj` via the dev API. You can also edit the map programmatically:
```javascript
// In browser console or via fetch:
const resp = await fetch('/mosaic/maps/village.tmj');
const map = await resp.json();
const ground = map.layers.find(l => l.name === 'ground');
// Modify ground.data[index] = gid;
await fetch('/api/save-map/village', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(map, null, 2)
});
```

### 2. Verify the game renders the map
Open `/mosaic/`. The PixiJS game loads `village.tmj`, renders all tile layers, and supports camera scrolling with arrow keys / WASD.

### 3. Test the submission loop
- Open `/mosaic/submit/?token=test-token-abc`
- Bypass the password gate: `sessionStorage.setItem("mosaic-authed", "true")` then reload
- Enter a name, draw a sprite on the 16x32 pixel canvas, click Save
- Reload the page -- name and sprite should persist (loaded from Firebase)
- Open `/mosaic/` -- the sprite should appear on the village map (rendered by `npcs.ts` from Firebase data)

### Programmatic sprite submission (via browser console)
```javascript
// After bypassing password gate:
const canvas = document.querySelector('canvas');
const rect = canvas.getBoundingClientRect();
function clickCell(x, y) {
  const cx = rect.left + (x + 0.5) * rect.width / 16;
  const cy = rect.top + (y + 0.5) * rect.height / 32;
  canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: cx, clientY: cy, bubbles: true }));
  canvas.dispatchEvent(new PointerEvent('pointerup', { clientX: cx, clientY: cy, bubbles: true }));
}
// Draw pixels: clickCell(col, row)
```

## Environment Variables

Required in `.env.local` (not committed):
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_DATABASE_URL=...
```
These are also set as GitHub Actions secrets for the deploy workflow.

## Firebase Database Rules

```json
{
  "rules": {
    "submissions": {
      ".read": true,
      "$token": { ".write": true }
    }
  }
}
```

## Browser Automation (Playwright MCP)

Configured in `.mcp.json`. Provides orchestrator-agnostic browser automation via `@playwright/mcp` — works with Claude Code, Amplifier, VS Code, Cursor, or any MCP client.

```bash
# The MCP server launches Chrome at 960x540 (2x the 480x270 game viewport).
# Tools available: browser_navigate, browser_click, browser_type,
# browser_snapshot, browser_console_messages, browser_evaluate, etc.
```

### Visual debugging workflow
1. Start the dev server: `npx vite`
2. Use `browser_navigate` to open `http://localhost:5173/mosaic/` (game), `/mosaic/editor/` (editor), or `/mosaic/submit/?token=...` (portal)
3. Use `browser_snapshot` to inspect the accessibility tree
4. Use `browser_evaluate` to run JS (e.g. read console, modify game state)
5. Use `browser_console_messages` to check for errors

## Design Reference

- `context/design.md`: Full game design spec (narrative, mechanics, audio, accessibility)
- `docs/plans/m1-submission-playtest-loop.md`: Milestone 1 implementation plan
