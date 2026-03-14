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
        editor: resolve(__dirname, "editor/index.html"),
      },
    },
  },
});
