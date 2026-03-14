import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";
import { writeFile, mkdir } from "fs/promises";

/** Dev-only plugin: POST /api/save-map/:name writes to public/maps/:name.tmj */
function mapWriterPlugin(): Plugin {
  return {
    name: "map-writer",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const match = req.url?.match(/^\/api\/save-map\/([a-z]+)$/);
        if (req.method !== "POST" || !match) return next();

        const name = match[1];
        const chunks: Buffer[] = [];
        req.on("data", (c: Buffer) => chunks.push(c));
        req.on("end", async () => {
          try {
            const dir = resolve(__dirname, "public/maps");
            await mkdir(dir, { recursive: true });
            await writeFile(resolve(dir, `${name}.tmj`), Buffer.concat(chunks));
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok: true }));
          } catch (err) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: String(err) }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  base: "/mosaic/",
  plugins: [react(), mapWriterPlugin()],
  build: {
    rollupOptions: {
      input: {
        game: resolve(__dirname, "index.html"),
        portal: resolve(__dirname, "submit/index.html"),
        editor: resolve(__dirname, "editor/index.html"),
      },
    },
  },
});
