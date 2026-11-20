import { CONFIG } from "./config.js";
import { createRenderer, createInitialScene } from "./engine/renderer.js";
import { QualityManager } from "./performance/quality-manager.js";
import { DebugPanel } from "./performance/debug-panel.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js";

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
  const lookSwipeZone = document.querySelector("#look-swipe-zone");
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
  const { scene, camera, getHeightAt } = createInitialScene(THREE);
  const quality = new QualityManager(renderer, camera);

  // Operador táctico 3D importado desde GLB, con esqueleto y clips originales.
  const player = new THREE.Group();
  scene.add(player);
  player.position.set(0, getHeightAt(0, 15), 15);
  const gltfLoader = new GLTFLoader();
  let operatorMixer = null;
  let operatorActions = {};
  let activeOperatorAction = null;
  let operatorReady = false;
  let operatorLoadError = null;

  gltfLoader.load(
    "./assets/sci-fi-soldier-rigged.glb",
    (gltf) => {
      const model = gltf.scene;
      // Normaliza el tamaño real del GLB: algunos modelos vienen en centímetros
      // aunque el mundo del juego utiliza metros.
      model.scale.setScalar(1);
      model.rotation.y = 0;
      model.updateMatrixWorld(true);
      const modelBounds = new THREE.Box3().setFromObject(model);
      const modelSize = new THREE.Vector3();
      const modelCenter = new THREE.Vector3();
      modelBounds.getSize(modelSize);
      modelBounds.getCenter(modelCenter);
      if (Number.isFinite(modelSize.y) && modelSize.y > 0.001) {
        const targetHeight = 1.8;
        model.scale.setScalar(targetHeight / modelSize.y);
        model.updateMatrixWorld(true);
        const normalizedBounds = new THREE.Box3().setFromObject(model);
        const normalizedCenter = new THREE.Vector3();
        normalizedBounds.getCenter(normalizedCenter);
        model.position.x -= normalizedCenter.x;
        model.position.y -= normalizedBounds.min.y;
        model.position.z -= normalizedCenter.z;
      } else {
        model.scale.setScalar(0.01);
      }
      model.traverse((object) => {
        if (object.isMesh) {
          object.castShadow = true;
          object.receiveShadow = true;
          if (object.material) {
            const materials = Array.isArray(object.material) ? object.material : [object.material];
            for (const material of materials) {
              material.side = THREE.DoubleSide;
              material.needsUpdate = true;
            }
          }
        }
      });
      player.add(model);
      operatorMixer = new THREE.AnimationMixer(model);
      for (const clip of gltf.animations) {
        operatorActions[clip.name.toLowerCase()] = operatorMixer.clipAction(clip);
      }
      const initialAction = operatorActions.walk || operatorActions.run;
      if (initialAction) {
        initialAction.play();
        initialAction.paused = true;
        activeOperatorAction = initialAction;
      }
      operatorReady = true;
      const status = document.querySelector("#game-message");
      if (status) status.textContent = "Operador táctico 3D cargado.";
    },
    undefined,
    (error) => {
      operatorLoadError = error;
      console.error("[Isla Libre] No se pudo cargar el operador GLB:", error);
      const status = document.querySelector("#game-message");
      if (status) status.textContent = "No se pudo cargar el modelo 3D. Comprueba assets/sci-fi-soldier-rigged.glb.";
    }
  );

  function setOperatorAnimation(moving) {
    if (!operatorMixer) return;
    const next = moving
      ? (operatorActions.run || operatorActions.walk)
      : (operatorActions.walk || operatorActions.run);
    if (!next || next === activeOperatorAction) {
      if (activeOperatorAction) activeOperatorAction.paused = !moving;
      return;
    }
    next.reset();
    next.paused = false;
    next.play();
    if (activeOperatorAction) next.crossFadeFrom(activeOperatorAction, 0.18, true);
    activeOperatorAction = next;
  }

  camera.position.set(0, 2.7, 19.2);
  camera.lookAt(0, 1.2, 15);
  let walkPhase = 0;
  let verticalVelocity = 0;
  let verticalOffset = 0;
  let grounded = true;
  const jumpButton = document.querySelector("#jump-button");

  function targetDarkMaterialForPlayer() {
    return new THREE.MeshLambertMaterial({ color: 0x354b5a });
  }

  let rafId = 0;
  let previousTime = 0;
  let accumulator = 0;
  let lastRenderTime = 0;
  const moveInput = { x: 0, y: 0 };
  const lookDelta = { x: 0, y: 0 };
  // Yaw/pitch pertenecen a la cámara orbital; el operador solo gira al desplazarse.
  let yaw = 0;
  let pitch = 0;
  const cameraLookTarget = new THREE.Vector3();
  let cameraTargetInitialized = false;
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
  // La mitad derecha de la pantalla controla la cámara mediante deslizamiento.
  // El botón de disparo es independiente y no envía gestos a esta zona.
  if (lookSwipeZone) {
    let lookPointerId = null;
    let lastPointerX = 0;
    let lastPointerY = 0;
    const sensitivity = 0.0048;
    const endLookGesture = (event) => {
      if (event && event.pointerId !== undefined && event.pointerId !== lookPointerId) return;
      lookPointerId = null;
    };
    lookSwipeZone.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button, input, select, label")) return;
      if (lookPointerId !== null) return;
      event.preventDefault();
      lookPointerId = event.pointerId;
      lastPointerX = event.clientX;
      lastPointerY = event.clientY;
      try { lookSwipeZone.setPointerCapture(lookPointerId); } catch {}
    });
    lookSwipeZone.addEventListener("pointermove", (event) => {
      if (event.pointerId !== lookPointerId) return;
      event.preventDefault();
      const samples = typeof event.getCoalescedEvents === "function" ? event.getCoalescedEvents() : [event];
      for (const sample of samples) {
        const dx = Math.max(-80, Math.min(80, sample.clientX - lastPointerX));
        const dy = Math.max(-80, Math.min(80, sample.clientY - lastPointerY));
        lastPointerX = sample.clientX;
        lastPointerY = sample.clientY;
        lookDelta.x += dx * sensitivity;
        lookDelta.y += dy * sensitivity;
      }
    });
    lookSwipeZone.addEventListener("pointerup", endLookGesture);
    lookSwipeZone.addEventListener("pointercancel", endLookGesture);
    lookSwipeZone.addEventListener("lostpointercapture", endLookGesture);
    window.addEventListener("blur", () => endLookGesture());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) endLookGesture();
    });
  }
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
    target.position.set(x, getHeightAt(x, z), z);
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
  function jump(event) {
    if (event) event.preventDefault();
    if (grounded) {
      verticalOffset = 0;
      verticalVelocity = 8.2;
      grounded = false;
    }
  }
  jumpButton?.addEventListener("pointerdown", jump);
  jumpButton?.addEventListener("click", (event) => {
    if (grounded) jump(event);
  });
  window.addEventListener("keydown", (event) => {
    if (event.code === "Space" && grounded) { event.preventDefault(); verticalVelocity = 7.2; grounded = false; }
  });

  fireButton?.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    shoot();
  });

  function updateSimulation(step) {
    if (operatorMixer) operatorMixer.update(step);
    yaw += lookDelta.x;
    pitch = Math.max(-1.15, Math.min(1.15, pitch - lookDelta.y));
    lookDelta.x = 0;
    lookDelta.y = 0;
    const forward = -moveInput.y;
    const strafe = moveInput.x;
    const length = Math.hypot(forward, strafe);
    const isMoving = length > 0.08;
    setOperatorAnimation(isMoving);
    let moveWorldX = 0;
    let moveWorldZ = 0;
    if (isMoving) {
      const speed = 5.2;
      const f = forward / Math.max(1, length);
      const s = strafe / Math.max(1, length);
      moveWorldX = Math.sin(yaw) * f + Math.cos(yaw) * s;
      moveWorldZ = -Math.cos(yaw) * f + Math.sin(yaw) * s;
      player.position.x += moveWorldX * speed * step;
      player.position.z += moveWorldZ * speed * step;
      // El operador mira hacia su desplazamiento; la cámara mantiene su propio ángulo orbital.
      const targetPlayerYaw = Math.atan2(moveWorldX, -moveWorldZ);
      const angleDelta = Math.atan2(
        Math.sin(targetPlayerYaw - player.rotation.y),
        Math.cos(targetPlayerYaw - player.rotation.y)
      );
      player.rotation.y += angleDelta * Math.min(1, step * 10);
      walkPhase += step * 10;
    }

    const groundHeight = getHeightAt(player.position.x, player.position.z);
    if (!grounded) {
      verticalVelocity -= 18 * step;
      verticalOffset += verticalVelocity * step;
      if (verticalOffset <= 0) {
        verticalOffset = 0;
        verticalVelocity = 0;
        grounded = true;
      }
    }
    player.position.y = groundHeight + verticalOffset;
    const cameraDistance = 4.35;
    // Cámara orbital independiente: rota alrededor del operador y lo sigue suavemente.
    const forwardX = Math.sin(yaw);
    const forwardZ = -Math.cos(yaw);
    const desiredCameraPosition = new THREE.Vector3(
      player.position.x - forwardX * cameraDistance,
      groundHeight + 2.65 + pitch * 1.1,
      player.position.z - forwardZ * cameraDistance
    );
    const followSmoothness = 1 - Math.exp(-step * 10);
    camera.position.lerp(desiredCameraPosition, followSmoothness);
    const desiredLookTarget = new THREE.Vector3(
      player.position.x + forwardX * 0.35,
      groundHeight + 1.28 + pitch * 1.6,
      player.position.z + forwardZ * 0.35
    );
    if (!cameraTargetInitialized) {
      cameraLookTarget.copy(desiredLookTarget);
      cameraTargetInitialized = true;
    } else {
      cameraLookTarget.lerp(desiredLookTarget, 1 - Math.exp(-step * 14));
    }
    camera.lookAt(cameraLookTarget);
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
