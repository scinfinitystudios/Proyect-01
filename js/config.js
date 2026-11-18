// Límites y presupuestos centralizados del motor.
export const CONFIG = Object.freeze({
  render: {
    maxPixelRatio: 1.5,
    antialias: false,
    powerPreference: "high-performance",
    clearColor: 0x101820,
    fogNear: 18,
    fogFar: 65
  },
  performance: {
    targetFps: 60,
    fixedStep: 1 / 60,
    maxFrameDelta: 0.05,
    benchmarkDurationMs: 900,
    benchmarkWarmupFrames: 8,
    dynamicResolution: true,
    resolutionCheckIntervalMs: 1600,
    lowerThresholdMs: 19,
    raiseThresholdMs: 13.5,
    lowerHoldMs: 1800,
    raiseHoldMs: 4500,
    minResolutionScale: 0.65,
    maxResolutionScale: 1,
    resolutionStep: 0.1,
    drawCallBudget: 100,
    triangleBudget: 100000
  },
  quality: {
    low: { scale: 0.65, label: "Baja" },
    medium: { scale: 0.8, label: "Media" },
    high: { scale: 1, label: "Alta" }
  },
  debug: {
    enabledByQuery: "debug",
    logDropMs: 25
  }
});
