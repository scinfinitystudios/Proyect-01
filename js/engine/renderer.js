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

// Primera versión del mapa: bosque de supervivencia de geometría ligera.
// Los elementos repetidos usan InstancedMesh para reducir draw calls en Android.
export function createInitialScene(THREE) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9eb6a0);
  scene.fog = new THREE.Fog(0x9eb6a0, 24, 78);

  const camera = new THREE.PerspectiveCamera(72, 1, 0.1, 140);
  camera.position.set(0, 1.65, 15);
  camera.lookAt(0, 1.4, -8);

  scene.add(new THREE.HemisphereLight(0xdcebdc, 0x354332, 1.65));
  const sun = new THREE.DirectionalLight(0xffedcf, 1.35);
  sun.position.set(-12, 24, 10);
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(110, 110),
    new THREE.MeshLambertMaterial({ color: 0x405b3b })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.08;
  scene.add(ground);

  // Camino de tierra que conduce desde el punto de inicio al campamento.
  const path = new THREE.Mesh(
    new THREE.PlaneGeometry(5.5, 72),
    new THREE.MeshLambertMaterial({ color: 0x806b4c })
  );
  path.rotation.x = -Math.PI / 2;
  path.position.set(0, -0.045, -12);
  scene.add(path);

  const trunkGeometry = new THREE.CylinderGeometry(0.22, 0.34, 3.4, 6);
  const trunkMaterial = new THREE.MeshLambertMaterial({ color: 0x59432e });
  const trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, 90);
  const crownGeometry = new THREE.ConeGeometry(1.35, 3.8, 7);
  const crownMaterial = new THREE.MeshLambertMaterial({ color: 0x244d32 });
  const crowns = new THREE.InstancedMesh(crownGeometry, crownMaterial, 90);
  const dummy = new THREE.Object3D();
  let treeIndex = 0;
  // Dos franjas de árboles dejan el camino y el centro del mapa transitables.
  for (let z = -43; z <= 18; z += 6.1) {
    for (const side of [-1, 1]) {
      for (let lane = 0; lane < 3; lane++) {
        const x = side * (5.5 + lane * 4.4) + Math.sin((z + lane * 7) * 0.31) * 1.4;
        const zz = z + Math.cos((lane + side) * 2.1) * 1.8;
        dummy.position.set(x, 1.7, zz);
        dummy.rotation.set(0, (treeIndex % 5) * 0.37, 0);
        dummy.scale.setScalar(0.82 + (treeIndex % 4) * 0.12);
        dummy.updateMatrix();
        trunks.setMatrixAt(treeIndex, dummy.matrix);
        dummy.position.y = 3.55;
        dummy.scale.setScalar(0.9 + (treeIndex % 3) * 0.12);
        dummy.updateMatrix();
        crowns.setMatrixAt(treeIndex, dummy.matrix);
        treeIndex++;
      }
    }
  }
  trunks.count = treeIndex;
  crowns.count = treeIndex;
  scene.add(trunks, crowns);

  // Rocas decorativas de bajo coste junto al camino.
  const rockGeometry = new THREE.DodecahedronGeometry(0.8, 0);
  const rockMaterial = new THREE.MeshLambertMaterial({ color: 0x69736a });
  const rocks = new THREE.InstancedMesh(rockGeometry, rockMaterial, 18);
  for (let i = 0; i < 18; i++) {
    const side = i % 2 ? 1 : -1;
    dummy.position.set(side * (3.8 + (i % 4) * 0.55), 0.28, -39 + i * 4.3);
    dummy.rotation.set(i * 0.3, i * 0.7, i * 0.2);
    dummy.scale.set(0.65 + (i % 3) * 0.22, 0.45 + (i % 2) * 0.2, 0.7);
    dummy.updateMatrix();
    rocks.setMatrixAt(i, dummy.matrix);
  }
  scene.add(rocks);

  // Campamento visible al fondo: refugio, techo y dos cajas.
  const wood = new THREE.MeshLambertMaterial({ color: 0x72543a });
  const roof = new THREE.MeshLambertMaterial({ color: 0x3b4540 });
  const cabin = new THREE.Group();
  const walls = new THREE.Mesh(new THREE.BoxGeometry(5.2, 2.8, 4.2), wood);
  walls.position.y = 1.4;
  const roofMesh = new THREE.Mesh(new THREE.ConeGeometry(4.1, 2.1, 4), roof);
  roofMesh.rotation.y = Math.PI / 4;
  roofMesh.position.y = 3.65;
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.05, 2.05, 0.12), new THREE.MeshLambertMaterial({ color: 0x30251d }));
  door.position.set(0, 1.02, 2.16);
  cabin.add(walls, roofMesh, door);
  cabin.position.set(0, 0, -30);
  scene.add(cabin);

  const crateMaterial = new THREE.MeshLambertMaterial({ color: 0x9a7548 });
  for (const x of [-4, 4]) {
    const crate = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.1, 1.2), crateMaterial);
    crate.position.set(x, 0.55, -26);
    scene.add(crate);
  }

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
