import { CONFIG } from "../config.js";
import { resizeRenderer } from "../engine/renderer.js";

const PRESETS = CONFIG.quality;

export class QualityManager {
  constructor(renderer, camera) {
    this.renderer = renderer;
    this.camera = camera;
    this.mode = "auto";
    this.level = "medium";
    this.scale = PRESETS.medium.scale;
    this.targetFps = CONFIG.performance.targetFps;
    this.batterySaver = false;
    this.frameSamples = new Float32Array(120);
    this.sampleCursor = 0;
    this.sampleCount = 0;
    this.lastCheck = 0;
    this.overBudgetSince = 0;
    this.headroomSince = 0;
    this.lastLog = 0;
    this.apply();
  }

  get pixelRatio() {
    const deviceRatio = window.devicePixelRatio || 1;
    return Math.min(deviceRatio, CONFIG.render.maxPixelRatio) * this.scale;
  }

  apply() {
    resizeRenderer(this.renderer, this.camera, window.innerWidth, window.innerHeight, this.pixelRatio);
  }

  setQuality(mode) {
    this.mode = mode;
    if (mode !== "auto") {
      this.level = mode;
      this.scale = PRESETS[mode].scale;
      this.apply();
    }
  }

  setBatterySaver(enabled) {
    this.batterySaver = enabled;
    if (enabled) {
      this.targetFps = 30;
      this.mode = "auto";
      this.level = "low";
      this.scale = PRESETS.low.scale;
    } else {
      this.targetFps = 60;
      if (this.mode === "auto") this.level = "medium";
      this.scale = PRESETS[this.level].scale;
    }
    this.apply();
  }

  setTargetFps(value) {
    this.targetFps = value === 30 ? 30 : 60;
  }

  async runStartupBenchmark(renderBenchmarkFrame) {
    const samples = [];
    let previous = performance.now();
    let elapsed = 0;
    let frames = 0;
    while (elapsed < CONFIG.performance.benchmarkDurationMs) {
      await new Promise(resolve => requestAnimationFrame(resolve));
      const now = performance.now();
      const delta = now - previous;
      previous = now;
      if (frames >= CONFIG.performance.benchmarkWarmupFrames) samples.push(delta);
      renderBenchmarkFrame();
      elapsed += delta;
      frames++;
    }
    const average = samples.length ? samples.reduce((sum, value) => sum + value, 0) / samples.length : 25;
    const next = average <= 18 ? "high" : average <= 25 ? "medium" : "low";
    if (this.mode === "auto" && !this.batterySaver) {
      this.level = next;
      this.scale = PRESETS[next].scale;
      this.apply();
    }
    return { averageFrameMs: average, level: this.level, frames: samples.length };
  }

  onFrame(frameMs, now) {
    if (!CONFIG.performance.dynamicResolution || this.mode !== "auto" || this.batterySaver) return;
    this.frameSamples[this.sampleCursor] = frameMs;
    this.sampleCursor = (this.sampleCursor + 1) % this.frameSamples.length;
    this.sampleCount = Math.min(this.sampleCount + 1, this.frameSamples.length);
    if (now - this.lastCheck < CONFIG.performance.resolutionCheckIntervalMs || this.sampleCount === 0) return;
    this.lastCheck = now;
    let total = 0;
    for (let i = 0; i < this.sampleCount; i++) total += this.frameSamples[i];
    const average = total / this.sampleCount;

    if (average > CONFIG.performance.lowerThresholdMs) {
      this.headroomSince = 0;
      if (!this.overBudgetSince) this.overBudgetSince = now;
      if (now - this.overBudgetSince >= CONFIG.performance.lowerHoldMs) {
        this.scale = Math.max(CONFIG.performance.minResolutionScale, this.scale - CONFIG.performance.resolutionStep);
        this.level = "custom";
        this.overBudgetSince = now;
        this.apply();
        this.logDrop(average, "reducción de resolución para aliviar GPU");
      }
    } else if (average < CONFIG.performance.raiseThresholdMs) {
      this.overBudgetSince = 0;
      if (!this.headroomSince) this.headroomSince = now;
      if (now - this.headroomSince >= CONFIG.performance.raiseHoldMs) {
        this.scale = Math.min(CONFIG.performance.maxResolutionScale, this.scale + CONFIG.performance.resolutionStep);
        this.level = "custom";
        this.headroomSince = now;
        this.apply();
      }
    } else {
      this.overBudgetSince = 0;
      this.headroomSince = 0;
    }
  }

  logDrop(frameMs, cause) {
    const now = performance.now();
    if (now - this.lastLog < 5000) return;
    this.lastLog = now;
    console.warn("[Rendimiento] Fotograma lento:", frameMs.toFixed(1), "ms. Causa probable:", cause);
  }

  get frameInterval() {
    return 1000 / this.targetFps;
  }
}
