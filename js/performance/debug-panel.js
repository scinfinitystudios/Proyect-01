import { CONFIG } from "../config.js";

export class DebugPanel {
  constructor(element) {
    this.element = element;
    this.enabled = new URLSearchParams(location.search).has(CONFIG.debug.enabledByQuery);
    this.frames = 0;
    this.lastUpdate = performance.now();
    this.fps = 0;
    this.frameMs = 0;
    this.element.classList.toggle("hidden", !this.enabled);
  }

  toggle() {
    this.enabled = !this.enabled;
    this.element.classList.toggle("hidden", !this.enabled);
    return this.enabled;
  }

  update(renderer, deltaMs, quality, now) {
    this.frames++;
    this.frameMs = deltaMs;
    if (now - this.lastUpdate < 500) return;
    this.fps = this.frames * 1000 / (now - this.lastUpdate);
    this.frames = 0;
    this.lastUpdate = now;
    if (!this.enabled) return;

    const info = renderer.info;
    const memory = info.memory || {};
    this.element.textContent =
      "FPS: " + this.fps.toFixed(1) + "\n" +
      "Fotograma: " + this.frameMs.toFixed(1) + " ms\n" +
      "Dibujado: " + info.render.calls + " llamadas\n" +
      "Triángulos: " + info.render.triangles + "\n" +
      "Geometrías: " + (memory.geometries ?? "N/D") + "\n" +
      "Texturas: " + (memory.textures ?? "N/D") + "\n" +
      "Escala: " + quality.scale.toFixed(2) + "x\n" +
      "Límite: " + quality.targetFps + " FPS";
  }
}
