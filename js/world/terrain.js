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
  height = -4 + (height + 4) * coast;
  return height;
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


function createWaterRibbon(THREE, scene, points, width, name, material) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
  const divisions = Math.max(48, points.length * 24);
  const positions = [];
  const indices = [];
  for (let i = 0; i <= divisions; i++) {
    const t = i / divisions;
    const point = curve.getPoint(t);
    const tangent = curve.getTangent(t);
    const side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const taper = Math.min(1, 0.25 + t * 5, 0.25 + (1 - t) * 5);
    const halfWidth = width * 0.5 * taper;
    positions.push(
      point.x - side.x * halfWidth, point.y, point.z - side.z * halfWidth,
      point.x + side.x * halfWidth, point.y, point.z + side.z * halfWidth
    );
    if (i < divisions) {
      const a = i * 2;
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.frustumCulled = true;
  scene.add(mesh);
  return mesh;
}

function createWaterfall(THREE, scene, x, z, topY, bottomY, width, name) {
  const height = Math.max(2, topY - bottomY);
  const geometry = new THREE.PlaneGeometry(width, height, 1, 8);
  const material = new THREE.MeshLambertMaterial({
    color: 0x80d9ed,
    transparent: true,
    opacity: 0.82,
    side: THREE.DoubleSide,
    depthWrite: false
  });
  const waterfall = new THREE.Mesh(geometry, material);
  waterfall.name = name;
  waterfall.position.set(x, bottomY + height / 2, z);
  scene.add(waterfall);

  // Espuma ligera en la base para hacer legible la caída desde lejos.
  const foam = new THREE.Mesh(
    new THREE.CircleGeometry(width * 0.72, 16),
    new THREE.MeshBasicMaterial({ color: 0xb9f3f7, transparent: true, opacity: 0.48 })
  );
  foam.rotation.x = -Math.PI / 2;
  foam.position.set(x, bottomY + 0.12, z + 1.5);
  scene.add(foam);
  return waterfall;
}

function createIslandWater(THREE, scene, getHeightAt) {
  const riverMaterial = new THREE.MeshLambertMaterial({
    color: 0x36a9cc,
    transparent: true,
    opacity: 0.88,
    side: THREE.DoubleSide
  });

  // Río principal: baja desde las montañas del noroeste, cruza el valle y llega a la costa oriental.
  const mainRiver = [
    [-850, getHeightAt(-850, -1030) + 2.2, -1030],
    [-700, getHeightAt(-700, -930) + 1.8, -930],
    [-510, getHeightAt(-510, -875) + 1.5, -875],
    [-280, getHeightAt(-280, -850) + 1.2, -850],
    [-40, getHeightAt(-40, -790) + 1.0, -790],
    [180, getHeightAt(180, -590) + 0.9, -590],
    [390, getHeightAt(390, -300) + 0.8, -300],
    [620, getHeightAt(620, 20) + 0.7, 20],
    [820, getHeightAt(820, 360) + 0.6, 360],
    [1030, getHeightAt(1030, 690) + 0.4, 690]
  ];
  createWaterRibbon(THREE, scene, mainRiver, 15, "IslaLibre_Rio_Principal", riverMaterial);

  // Afluente desde el bosque tropical hacia el río principal.
  const forestRiver = [
    [900, getHeightAt(900, -650) + 1.1, -650],
    [790, getHeightAt(790, -470) + 1.0, -470],
    [700, getHeightAt(700, -260) + 0.9, -260],
    [620, getHeightAt(620, 20) + 0.8, 20]
  ];
  createWaterRibbon(THREE, scene, forestRiver, 9, "IslaLibre_Rio_Bosque", riverMaterial);

  // Afluente del sur, conecta las llanuras cercanas a la base militar con el cauce principal.
  const southRiver = [
    [-760, getHeightAt(-760, 900) + 1.0, 900],
    [-570, getHeightAt(-570, 700) + 0.9, 700],
    [-390, getHeightAt(-390, 480) + 0.8, 480],
    [-170, getHeightAt(-170, 250) + 0.7, 250],
    [40, getHeightAt(40, 80) + 0.7, 80]
  ];
  createWaterRibbon(THREE, scene, southRiver, 8, "IslaLibre_Rio_Sur", riverMaterial);

  // Lagos adicionales en depresiones suaves.
  const lakeMaterial = new THREE.MeshLambertMaterial({ color: 0x3b9fc1, transparent: true, opacity: 0.9 });
  const lakes = [
    { x: 0, z: -850, radius: 112, name: "IslaLibre_Lago_Cristal" },
    { x: 690, z: 690, radius: 58, name: "IslaLibre_Laguna_Sur" },
    { x: -880, z: -120, radius: 46, name: "IslaLibre_Laguna_Oeste" }
  ];
  for (const item of lakes) {
    const water = new THREE.Mesh(new THREE.CircleGeometry(item.radius, 40), lakeMaterial);
    water.name = item.name;
    water.rotation.x = -Math.PI / 2;
    water.position.set(item.x, getHeightAt(item.x, item.z) + 1.0, item.z);
    scene.add(water);
  }

  // Caídas visibles en la cordillera y el bosque.
  createWaterfall(THREE, scene, -620, -890, getHeightAt(-620, -890) + 24, getHeightAt(-620, -890) + 2, 20, "IslaLibre_Cascada_Norte");
  createWaterfall(THREE, scene, 820, -410, getHeightAt(820, -410) + 16, getHeightAt(820, -410) + 1.5, 13, "IslaLibre_Cascada_Bosque");
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

  createIslandWater(THREE, scene, getIslandHeight);

  return { terrain, ocean, getHeightAt: getIslandHeight };
}
