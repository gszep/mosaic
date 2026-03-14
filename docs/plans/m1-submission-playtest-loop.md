# M1: Submission-Playtest Loop Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the end-to-end submission pipeline: a loved one creates a character sprite in the portal, and it appears in the game world at the public URL.

**Architecture:** Vite multi-entry TypeScript project. The portal (`/mosaic/submit/`) is a React app where loved ones create character sprites via a canvas-based pixel editor. The game (`/mosaic/`) is a PixiJS v8 app that fetches submissions from Supabase and renders them as sprites on a Tiled village square map. Both entry points share types, palette data, and the Supabase client.

**Tech Stack:** Vite 6, TypeScript (strict), React 19, PixiJS v8, @pixi/tilemap, Supabase (PostgreSQL + JS client), Vitest

**Design Reference:** `context/design.md` -- sections referenced as section-N throughout.

---

## Prerequisites (Manual, One-Time)

These are not plan tasks. Complete them before starting.

1. **Ninja Adventure asset pack**: Download from itch.io (pixel-boy, CC0 license). Extract to a working location -- tileset PNGs will be copied into `public/tilesets/` during Task 3.
2. **Supabase project**: Create at supabase.com. Note the project URL and anon key. The schema is applied in Task 2.
3. **Tiled map editor**: Install from mapeditor.org. The village square map is created in Task 8.
4. **Node.js 18+**: Required for Vite and all tooling.

---

## File Structure

```
mosaic/
  context/
    design.md                      # existing -- the spec
  src/
    shared/
      types.ts                     # Submission row type, sprite data shape
      palette.ts                   # Ninja Adventure color swatches (hex array)
      supabase.ts                  # Supabase client singleton
    portal/
      main.tsx                     # React DOM entry point
      App.tsx                      # PasswordGate -> SubmissionForm routing
      components/
        PasswordGate.tsx           # Shared password check, sessionStorage flag
        SubmissionForm.tsx         # Name field + PixelEditor + save button
        PixelEditor.tsx            # 16x32 canvas editor, click/drag/touch paint
        PalettePicker.tsx          # Horizontal swatch bar, selected color state
      hooks/
        useSubmission.ts           # Load/save submission via Supabase by token
    game/
      main.ts                      # PixiJS entry point, orchestrates boot
      viewport.ts                  # Integer scaling, letterboxing, resize
      tilemap.ts                   # TMJ JSON parser -> @pixi/tilemap rendering
      npcs.ts                      # Fetch submissions, pixel data -> textures
      camera.ts                    # Arrow key input, camera offset, clamping
  public/
    tilesets/                      # Ninja Adventure tileset PNGs (copied from pack)
    maps/
      village.tmj                  # Tiled village square map (created in Task 8)
  index.html                       # Game HTML shell
  submit/
    index.html                     # Portal HTML shell
  supabase/
    schema.sql                     # Table definitions (applied manually via SQL editor)
  scripts/
    extract-palette.ts             # One-shot script to extract palette from tileset PNGs
  vite.config.ts
  tsconfig.json
  package.json
  .env.local                       # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (not committed)
  .gitignore
```

---

## Chunk 1: Foundation

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `.gitignore`
- Create: `index.html`, `submit/index.html`
- Create: `src/game/main.ts`, `src/portal/main.tsx`, `src/portal/App.tsx`

- [ ] **Step 1: Initialize project and install dependencies**

```bash
npm init -y
npm install pixi.js @pixi/tilemap react react-dom @supabase/supabase-js
npm install -D vite @vitejs/plugin-react typescript @types/react @types/react-dom vitest
```

Verify: `node_modules/` exists, no install errors.

If `@pixi/tilemap` does not support PixiJS v8, fall back to rendering tiles as individual `Sprite` objects in a `Container`. The village square is small enough that per-tile sprites are fine for M1.

- [ ] **Step 2: Create vite.config.ts**

Multi-entry config with React plugin and `/mosaic/` base path. The React plugin only transforms `.tsx`/`.jsx` files, so the game entry point (plain `.ts`) is unaffected.

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  base: "/mosaic/",
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        game: resolve(__dirname, "index.html"),
        portal: resolve(__dirname, "submit/index.html"),
      },
    },
  },
});
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonImports": true,
    "isolatedModules": true,
    "outDir": "dist",
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["src/shared/*"]
    }
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Create HTML shells**

`index.html` (game):
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mosaic</title>
  <style>
    * { margin: 0; padding: 0; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: #000; }
  </style>
</head>
<body>
  <script type="module" src="/src/game/main.ts"></script>
</body>
</html>
```

`submit/index.html` (portal):
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Mosaic - Submit</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/portal/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 5: Create minimal entry points**

`src/game/main.ts`:
```ts
const app = document.createElement("p");
app.textContent = "Game entry point loaded.";
app.style.color = "white";
document.body.appendChild(app);
```

`src/portal/main.tsx`:
```tsx
import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(<App />);
```

`src/portal/App.tsx`:
```tsx
export function App() {
  return <h1>Portal entry point loaded.</h1>;
}
```

- [ ] **Step 6: Create .gitignore**

```
node_modules/
dist/
.env.local
```

- [ ] **Step 7: Verify both entry points serve**

```bash
npx vite --open
```

Visit `http://localhost:5173/mosaic/` -- should show "Game entry point loaded." in white on black.
Visit `http://localhost:5173/mosaic/submit/` -- should show "Portal entry point loaded." heading.

Kill the dev server.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(m1): project scaffolding -- Vite multi-entry, TS, React, PixiJS"
```

---

### Task 2: Database Schema and Client

**Files:**
- Create: `supabase/schema.sql`, `src/shared/types.ts`, `src/shared/supabase.ts`, `.env.local`

- [ ] **Step 1: Write schema SQL**

`supabase/schema.sql` -- forward-compatible with M2/M3 fields as nullable columns:

```sql
-- Apply via Supabase SQL Editor (Dashboard > SQL Editor > New Query)

create table submissions (
  id         uuid primary key default gen_random_uuid(),
  token      text unique not null,
  name       text,
  sprite_data jsonb,
  -- M2 fields (nullable, unused in M1)
  dialogue_mode       text check (dialogue_mode in ('hardcoded', 'ai')),
  dialogue_tree       jsonb,
  personality_traits   text[],
  personality_prompt   text,
  gift_object         text,
  audio_blips         jsonb,
  -- Developer-only field
  location_description text default 'In the village square.',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS: allow public reads (game fetches all submissions)
alter table submissions enable row level security;

create policy "public read" on submissions
  for select using (true);

-- RLS: allow upserts (portal writes by token)
create policy "public write" on submissions
  for insert with check (true);

create policy "public update" on submissions
  for update using (true);

-- Auto-update updated_at on changes
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger submissions_updated_at
  before update on submissions
  for each row execute function update_updated_at();
```

Apply this SQL in the Supabase dashboard SQL Editor.

- [ ] **Step 2: Create .env.local**

```
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Replace with actual values from Supabase dashboard (Settings > API).

- [ ] **Step 3: Write shared types**

`src/shared/types.ts`:

```ts
/** Raw pixel data from the freeform editor. 512 cells (16 wide x 32 tall). */
export interface SpriteData {
  width: 16;
  height: 32;
  /** Hex color strings ("#RRGGBB") or empty string for transparent. Row-major order. */
  pixels: string[];
}

/** A loved-one's submission as stored in the database. */
export interface Submission {
  id: string;
  token: string;
  name: string | null;
  sprite_data: SpriteData | null;
  dialogue_mode: "hardcoded" | "ai" | null;
  dialogue_tree: unknown | null;
  personality_traits: string[] | null;
  personality_prompt: string | null;
  gift_object: string | null;
  audio_blips: unknown | null;
  location_description: string;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 4: Write Supabase client**

`src/shared/supabase.ts`:

```ts
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !key) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment"
  );
}

export const supabase = createClient(url, key);
```

- [ ] **Step 5: Write test for types and client module**

`src/shared/__tests__/types.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { SpriteData, Submission } from "../types";

describe("SpriteData", () => {
  it("accepts a valid 16x32 pixel grid", () => {
    const data: SpriteData = {
      width: 16,
      height: 32,
      pixels: Array(16 * 32).fill("#000000"),
    };
    expect(data.pixels).toHaveLength(512);
  });
});
```

- [ ] **Step 6: Run test**

```bash
npx vitest run src/shared/__tests__/types.test.ts
```

Expected: PASS.

- [ ] **Step 7: Verify database connection**

Add a temporary check to `src/game/main.ts`:

```ts
import { supabase } from "../shared/supabase";

async function boot() {
  const { data, error } = await supabase.from("submissions").select("id");
  if (error) {
    document.body.textContent = `DB error: ${error.message}`;
  } else {
    document.body.textContent = `DB connected. ${data.length} submissions.`;
  }
}

boot();
```

Run `npx vite`, visit the game URL. Should show "DB connected. 0 submissions."

Revert `src/game/main.ts` back to the placeholder after verifying.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(m1): Supabase schema, shared types, database client"
```

---

### Task 3: Palette Extraction

**Files:**
- Create: `scripts/extract-palette.ts`, `src/shared/palette.ts`
- Copy: Ninja Adventure tileset PNGs into `public/tilesets/`

- [ ] **Step 1: Copy tileset PNGs into public/tilesets/**

From the downloaded Ninja Adventure pack, copy the main tileset PNG(s) used for terrain, buildings, and decoration into `public/tilesets/`. At minimum, copy the primary tileset file (usually named something like `TilesetFloor.png`, `TilesetNature.png`, etc.). These are the tilesets that Tiled will reference.

- [ ] **Step 2: Write palette extraction script**

`scripts/extract-palette.ts` -- a Node script that reads all PNGs in `public/tilesets/`, extracts unique non-transparent colors, and writes them to stdout as a JSON array. This is run once; the output is pasted into `palette.ts`.

```ts
/**
 * Usage: npx tsx scripts/extract-palette.ts
 *
 * Reads all PNG files in public/tilesets/, extracts unique opaque pixel colors,
 * and prints a sorted JSON array of hex strings to stdout.
 *
 * Requires: npm install -D tsx sharp (sharp for PNG decoding)
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";

const TILESET_DIR = "public/tilesets";

async function extractColors(): Promise<Set<string>> {
  const colors = new Set<string>();
  const files = (await readdir(TILESET_DIR)).filter((f) =>
    f.toLowerCase().endsWith(".png")
  );

  for (const file of files) {
    const { data, info } = await sharp(join(TILESET_DIR, file))
      .raw()
      .ensureAlpha()
      .toBuffer({ resolveWithObject: true });

    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3];
      if (a < 128) continue; // skip transparent/semi-transparent
      const hex =
        "#" +
        data[i].toString(16).padStart(2, "0") +
        data[i + 1].toString(16).padStart(2, "0") +
        data[i + 2].toString(16).padStart(2, "0");
      colors.add(hex.toUpperCase());
    }
  }
  return colors;
}

const colors = await extractColors();
const sorted = [...colors].sort();
console.log(JSON.stringify(sorted, null, 2));
console.error(`Extracted ${sorted.length} unique colors.`);
```

- [ ] **Step 3: Run extraction and capture output**

```bash
npm install -D tsx sharp
npx tsx scripts/extract-palette.ts > palette-output.json
```

Review `palette-output.json`. Expect 50-200 unique colors. If the count is unreasonably high (500+), the tilesets may include gradient or anti-aliased art -- filter further by removing near-duplicate colors, or manually curate a subset.

- [ ] **Step 4: Write palette.ts**

`src/shared/palette.ts` -- paste the extracted colors into a typed constant:

```ts
/**
 * Colors extracted from the Ninja Adventure asset pack.
 * This is the only palette available in the pixel editor (design section-2.3).
 * Generated by scripts/extract-palette.ts -- do not edit by hand.
 */
export const PALETTE: readonly string[] = [
  // Paste the contents of palette-output.json here.
  // Example (actual values come from extraction):
  // "#1A1A2E", "#16213E", "#0F3460", "#533483", "#E94560", ...
] as const;

/** Transparent "color" used for empty pixels. */
export const TRANSPARENT = "";
```

- [ ] **Step 5: Write palette test**

`src/shared/__tests__/palette.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { PALETTE, TRANSPARENT } from "../palette";

describe("palette", () => {
  it("contains at least 10 colors", () => {
    expect(PALETTE.length).toBeGreaterThanOrEqual(10);
  });

  it("all entries are valid uppercase hex colors", () => {
    for (const color of PALETTE) {
      expect(color).toMatch(/^#[0-9A-F]{6}$/);
    }
  });

  it("has no duplicates", () => {
    expect(new Set(PALETTE).size).toBe(PALETTE.length);
  });

  it("TRANSPARENT is empty string", () => {
    expect(TRANSPARENT).toBe("");
  });
});
```

- [ ] **Step 6: Run tests**

```bash
npx vitest run src/shared/__tests__/palette.test.ts
```

Expected: PASS.

- [ ] **Step 7: Clean up and commit**

Remove `palette-output.json` (intermediate artifact). Keep `scripts/extract-palette.ts` for re-extraction if tilesets change.

```bash
rm palette-output.json
git add -A
git commit -m "feat(m1): extract Ninja Adventure palette, tileset assets"
```

---

## Chunk 2: Portal

### Task 4: Password Gate

**Files:**
- Create: `src/portal/components/PasswordGate.tsx`
- Modify: `src/portal/App.tsx`

- [ ] **Step 1: Implement PasswordGate component**

`src/portal/components/PasswordGate.tsx`:

The gate hashes user input with SHA-256 and compares against a stored hash. On success, sets a sessionStorage flag so the user isn't re-prompted on page reload within the same tab. The expected hash is hardcoded -- the actual password is distributed to loved ones alongside their invite link (design section-6.1).

```tsx
import { useState, useCallback, type FormEvent } from "react";

const EXPECTED_HASH = "REPLACE_WITH_SHA256_OF_ACTUAL_PASSWORD";

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input)
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function PasswordGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(
    () => sessionStorage.getItem("mosaic-authed") === "true"
  );
  const [error, setError] = useState(false);

  const handleSubmit = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const input = new FormData(e.currentTarget).get("password") as string;
    const hash = await sha256(input.trim());
    if (hash === EXPECTED_HASH) {
      sessionStorage.setItem("mosaic-authed", "true");
      setAuthed(true);
    } else {
      setError(true);
    }
  }, []);

  if (authed) return <>{children}</>;

  return (
    <form onSubmit={handleSubmit} style={{ padding: "2rem" }}>
      <label>
        Password:
        <input type="password" name="password" autoFocus />
      </label>
      <button type="submit">Enter</button>
      {error && <p style={{ color: "red" }}>Incorrect password.</p>}
    </form>
  );
}
```

- [ ] **Step 2: Wire into App.tsx**

```tsx
import { PasswordGate } from "./components/PasswordGate";

export function App() {
  return (
    <PasswordGate>
      <h1>Welcome to Mosaic</h1>
      <p>Submission form will go here.</p>
    </PasswordGate>
  );
}
```

- [ ] **Step 3: Generate the password hash**

Pick a password (e.g., "fraser2026"). Generate its SHA-256 hash:

```bash
echo -n "fraser2026" | sha256sum
```

Paste the resulting hash into `EXPECTED_HASH` in `PasswordGate.tsx`.

- [ ] **Step 4: Verify manually**

```bash
npx vite
```

Visit portal URL. Should see password prompt. Enter wrong password -- should see error. Enter correct password -- should see "Welcome to Mosaic". Refresh page -- should still be authed (sessionStorage).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(m1): portal password gate with SHA-256 client-side check"
```

---

### Task 5: Pixel Editor

**Files:**
- Create: `src/portal/components/PixelEditor.tsx`, `src/portal/components/PalettePicker.tsx`

This is the largest task in M1. The editor is a focused React component rendering a 16x32 grid on a `<canvas>` element with click/drag and touch-drag painting, palette swatch selection, and undo/redo (design section-6.2 phase 2).

- [ ] **Step 1: Implement PalettePicker**

`src/portal/components/PalettePicker.tsx`:

A horizontal scrollable bar of color swatches. Clicking a swatch selects it. The selected color is lifted to the parent via a callback.

```tsx
import { PALETTE } from "../../shared/palette";

interface PalettePickerProps {
  selected: string;
  onSelect: (color: string) => void;
}

export function PalettePicker({ selected, onSelect }: PalettePickerProps) {
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 2,
        padding: "0.5rem 0",
        maxWidth: "100%",
      }}
    >
      {PALETTE.map((color) => (
        <button
          key={color}
          onClick={() => onSelect(color)}
          aria-label={color}
          style={{
            width: 24,
            height: 24,
            backgroundColor: color,
            border: color === selected ? "2px solid white" : "2px solid transparent",
            outline: color === selected ? "1px solid #000" : "none",
            cursor: "pointer",
            padding: 0,
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Implement PixelEditor**

`src/portal/components/PixelEditor.tsx`:

The editor renders a 16x32 grid at a magnified scale so pixels are large enough to tap/click. Internal state is a flat `string[]` of 512 hex values. Undo/redo uses a stack of snapshot copies.

```tsx
import {
  useRef,
  useEffect,
  useState,
  useCallback,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { TRANSPARENT } from "../../shared/palette";
import type { SpriteData } from "../../shared/types";

const W = 16;
const H = 32;
const CELL_COUNT = W * H;

/** Scale factor: each pixel cell renders as SCALE x SCALE screen pixels. */
const SCALE = 16;

interface PixelEditorProps {
  /** Initial pixel data. If null, starts blank. */
  initial: SpriteData | null;
  /** Called on every paint stroke with the full current grid. */
  onChange: (data: SpriteData) => void;
  /** The color to paint with. */
  color: string;
}

function createBlank(): string[] {
  return Array(CELL_COUNT).fill(TRANSPARENT);
}

export function PixelEditor({ initial, onChange, color }: PixelEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pixels, setPixels] = useState<string[]>(
    () => initial?.pixels.slice() ?? createBlank()
  );
  const [undoStack, setUndoStack] = useState<string[][]>([]);
  const [redoStack, setRedoStack] = useState<string[][]>([]);
  const isPainting = useRef(false);
  const preStrokeSnapshot = useRef<string[] | null>(null);

  // Redraw canvas whenever pixels change.
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    // Checkerboard background for transparent cells.
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = y * W + x;
        const px = pixels[i];
        if (px === TRANSPARENT) {
          ctx.fillStyle = (x + y) % 2 === 0 ? "#C8C8C8" : "#A0A0A0";
        } else {
          ctx.fillStyle = px;
        }
        ctx.fillRect(x * SCALE, y * SCALE, SCALE, SCALE);
      }
    }

    // Grid lines.
    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= W; x++) {
      ctx.beginPath();
      ctx.moveTo(x * SCALE + 0.5, 0);
      ctx.lineTo(x * SCALE + 0.5, H * SCALE);
      ctx.stroke();
    }
    for (let y = 0; y <= H; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * SCALE + 0.5);
      ctx.lineTo(W * SCALE, y * SCALE + 0.5);
      ctx.stroke();
    }
  }, [pixels]);

  const cellFromPointer = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>): number | null => {
      const rect = canvasRef.current!.getBoundingClientRect();
      const x = Math.floor(((e.clientX - rect.left) / rect.width) * W);
      const y = Math.floor(((e.clientY - rect.top) / rect.height) * H);
      if (x < 0 || x >= W || y < 0 || y >= H) return null;
      return y * W + x;
    },
    []
  );

  const paint = useCallback(
    (index: number) => {
      setPixels((prev) => {
        if (prev[index] === color) return prev;
        const next = prev.slice();
        next[index] = color;
        onChange({ width: W as 16, height: H as 32, pixels: next });
        return next;
      });
    },
    [color, onChange]
  );

  const handlePointerDown = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      isPainting.current = true;
      preStrokeSnapshot.current = pixels.slice();
      const i = cellFromPointer(e);
      if (i !== null) paint(i);
    },
    [cellFromPointer, paint, pixels]
  );

  const handlePointerMove = useCallback(
    (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!isPainting.current) return;
      const i = cellFromPointer(e);
      if (i !== null) paint(i);
    },
    [cellFromPointer, paint]
  );

  const handlePointerUp = useCallback(() => {
    if (isPainting.current && preStrokeSnapshot.current) {
      setUndoStack((prev) => [...prev, preStrokeSnapshot.current!]);
      setRedoStack([]);
    }
    isPainting.current = false;
    preStrokeSnapshot.current = null;
  }, []);

  const undo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const snapshot = prev[prev.length - 1];
      setRedoStack((r) => [...r, pixels]);
      setPixels(snapshot);
      onChange({ width: W as 16, height: H as 32, pixels: snapshot });
      return prev.slice(0, -1);
    });
  }, [pixels, onChange]);

  const redo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const snapshot = prev[prev.length - 1];
      setUndoStack((u) => [...u, pixels]);
      setPixels(snapshot);
      onChange({ width: W as 16, height: H as 32, pixels: snapshot });
      return prev.slice(0, -1);
    });
  }, [pixels, onChange]);

  const clear = useCallback(() => {
    setUndoStack((prev) => [...prev, pixels]);
    setRedoStack([]);
    const blank = createBlank();
    setPixels(blank);
    onChange({ width: W as 16, height: H as 32, pixels: blank });
  }, [pixels, onChange]);

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={W * SCALE}
        height={H * SCALE}
        style={{
          imageRendering: "pixelated",
          touchAction: "none",
          cursor: "crosshair",
          maxWidth: "100%",
          height: "auto",
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      />
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem" }}>
        <button onClick={undo} disabled={undoStack.length === 0}>
          Undo
        </button>
        <button onClick={redo} disabled={redoStack.length === 0}>
          Redo
        </button>
        <button onClick={clear}>Clear</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify manually**

Create a temporary test harness in `App.tsx`:

```tsx
import { useState } from "react";
import { PasswordGate } from "./components/PasswordGate";
import { PixelEditor } from "./components/PixelEditor";
import { PalettePicker } from "./components/PalettePicker";
import { PALETTE } from "../shared/palette";
import type { SpriteData } from "../shared/types";

export function App() {
  const [color, setColor] = useState(PALETTE[0]);

  return (
    <PasswordGate>
      <h1>Mosaic Sprite Editor</h1>
      <PalettePicker selected={color} onSelect={setColor} />
      <PixelEditor
        initial={null}
        onChange={(data: SpriteData) => console.log("pixels changed", data.pixels.filter(p => p !== "").length, "filled")}
        color={color}
      />
    </PasswordGate>
  );
}
```

```bash
npx vite
```

Visit portal URL. Verify:
- Palette swatches render and are clickable.
- Clicking a swatch changes the selected color (border highlight).
- Clicking/dragging on the canvas paints pixels in the selected color.
- Undo reverts the last stroke. Redo restores it.
- Clear resets the grid.
- Touch-drag works on mobile (test via browser devtools device emulation).
- Console logs pixel count on each change.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(m1): pixel editor (16x32 canvas) and palette picker"
```

---

### Task 6: Submission Flow

**Files:**
- Create: `src/portal/hooks/useSubmission.ts`, `src/portal/components/SubmissionForm.tsx`
- Modify: `src/portal/App.tsx`

- [ ] **Step 1: Implement useSubmission hook**

`src/portal/hooks/useSubmission.ts`:

Parses the `token` query parameter from the URL. On mount, loads any existing submission for that token. Exposes a `save` function that upserts to Supabase.

```ts
import { useState, useEffect, useCallback } from "react";
import { supabase } from "../../shared/supabase";
import type { Submission, SpriteData } from "../../shared/types";

function getToken(): string | null {
  return new URLSearchParams(window.location.search).get("token");
}

interface SubmissionState {
  token: string | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  name: string;
  spriteData: SpriteData | null;
}

export function useSubmission() {
  const [state, setState] = useState<SubmissionState>({
    token: getToken(),
    loading: true,
    saving: false,
    error: null,
    name: "",
    spriteData: null,
  });

  // Load existing submission on mount.
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setState((s) => ({ ...s, loading: false, error: "No token in URL." }));
      return;
    }

    supabase
      .from("submissions")
      .select("*")
      .eq("token", token)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) {
          setState((s) => ({ ...s, loading: false, error: error.message }));
        } else if (data) {
          setState((s) => ({
            ...s,
            loading: false,
            name: data.name ?? "",
            spriteData: data.sprite_data as SpriteData | null,
          }));
        } else {
          setState((s) => ({ ...s, loading: false }));
        }
      });
  }, []);

  const setName = useCallback((name: string) => {
    setState((s) => ({ ...s, name }));
  }, []);

  const setSpriteData = useCallback((spriteData: SpriteData) => {
    setState((s) => ({ ...s, spriteData }));
  }, []);

  const save = useCallback(async () => {
    const token = getToken();
    if (!token) return;

    setState((s) => ({ ...s, saving: true, error: null }));

    const { error } = await supabase.from("submissions").upsert(
      {
        token,
        name: state.name || null,
        sprite_data: state.spriteData,
      },
      { onConflict: "token" }
    );

    if (error) {
      setState((s) => ({ ...s, saving: false, error: error.message }));
    } else {
      setState((s) => ({ ...s, saving: false }));
    }
  }, [state.name, state.spriteData]);

  return { ...state, setName, setSpriteData, save };
}
```

- [ ] **Step 2: Implement SubmissionForm**

`src/portal/components/SubmissionForm.tsx`:

```tsx
import { useState } from "react";
import { PixelEditor } from "./PixelEditor";
import { PalettePicker } from "./PalettePicker";
import { useSubmission } from "../hooks/useSubmission";
import { PALETTE } from "../../shared/palette";

export function SubmissionForm() {
  const { token, loading, saving, error, name, spriteData, setName, setSpriteData, save } =
    useSubmission();
  const [color, setColor] = useState(PALETTE[0]);

  if (!token) return <p>Invalid invite link -- no token found.</p>;
  if (loading) return <p>Loading...</p>;

  return (
    <div style={{ padding: "1rem", maxWidth: 600 }}>
      <h1>Create Your Character</h1>

      <label style={{ display: "block", marginBottom: "1rem" }}>
        Your name:
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your display name"
          style={{ display: "block", marginTop: "0.25rem", fontSize: "1rem" }}
        />
      </label>

      <h2>Draw your sprite</h2>
      <PalettePicker selected={color} onSelect={setColor} />
      <PixelEditor initial={spriteData} onChange={setSpriteData} color={color} />

      <button
        onClick={save}
        disabled={saving}
        style={{ marginTop: "1rem", fontSize: "1rem", padding: "0.5rem 1.5rem" }}
      >
        {saving ? "Saving..." : "Save"}
      </button>

      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Wire into App.tsx**

Replace the test harness with the real form:

```tsx
import { PasswordGate } from "./components/PasswordGate";
import { SubmissionForm } from "./components/SubmissionForm";

export function App() {
  return (
    <PasswordGate>
      <SubmissionForm />
    </PasswordGate>
  );
}
```

- [ ] **Step 4: Seed a test token in the database**

In the Supabase SQL Editor, insert a test row:

```sql
insert into submissions (token) values ('test-token-abc');
```

- [ ] **Step 5: Verify end-to-end portal flow**

```bash
npx vite
```

Visit `http://localhost:5173/mosaic/submit/?token=test-token-abc`.

Verify:
1. Password gate appears. Enter correct password.
2. Submission form loads. Name field is empty.
3. Draw a sprite using the pixel editor.
4. Enter a name.
5. Click Save. Verify no errors.
6. Check Supabase dashboard -- the `submissions` row for `test-token-abc` should have `name` and `sprite_data` populated.
7. Refresh the page. Name and sprite should reload from the database.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(m1): submission form with name, pixel editor, and Supabase persistence"
```

---

## Chunk 3: Game

### Task 7: PixiJS Viewport

**Files:**
- Create: `src/game/viewport.ts`
- Modify: `src/game/main.ts`

- [ ] **Step 1: Write viewport scaling module**

`src/game/viewport.ts`:

Implements 480x270 internal resolution rendered at the largest integer scale that fits the browser viewport, centered with letterboxing on all sides (design section-2.1).

```ts
import { Application } from "pixi.js";

export const INTERNAL_WIDTH = 480;
export const INTERNAL_HEIGHT = 270;

/**
 * Calculate the largest integer scale factor that fits the viewport.
 * Returns at minimum 1.
 */
export function calculateScale(viewportW: number, viewportH: number): number {
  const scaleX = Math.floor(viewportW / INTERNAL_WIDTH);
  const scaleY = Math.floor(viewportH / INTERNAL_HEIGHT);
  return Math.max(1, Math.min(scaleX, scaleY));
}

/**
 * Resize and center the PixiJS canvas within the viewport.
 */
export function applyViewport(app: Application): void {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const scale = calculateScale(vw, vh);
  const canvasW = INTERNAL_WIDTH * scale;
  const canvasH = INTERNAL_HEIGHT * scale;

  app.renderer.resize(INTERNAL_WIDTH, INTERNAL_HEIGHT);
  const canvas = app.canvas as HTMLCanvasElement;
  canvas.style.width = `${canvasW}px`;
  canvas.style.height = `${canvasH}px`;
  canvas.style.position = "absolute";
  canvas.style.left = `${(vw - canvasW) / 2}px`;
  canvas.style.top = `${(vh - canvasH) / 2}px`;
  canvas.style.imageRendering = "pixelated";
}
```

- [ ] **Step 2: Write viewport test**

`src/game/__tests__/viewport.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { calculateScale, INTERNAL_WIDTH, INTERNAL_HEIGHT } from "../viewport";

describe("calculateScale", () => {
  it("returns 4x for 1080p", () => {
    expect(calculateScale(1920, 1080)).toBe(4);
  });

  it("returns 8x for 4K", () => {
    expect(calculateScale(3840, 2160)).toBe(8);
  });

  it("returns 2x for 720p", () => {
    // 1280/480 = 2.67, 720/270 = 2.67 -> floor = 2
    expect(calculateScale(1280, 720)).toBe(2);
  });

  it("returns 1x for very small viewports", () => {
    expect(calculateScale(400, 200)).toBe(1);
  });

  it("uses the smaller axis to avoid overflow", () => {
    // Wide but short: 1920/480=4, 300/270=1.1 -> floor min = 1
    expect(calculateScale(1920, 300)).toBe(1);
  });
});
```

- [ ] **Step 3: Run test**

```bash
npx vitest run src/game/__tests__/viewport.test.ts
```

Expected: PASS.

- [ ] **Step 4: Wire into game entry point**

`src/game/main.ts`:

```ts
import { Application } from "pixi.js";
import { applyViewport } from "./viewport";

async function boot() {
  const app = new Application();
  await app.init({
    width: 480,
    height: 270,
    backgroundColor: 0x1a1a2e,
    antialias: false,
    roundPixels: true,
  });
  document.body.appendChild(app.canvas);
  applyViewport(app);
  window.addEventListener("resize", () => applyViewport(app));
}

boot();
```

- [ ] **Step 5: Verify manually**

```bash
npx vite
```

Visit game URL. Should see a dark canvas centered in the browser. Resize the browser window -- the canvas should snap to integer scales and stay centered with letterboxing. The canvas should appear crisp (no blurring from fractional scaling).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(m1): PixiJS viewport with integer scaling and letterboxing"
```

---

### Task 8: Tilemap Rendering

**Files:**
- Create: `src/game/tilemap.ts`, `public/maps/village.tmj`
- Modify: `src/game/main.ts`

- [ ] **Step 1: Create village square map in Tiled**

Open Tiled. Create a new map:
- Orientation: Orthogonal
- Tile size: 16x16
- Map size: 40x30 tiles (640x480 pixels -- larger than the 480x270 viewport, so the camera can scroll)

Add the Ninja Adventure tileset(s) from `public/tilesets/`.

Create layers per design section-7.3:
- `ground` (tile layer): grass, paths, cobblestone for the village square
- `buildings` (tile layer): a few simple structures at the edges
- `decoration` (tile layer): trees, fences, flowers
- `collision` (tile layer): solid tiles over buildings and edges (not rendered)
- `spawns` (object layer): leave empty for now (NPC positions added later)

Keep the map simple for M1 -- a grassy field with a cobblestone square in the center and a few trees. The map will grow in M3.

Export as JSON format to `public/maps/village.tmj`.

- [ ] **Step 2: Write TMJ tilemap loader**

`src/game/tilemap.ts`:

Parses a Tiled TMJ (JSON) file and renders tile layers using PixiJS. Uses `Sprite` and `Container` for rendering (not `@pixi/tilemap`) to avoid v8 compatibility risk. The village square is small enough that per-tile sprites are performant.

```ts
import { Container, Sprite, Texture, Rectangle, Assets } from "pixi.js";

interface TMJLayer {
  name: string;
  type: "tilelayer" | "objectgroup";
  data?: number[];
  width?: number;
  height?: number;
  visible: boolean;
}

interface TMJTileset {
  firstgid: number;
  image: string;
  tilewidth: number;
  tileheight: number;
  imagewidth: number;
  imageheight: number;
  columns: number;
}

interface TMJMap {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: TMJLayer[];
  tilesets: TMJTileset[];
}

const RENDER_LAYERS = ["ground", "buildings", "decoration"];

/**
 * Load and render a Tiled TMJ map. Returns a Container with all visible
 * tile layers and a Set of solid tile indices from the collision layer.
 */
export async function loadTilemap(
  mapUrl: string,
  tilesetBasePath: string
): Promise<{ container: Container; collision: Set<number>; mapWidth: number; mapHeight: number }> {
  const map: TMJMap = await (await fetch(mapUrl)).json();
  const container = new Container();
  const collision = new Set<number>();

  // Load tileset textures.
  const tileTextures = new Map<number, Texture>();

  for (const ts of map.tilesets) {
    const texturePath = `${tilesetBasePath}/${ts.image.split("/").pop()}`;
    const baseTexture = await Assets.load(texturePath);
    const cols = ts.columns;

    // Pre-slice every tile in this tileset.
    for (let localId = 0; localId < (ts.imagewidth / ts.tilewidth) * (ts.imageheight / ts.tileheight); localId++) {
      const gid = ts.firstgid + localId;
      const col = localId % cols;
      const row = Math.floor(localId / cols);
      tileTextures.set(
        gid,
        new Texture({
          source: baseTexture.source,
          frame: new Rectangle(
            col * ts.tilewidth,
            row * ts.tileheight,
            ts.tilewidth,
            ts.tileheight
          ),
        })
      );
    }
  }

  // Render each layer.
  for (const layer of map.layers) {
    if (layer.type !== "tilelayer" || !layer.data) continue;

    if (layer.name === "collision") {
      // Build collision set (tile indices where gid > 0).
      for (let i = 0; i < layer.data.length; i++) {
        if (layer.data[i] > 0) collision.add(i);
      }
      continue; // Don't render collision layer.
    }

    if (!RENDER_LAYERS.includes(layer.name)) continue;

    const layerContainer = new Container();
    for (let i = 0; i < layer.data.length; i++) {
      const gid = layer.data[i];
      if (gid === 0) continue;
      const tex = tileTextures.get(gid);
      if (!tex) continue;
      const sprite = new Sprite(tex);
      sprite.x = (i % map.width) * map.tilewidth;
      sprite.y = Math.floor(i / map.width) * map.tileheight;
      layerContainer.addChild(sprite);
    }
    container.addChild(layerContainer);
  }

  return {
    container,
    collision,
    mapWidth: map.width * map.tilewidth,
    mapHeight: map.height * map.tileheight,
  };
}
```

- [ ] **Step 3: Wire tilemap into game**

Update `src/game/main.ts`:

```ts
import { Application } from "pixi.js";
import { applyViewport } from "./viewport";
import { loadTilemap } from "./tilemap";

const BASE = import.meta.env.BASE_URL;

async function boot() {
  const app = new Application();
  await app.init({
    width: 480,
    height: 270,
    backgroundColor: 0x1a1a2e,
    antialias: false,
    roundPixels: true,
  });
  document.body.appendChild(app.canvas);
  applyViewport(app);
  window.addEventListener("resize", () => applyViewport(app));

  const { container: mapContainer } = await loadTilemap(
    `${BASE}maps/village.tmj`,
    `${BASE}tilesets`
  );
  app.stage.addChild(mapContainer);
}

boot();
```

- [ ] **Step 4: Verify manually**

```bash
npx vite
```

Visit game URL. The village square tilemap should render. Tiles should be crisp (no blurring). If the map is larger than the viewport, only the top-left portion is visible (camera scrolling comes in Task 10).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(m1): Tiled TMJ loader and village square tilemap rendering"
```

---

### Task 9: NPC Sprite Display

**Files:**
- Create: `src/game/npcs.ts`
- Modify: `src/game/main.ts`

- [ ] **Step 1: Write NPC sprite module**

`src/game/npcs.ts`:

Fetches all submissions from Supabase, converts each sprite's pixel data into a PixiJS `Texture`, and places sprites in a grid layout in the village square.

```ts
import { Container, Sprite, Texture } from "pixi.js";
import { supabase } from "../shared/supabase";
import type { Submission, SpriteData } from "../shared/types";

const TILE = 16;

/**
 * Convert a SpriteData pixel array into a PixiJS Texture.
 */
function spriteDataToTexture(data: SpriteData): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = data.width;
  canvas.height = data.height;
  const ctx = canvas.getContext("2d")!;
  const imageData = ctx.createImageData(data.width, data.height);

  for (let i = 0; i < data.pixels.length; i++) {
    const hex = data.pixels[i];
    const offset = i * 4;
    if (!hex) {
      // Transparent.
      imageData.data[offset + 3] = 0;
      continue;
    }
    imageData.data[offset] = parseInt(hex.slice(1, 3), 16);
    imageData.data[offset + 1] = parseInt(hex.slice(3, 5), 16);
    imageData.data[offset + 2] = parseInt(hex.slice(5, 7), 16);
    imageData.data[offset + 3] = 255;
  }

  ctx.putImageData(imageData, 0, 0);
  return Texture.from(canvas);
}

/**
 * Fetch all submissions with sprite data and render them as sprites.
 * For M1, sprites are arranged in a grid near the center of the map.
 */
export async function loadNpcSprites(
  mapWidth: number,
  mapHeight: number
): Promise<Container> {
  const { data, error } = await supabase
    .from("submissions")
    .select("*")
    .not("sprite_data", "is", null);

  if (error) {
    console.error("Failed to fetch submissions:", error.message);
    return new Container();
  }

  const submissions = (data ?? []) as Submission[];
  const container = new Container();

  // Grid layout: center of map, 3 tiles apart.
  const cols = Math.ceil(Math.sqrt(submissions.length));
  const startX = Math.floor(mapWidth / 2 / TILE - cols) * TILE;
  const startY = Math.floor(mapHeight / 2 / TILE - 2) * TILE;

  for (let i = 0; i < submissions.length; i++) {
    const sub = submissions[i];
    if (!sub.sprite_data) continue;

    const texture = spriteDataToTexture(sub.sprite_data);
    const sprite = new Sprite(texture);
    const col = i % cols;
    const row = Math.floor(i / cols);
    sprite.x = startX + col * TILE * 3;
    sprite.y = startY + row * TILE * 3;
    container.addChild(sprite);
  }

  return container;
}
```

- [ ] **Step 2: Wire into game**

Update `src/game/main.ts` to call `loadNpcSprites` after the tilemap:

```ts
import { Application } from "pixi.js";
import { applyViewport } from "./viewport";
import { loadTilemap } from "./tilemap";
import { loadNpcSprites } from "./npcs";

const BASE = import.meta.env.BASE_URL;

async function boot() {
  const app = new Application();
  await app.init({
    width: 480,
    height: 270,
    backgroundColor: 0x1a1a2e,
    antialias: false,
    roundPixels: true,
  });
  document.body.appendChild(app.canvas);
  applyViewport(app);
  window.addEventListener("resize", () => applyViewport(app));

  const { container: mapContainer, mapWidth, mapHeight } = await loadTilemap(
    `${BASE}maps/village.tmj`,
    `${BASE}tilesets`
  );
  app.stage.addChild(mapContainer);

  const npcContainer = await loadNpcSprites(mapWidth, mapHeight);
  app.stage.addChild(npcContainer);
}

boot();
```

- [ ] **Step 3: Verify with test submission**

Ensure the test submission from Task 6 has sprite data (submit a sprite via the portal if not).

```bash
npx vite
```

Visit game URL. The submitted sprite should appear on the tilemap in the village square area. If no submissions exist, the map renders without sprites (no errors).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(m1): render loved-one sprites from Supabase on village tilemap"
```

---

### Task 10: Camera Movement

**Files:**
- Create: `src/game/camera.ts`
- Modify: `src/game/main.ts`

- [ ] **Step 1: Write camera module**

`src/game/camera.ts`:

Tracks arrow key state, updates a camera position each frame, and applies it as a stage offset. The camera is clamped so it cannot scroll past the map edges.

```ts
import { Container } from "pixi.js";
import { INTERNAL_WIDTH, INTERNAL_HEIGHT } from "./viewport";

const SPEED = 2; // pixels per frame

interface CameraState {
  x: number;
  y: number;
}

const keys: Record<string, boolean> = {};

export function initInput(): void {
  window.addEventListener("keydown", (e) => {
    keys[e.key] = true;
  });
  window.addEventListener("keyup", (e) => {
    keys[e.key] = false;
  });
}

export function createCamera(): CameraState {
  return { x: 0, y: 0 };
}

export function updateCamera(
  camera: CameraState,
  mapWidth: number,
  mapHeight: number
): void {
  if (keys["ArrowLeft"] || keys["a"]) camera.x -= SPEED;
  if (keys["ArrowRight"] || keys["d"]) camera.x += SPEED;
  if (keys["ArrowUp"] || keys["w"]) camera.y -= SPEED;
  if (keys["ArrowDown"] || keys["s"]) camera.y += SPEED;

  // Clamp so camera doesn't go past map edges.
  const maxX = Math.max(0, mapWidth - INTERNAL_WIDTH);
  const maxY = Math.max(0, mapHeight - INTERNAL_HEIGHT);
  camera.x = Math.max(0, Math.min(camera.x, maxX));
  camera.y = Math.max(0, Math.min(camera.y, maxY));
}

export function applyCamera(stage: Container, camera: CameraState): void {
  stage.x = -camera.x;
  stage.y = -camera.y;
}
```

- [ ] **Step 2: Write camera test**

`src/game/__tests__/camera.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createCamera, updateCamera } from "../camera";

describe("updateCamera", () => {
  it("clamps to zero at top-left", () => {
    const cam = createCamera();
    cam.x = -10;
    cam.y = -10;
    updateCamera(cam, 640, 480);
    expect(cam.x).toBe(0);
    expect(cam.y).toBe(0);
  });

  it("clamps to max at bottom-right", () => {
    const cam = createCamera();
    cam.x = 9999;
    cam.y = 9999;
    updateCamera(cam, 640, 480);
    // maxX = 640 - 480 = 160, maxY = 480 - 270 = 210
    expect(cam.x).toBe(160);
    expect(cam.y).toBe(210);
  });
});
```

- [ ] **Step 3: Run test**

```bash
npx vitest run src/game/__tests__/camera.test.ts
```

Expected: PASS.

- [ ] **Step 4: Wire camera into game loop**

Update `src/game/main.ts` to add the camera and game loop:

```ts
import { Application } from "pixi.js";
import { applyViewport } from "./viewport";
import { loadTilemap } from "./tilemap";
import { loadNpcSprites } from "./npcs";
import { initInput, createCamera, updateCamera, applyCamera } from "./camera";

const BASE = import.meta.env.BASE_URL;

async function boot() {
  const app = new Application();
  await app.init({
    width: 480,
    height: 270,
    backgroundColor: 0x1a1a2e,
    antialias: false,
    roundPixels: true,
  });
  document.body.appendChild(app.canvas);
  applyViewport(app);
  window.addEventListener("resize", () => applyViewport(app));

  const { container: mapContainer, mapWidth, mapHeight } = await loadTilemap(
    `${BASE}maps/village.tmj`,
    `${BASE}tilesets`
  );
  app.stage.addChild(mapContainer);

  const npcContainer = await loadNpcSprites(mapWidth, mapHeight);
  app.stage.addChild(npcContainer);

  // Camera.
  initInput();
  const camera = createCamera();

  // Center camera on map initially.
  camera.x = Math.max(0, (mapWidth - 480) / 2);
  camera.y = Math.max(0, (mapHeight - 270) / 2);

  app.ticker.add(() => {
    updateCamera(camera, mapWidth, mapHeight);
    applyCamera(app.stage, camera);
  });
}

boot();
```

- [ ] **Step 5: Verify manually**

```bash
npx vite
```

Visit game URL. Arrow keys (and WASD) should scroll the camera across the tilemap. Camera should stop at map edges. NPC sprites should scroll with the map.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(m1): camera movement with arrow keys and edge clamping"
```

---

## Chunk 4: Deploy and Verify

### Task 11: GitHub Pages Deployment

**Files:**
- May need: GitHub repository settings, GitHub Actions workflow (optional)

- [ ] **Step 1: Build the project**

```bash
npx vite build
```

Verify: `dist/` contains `index.html` (game), `submit/index.html` (portal), and `assets/` directory. No build errors.

- [ ] **Step 2: Verify the build locally**

```bash
npx vite preview
```

Visit `http://localhost:4173/mosaic/` -- game should work.
Visit `http://localhost:4173/mosaic/submit/?token=test-token-abc` -- portal should work.

- [ ] **Step 3: Deploy to GitHub Pages**

Option A (simple): Use `gh-pages` package:

```bash
npm install -D gh-pages
npx gh-pages -d dist
```

Option B (manual): Push `dist/` contents to a `gh-pages` branch.

Option C (automated): Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]

permissions:
  contents: read
  pages: write
  id-token: write

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx vite build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist
      - id: deployment
        uses: actions/deploy-pages@v4
```

For Option C, add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as repository secrets in GitHub Settings > Secrets and variables > Actions.

Enable GitHub Pages in repository settings: Settings > Pages > Source: GitHub Actions.

- [ ] **Step 4: Verify public URLs**

Visit `https://gszep.com/mosaic/` -- game should load tilemap and any submitted sprites.
Visit `https://gszep.com/mosaic/submit/?token=test-token-abc` -- portal should load.

- [ ] **Step 5: Commit deployment config**

```bash
git add -A
git commit -m "feat(m1): GitHub Pages deployment with Vite build"
git push
```

---

### Task 12: End-to-End Loop Verification

This is the M1 acceptance test. No code changes -- just verification.

- [ ] **Step 1: Create a fresh test token**

In Supabase SQL Editor:

```sql
insert into submissions (token) values ('e2e-test-token');
```

- [ ] **Step 2: Submit a sprite via the public portal**

Visit `https://gszep.com/mosaic/submit/?token=e2e-test-token`.

1. Enter the password.
2. Enter a name (e.g., "Test User").
3. Draw a recognizable sprite (e.g., a smiley face).
4. Click Save.
5. Verify in Supabase dashboard that the row has name and sprite_data.

- [ ] **Step 3: View the sprite in the public game**

Visit `https://gszep.com/mosaic/`.

1. The tilemap loads.
2. The submitted sprite appears in the village square.
3. Arrow keys scroll the camera.

- [ ] **Step 4: Edit and re-verify**

Return to the portal URL. Change the sprite (add a hat, change colors). Save. Reload the game. The updated sprite should appear.

**M1 is complete when this loop works at the public URLs.**
