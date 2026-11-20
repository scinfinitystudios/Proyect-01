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
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = true;
  renderer.info.autoReset = true;
  return { THREE, renderer };
}

// Escena base de Isla Libre: isla procedural, océano y lago principal.
export function createInitialScene(THREE) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9bbbd0);
  scene.fog = new THREE.Fog(0x9bbbd0, 780, 2600);

  const camera = new THREE.PerspectiveCamera(68, 1, 0.1, 3000);
  camera.position.set(0, 3.1, 20.5);
  camera.lookAt(0, 1.2, 15);

  const hemisphere = new THREE.HemisphereLight(0xdcecff, 0x354333, 1.35);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight(0xffe5c4, 2.7);
  sun.position.set(-420, 680, 360);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -900;
  sun.shadow.camera.right = 900;
  sun.shadow.camera.top = 900;
  sun.shadow.camera.bottom = -900;
  sun.shadow.camera.near = 10;
  sun.shadow.camera.far = 1800;
  sun.shadow.normalBias = 0.035;
  sun.shadow.bias = -0.00008;
  sun.shadow.radius = 3;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xb6d3ed, 0.38);
  fill.position.set(360, 180, -420);
  scene.add(fill);

  const terrain = createIslandTerrain(THREE, scene);
  return { scene, camera, getHeightAt: terrain.getHeightAt };
}

export function resizeRenderer(renderer, camera, width, height, pixelRatio) {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(safeWidth, safeHeight, false);
  camera.aspect = safeWidth / safeHeight;
  camera.updateProjectionMatrix();
}
