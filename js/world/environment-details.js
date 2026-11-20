// Elementos ambientales tácticos optimizados con InstancedMesh.
export function createEnvironmentDetails(THREE, scene, getHeightAt) {
  let seed = 84271;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const dummy = new THREE.Object3D();
  const addInstances = (geometry, material, transforms, name, castShadow = true) => {
    if (!transforms.length) return null;
    const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
    mesh.name = name;
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    transforms.forEach((t, i) => {
      dummy.position.set(t.x, t.y, t.z);
      dummy.rotation.set(t.rx || 0, t.ry || 0, t.rz || 0);
      dummy.scale.set(t.sx || 1, t.sy || 1, t.sz || 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (t.color) mesh.setColorAt(i, new THREE.Color(t.color));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    scene.add(mesh);
    return mesh;
  };

  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x59412e, roughness: 0.96 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x31583b, roughness: 0.88 });
  const pineMat = new THREE.MeshStandardMaterial({ color: 0x244b3c, roughness: 0.9 });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x777b78, roughness: 1 });
  const sandRockMat = new THREE.MeshStandardMaterial({ color: 0x988b70, roughness: 1 });

  const trunks = [], crowns = [], pines = [], rocks = [];
  for (let i = 0; i < 1850; i++) {
    const x = (random() - 0.5) * 2260;
    const z = (random() - 0.5) * 2260;
    const radius = Math.hypot(x, z);
    if (radius > 1110 || (x*x + z*z < 300*300)) continue;
    const y = getHeightAt(x, z);
    if (y < 8 || y > 145) continue;
    const coastal = radius > 980;
    const industrial = x > 350 && z < -300;
    if (coastal && random() < 0.8) continue;
    if (industrial && random() < 0.88) continue;
    const tropical = x > 350 && z > -250 && z < 500;
    const scale = tropical ? 0.85 + random() * 0.75 : 0.7 + random() * 0.85;
    const pine = y > 95 || (x < -400 && z > 350);
    trunks.push({ x, y: y + 1.35 * scale, z, sx: 0.18 * scale, sy: 1.35 * scale, sz: 0.18 * scale, ry: random() * Math.PI });
    if (pine) {
      pines.push({ x, y: y + 3.1 * scale, z, sx: 1.35 * scale, sy: 3.2 * scale, sz: 1.35 * scale, ry: random() * Math.PI });
    } else {
      crowns.push({ x, y: y + 3.0 * scale, z, sx: 1.65 * scale, sy: 1.8 * scale, sz: 1.55 * scale, ry: random() * Math.PI, color: tropical ? 0x3e7044 : 0x31583b });
      crowns.push({ x: x + .7 * scale, y: y + 3.45 * scale, z: z - .2 * scale, sx: .95 * scale, sy: 1.1 * scale, sz: 1.0 * scale, ry: random() * Math.PI, color: 0x456f43 });
    }
  }
  for (let i = 0; i < 420; i++) {
    const x = (random() - .5) * 2350, z = (random() - .5) * 2350;
    const y = getHeightAt(x, z);
    if (Math.hypot(x, z) > 1160 || y < 4) continue;
    const s = .7 + random() * 2.3;
    rocks.push({ x, y: y + .35*s, z, sx: s, sy: .55*s, sz: .85*s, rx: random()*.4, ry: random()*Math.PI, rz: random()*.35 });
  }
  addInstances(new THREE.CylinderGeometry(.72, 1.05, 2.7, 7), trunkMat, trunks, "IslaLibre_Arboles_Troncos");
  addInstances(new THREE.IcosahedronGeometry(1, 1), leafMat, crowns, "IslaLibre_Copas_Follaje");
  addInstances(new THREE.ConeGeometry(1.25, 3.6, 7), pineMat, pines, "IslaLibre_Pinos");
  addInstances(new THREE.DodecahedronGeometry(1, 0), rockMat, rocks, "IslaLibre_Rocas");

  // Arquitectura de ciudad y puestos militares en módulos de bajo coste.
  const concrete = new THREE.MeshStandardMaterial({ color: 0x777f82, roughness: .82, metalness: .08 });
  const darkConcrete = new THREE.MeshStandardMaterial({ color: 0x424c50, roughness: .9 });
  const roof = new THREE.MeshStandardMaterial({ color: 0x343d42, roughness: .72, metalness: .18 });
  const buildings = [];
  for (let i = 0; i < 34; i++) {
    const angle = random() * Math.PI * 2;
    const radius = 105 + random() * 175;
    const x = Math.cos(angle) * radius, z = Math.sin(angle) * radius;
    const y = getHeightAt(x, z);
    const w = 13 + random() * 20, d = 12 + random() * 22, h = 9 + random() * 27;
    buildings.push({ x, y: y + h/2, z, sx: w, sy: h, sz: d, ry: Math.round(random()*3)*Math.PI/2 });
  }
  addInstances(new THREE.BoxGeometry(1,1,1), concrete, buildings, "IslaLibre_Ciudad_Edificios");
  const roofs = buildings.map(b => ({ x:b.x, y:b.y+b.sy*.52, z:b.z, sx:b.sx*1.06, sy:.8, sz:b.sz*1.06, ry:b.ry }));
  addInstances(new THREE.BoxGeometry(1,1,1), roof, roofs, "IslaLibre_Ciudad_Techos");

  const baseBuildings = [];
  for (const [x,z,w,d,h] of [[-650,420,52,36,13],[-580,470,38,28,10],[-720,500,28,22,8],[-630,350,22,18,7]]) {
    const y = getHeightAt(x,z);
    baseBuildings.push({ x, y:h/2+y, z, sx:w, sy:h, sz:d });
  }
  addInstances(new THREE.BoxGeometry(1,1,1), darkConcrete, baseBuildings, "IslaLibre_Base_Militar_Bunkers");
  const hangarMat = new THREE.MeshStandardMaterial({ color: 0x69777a, roughness: .7, metalness: .22 });
  const hangar = new THREE.Mesh(new THREE.BoxGeometry(58, 14, 34), hangarMat);
  hangar.name = "IslaLibre_Base_Militar_Hangar";
  hangar.position.set(-650, getHeightAt(-650, 560) + 7, 560);
  hangar.castShadow = true; hangar.receiveShadow = true; scene.add(hangar);
  const tower = new THREE.Mesh(new THREE.BoxGeometry(5, 22, 5), darkConcrete);
  tower.name = "IslaLibre_Base_Militar_Torre";
  tower.position.set(-710, getHeightAt(-710, 550) + 11, 550);
  tower.castShadow = true; tower.receiveShadow = true; scene.add(tower);
}
