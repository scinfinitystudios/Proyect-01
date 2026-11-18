import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { CONFIG } from "../config.js";

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

export function createInitialScene(THREE) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CONFIG.render.clearColor);
  scene.fog = new THREE.Fog(CONFIG.render.clearColor, CONFIG.render.fogNear, CONFIG.render.fogFar);

  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 100);
  camera.position.set(0, 1.6, 5);

  const ambient = new THREE.AmbientLight(0xffffff, 1.35);
  const directional = new THREE.DirectionalLight(0xffffff, 1.1);
  directional.position.set(3, 6, 4);
  scene.add(ambient, directional);

  // Geometría temporal de calibración; será sustituida por el escenario del FPS.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 80),
    new THREE.MeshLambertMaterial({ color: 0x263943 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -0.02;
  floor.matrixAutoUpdate = false;
  floor.updateMatrix();
  scene.add(floor);

  const testGeometry = new THREE.BoxGeometry(1, 1, 1);
  const testMaterial = new THREE.MeshLambertMaterial({ color: 0x65a99f });
  const testObject = new THREE.InstancedMesh(testGeometry, testMaterial, 36);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  let index = 0;
  for (let x = -3; x <= 3; x++) {
    for (let z = -2; z <= 2; z++) {
      position.set(x * 1.6, 0.55, -z * 1.8);
      scale.setScalar(0.8);
      matrix.compose(position, quaternion, scale);
      testObject.setMatrixAt(index++, matrix);
    }
  }
  testObject.count = index;
  testObject.instanceMatrix.needsUpdate = true;
  testObject.matrixAutoUpdate = false;
  testObject.updateMatrix();
  scene.add(testObject);

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
