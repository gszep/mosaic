# Mosaic: Technical Architecture for a WebGL2-Powered Birthday RPG

A personalized, Stardew Valley-inspired birthday RPG delivered as a web link. The player wakes up on their birthday, receives wishes from parents downstairs, then explores a village collecting presents from loved ones in a short fetch quest. Once all presents are collected, a final cutscene gathers everyone in the village square for a birthday cake under evening lanterns. Target play time: ~10 minutes. Target loved-one count: 5-15.

Development is driven by **Microsoft Amplifier** and **Claude Code**, using a custom pipeline to transform hand-made loved-one assets into a living digital world.

---

## 1. Development-Time Orchestration Layer

* **Microsoft Amplifier & Claude Code**: Amplifier orchestrates the multi-agent pipeline for asset ingestion and dialogue validation. Claude Code handles granular coding tasks: shaders, collision logic, dialogue systems, and portal UI.
* **Vite HMR**: Sub-200ms Hot Module Replacement for real-time iteration on visual flourishes (lighting, text-crawl speed, sprite animation) without losing player position.

---

## 2. Visual Design: Resolution, Tiles, and Palette

### 2.1 Internal Resolution and Viewport

**480x270** internal resolution. This matches Stardew Valley's effective rendering resolution at default zoom.

| Target Display | Scale Factor | Result |
|---|---|---|
| 1080p (1920x1080) | 4x | Pixel-perfect |
| 4K (3840x2160) | 8x | Pixel-perfect |
| 720p (1280x720) | 2.67x | Nearest-neighbor with letterboxing |

**Viewport policy**: The game accepts any viewport size and orientation on both mobile and desktop -- no forced orientation locks, rotation prompts, or landscape/portrait bias. The 480×270 internal resolution is fixed and shows ~30×17 tiles (30×16.875 exactly; the bottom tile row is partially clipped). It is rendered at the largest integer scale that fits the viewport, centered with letterboxing on all sides. Portrait viewports see the same world with more vertical letterboxing. Dialogue boxes and UI elements are positioned relative to the internal resolution, so they render correctly at any aspect ratio.

**Tile size: 16x16 pixels**, the dominant standard across classic and modern pixel RPGs (Pokemon GBC/GBA, Stardew Valley, Final Fantasy, EarthBound). This yields a viewport of ~30x17 tiles, providing generous world visibility while maintaining the chunky pixel aesthetic of handheld games.

**Character sprites: 16x32** (1 tile wide, 2 tiles tall), matching the Stardew Valley convention.

### 2.2 Dialogue Box Layout

The dialogue box occupies 4 tile rows (64px) at the bottom of the screen, spanning ~90% of screen width with small side margins. This uses **~24% of screen height** -- a clean modern proportion that leaves 206px (12.9 tile rows) of visible playfield above.

For reference, classic RPG dialogue proportions:
- Pokemon (GBC): ~30-33% of screen height
- EarthBound (SNES): ~25-30%
- Modern pixel RPGs on sharp displays: ~20-25%

### 2.3 Colorblind-Friendly Palette

The game palette is **extracted directly from the Ninja Adventure asset pack**. No custom palette is designed -- the pack's existing colors are used as-is. This guarantees visual coherence between loved-one-created sprites and the environment, and avoids any palette mismatch or recoloring workflow.

**Protan safety**: The Ninja Adventure pack uses bold outlines and high value contrast between elements, making shapes readable even under protan color vision (the boyfriend's specific type) where color distinctions collapse. The palette is verified against protan/deutan simulation during development.

**Design principles:**
- Never rely on color alone for game state; always pair with shape/icon/text cues
- Strong value contrast (light/dark) between all functional elements
- The portal's color picker shows **only Ninja Adventure palette swatches** -- no color wheel, no hex input

**Testing tools:** Color Oracle (real-time desktop overlay) during development. Coblis and DaltonLens for export verification. Final testing with an actual colorblind user.

### 2.4 Asset Sourcing Strategy

This is a non-commercial birthday gift. All selected asset packs must permit non-commercial use.

| Asset Pack | Author | License | Content |
|---|---|---|---|
| **Ninja Adventure** | pixel-boy | CC0 (public domain) | Massive top-down pack: terrain, buildings, interiors, items, UI, NPC sprites. Sole tileset and palette source. |
| **Kevin MacLeod** | Kevin MacLeod | CC BY 3.0 (requires attribution) | Royalty-free ambient and cozy music tracks for scene backgrounds. |

**Asset strategy**: Ninja Adventure is the single art source for both tiles and palette. Loved-one character sprites created via the submission portal are constrained to the pack's color palette, ensuring visual consistency.

### 2.5 Aesthetic Influences

The visual direction blends three eras of handheld history with two modern indie influences:

* **GBC (Gen 2)**: High-saturation palettes and extreme economy of detail.
* **GBA (Gen 3)**: Clean tiling systems and refined character outlines (Pokemon Emerald).
* **DS (Gen 4/5)**: Dynamic world elements -- day/night cycles, glowing lanterns (HeartGold/SoulSilver).
* **Stardew Valley**: The primary influence. Warm earthy tones, environmental "juice" (swaying grass, water ripples), cozy interiors.
* **Undertale**: Emotive sprites with minimal pixel movements, character-specific voice beeps.

---

## 3. Narrative and Game State

### 3.1 Story Arc

1. **Wake up** -- Black screen with "Wake up" text. Any player interaction (tap/click/key) fades the black out, revealing the player's bedroom.
2. **Go downstairs** -- Parents wish happy birthday. First dialogue interaction.
3. **Exit house** -- Village overworld opens up. Music changes.
4. **Fetch quest** -- Visit loved ones scattered around the village. Each loved one has a short dialogue exchange and gives a present (a gift object chosen by the loved one via the portal). Loved ones control their character's appearance, dialogue, audio, and gift object. Some loved ones are in the village square, others are inside houses or shops. The developer controls all NPC placement via Tiled.
5. **All presents collected** -- Time of day shifts to evening. The village square transforms: lanterns glow, a fire pit with marshmallows appears. Everyone gathers. Birthday cake. End screen.

**NPC placement**: The Tiled `spawns` object layer is the sole source of truth for NPC coordinates. Each spawn point has a custom property `npcId` matching a database record. The database holds character data (sprite, dialogue, audio, gift) but never coordinates. By default, all loved ones are placed in the village square; the developer repositions NPCs in Tiled as the map matures. A `locationDescription` field in the database (developer-editable only, shown read-only to loved ones in the portal) communicates where their character lives -- e.g., "Near the fountain in the village square" or "Inside the bakery on the east side."

**Walk cycles (stretch goal)**: Tiled polyline objects on the spawns layer, linked by the same `npcId`. The NPC patrols the polyline path. Since coordinates live entirely in Tiled, adding pathing requires no database schema changes.

### 3.2 Game State Architecture

A full ECS is overkill for a 10-minute game with ~10-30 entities. Use a **simple state object with flags**:

```
gameState = {
  currentScene: "bedroom",
  player: { tileX, tileY, direction },
  flags: {
    presentCount: 0,
    totalPresents: N,  // 5-15, driven by loved-one submissions
  },
  npcs: [
    // tileX, tileY, scene are loaded from Tiled spawns layer at startup, not stored in DB
    { id, tileX, tileY, scene, dialogueKey, interacted: false, givesPresent: true, giftObject: "..." },
    ...
  ]
}
```

**Scene manager**: A simple map of scene names to scene objects. Each scene has its own update/render loop and entity list. Scenes: `bedroom` (2nd floor of home), `house_downstairs` (kitchen/living room, 1st floor of home), `village` (overworld), `npc_home` (a loved one's interior), `shop` (shop/market run by a loved one). The village square is part of the village scene -- the evening transition is a lighting/palette swap, not a scene change.

**Save system**: Not needed. The game is short enough to play in one sitting.

**Database dependency**: The game fetches all loved-one data from the database **once at startup**. All assets, dialogue, and NPC data are loaded into memory before gameplay begins. After startup, the game has no further database dependency -- a database outage mid-session cannot affect the player. If the database is unavailable at startup, the game does not load.

---

## 4. Movement and Collision

**Smooth interpolated movement with grid-based collision.** The player moves fluidly through the world (Stardew Valley feel) but the collision model underneath operates on the tile grid (Pokemon simplicity). This combines the visual warmth of analog movement with the implementation simplicity of discrete collision.

**Implementation**:

- Player position is tracked as a tile coordinate `(tileX, tileY)` for collision purposes. Movement input queues a target tile.
- Before moving, check if the target tile is solid (collision layer from Tiled) or occupied by an NPC.
- Animate the sprite sliding smoothly from current position to target position over ~150-200ms.
- NPC interaction: pressing interact (keyboard) or double-tapping (mobile) triggers interaction with any NPC within 2 tiles of the player. NPCs must be placed far enough apart in Tiled to prevent ambiguous interactions.
- Walking animation plays during the slide; idle animation when stationary.

This approach eliminates the need for sub-tile AABB collision, corner-sliding edge cases, and precise hitbox tuning, while still producing visually smooth movement that pairs well with environmental animation (swaying grass, water ripples).

**Mobile input**: Tap and hold to move in the direction of the hold position relative to screen center. Double tap to interact with the nearest NPC within 2 tiles. No virtual d-pad or on-screen buttons.

---

## 5. Dialogue System

### 5.1 Dialogue Modes

Each NPC uses **one** dialogue mode, chosen by the loved one during portal submission:

**Mode A: Hardcoded dialogue tree.** The loved one authors a full dialogue tree during submission: NPC lines, player response choices, branching follow-ups, and conversation endpoints. Trees can be arbitrary in structure -- linear, branching, or even looping (e.g., an NPC that keeps redirecting the conversation back to an earlier node to mess with the player). The only constraint is that at least one path through the tree must reach a leaf that ends the conversation and gives the gift. No AI involvement.

**Mode B: AI-generated dialogue.** The loved one provides personality traits and a personality prompt during submission. At runtime, the interaction follows a fixed 3-turn structure:

1. Player interacts with the NPC.
2. The Gemini API generates an initial greeting and 3 possible player responses.
3. The player selects one of the 3 responses.
4. The Gemini API generates a final response based on the selected option.
5. The conversation ends and the NPC gives their gift.

Hardcoded dialogue data format:
```json
{
  "speaker": "NpcName",
  "mode": "hardcoded",
  "tree": {
    "id": "root",
    "text": "Happy birthday!",
    "responses": [
      {
        "option": "Thanks! What did you get me?",
        "next": {
          "id": "gift_eager",
          "text": "Something you'll love.",
          "responses": null
        }
      },
      {
        "option": "Do I know you?",
        "next": {
          "id": "gift_funny",
          "text": "Very funny. Here, just take your present.",
          "responses": null
        }
      },
      {
        "option": "Wait, say that again?",
        "goto": "root"
      }
    ]
  },
  "giftObject": "telescope"
}
```

AI dialogue data format:
```json
{
  "speaker": "NpcName",
  "mode": "ai",
  "traits": ["cheerful", "nerdy"],
  "personalityPrompt": "You are a bubbly scientist who loves space...",
  "giftObject": "telescope"
}
```

### 5.2 AI Dialogue Backend

AI dialogue calls the **Gemini API directly from the client** using a Google AI Studio API key.

| Model | Pricing | Use Case |
|---|---|---|
| Gemini 2.5 Flash-Lite | Pay-as-you-go (~fractions of a cent per request) | All AI dialogue |

A **$5-10 monthly spending cap** is set on the Google AI Studio billing account. Even if the API key is extracted from client code, spending is hard-capped. This is acceptable because the game is invite-only, shared with ~15 trusted loved ones.

**Architecture**: The game client calls the Gemini API directly with the NPC's personality prompt + the player's selected response. No client-side caching -- Gemini is cheap enough that fresh requests on every interaction are fine. If the API is unreachable, the game falls back to a generic "Happy birthday!" greeting for AI-mode NPCs.

**Content safety**: The personality prompt constrains tone and topic. The API call includes a system instruction enforcing birthday-appropriate, wholesome responses. Responses are length-capped (max ~100 tokens per exchange). This is an invite-only game shared with a known group of loved ones.

**Privacy**: No conversation data is stored beyond the transient API request. Nothing is cached or persisted on the client.

### 5.3 Dialogue Presentation

- **Typewriter effect** with character-specific blip sounds (pitch-shifted per character).
- **GPU-accelerated BitmapText** via PixiJS for text effects (shake, color-shift) without performance impact.
- **Dialogue box** styled with a pixel-art border, semi-transparent background, and speaker name label. For AI-mode NPCs, the 3 player response options are displayed as selectable items below the NPC's greeting.

---

## 6. Submission Portal

An **invitation-only** web app where loved ones contribute their characters. The portal enforces stylistic consistency while giving creative freedom. Loved ones can **edit their submissions at any time** and **playtest a draft of the game** to see their character in action.

### 6.1 Data Persistence and Access

A small database (e.g., Supabase, PlanetScale, or a simple SQLite via Turso) stores loved-one submissions. Each loved one receives an invite link containing a **unique token in the query parameters** (e.g., `gszep.com/mosaic/submit?token=abc123`). The token uniquely identifies the loved one and their submission.

**Access control**: Two-layer gate. First, a client-side password prompt protects the portal from bots and casual unauthorized access. The password is a single shared secret distributed to loved ones alongside their invite link; the client stores only a hashed form and validates input against it. After the password is accepted, the portal reads the unique token from the URL to identify the loved one and load their submission. Both the password and a valid token are required -- the password alone grants no access, and a token without the password is blocked at the gate.

Submissions include:
- Loved one's display name
- Character sprite data (layers + colors, or raw pixel data from the freeform editor)
- Dialogue mode choice (hardcoded lines or AI personality prompt + traits)
- Gift object name (text description; developer creates the pixel art asset)
- Named audio blip recordings (or preset selections)
- `locationDescription` (developer-editable only, shown read-only to loved ones): a text description of where their character is placed in the game world, e.g., "Inside the bakery on the east side." Defaults to "In the village square."

When a loved one opens their invite link, the portal checks for an existing submission under that token. If one exists, all previously saved data is loaded into the portal so the loved one can continue editing where they left off. If no submission exists, the portal starts with a blank state.

The game client fetches loved-one data from this database at load time, making the game always reflect the latest submissions. Local development uses the same live database to maintain a shared view of assets.

### 6.2 Character Creator (Two-Phase)

The character creator has two phases. The loved one can submit after phase 1 without entering phase 2.

**Phase 1: Template assembly.** A layered "paper doll" system where loved ones select from pre-drawn options to establish the overall shape, clothing, and style:

- **Base body**: 2-3 body type templates (all 16x32, pre-drawn to the project's pixel style)
- **Skin tone**: Palette ramp selection (3-4 colors per ramp: base, shadow, highlight)
- **Hairstyle**: 8-12 pre-drawn options, each palette-swappable
- **Clothing top**: 8-10 options, palette-swappable
- **Clothing bottom**: 6-8 options, palette-swappable
- **Accessory slot**: Hats, glasses, scarves, etc. (optional)

Each layer uses **only colors from the Ninja Adventure asset pack**. The color picker shows **only palette swatches extracted from the pack** -- no color wheel, no hex input. This guarantees visual coherence with the game world and colorblind safety.

**Phase 2: Freeform editing (optional).** The assembled template is flattened into a custom `<canvas>`-based pixel editor (a focused React component, ~200-400 lines, zero external dependencies) where the loved one can make final touches -- adding details, tweaking individual pixels, or customizing beyond what the templates offer. The editor renders a 16x32 grid (512 cells) with click/drag and touch-drag painting, a fixed palette swatch bar (Ninja Adventure colors only), and undo/redo via a stack of grid snapshots.

**State persistence**: Template selections (body type, skin tone, hairstyle, clothing, accessories, and their palette choices) are stored in the database alongside the flattened sprite data. If a loved one returns to template editing after making freeform pixel edits, the freeform edits are discarded and the editor restores the last saved template state. This is a one-way door communicated clearly in the UI -- freeform edits are refinements, not a parallel track.

**Style reference**: The portal displays example character sprites and a background reference image showing the game's village environment, so loved ones can see the target aesthetic before creating their sprite.

**Tech stack**: React + custom `<canvas>` pixel editor.

### 6.3 Personality and Dialogue Input

Simple form-based:

- **Name**: Loved one's display name (used as the NPC's speaker name)
- **Dialogue mode toggle**: Hardcoded or AI-generated
- **If hardcoded**: A **nested outline editor** (zero external dependencies -- a recursive React component). The editor displays the conversation as an indented tree: NPC lines are text blocks, player responses are indented beneath them, and each response can have a child NPC reply. An "Add player response" button appears beneath each NPC block; an "Add NPC reply" button appears beneath each player response. Leaf nodes (no child responses) end the conversation and give the gift. Loop-backs are supported via a "Redirect to..." option that lets a response point to an ancestor NPC node by label (displayed as the first few words of the NPC's line). Constraints enforced by the editor: max depth 4, max 3 responses per NPC line, max 2 loop-back references. The portal validates that at least one path reaches a leaf. The editor outputs nested JSON matching the hardcoded dialogue data format (§5.1).
- **If AI**: 3-5 personality traits (dropdown/tag selection: cheerful, sarcastic, shy, nerdy, etc.) and a personality prompt text field. The loved one can review and edit the generated prompt before confirming.
- **Gift object**: Text field describing what their character gives Fraser (e.g., "a tiny telescope", "homemade cookies"). The developer creates the corresponding pixel art asset.

### 6.4 Retro Audio Recording

Loved ones record short "dialogue noises" (1-3 seconds) via their microphone. Each recording is given a **name** by the loved one (e.g., "excited", "hmm", "laugh"). Loved ones can record multiple named blips to give their character a richer voice. The recording and processing are separated into distinct steps:

1. **Recording**: The **MediaRecorder API** captures a short audio clip as a blob.
2. **Processing**: After recording, an **OfflineAudioContext** applies bitcrushing (reduced sample rate and bit depth for lo-fi Game Boy texture) and pitch shifting (creating character-specific blips in the Animal Crossing / Undertale style). No AudioWorklet required.
3. **Preview**: The loved one hears the processed result before submitting.

**Fallback**: If microphone access is denied or unavailable, the loved one selects from **5-6 preset voice textures** (high chirp, low hum, breathy, nasal, etc.) and names each one. Pitch-shifted by name hash. Still personalized, zero hardware requirement.

**Browser support**: Chrome, Firefox, Edge, and Safari. Audio processing results (bitcrushing, pitch shifting) may vary slightly across browsers due to differences in `OfflineAudioContext` implementations -- this inconsistency is accepted as part of the lo-fi aesthetic. Safari's Web Audio support has improved sufficiently for the recording pipeline, and excluding Safari would lock out most iPhone users, which is unacceptable for a birthday gift shared with a small group of loved ones.

### 6.5 Playtesting

Loved ones can launch the full game in its current state at any time from the portal. The game loads the latest submissions from the database, so loved ones see their character in the world. What's testable grows with each milestone: M1 shows sprites in the village square, M2 adds dialogue and audio playback, M3 adds full gameplay. If a loved one updates their submission, they reload the game to see the changes.

The invite link is shared with loved ones after Milestone 2, once the portal supports sprite creation, dialogue, and audio. The milestones are scoped as follows:

**Milestone 1: Submission → Playtest Loop (plumbing)**
1. **Project scaffolding**: Vite multi-entry build (game at `/mosaic/`, portal at `/mosaic/submit/`), TypeScript, React (portal), PixiJS v8 (game), shared types between entry points.
2. **Database**: Schema designed for the full game (loved-one name, sprite data, dialogue tree, audio blips, personality traits, gift object) with M2/M3 fields nullable. Only name + sprite data are written in M1.
3. **Portal access control**: Shared password gate (client-side hash check) + unique token in URL query params to identify each loved one and load their submission.
4. **Ninja Adventure palette extraction**: Extract the color palette from the asset pack into a fixed swatch set used by the pixel editor and (later) the template assembly system.
5. **Portal (minimal)**: Name field + freeform pixel editor only (the canvas editor from §6.2 phase 2, shipped first because it has no template art dependency -- 16x32 grid, Ninja Adventure palette swatches). No template assembly, no dialogue builder, no audio recording, no gift field yet. Loved ones can draw anything.
6. **Game (minimal)**: A village square tilemap. All submitted loved-one sprites are rendered in a grid layout in the square. An invisible, non-colliding player position moves with arrow keys; the camera follows it. No visible player sprite, no collision, no NPC interaction. The game fetches submissions from the database at startup and displays them.
7. **Deployment**: GitHub Pages from the `mosaic` repo. Vite `base: '/mosaic/'` for correct asset paths. The game and portal are accessible at their public URLs.
8. **Loop**: A loved one submits a sprite via the portal, reloads the game, and sees their sprite in the village square. They edit the sprite, reload, and see the update. This loop working end-to-end at the public URL validates the submission pipeline.

**Milestone 2: Dialogue and Audio**
Priority after Milestone 1. Build out the dialogue tree editor (nested outline UI) and audio recording pipeline in the portal. Add dialogue rendering and audio blip playback to the game. Loved ones can test their dialogue trees and hear their character's voice. This milestone gates the invite link (see §6.5).

**Milestone 3: Playable Game**
Player sprite, collision, NPC interaction, and iterative map expansion (the world grows larger and more detailed over time). Loved ones collaborate on their submissions while the game world is built out around them.

---

## 7. Technical Core: PixiJS v8 and WebGL2

### 7.1 Renderer

**PixiJS v8** with **WebGL2** as the sole rendering backend. No WebGPU -- simplifies the shader pipeline. Target browsers: Chrome, Firefox, Edge, and Safari (Safari 15+, which supports WebGL2).

### 7.2 Rendering Features

* **Pre-baked lighting**: The majority of the game uses static lighting baked into the tile art. Day/night mood is achieved through palette swaps and tinted overlay layers, not real-time lighting.
* **PixiJS Filters**: ColorMatrixFilter for tinting (evening warmth), BlurFilter for depth-of-field on dialogue, AlphaFilter for fade transitions.
* **One dynamic lighting moment**: The final birthday cake sequence uses a real-time point light effect (GLSL fragment shader) to create a warm, glowing centerpiece. This is the visual climax of the game -- a single shader, tested on one scene.
* **BitmapText**: GPU-accelerated dialogue rendering with typewriter effects.

### 7.3 Tile Maps

**Tiled** (mapeditor.org) for level design, exporting to TMJ (JSON) format. Loaded via a **custom TMJ loader** that parses the Tiled JSON and renders tiles using **`@pixi/tilemap`** (the official PixiJS tilemap package).

`@pixi/tilemap` provides optimized batch rendering of rectangular tilemaps. The custom loader reads Tiled layers (terrain, collision, object/NPC spawn points) and translates them into `Tilemap.tile()` calls. This avoids depending on third-party Tiled integration libraries with uncertain maintenance.

**Hot reload**: TMJ map files are imported as JSON assets through Vite. The map loader module uses `import.meta.hot.accept` to detect changes, reload the TMJ data, and rebuild the tilemap without losing player position or game state. This enables real-time map iteration in Tiled with sub-second feedback in the browser. On hot reload, all spawn positions are rebuilt from the updated TMJ and runtime flags (e.g., `interacted`) are preserved by `npcId` key. This is a development-only feature -- production loads the map once.

**NPC ID sync**: A **pre-commit hook** validates that every `npcId` on the TMJ `spawns` layer has a matching database record, and every database NPC record has a corresponding spawn point. The commit is rejected on mismatch, catching typos and forgotten placements before they reach the running game.

**Layer convention in Tiled**:
- `ground`: Base terrain (grass, paths, floors)
- `buildings`: Structures and walls
- `decoration`: Objects rendered above ground (furniture, trees, fences)
- `collision`: Solid tiles (not rendered, used for movement blocking)
- `spawns`: Object layer with NPC positions and metadata

---

## 8. Audio

### 8.1 Music

| Context | Track | Notes |
|---|---|---|
| Inside (houses, rooms) | Warm, gentle interior theme | Soft piano/chiptune, low tempo |
| Outside (village, daytime) | Bright, upbeat village theme | More instruments, livelier feel |
| Evening (village square) | Warm, mellow evening theme | Acoustic feel, lantern ambiance |

Music sourced from **Kevin MacLeod's royalty-free library** (incompetech.com). Crossfades on scene transitions. Loops seamlessly. Attribution included in the game's credits/end screen as required by CC BY 3.0.

### 8.2 Sound Effects

- **Dialogue blips**: Per-character pitch-shifted sounds (from loved-one audio submissions or preset voice textures)
- **UI sounds**: Menu select, dialogue advance, present received
- **Optional foley** (stretch goal): Footsteps (grass vs. wood vs. stone), door open/close, item pickup jingle

### 8.3 Engine

**Howler.js** for cross-browser audio playback. Handles Web Audio API context resumption (required after user interaction on mobile), sprite-based sound effects, and seamless music looping.

---

## 9. Loading and Boot Sequence

1. **Minimal HTML shell** loads immediately with a black background.
2. **All assets are preloaded**: tilesets, spritesheets, music, sound effects, loved-one data from the database. A **loading bar** tracks progress. The game does not start until every asset has loaded successfully. If any asset fails to load, the loading bar stalls and an error message is shown -- no partial failures are accepted.
3. **"Wake up" text** appears centered on the black screen once loading is complete.
4. **Any player interaction** (click, tap, or keypress) triggers a fade-out of the black overlay, revealing the bedroom scene. This interaction also satisfies the browser's user-gesture requirement for audio playback.

---

## 10. Deployment

The project name is **Mosaic**. It is hosted via **GitHub Pages** from the `mosaic` repository.

- **Game URL**: `https://gszep.com/mosaic` -- the main game entry point.
- **Portal URL**: `https://gszep.com/mosaic/submit` -- the submission portal.
- **Database**: Small managed database (Supabase, Turso, or PlanetScale free tier) for loved-one submissions.
- **AI dialogue**: Direct client-side calls to the Gemini API.
- **Build structure**: Vite multi-entry-point build. The game and portal are separate entry points with independent bundles, sharing common code (palette, database types, sprite templates). Vite `base: '/mosaic/'` ensures correct asset paths under GitHub Pages.

```
dist/
  index.html          -> game entry point
  submit/
    index.html        -> portal entry point
  assets/             -> shared and per-entry-point chunks
```

- **Local development**: Uses the live database so developers and loved ones share the same view of submitted assets.
- **Playtesting**: Loved ones access the game at the same URL. The game always loads the latest submissions from the database, so loved ones see their character as soon as they submit.
- **Final lockdown**: Before the birthday, the database is switched to **read-only mode** (write access removed). The game fetches from the live database at startup, accepting the risk of database downtime in exchange for simpler code with a single data path.
- **Total payload**: Tileset sprites + music + game code + loved-one data fetched from database. Target: under 5MB total initial load.

---

## 11. Accessibility

- **Colorblind-safe palette**: All game-critical information uses the Ninja Adventure pack palette with strong value contrast. No color-only indicators.
- **Keyboard navigation**: Full keyboard support (arrow keys + spacebar/enter for interaction). Mobile: tap-and-hold to move (direction relative to screen center), double-tap to interact with the nearest NPC within 2 tiles.
- **Font scaling**: BitmapFont rendered at integer multiples for crisp text at all display sizes.
- **Screen reader**: Not a primary target for a visual pixel art game, but dialogue text is stored as accessible strings for potential future integration.

---

## References

1. Choosing the Right Rendering Resolution for a Pixel Art Game -- notkey.studio
2. 16:9 Adaptive Integer Scale Resolutions -- GitHub Gist (peeweek)
3. Stardew Valley Native Resolution -- Chucklefish Forums
4. Stardew Valley Modding: Game Fundamentals -- Stardew Valley Wiki
5. Color Blindness Types and Prevalence -- Colour Blind Awareness
6. Color Oracle -- colororacle.org
7. DaltonLens CVD Simulation -- daltonlens.org
8. PixiJS v8 Migration Guide -- pixijs.com
9. @pixi/tilemap -- GitHub (pixijs-userland)
10. Ninja Adventure Asset Pack -- itch.io (pixel-boy), CC0
11. Tiled Map Editor -- mapeditor.org
12. Google AI Studio and Gemini API -- ai.google.dev
13. Howler.js -- howlerjs.com
14. Vite HMR API -- vite.dev
