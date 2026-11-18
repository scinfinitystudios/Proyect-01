import { CONFIG } from "./config.js";
import { createRenderer, createInitialScene } from "./engine/renderer.js";
import { QualityManager } from "./performance/quality-manager.js";
import { DebugPanel } from "./performance/debug-panel.js";

function showStartupError(error) {
  console.error("[FPS Mobile] Error de inicio:", error);
  if (typeof window.__FPS_SHOW_ERROR__ === "function") {
    const message = error && error.message ? error.message : String(error || "Error desconocido");
    window.__FPS_SHOW_ERROR__(message);
  } else {
    const status = document.querySelector("#loading-status");
    if (status) status.textContent = "No se pudo iniciar el motor. Cierra y vuelve a abrir la aplicación.";
  }
}

function startGame() {
  const canvas = document.querySelector("#game-canvas");
  const loading = document.querySelector("#loading");
  const qualitySelect = document.querySelector("#quality-select");
  const fpsSelect = document.querySelector("#fps-select");
  const batteryToggle = document.querySelector("#battery-toggle");
  const debugToggle = document.querySelector("#debug-toggle");
  const debugPanel = new DebugPanel(document.querySelector("#debug-panel"));
  const moveZone = document.querySelector("#move-zone");
  const moveKnob = document.querySelector("#move-knob");
  const lookZone = document.querySelector("#look-zone");
  const lookKnob = document.querySelector("#look-knob");
  const jumpButton = document.querySelector("#jump-button");
  const fireButton = document.querySelector("#fire-button");

  if (!canvas || !loading || !qualitySelect || !fpsSelect || !batteryToggle || !debugToggle) {
    throw new Error("Faltan elementos necesarios en index.html.");
  }

  const setup = createRenderer(canvas);
  if (!setup) {
    const compatibility = document.querySelector("#compatibility");
    loading.classList.add("hidden");
    if (compatibility) compatibility.classList.remove("hidden");
    throw new Error("WebGL2 no está disponible en este dispositivo o WebView.");
  }

  const { THREE, renderer } = setup;
  const { scene, camera } = createInitialScene(THREE);
  const quality = new QualityManager(renderer, camera);

  let rafId = 0;
  let previousTime = 0;
  let accumulator = 0;
  let lastRenderTime = 0;
  const moveInput = { x: 0, y: 0 };
  const lookInput = { x: 0, y: 0 };
  let yaw = 0;
  let pitch = 0;
  let verticalVelocity = 0;
  let grounded = true;
  let jumpQueued = false;
  let visible = !document.hidden;
  let running = false;
  const fixedStep = CONFIG.performance.fixedStep;

  function bindStick(zone, knob, input) {
    if (!zone || !knob) return;
    let pointerId = null;
    const radius = 43;
    const update = (event) => {
      const rect = zone.getBoundingClientRect();
      let dx = event.clientX - (rect.left + rect.width / 2);
      let dy = event.clientY - (rect.top + rect.height / 2);
      const length = Math.hypot(dx, dy);
      if (length > radius) { dx = dx / length * radius; dy = dy / length * radius; }
      input.x = dx / radius;
      input.y = dy / radius;
      knob.style.transform = "translate(" + dx + "px," + dy + "px)";
    };
    zone.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      if (pointerId !== null) return;
      pointerId = event.pointerId;
      zone.setPointerCapture(pointerId);
      update(event);
    });
    zone.addEventListener("pointermove", (event) => {
      if (event.pointerId === pointerId) { event.preventDefault(); update(event); }
    });
    const release = (event) => {
      if (event.pointerId !== pointerId) return;
      pointerId = null;
      input.x = 0; input.y = 0;
      knob.style.transform = "translate(0,0)";
    };
    zone.addEventListener("pointerup", release);
    zone.addEventListener("pointercancel", release);
    zone.addEventListener("lostpointercapture", release);
  }

  bindStick(moveZone, moveKnob, moveInput);
  bindStick(lookZone, lookKnob, lookInput);
  jumpButton?.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    jumpQueued = true;
  });
  fireButton?.addEventListener("click", () => {
    const message = document.querySelector("#game-message");
    if (message) {
      message.textContent = "El sistema de disparo estará disponible en la siguiente fase.";
      clearTimeout(fireButton._messageTimer);
      fireButton._messageTimer = setTimeout(() => {
        message.textContent = "FPS Mobile — escenario de prueba.";
      }, 1800);
    }
  });

  function updateSimulation(step) {
    yaw -= lookInput.x * 2.2 * step;
    pitch = Math.max(-1.15, Math.min(1.15, pitch - lookInput.y * 1.8 * step));
    camera.rotation.order = "YXZ";
    camera.rotation.y = yaw;
    camera.rotation.x = pitch;

    const forward = -moveInput.y;
    const strafe = moveInput.x;
    const length = Math.hypot(forward, strafe);
    if (length > 0.08) {
      const speed = 5.2;
      const f = forward / Math.max(1, length);
      const s = strafe / Math.max(1, length);
      camera.position.x += (Math.sin(yaw) * f + Math.cos(yaw) * s) * speed * step;
      camera.position.z += (-Math.cos(yaw) * f + Math.sin(yaw) * s) * speed * step;
    }

    if (jumpQueued && grounded) {
      verticalVelocity = 5.2;
      grounded = false;
    }
    jumpQueued = false;
    verticalVelocity -= 14 * step;
    camera.position.y += verticalVelocity * step;
    if (camera.position.y <= 1.65) {
      camera.position.y = 1.65;
      verticalVelocity = 0;
      grounded = true;
    }
  }

  function renderFrame() {
    renderer.render(scene, camera);
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

  qualitySelect.value = "auto";
  qualitySelect.addEventListener("change", () => quality.setQuality(qualitySelect.value));
  fpsSelect.addEventListener("change", () => quality.setTargetFps(Number(fpsSelect.value)));
  batteryToggle.addEventListener("change", () => {
    quality.setBatterySaver(batteryToggle.checked);
    fpsSelect.value = String(quality.targetFps);
    qualitySelect.value = batteryToggle.checked ? "low" : "auto";
    qualitySelect.disabled = batteryToggle.checked;
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

  if ("serviceWorker" in navigator && location.protocol.startsWith("http") && location.hostname !== "fpsmobile.local") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(error => {
        console.warn("[Carga] No se pudo registrar el Service Worker:", error);
      });
    }, { once: true });
  }

  renderFrame();
  loading.classList.add("hidden");
  if (typeof window.__FPS_MARK_BOOTED__ === "function") window.__FPS_MARK_BOOTED__();
  startLoop();
}

try {
  startGame();
} catch (error) {
  showStartupError(error);
}
