import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { CONFIG } from "../config.js";
import { createIslandTerrain } from "../world/terrain.js";

export function createRenderer(canvas) {
  const context = canvas.getContext("webgl2", {
    antialias: CONFIG.render.antialias,
    alpha: false,
    powerPreference: CONFIG.render.powerPreference,
    depth: true,
    stencil: false,
    preserveDrawingBuffer: false
  });
  if (!context) return null;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    context,
    antialias: CONFIG.render.antialias,
    powerPreference: CONFIG.render.powerPreference,
    alpha: false,
    stencil: false,
    depth: true
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, CONFIG.render.maxPixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.shadowMap.enabled = false;
  renderer.info.autoReset = true;
  return { THREE, renderer };
}

// Escena base de Isla Libre: isla procedural, océano y lago principal.
export function createInitialScene(THREE) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x91c5e5);
  scene.fog = new THREE.Fog(0x91c5e5, 420, 1900);

  const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 2800);
  camera.position.set(0, 3.1, 20.5);
  camera.lookAt(0, 1.2, 15);

  scene.add(new THREE.HemisphereLight(0xe7f4ff, 0x526044, 1.7));
  const sun = new THREE.DirectionalLight(0xfff0d6, 1.25);
  sun.position.set(-650, 900, 450);
  scene.add(sun);

  createIslandTerrain(THREE, scene);
  return { scene, camera };
}

export function resizeRenderer(renderer, camera, width, height, pixelRatio) {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(safeWidth, safeHeight, false);
  camera.aspect = safeWidth / safeHeight;
  camera.updateProjectionMatrix();
}
