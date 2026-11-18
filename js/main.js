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
  const raycaster = new THREE.Raycaster();
  const screenCenter = new THREE.Vector2(0, 0);
  const targets = [];
  let score = 0;
  let lastShotAt = 0;
  let shotFlashTimer = 0;

  // Blancos de práctica colocados a lo largo del camino.
  const targetBodyMaterial = new THREE.MeshLambertMaterial({ color: 0xb83c32 });
  const targetHeadMaterial = new THREE.MeshLambertMaterial({ color: 0xe1b18a });
  const targetDarkMaterial = new THREE.MeshLambertMaterial({ color: 0x292d31 });
  for (const [x, z] of [[-2.4, 5], [2.2, -2], [0, -9], [-2.8, -16], [2.8, -22]]) {
    const target = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, 1.15, 8), targetBodyMaterial);
    body.position.y = 0.95;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 8, 6), targetHeadMaterial);
    head.position.y = 1.72;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.48, 0.55, 0.16, 8), targetDarkMaterial);
    base.position.y = 0.08;
    target.add(body, head, base);
    target.position.set(x, 0, z);
    target.userData.isPracticeTarget = true;
    scene.add(target);
    targets.push(target);
  }

  function shoot() {
    const now = performance.now();
    if (now - lastShotAt < 260) return;
    lastShotAt = now;
    raycaster.setFromCamera(screenCenter, camera);
    const hit = raycaster.intersectObjects(targets, true)[0];
    const end = hit ? hit.point : raycaster.ray.origin.clone().add(raycaster.ray.direction.clone().multiplyScalar(28));
    const tracerGeometry = new THREE.BufferGeometry().setFromPoints([camera.position.clone(), end]);
    const tracerMaterial = new THREE.LineBasicMaterial({ color: 0xffe39a, transparent: true, opacity: 0.95 });
    const tracer = new THREE.Line(tracerGeometry, tracerMaterial);
    scene.add(tracer);
    clearTimeout(shotFlashTimer);
    shotFlashTimer = setTimeout(() => {
      scene.remove(tracer);
      tracerGeometry.dispose();
      tracerMaterial.dispose();
    }, 75);

    if (hit) {
      let target = hit.object;
      while (target && !target.userData.isPracticeTarget) target = target.parent;
      if (target) {
        scene.remove(target);
        const index = targets.indexOf(target);
        if (index !== -1) targets.splice(index, 1);
        score++;
        const message = document.querySelector("#game-message");
        if (message) message.textContent = "¡Impacto! Puntos: " + score + " · Blancos restantes: " + targets.length;
      }
    }
  }
  fireButton?.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    shoot();
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
