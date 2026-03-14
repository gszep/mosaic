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
