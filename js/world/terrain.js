// Terreno procedural de Isla Libre con cauces, cuencas y costa jugable.
export const ISLAND = Object.freeze({
  size: 2500,
  halfSize: 1250,
  segments: 256,
  seaLevel: -2,
  cityRadius: 260
});

const RIVERS = [
  { width: 15, points: [[-850,-1030],[-700,-930],[-510,-875],[-280,-850],[-40,-790],[180,-590],[390,-300],[620,20],[820,360],[1030,690]] },
  { width: 12, points: [[900,-650],[790,-470],[700,-260],[620,20]] },
  { width: 11, points: [[-760,900],[-570,700],[-390,480],[-170,250],[40,80]] }
];
const LAKES = [
  { x: 0, z: -850, radius: 112, depth: 5, name: "IslaLibre_Lago_Cristal" },
  { x: 690, z: 690, radius: 58, depth: 3.5, name: "IslaLibre_Laguna_Sur" },
  { x: -880, z: -120, radius: 46, depth: 3, name: "IslaLibre_Laguna_Oeste" }
];

function smoothstep(a, b, value) {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
}
function gaussian(x, z, cx, cz, sx, sz, height) {
  const dx = (x - cx) / sx, dz = (z - cz) / sz;
  return height * Math.exp(-0.5 * (dx * dx + dz * dz));
}
function noise2D(x, z) {
  return Math.sin(x * .010 + Math.cos(z * .007) * 1.7) * .42 +
    Math.cos(z * .014 - x * .004) * .32 +
    Math.sin((x + z) * .023) * .16 + Math.cos((x - z) * .037) * .10;
}
function distanceToSegment(x, z, a, b) {
  const dx=b[0]-a[0], dz=b[1]-a[1];
  const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz || 1)));
  return Math.hypot(x-(a[0]+dx*t),z-(a[1]+dz*t));
}
function distanceToRiver(x,z,river) {
  let d=Infinity;
  for(let i=0;i<river.points.length-1;i++) d=Math.min(d,distanceToSegment(x,z,river.points[i],river.points[i+1]));
  return d;
}
function getBaseHeight(x,z) {
  const nx=x/ISLAND.halfSize, nz=z/ISLAND.halfSize;
  const angle=Math.atan2(nz,nx);
  const variation=.035*Math.sin(angle*5+.7)+.022*Math.cos(angle*9);
  const radius=Math.hypot(nx,nz)/(1+variation);
  const coast=smoothstep(1,.91,radius);
  const interior=smoothstep(.98,.30,radius);
  let h=2.5+coast*(9+noise2D(x,z)*3);
  h+=interior*noise2D(x,z)*13;
  h+=gaussian(x,z,-750,-850,360,420,215);
  h+=gaussian(x,z,-420,-1030,230,260,115);
  h+=gaussian(x,z,120,-1120,260,190,85);
  h+=gaussian(x,z,980,-300,250,330,70);
  h+=gaussian(x,z,-900,520,260,300,55);
  h+=Math.max(0,noise2D(x*1.35,z*1.35))*24*interior;
  h-=gaussian(x,z,0,-850,250,210,19);
  const city=1-smoothstep(190,ISLAND.cityRadius,Math.hypot(x,z));
  h=h*(1-city)+.5*city;
  return -4+(h+4)*coast;
}
export function getIslandHeight(x,z) {
  let h=getBaseHeight(x,z);
  // Los cauces se excavan en el terreno; la lámina de agua queda dentro del canal.
  for(const river of RIVERS) {
    const d=distanceToRiver(x,z,river);
    const bank=river.width*.5+5;
    const cut=(1-smoothstep(river.width*.5,bank,d))*4.2;
    h-=cut;
  }
  // Cada lago crea una cubeta con orillas progresivas.
  for(const lake of LAKES) {
    const d=Math.hypot(x-lake.x,z-lake.z);
    h-=lake.depth*(1-smoothstep(lake.radius*.68,lake.radius+13,d));
  }
  return h;
}
function terrainColor(height,x,z) {
  const radius=Math.hypot(x,z);
  // Arena costera ancha y transición de vegetación a playa.
  if(height<5 || (radius>1050 && height<15)) return [0.82,0.72,0.49];
  if(height<12) return [0.66,0.68,0.39];
  if(height>175) return [0.88,0.91,0.94];
  if(height>105) return [0.48,0.55,0.48];
  if(x>400 && z>-250 && z<500) return [0.48,0.66,0.36];
  if(x>350 && z< -300) return [0.20,0.43,0.25];
  if(x< -400 && z>350) return [0.42,0.56,0.31];
  return [0.34,0.58,0.32];
}
function createWaterRibbon(THREE,scene,points,width,name,material) {
  const curve=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,getIslandHeight(x,z)+.65,z)));
  const divisions=Math.max(64,points.length*32), positions=[], indices=[];
  for(let i=0;i<=divisions;i++) {
    const t=i/divisions, p=curve.getPoint(t), tangent=curve.getTangent(t);
    const side=new THREE.Vector3(-tangent.z,0,tangent.x).normalize();
    const taper=Math.min(1,.25+t*5,.25+(1-t)*5), half=width*.5*taper;
    positions.push(p.x-side.x*half,p.y,p.z-side.z*half,p.x+side.x*half,p.y,p.z+side.z*half);
    if(i<divisions){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material); mesh.name=name; mesh.frustumCulled=true; scene.add(mesh);
  return mesh;
}
function createWaterfall(THREE,scene,x,z,topY,bottomY,width,name) {
  const h=Math.max(2,topY-bottomY);
  const material=new THREE.MeshBasicMaterial({color:0x8de5f4,transparent:true,opacity:.78,side:THREE.DoubleSide,depthWrite:false});
  const sheet=new THREE.Mesh(new THREE.PlaneGeometry(width,h,1,12),material);
  sheet.name=name; sheet.position.set(x,bottomY+h/2,z); scene.add(sheet);
  const foam=new THREE.Mesh(new THREE.CircleGeometry(width*.8,20),new THREE.MeshBasicMaterial({color:0xd2fbff,transparent:true,opacity:.55,depthWrite:false}));
  foam.rotation.x=-Math.PI/2; foam.position.set(x,bottomY+.2,z+2); scene.add(foam);
  return sheet;
}
function createIslandWater(THREE,scene) {
  const riverMaterial=new THREE.MeshLambertMaterial({color:0x36a9cc,transparent:true,opacity:.94,side:THREE.DoubleSide});
  RIVERS.forEach((river,i)=>createWaterRibbon(THREE,scene,river.points,river.width,
    ["IslaLibre_Rio_Principal","IslaLibre_Rio_Bosque","IslaLibre_Rio_Sur"][i],riverMaterial));
  const lakeMaterial=new THREE.MeshLambertMaterial({color:0x3b9fc1,transparent:true,opacity:.94,side:THREE.DoubleSide});
  for(const lake of LAKES) {
    const water=new THREE.Mesh(new THREE.CircleGeometry(lake.radius,48),lakeMaterial);
    water.name=lake.name; water.rotation.x=-Math.PI/2;
    water.position.set(lake.x,getBaseHeight(lake.x,lake.z)-lake.depth+.8,lake.z);
    scene.add(water);
  }
  // Caídas situadas sobre pendientes; la salida se integra al cauce inferior.
  createWaterfall(THREE,scene,-620,-890,getBaseHeight(-620,-890)+28,getIslandHeight(-620,-890)+.8,20,"IslaLibre_Cascada_Norte");
  createWaterfall(THREE,scene,820,-410,getBaseHeight(820,-410)+19,getIslandHeight(820,-410)+.8,13,"IslaLibre_Cascada_Bosque");
}
export function createIslandTerrain(THREE,scene) {
  const segments=ISLAND.segments,size=ISLAND.size,half=size/2;
  const count=(segments+1)*(segments+1);
  const positions=new Float32Array(count*3),colors=new Float32Array(count*3),indices=[];
  let v=0;
  for(let iz=0;iz<=segments;iz++) {
    const z=-half+iz/segments*size;
    for(let ix=0;ix<=segments;ix++) {
      const x=-half+ix/segments*size,h=getIslandHeight(x,z),c=terrainColor(h,x,z),p=v*3;
      positions[p]=x;positions[p+1]=h;positions[p+2]=z;
      colors[p]=c[0];colors[p+1]=c[1];colors[p+2]=c[2];v++;
    }
  }
  for(let iz=0;iz<segments;iz++) for(let ix=0;ix<segments;ix++) {
    const a=iz*(segments+1)+ix,b=a+1,c=a+segments+1,d=c+1;
    indices.push(a,c,b,b,c,d);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.BufferAttribute(positions,3));
  geometry.setAttribute("color",new THREE.BufferAttribute(colors,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  const terrain=new THREE.Mesh(geometry,new THREE.MeshLambertMaterial({vertexColors:true}));
  terrain.name="IslaLibre_Terreno";
  terrain.receiveShadow = true;
  scene.add(terrain);
  const ocean=new THREE.Mesh(new THREE.PlaneGeometry(3400,3400),new THREE.MeshLambertMaterial({color:0x287fa7}));
  ocean.name="IslaLibre_Oceano";
  ocean.rotation.x=-Math.PI/2;
  ocean.position.y=ISLAND.seaLevel;
  scene.add(ocean);
  createIslandWater(THREE,scene);
  return {terrain,ocean,getHeightAt:getIslandHeight};
}
