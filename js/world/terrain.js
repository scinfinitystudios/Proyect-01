// Terreno procedural de Isla Libre.
// La isla usa una malla ligera con elevaciones deterministas y zonas de relieve manual.
export const ISLAND = Object.freeze({
  size: 2500,
  halfSize: 1250,
  segments: 128,
  seaLevel: -2,
  cityRadius: 260
});

function smoothstep(a, b, value) {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function gaussian(x, z, cx, cz, sx, sz, height) {
  const dx = (x - cx) / sx;
  const dz = (z - cz) / sz;
  return height * Math.exp(-0.5 * (dx * dx + dz * dz));
}

function noise2D(x, z) {
  return (
    Math.sin(x * 0.010 + Math.cos(z * 0.007) * 1.7) * 0.42 +
    Math.cos(z * 0.014 - x * 0.004) * 0.32 +
    Math.sin((x + z) * 0.023) * 0.16 +
    Math.cos((x - z) * 0.037) * 0.10
  );
}

export function getIslandHeight(x, z) {
  const nx = x / ISLAND.halfSize;
  const nz = z / ISLAND.halfSize;
  const angle = Math.atan2(nz, nx);
  const coastVariation = 0.035 * Math.sin(angle * 5 + 0.7) + 0.022 * Math.cos(angle * 9);
  const normalizedRadius = Math.sqrt(nx * nx + nz * nz) / (1 + coastVariation);
  const coast = smoothstep(1.0, 0.91, normalizedRadius);
  const interior = smoothstep(0.98, 0.30, normalizedRadius);

  let height = 2.5 + coast * (9 + noise2D(x, z) * 3);
  height += interior * noise2D(x, z) * 13;

  // Relieve principal: cordillera al noroeste y sierras secundarias al norte.
  height += gaussian(x, z, -750, -850, 360, 420, 215);
  height += gaussian(x, z, -420, -1030, 230, 260, 115);
  height += gaussian(x, z, 120, -1120, 260, 190, 85);
  height += gaussian(x, z, 980, -300, 250, 330, 70);
  height += gaussian(x, z, -900, 520, 260, 300, 55);

  // Colinas y valles secundarios.
  height += Math.max(0, noise2D(x * 1.35, z * 1.35)) * 24 * interior;
  height -= gaussian(x, z, 0, -850, 250, 210, 19);

  // Ciudad Central: explanada amplia y transitable en torno al punto de aparición.
  const cityBlend = 1 - smoothstep(190, ISLAND.cityRadius, Math.hypot(x, z));
  height = height * (1 - cityBlend) + 0.5 * cityBlend;

  // La costa cae suavemente hasta el nivel del mar.
  height *= coast;
  return Math.max(-2, height);
}

function terrainColor(height, x, z) {
  if (height > 175) return [0.88, 0.91, 0.94];
  if (height > 105) return [0.48, 0.55, 0.48];
  if (height < 5) return [0.78, 0.69, 0.43];
  if (x > 400 && z > -250 && z < 500) return [0.48, 0.66, 0.36];
  if (x > 350 && z < -300) return [0.20, 0.43, 0.25];
  if (x < -400 && z > 350) return [0.42, 0.56, 0.31];
  return [0.34, 0.58, 0.32];
}

export function createIslandTerrain(THREE, scene) {
  const segments = ISLAND.segments;
  const size = ISLAND.size;
  const half = size / 2;
  const vertexCount = (segments + 1) * (segments + 1);
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const indices = [];

  let vertex = 0;
  for (let iz = 0; iz <= segments; iz++) {
    const z = -half + (iz / segments) * size;
    for (let ix = 0; ix <= segments; ix++) {
      const x = -half + (ix / segments) * size;
      const height = getIslandHeight(x, z);
      const color = terrainColor(height, x, z);
      const p = vertex * 3;
      positions[p] = x;
      positions[p + 1] = height;
      positions[p + 2] = z;
      colors[p] = color[0];
      colors[p + 1] = color[1];
      colors[p + 2] = color[2];
      vertex++;
    }
  }

  for (let iz = 0; iz < segments; iz++) {
    for (let ix = 0; ix < segments; ix++) {
      const a = iz * (segments + 1) + ix;
      const b = a + 1;
      const c = a + segments + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshLambertMaterial({ vertexColors: true });
  const terrain = new THREE.Mesh(geometry, material);
  terrain.name = "IslaLibre_Terreno";
  terrain.receiveShadow = false;
  scene.add(terrain);

  const oceanGeometry = new THREE.PlaneGeometry(3400, 3400, 1, 1);
  const oceanMaterial = new THREE.MeshLambertMaterial({ color: 0x287fa7 });
  const ocean = new THREE.Mesh(oceanGeometry, oceanMaterial);
  ocean.name = "IslaLibre_Oceano";
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = ISLAND.seaLevel;
  scene.add(ocean);

  // Lago principal en el Valle del Lago: la depresión del terreno forma su cuenca.
  const lakeGeometry = new THREE.CircleGeometry(112, 48);
  const lakeMaterial = new THREE.MeshLambertMaterial({ color: 0x3b9fc1 });
  const lake = new THREE.Mesh(lakeGeometry, lakeMaterial);
  lake.name = "IslaLibre_Lago_Cristal";
  lake.rotation.x = -Math.PI / 2;
  lake.position.set(0, getIslandHeight(0, -850) + 1.2, -850);
  scene.add(lake);

  return { terrain, ocean, lake, getHeightAt: getIslandHeight };
}
