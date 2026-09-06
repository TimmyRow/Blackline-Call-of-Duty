import * as THREE from 'three';
import { REGION_START, REGION_SITES, REGION_ROADS, heightAt } from './region-layout.mjs';
import type { ArenaCollider } from './environment';

/** Continuous terrain and survey infrastructure. The render mesh is also the physics surface. */
export function buildRegion(scene: THREE.Scene, colliders: ArenaCollider[], occluders: THREE.Object3D[]) {
  const root = new THREE.Group(); root.name = 'BLACKLINE / Orison island'; scene.add(root);
  // Reusable local surface maps add grain at walking distance without extra geometry or calls.
  function surfaceTexture(asphalt: boolean) {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    let textureSeed = asphalt ? 991 : 374;
    const rand = () => { textureSeed = (Math.imul(textureSeed, 1664525) + 1013904223) | 0; return (textureSeed >>> 0) / 4294967296; };
    ctx.fillStyle = asphalt ? '#b5bebc' : '#c3c2ae'; ctx.fillRect(0, 0, 512, 512);
    // Soft mottling precedes the fine mineral grit so large patches stay irregular.
    for (let i = 0; i < 130; i++) {
      const x = rand() * 512, y = rand() * 512, radius = 10 + rand() * 64;
      const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
      g.addColorStop(0, asphalt ? 'rgba(32,49,53,.21)' : 'rgba(76,77,44,.23)'); g.addColorStop(1, 'rgba(60,70,54,0)');
      ctx.fillStyle = g; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    for (let i = 0; i < 31000; i++) {
      const v = 50 + rand() * 170;
      ctx.fillStyle = `rgba(${v},${v + 5},${v},${.08 + rand() * .26})`;
      const grain = .45 + rand() * (asphalt ? 1.5 : 3);
      ctx.fillRect(rand() * 512, rand() * 512, grain, grain * (.5 + rand()));
    }
    ctx.lineCap = 'round';
    for (let i = 0; i < (asphalt ? 8 : 280); i++) {
      let x = rand() * 512, y = rand() * 512;
      ctx.strokeStyle = asphalt ? 'rgba(28,39,40,.36)' : `rgba(104,109,67,${.12 + rand() * .23})`;
      ctx.lineWidth = asphalt ? .65 : .6 + rand(); ctx.beginPath(); ctx.moveTo(x,y);
      for(let j=0;j<(asphalt?9:2);j++) {x+=rand()*13-6;y+=rand()*(asphalt?16:7);ctx.lineTo(x,y);} ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.anisotropy = 8;
    return texture;
  }
  const soilTexture = surfaceTexture(false), asphaltTexture = surfaceTexture(true);
  const size = 460, segments = 230;
  const terrainGeometry = new THREE.PlaneGeometry(size, size, segments, segments);
  terrainGeometry.rotateX(-Math.PI / 2);
  const positions = terrainGeometry.attributes.position;
  const colors = new Float32Array(positions.count * 3);
  const earth = new THREE.Color(), green = new THREE.Color('#59665a'), rock = new THREE.Color('#7b827c'), sand = new THREE.Color('#8b9589');
  for (let i = 0; i < positions.count; i++) {
    const x = positions.getX(i), z = positions.getZ(i), y = heightAt(x, z);
    positions.setY(i, y); terrainGeometry.attributes.uv.setXY(i, x / 9, z / 9);
    const slope = Math.hypot(heightAt(x + 1, z) - y, heightAt(x, z + 1) - y);
    earth.copy(green).lerp(rock, Math.min(1, slope * 1.5));
    const scrubPatch = Math.sin(x * .082 + Math.sin(z * .071) * 2.3) * Math.cos(z * .061 - x * .028);
    earth.lerp(sand, Math.max(0, scrubPatch - .04) * .47);
    if (y < 1.2) earth.lerp(sand, Math.max(0, 1 - Math.abs(y) / 5));
    earth.multiplyScalar(.9 + .1 * Math.sin(x * 1.8 + Math.sin(z * .8)) + .035 * Math.cos(x * .25 - z * .43));
    colors.set([earth.r, earth.g, earth.b], i * 3);
  }
  terrainGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); terrainGeometry.computeVertexNormals();
  const terrainMesh = new THREE.Mesh(terrainGeometry, new THREE.MeshStandardMaterial({ vertexColors: true, map: soilTexture, bumpMap: soilTexture, bumpScale: .12, roughness: .94, metalness: .02 }));
  terrainMesh.receiveShadow = true; root.add(terrainMesh); occluders.push(terrainMesh);
  const terrain = { vertices: new Float32Array(positions.array), indices: new Uint32Array(terrainGeometry.index!.array) };
  const steel = new THREE.MeshStandardMaterial({ color: '#687b7e', roughness: .48, metalness: .68 });
  const concrete = new THREE.MeshStandardMaterial({ color: '#abb3a4', roughness: .89 });
  const dark = new THREE.MeshStandardMaterial({ color: '#283b42', roughness: .68, metalness: .36 });
  const orange = new THREE.MeshStandardMaterial({ color: '#c78150', roughness: .65, metalness: .3 });
  const glow = new THREE.MeshStandardMaterial({ color: '#a9e5de', emissive: '#79cfc7', emissiveIntensity: 1.5 });
  const batches = new Map<THREE.Material, THREE.Matrix4[]>(), dummy = new THREE.Object3D(), box = new THREE.BoxGeometry(1, 1, 1);
  function block(x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material, collision = false, rotation = 0) {
    dummy.position.set(x, y, z); dummy.scale.set(w, h, d); dummy.rotation.set(0, rotation, 0); dummy.updateMatrix();
    const matrices = batches.get(material) || []; matrices.push(dummy.matrix.clone()); batches.set(material, matrices);
    if (collision) colliders.push({ x, y, z, hx: w / 2, hy: h / 2, hz: d / 2 });
  }
  function beam(a: THREE.Vector3, b: THREE.Vector3, thickness: number, material: THREE.Material) {
    dummy.position.copy(a).add(b).multiplyScalar(.5); dummy.scale.set(thickness, a.distanceTo(b), thickness);
    dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()); dummy.updateMatrix();
    const matrices = batches.get(material) || []; matrices.push(dummy.matrix.clone()); batches.set(material, matrices);
  }
  const roads: number[][][] = REGION_ROADS;
  const roadCurves = roads.map(points => new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'centripetal'));
  const roadMaterial = new THREE.MeshStandardMaterial({ color: '#607073', map: asphaltTexture, bumpMap: asphaltTexture, bumpScale: .055, roughness: .78, metalness: .06 });
  const shoulderMaterial = new THREE.MeshStandardMaterial({ color: '#aba88e', map: soilTexture, bumpMap: soilTexture, bumpScale: .16, roughness: 1 });
  function ribbon(curve: THREE.CatmullRomCurve3, width: number, lift: number, material: THREE.Material, dashed = false) {
    const length=curve.getLength(), count = Math.ceil(length / .7), across=dashed?1:12, stride=across+1, verts: number[] = [], indices: number[] = [], uvs: number[] = [];
    for (let i = 0; i <= count; i++) {
      const t = i / count, p = curve.getPoint(t), direction = curve.getTangent(t), normal = new THREE.Vector3(-direction.z, 0, direction.x);
      for (let j=0;j<=across;j++) {
        const side=j/across*2-1;
        const edgeWear = Math.sin(i * 1.71 + side * 2) * Math.sin(i * .49) * (material === shoulderMaterial ? .34 : .055);
        const x = p.x + normal.x * (width * .5 + edgeWear) * side, z = p.z + normal.z * (width * .5 + edgeWear) * side;
        verts.push(x, heightAt(x, z) + lift, z); uvs.push(x / 9, z / 9);
      }
      if (i < count && (!dashed || (i/count*length)%13<2.8)) for(let j=0;j<across;j++){const n=i*stride+j;indices.push(n,n+1,n+stride,n+1,n+stride+1,n+stride);}
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material); mesh.receiveShadow = true; root.add(mesh);
  }
  roadCurves.forEach((curve, index) => {
    ribbon(curve, index === 3 ? 6.8 : 9, .10, shoulderMaterial); ribbon(curve, index === 3 ? 4.4 : 6.7, .14, roadMaterial);
    ribbon(curve,.12,.18,concrete,true);
    for (let distance = 6; distance < curve.getLength(); distance += 13) {
      const t = distance / curve.getLength(), p = curve.getPointAt(t), tangent = curve.getTangentAt(t);
      if (index < 3 && distance % 26 < 13) for (const side of [-1, 1]) {
        const x = p.x - tangent.z * 5 * side, z = p.z + tangent.x * 5 * side, y = heightAt(x, z);
        block(x, y + .6, z, .14, 1.2, .14, dark); block(x, y + 1.1, z, .17, .15, .17, glow);
      }
    }
  });
  function sign(lines: string[], x: number, z: number, rotation = 0) {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 512;
    const ctx = canvas.getContext('2d')!; ctx.fillStyle = '#183439'; ctx.fillRect(0, 0, 1024, 512);
    ctx.strokeStyle = '#a4c9b6'; ctx.lineWidth = 10; ctx.strokeRect(16, 16, 992, 480);
    ctx.fillStyle = '#cee4cd'; ctx.font = 'bold 54px monospace';
    lines.forEach((line, i) => ctx.fillText(line, 55, 108 + i * 100));
    ctx.fillStyle = '#e9b970'; ctx.font = 'bold 24px monospace'; ctx.fillText('ORISON / COLONIAL DEFENCE FORCE', 55, 463);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.5), new THREE.MeshStandardMaterial({ map: texture, emissiveMap: texture, emissive: '#9ab6a4', emissiveIntensity: .24, roughness: .85, side: THREE.DoubleSide }));
    const y = heightAt(x, z); mesh.position.set(x, y + 3.1, z); mesh.rotation.y = rotation; root.add(mesh);
    for (const offset of [-1.8, 1.8]) block(x + Math.cos(rotation) * offset, y + 1.4, z - Math.sin(rotation) * offset, .12, 2.8, .12, steel);
  }
  sign(['↑  HARBOUR / 170m', '←  NORTHWATCH RELAY', '→  TIDEBREAK BATTERY'], -6, 89);
  sign(['↑  HARBOUR', '←  NORTHWATCH RELAY / 155m', '→  DEPOT / 150m'], 8, 76);
  sign(['←  RELAY', '→  DEPOT', '↓  INSERTION'], -5, -46, Math.PI);
  sign(['ORISON ISLAND', 'CONTESTED COLONY / 07', 'SIGNAL LOST AT 04:17'], 8, 115, -.25);
  sign(['↑  INSERTION / 60m', 'COASTAL LANDING', 'RETURN AFTER RECOVERY'], 6, 64, Math.PI);

  const siteSignals = new Map<string, THREE.MeshStandardMaterial>();
  for (const site of REGION_SITES) {
    const { x, z } = site, base = heightAt(x, z);
    const signal = new THREE.MeshStandardMaterial({ color: '#ff9970', emissive: '#ff5d2e', emissiveIntensity: 2 }); siteSignals.set(site.id, signal);
    // Four small illuminated survey stakes leave the interactive centre unobstructed.
    for (const dx of [-3.6, 3.6]) for (const dz of [-3.6, 3.6]) {
      const y = heightAt(x + dx, z + dz); block(x + dx, y + .48, z + dz, .12, .95, .12, dark); block(x + dx, y + .97, z + dz, .17, .13, .17, signal);
    }
    if (site.id === 'harbour') { block(x + 9, base + 10.3, z - 2, .6, 1, .6, signal); continue; }
    // Gravel pads follow the land; there is no compound boundary or invisible wall.
    const pad = new THREE.CircleGeometry(24, 48); pad.rotateX(-Math.PI / 2);
    const pp = pad.attributes.position;
    for (let i = 0; i < pp.count; i++) { pp.setY(i, heightAt(pp.getX(i) + x, pp.getZ(i) + z) - base + .04); pad.attributes.uv.setXY(i, (pp.getX(i) + x) / 9, (pp.getZ(i) + z) / 9); }
    pad.computeVertexNormals(); const apron = new THREE.Mesh(pad, shoulderMaterial); apron.position.set(x, base, z); apron.receiveShadow = true; root.add(apron);
    for (const [dx, dz, w, h, d] of [[-8, 2, 4, 1.1, 1.3], [7, 8, 3.8, 1.15, 1.4], [-4, -11, 3, 1.3, 1.8], [12, -5, 2, 1.8, 2]]) {
      const y = heightAt(x + dx, z + dz); block(x + dx, y + h / 2, z + dz, w, h, d, concrete, true);
      block(x + dx, y + h + .06, z + dz, w + .08, .12, d + .04, steel);
    }
    const hutX = x + (site.id === 'relay' ? -15 : 15), hutZ = z - 8, hutY = heightAt(hutX, hutZ);
    block(hutX, hutY + 2.2, hutZ, 7, 4.4, 6, dark, true); block(hutX, hutY + 4.5, hutZ, 7.7, .24, 6.7, steel);
    block(hutX, hutY + 2.5, hutZ + 3.03, 2.3, 1, .05, glow); block(hutX - 2.4, hutY + 1.2, hutZ + 3.04, 1.2, 2.4, .06, orange);
    sign(site.id === 'relay' ? ['NORTHWATCH RELAY', 'WIDE BAND ARRAY', 'FIELD STATION / 02'] : ['TIDEBREAK BATTERY', 'ORBITAL FIRE CONTROL', 'FIELD STATION / 03'], x - 7, z + 17);
    const mastX = x, mastZ = z - 13, mastBase = heightAt(mastX, mastZ), mastH = site.id === 'relay' ? 35 : 19;
    for (const dx of [-1.4, 1.4]) for (const dz of [-1.4, 1.4]) {
      block(mastX + dx, mastBase + mastH / 2, mastZ + dz, .24, mastH, .24, steel, true);
      block(mastX + dx, mastBase + .35, mastZ + dz, 1.2, .7, 1.2, concrete, true);
    }
    for (let y = 2; y < mastH; y += 4) {
      for (const side of [-1, 1]) {
        beam(new THREE.Vector3(mastX - 1.4, mastBase + y, mastZ + side * 1.4), new THREE.Vector3(mastX + 1.4, mastBase + y + 3.8, mastZ + side * 1.4), .11, steel);
        beam(new THREE.Vector3(mastX + side * 1.4, mastBase + y, mastZ - 1.4), new THREE.Vector3(mastX + side * 1.4, mastBase + y + 3.8, mastZ + 1.4), .11, steel);
      }
      block(mastX, mastBase + y, mastZ, 3.2, .1, 3.2, steel);
    }
    block(mastX, mastBase + mastH + .5, mastZ, .5, 1, .5, signal);
    if (site.id === 'relay') {
      for (const dx of [-2.4, 2.4]) { block(mastX + dx, mastBase + 27, mastZ, .7, 7, .5, concrete); block(mastX, mastBase + 29, mastZ, 6.3, .18, .18, steel); }
      block(mastX, mastBase + mastH + 3, mastZ, .08, 5, .08, steel);
    } else {
      const dish = new THREE.Mesh(new THREE.SphereGeometry(4.6, 24, 12, 0, Math.PI * 2, 0, Math.PI * .38), new THREE.MeshStandardMaterial({ color: '#d2d6bc', side: THREE.DoubleSide, metalness: .4, roughness: .48 }));
      dish.position.set(mastX, mastBase + 19, mastZ); dish.rotation.x = Math.PI * .7; root.add(dish);
      beam(new THREE.Vector3(mastX, mastBase + 18, mastZ), new THREE.Vector3(mastX, mastBase + 23, mastZ + 3), .12, steel);
      for (const dz of [4, 10]) { const bx = x + 19, bz = z + dz, by = heightAt(bx, bz); block(bx, by + 1.5, bz, 4, 3, 4, orange, true); }
    }
  }
  // Shore landing, weather gauges and a lighthouse establish the island's own silhouette.
  for (let i = 0; i < 8; i++) block(REGION_START.x - 4 + i * 1.1, heightAt(REGION_START.x, REGION_START.z) + .08, REGION_START.z + 7, .9, .1, 6, steel);
  const lx = 150, lz = 68, ly = heightAt(lx, lz);
  const lighthouse = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.8, 25, 14), concrete); lighthouse.position.set(lx, ly + 12.5, lz); root.add(lighthouse); occluders.push(lighthouse);
  colliders.push({ x: lx, y: ly + 12.5, z: lz, hx: 3.3, hy: 12.5, hz: 3.3 });
  block(lx, ly + 25.2, lz, 6.4, .5, 6.4, dark); block(lx, ly + 26.5, lz, 3, 2.2, 3, glow); block(lx, ly + 28, lz, 5, .7, 5, dark);

  // Colonial vessels use faceted pressure hulls, external drive pods and deep recessed bays.
  // Each vessel batches its plated details into four draw calls, including engine lenses.
  function spacecraft(x: number, y: number, z: number, scale: number, yaw: number, capital = false) {
    const group = new THREE.Group(); group.position.set(x, y, z); group.rotation.y = yaw; group.scale.setScalar(scale); root.add(group);
    const hullMat = new THREE.MeshStandardMaterial({ color: capital ? '#a4b2b5' : '#8d9e9d', metalness: .6, roughness: .5, fog: !capital });
    const armorMat = new THREE.MeshStandardMaterial({ color: '#354750', metalness: .7, roughness: .47, fog: !capital });
    const stripeMat = new THREE.MeshStandardMaterial({ color: '#b99a6a', metalness: .5, roughness: .6, fog: !capital });
    const engineMat = new THREE.MeshBasicMaterial({ color: '#a9e6eb', fog: false });
    const shipBatches = new Map<THREE.Material, THREE.Matrix4[]>();
    const part = (px: number, py: number, pz: number, w: number, h: number, d: number, material: THREE.Material, tilt = 0) => {
      dummy.position.set(px, py, pz); dummy.rotation.set(0, 0, tilt); dummy.scale.set(w, h, d); dummy.updateMatrix();
      const matrices = shipBatches.get(material) || []; matrices.push(dummy.matrix.clone()); shipBatches.set(material, matrices);
    };
    const hullGeo = new THREE.BufferGeometry();
    const points = [-2,-.8,5, 2,-.8,5, 2,1,4, -2,1,4, -.8,-.4,-7, .8,-.4,-7, .9,.5,-5, -.9,.5,-5];
    hullGeo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));
    hullGeo.setIndex([0,1,2,0,2,3,4,7,6,4,6,5,0,4,5,0,5,1,3,2,6,3,6,7,0,3,7,0,7,4,1,5,6,1,6,2]); hullGeo.computeVertexNormals();
    const hullMesh = new THREE.Mesh(hullGeo,hullMat); hullMesh.castShadow = !capital; group.add(hullMesh);
    part(0,-.7,0,2.8,.8,8,armorMat);
    part(0,1,1.3,2.8,.8,6,hullMat); part(0,1.5,1.9,1.8,.4,3.3,armorMat);
    part(0,.55,-4.4,1.4,.4,1.2,armorMat); part(0,.66,-4.8,.9,.1,.5,engineMat);
    for (const side of [-1,1]) {
      part(side*3.3,.1,1.3,3.4,.35,3.4,hullMat,side*-.08);
      part(side*4.8,-.15,2,1.45,1.35,6.5,armorMat);
      part(side*4.8,.55,1.7,1.55,.16,4.8,hullMat);
      part(side*4.8,-.05,5.32,1.02,.85,.09,engineMat);
      part(side*4.8,.8,3.7,.16,2.3,1.8,stripeMat,side*-.12);
      part(side*2.15,.4,2,.18,.8,5,stripeMat);
      part(side*1.35,-1.15,-3,.2,1.7,.3,armorMat);
      part(side*1.35,-1.9,-3,.9,.17,1.2,hullMat);
      part(side*3.5,-1.2,3.4,.2,1.6,.3,armorMat);
      part(side*3.5,-1.9,3.4,1.1,.17,1.4,hullMat);
      if (capital) {
        for(let i=0;i<5;i++) { part(side*2.03,.2,-2+i*1.25,.13,.28,.6,engineMat); part(side*2.15,-.55,-2+i*1.25,.35,.25,.8,armorMat); }
        part(side*3.2,1.2,.2,.9,.5,.9,armorMat); part(side*3.2,1.45,-.8,.14,.17,2.5,hullMat);
      }
    }
    part(0,-.15,5.12,2.5,.9,.12,engineMat);
    if(capital) {
      part(0,2.3,3.4,1.6,2,2.3,hullMat); part(0,3.2,3.1,2,.22,1.7,armorMat);
      part(0,3.35,2.25,1.6,.15,.08,engineMat); part(.6,4.15,3.6,.08,1.8,.08,hullMat);
      part(0,-1.15,1.2,2.6,.3,4.6,armorMat);
    }
    for(const [material,matrices] of shipBatches) {
      const mesh = new THREE.InstancedMesh(box,material,matrices.length); matrices.forEach((matrix,i)=>mesh.setMatrixAt(i,matrix));
      mesh.castShadow=!capital; mesh.receiveShadow=!capital; mesh.computeBoundingSphere(); group.add(mesh);
    }
    return group;
  }
  const landingY = heightAt(17,107);
  spacecraft(17,landingY+2,107,1.25,-.24);
  colliders.push({x:17,y:landingY+2,z:107,hx:2.5,hy:1.3,hz:7});
  for(const x of [11,23]) colliders.push({x,y:landingY+1.9,z:109,hx:1,hy:.85,hz:4});
  sign(['KESTREL / 04', 'EXPEDITIONARY SQUAD', 'RALLY AT SOUTH LANDING'], 24,120,-.22);
  const fleetA = spacecraft(-110,105,-125,6.2,-1.0,true);
  const fleetB = spacecraft(145,138,-185,8.8,.92,true);
  const escorts = [spacecraft(-55,72,-60,.8,.2,true),spacecraft(60,86,-140,.7,-.5,true),spacecraft(90,64,-40,.65,.2,true)];
  // Battery rails give the former telemetry site a military orbital silhouette.
  const battery = REGION_SITES.find(site=>site.id==='depot')!;
  for(const dx of [-8,8]) {
    const bx=battery.x+dx,bz=battery.z-20,by=heightAt(bx,bz);
    block(bx,by+1.3,bz,3.5,2.6,4,dark,true);
    block(bx,by+3,bz,2.5,.8,4.8,steel);
    for(const side of [-1,1]) beam(new THREE.Vector3(bx+side*.75,by+3,bz),new THREE.Vector3(bx+side*.75,by+7,bz-7),.32,steel);
  }

  let seed = 88239; const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
  const sampledRoads = roadCurves.flatMap(curve => curve.getPoints(100));
  const isClear = (x: number, z: number) => Math.abs(x) < 27 && z < 25 && z > -48 || REGION_SITES.some(site => Math.hypot(x - site.x, z - site.z) < 26) || sampledRoads.some(p => Math.hypot(p.x - x, p.z - z) < 6);
  const shrubs: THREE.Matrix4[] = [], rocks: THREE.Matrix4[] = [], grass: THREE.Matrix4[] = [];
  for (let i = 0; i < 4200; i++) {
    const x = (random() - .5) * 405, z = (random() - .5) * 405, y = heightAt(x, z);
    if (y < -.8 || isClear(x, z)) continue;
    dummy.position.set(x, y, z); dummy.rotation.set(random() * .15, random() * 6.28, random() * .13);
    const r = random();
    if (r < .16) { dummy.position.y += .1; dummy.scale.set(.6 + random() * 2.8, .4 + random() * 1.8, .7 + random() * 2.2); dummy.updateMatrix(); rocks.push(dummy.matrix.clone()); }
    else if (r < .45) { dummy.position.y += .25; dummy.scale.set(.6 + random(), .35 + random() * .6, .6 + random()); dummy.updateMatrix(); shrubs.push(dummy.matrix.clone()); }
    else { dummy.position.y += .28; dummy.scale.set(.4 + random() * .7, .3 + random() * .5, .4 + random() * .7); dummy.updateMatrix(); grass.push(dummy.matrix.clone()); }
  }
  function instance(geometry: THREE.BufferGeometry, material: THREE.Material, matrices: THREE.Matrix4[]) {
    const mesh = new THREE.InstancedMesh(geometry, material, matrices.length); matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix)); mesh.receiveShadow = true; mesh.computeBoundingSphere(); root.add(mesh); return mesh;
  }
  // Deformed stone profiles and blade clumps replace the repeated perfect polyhedra.
  const rockGeometry = new THREE.IcosahedronGeometry(1, 1);
  const rp = rockGeometry.attributes.position;
  for(let i=0;i<rp.count;i++) {
    const x=rp.getX(i),y=rp.getY(i),z=rp.getZ(i), scale=1+Math.sin(x*8+z*4)*Math.cos(y*6-z*3)*.13;
    rp.setXYZ(i,x*scale,Math.max(-.45,y*scale),z*scale);
  }
  rockGeometry.computeVertexNormals();
  instance(rockGeometry, new THREE.MeshStandardMaterial({ color: '#85918a', map: soilTexture, bumpMap: soilTexture, bumpScale: .09, roughness: .96 }), rocks);
  const shrubGeometry = new THREE.IcosahedronGeometry(1, 1), sp=shrubGeometry.attributes.position;
  for(let i=0;i<sp.count;i++) {
    const x=sp.getX(i),y=sp.getY(i),z=sp.getZ(i), scale=.82+.22*Math.sin(x*11+z*7)*Math.sin(y*9-z*13);
    sp.setXYZ(i,x*scale,y*scale+Math.sin(x*6+z*7)*.14,z*scale);
  }
  shrubGeometry.computeVertexNormals();
  instance(shrubGeometry, new THREE.MeshStandardMaterial({ color: '#647b59', map: soilTexture, roughness: 1 }), shrubs);
  const bladeVertices:number[]=[],bladeColors:number[]=[],bladeIndices:number[]=[];
  const rootTint=new THREE.Color('#596747'),tipTint=new THREE.Color('#b3ae78');
  for(let i=0;i<9;i++) {
    const angle=i*2.399,dx=Math.cos(angle),dz=Math.sin(angle),radius=.12+(i%3)*.12,h=.6+(i%4)*.15,w=.055+(i%2)*.022;
    const bx=dx*radius,bz=dz*radius,offset=bladeVertices.length/3;
    bladeVertices.push(bx-dz*w,-.35,bz+dx*w,bx+dz*w,-.35,bz-dx*w,bx+dx*.16-dz*w*.6,h*.45-.35,bz+dz*.16+dx*w*.6,bx+dx*.16+dz*w*.6,h*.45-.35,bz+dz*.16-dx*w*.6,bx+dx*.42,h-.35,bz+dz*.42);
    for(let j=0;j<5;j++) { const c=rootTint.clone().lerp(tipTint,j/5);bladeColors.push(c.r,c.g,c.b); }
    bladeIndices.push(offset,offset+1,offset+2,offset+1,offset+3,offset+2,offset+2,offset+3,offset+4);
  }
  const grassGeometry=new THREE.BufferGeometry();grassGeometry.setAttribute('position',new THREE.Float32BufferAttribute(bladeVertices,3));grassGeometry.setAttribute('color',new THREE.Float32BufferAttribute(bladeColors,3));grassGeometry.setIndex(bladeIndices);grassGeometry.computeVertexNormals();
  instance(grassGeometry, new THREE.MeshStandardMaterial({ vertexColors:true, roughness:1, side:THREE.DoubleSide }), grass);
  for (const [material, matrices] of batches) instance(box, material, matrices);
  // Ocean extends past the terrain edge, with animated broad swells and pale wave crests.
  const oceanGeo = new THREE.PlaneGeometry(3000, 3000, 100, 100); oceanGeo.rotateX(-Math.PI / 2);
  const ocean = new THREE.Mesh(oceanGeo, new THREE.MeshStandardMaterial({ color: '#426474', roughness: .36, metalness: .48, transparent: true, opacity: .95 }));
  ocean.position.y = -2.5; root.add(ocean);
  const oceanBase = new Float32Array(oceanGeo.attributes.position.array);
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1400, 32, 20), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vDirection; void main(){vDirection=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); gl_Position.z=gl_Position.w;}',
    fragmentShader: 'varying vec3 vDirection; void main(){vec3 d=normalize(vDirection); float h=max(d.y,0.0); vec3 color=mix(vec3(.45,.56,.61),vec3(.12,.23,.34),pow(h,.45)); float dawn=pow(max(0.0,dot(d,normalize(vec3(-.8,.04,-.4)))),18.0); color+=vec3(.32,.16,.055)*dawn; float cloud=sin(d.x*22.0+d.z*17.0+sin(d.z*36.0))*sin(d.z*31.0+d.y*25.0); color*=1.0-smoothstep(.05,.75,h)*max(cloud,0.0)*.17; gl_FragColor=vec4(color,1.0);}'
  })); sky.renderOrder = -100; root.add(sky);
  let oceanFrame = 0;
  return {
    terrain,
    setSiteComplete(id: string, complete: boolean) { const material = siteSignals.get(id); if (material) { material.color.set(complete ? '#8affdf' : '#ff9970'); material.emissive.set(complete ? '#34f6c0' : '#ff5d2e'); } },
    update(_dt: number, time: number, player: THREE.Vector3) {
      sky.position.copy(player);
      fleetA.position.y = 105 + Math.sin(time*.045)*1.4;
      fleetB.position.y = 138 + Math.sin(time*.035+2)*1.5;
      escorts.forEach((ship,i)=>{
        const phase=time*.035+i*2.1;
        ship.position.set(Math.sin(phase)*145,64+i*11+Math.sin(phase*2)*5,-55-Math.cos(phase)*95);
        ship.rotation.y=Math.atan2(-Math.cos(phase)*145,-Math.sin(phase)*95);
        ship.rotation.z=Math.sin(phase)*.12;
      });
      if (++oceanFrame % 4 === 0) {
        const attr = oceanGeo.attributes.position;
        for (let i = 0; i < attr.count; i++) { const x = oceanBase[i * 3], z = oceanBase[i * 3 + 2]; attr.setY(i, Math.sin(x * .035 + z * .022 + time * .65) * .24 + Math.sin(z * .065 - time * .8) * .1); }
        attr.needsUpdate = true;
      }
    },
  };
}
