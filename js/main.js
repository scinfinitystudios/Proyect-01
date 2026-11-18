import { CONFIG } from "./config.js";
import { createRenderer, createInitialScene } from "./engine/renderer.js";
import { QualityManager } from "./performance/quality-manager.js";
import { DebugPanel } from "./performance/debug-panel.js";

const canvas = document.querySelector("#game-canvas");
const loading = document.querySelector("#loading");
const loadingStatus = document.querySelector("#loading-status");
const compatibility = document.querySelector("#compatibility");
const qualitySelect = document.querySelector("#quality-select");
const fpsSelect = document.querySelector("#fps-select");
const batteryToggle = document.querySelector("#battery-toggle");
const debugToggle = document.querySelector("#debug-toggle");
const debugPanel = new DebugPanel(document.querySelector("#debug-panel"));

const setup = createRenderer(canvas);
if (!setup) {
  loading.classList.add("hidden");
  compatibility.classList.remove("hidden");
  throw new Error("WebGL2 no está disponible en este navegador.");
}

const { THREE, renderer } = setup;
const { scene, camera } = createInitialScene(THREE);
const quality = new QualityManager(renderer, camera);

let rafId = 0;
let previousTime = 0;
let accumulator = 0;
let lastRenderTime = 0;
let visible = !document.hidden;
let running = false;
const fixedStep = CONFIG.performance.fixedStep;

function updateSimulation(step) {
  // Reservado para la lógica del FPS; mantener el paso fijo y sin reservas temporales.
  void step;
}

function renderFrame() {
  renderer.render(scene, camera);
}

async function initialize() {
  loadingStatus.textContent = "Calibrando el rendimiento del dispositivo…";
  const result = await quality.runStartupBenchmark(renderFrame);
  qualitySelect.value = "auto";
  loadingStatus.textContent = "Calibración: " + result.level + " (" + result.averageFrameMs.toFixed(1) + " ms/fotograma)";
  await new Promise(resolve => setTimeout(resolve, 250));
  loading.classList.add("hidden");
  startLoop();
}

function loop(now) {
  if (!running || !visible) return;
  rafId = requestAnimationFrame(loop);
  if (!previousTime) previousTime = now;
  const rawDelta = Math.min((now - previousTime) / 1000, CONFIG.performance.maxFrameDelta);
  previousTime = now;
  accumulator += rawDelta;

  let steps = 0;
  while (accumulator >= fixedStep && steps < 3) {
    updateSimulation(fixedStep);
    accumulator -= fixedStep;
    steps++;
  }
  if (steps === 3) accumulator = 0;

  const frameMs = rawDelta * 1000;
  quality.onFrame(frameMs, now);
  debugPanel.update(renderer, frameMs, quality, now);

  if (now - lastRenderTime >= quality.frameInterval - 1) {
    renderFrame();
    lastRenderTime = now;
  }
  if (frameMs > CONFIG.debug.logDropMs) quality.logDrop(frameMs, "tiempo de fotograma superior al presupuesto");
}

function startLoop() {
  if (running || !visible) return;
  running = true;
  previousTime = 0;
  lastRenderTime = 0;
  rafId = requestAnimationFrame(loop);
}

function stopLoop() {
  running = false;
  cancelAnimationFrame(rafId);
  previousTime = 0;
}

qualitySelect.addEventListener("change", () => quality.setQuality(qualitySelect.value));
fpsSelect.addEventListener("change", () => quality.setTargetFps(Number(fpsSelect.value)));
batteryToggle.addEventListener("change", () => {
  quality.setBatterySaver(batteryToggle.checked);
  fpsSelect.value = String(quality.targetFps);
  qualitySelect.value = batteryToggle.checked ? "low" : "auto";
});
debugToggle.addEventListener("click", () => {
  debugToggle.setAttribute("aria-pressed", String(debugPanel.toggle()));
});
window.addEventListener("resize", () => quality.apply(), { passive: true });
document.addEventListener("visibilitychange", () => {
  visible = !document.hidden;
  if (visible) startLoop();
  else stopLoop();
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(error => {
      console.warn("[Carga] No se pudo registrar el Service Worker:", error);
    });
  }, { once: true });
}

initialize().catch(error => {
  console.error("[Inicio] Error al iniciar el motor:", error);
  loadingStatus.textContent = "No se pudo iniciar el motor. Revisa la consola del navegador.";
});
