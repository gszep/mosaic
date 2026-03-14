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
