import * as THREE from 'three';
import { buildRegion } from './region';
import { heightAt } from './region-layout.mjs';

export type ArenaCollider = { x: number; y: number; z: number; hx: number; hy: number; hz: number };

/** The environment owns presentation only. Collision boxes are adapted to Rapier by the game. */
export function buildEnvironment(scene: THREE.Scene): {
  colliders: ArenaCollider[]; occluders: THREE.Object3D[];
  terrain: { vertices: Float32Array; indices: Uint32Array };
  setSiteComplete: (id: string, complete: boolean) => void;
  update: (dt: number, time: number, player: THREE.Vector3) => void;
} {
  const colliders: ArenaCollider[] = [];
  const occluders: THREE.Object3D[] = [];
  const root = new THREE.Group(); root.name = 'BLACKLINE / North freight terminal'; scene.add(root);
  let seed = 73429;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
  const canvasTexture = (w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) => {
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    draw(canvas.getContext('2d')!);
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 8; return texture;
  };
  const asphalt = canvasTexture(1024, 1024, ctx => {
    ctx.fillStyle = '#56616a'; ctx.fillRect(0, 0, 1024, 1024);
    for (let i = 0; i < 90000; i++) {
      const v = 30 + random() * 60; ctx.fillStyle = `rgba(${v},${v + 7},${v + 10},${random() * .5})`;
      ctx.fillRect(random() * 1024, random() * 1024, 1 + random() * 3, 1 + random() * 2);
    }
    for (let i = 0; i < 95; i++) {
      const x = random() * 1024, y = random() * 1024;
      const g = ctx.createRadialGradient(x, y, 2, x, y, 30 + random() * 90);
      g.addColorStop(0, 'rgba(2,13,18,.68)'); g.addColorStop(1, 'rgba(2,13,18,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 140, y - 140, 280, 280);
    }
    ctx.strokeStyle = '#17292d'; ctx.lineWidth = 2;
    for (let i = 0; i < 25; i++) {
      let x = random() * 1024, y = random() * 1024; ctx.beginPath(); ctx.moveTo(x, y);
      for (let j = 0; j < 9; j++) { x += random() * 35 - 13; y += random() * 25; ctx.lineTo(x, y); } ctx.stroke();
    }
  });
  asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping; asphalt.repeat.set(12, 16);
  const steelMap = canvasTexture(512, 512, ctx => {
    ctx.fillStyle = '#969991'; ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 5000; i++) {
      ctx.fillStyle = random() > .45 ? `rgba(20,26,25,${random() * .18})` : `rgba(120,56,27,${random() * .3})`;
      ctx.fillRect(random() * 512, random() * 512, .5 + random() * 4, random() * 70);
    }
    for (let i = 0; i < 65; i++) {
      const x = random() * 512, y = random() * 512;
      const g = ctx.createRadialGradient(x, y, 0, x, y, 14 + random() * 60);
      g.addColorStop(0, 'rgba(89,44,23,.45)'); g.addColorStop(1, 'rgba(89,44,23,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 75, y - 75, 150, 150);
    }
    ctx.strokeStyle = '#454f4f'; ctx.lineWidth = 3; ctx.strokeRect(3, 3, 506, 506);
    for (const x of [12, 500]) for (const y of [12, 500]) { ctx.fillStyle = '#424849'; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill(); }
  });
  steelMap.wrapS = steelMap.wrapT = THREE.RepeatWrapping;
  const concreteMap = canvasTexture(512, 512, ctx => {
    ctx.fillStyle = '#858b84'; ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 18000; i++) { const c = 35 + random() * 145; ctx.fillStyle = `rgba(${c},${c},${c},.2)`; ctx.fillRect(random() * 512, random() * 512, random() * 5, random() * 3); }
    for (let i = 0; i < 35; i++) { ctx.fillStyle = 'rgba(28,42,35,.06)'; ctx.fillRect(random() * 512, 0, random() * 9, 512); }
    ctx.fillStyle = 'rgba(25,34,31,.26)'; ctx.fillRect(0, 490, 512, 22);
  });
  concreteMap.wrapS = concreteMap.wrapT = THREE.RepeatWrapping;
  const environmentMap = canvasTexture(512, 256, ctx => {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#152637'); g.addColorStop(.43, '#446478'); g.addColorStop(.52, '#75818a'); g.addColorStop(.57, '#26393c'); g.addColorStop(1, '#101719');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#b8c9cf'; ctx.fillRect(340, 75, 23, 24);
    ctx.fillStyle = '#a17c44'; ctx.fillRect(75, 111, 50, 8);
  });
  environmentMap.mapping = THREE.EquirectangularReflectionMapping;
  scene.environment = environmentMap; scene.environmentIntensity = 1.7;
  scene.background = new THREE.Color('#728e9d'); scene.fog = new THREE.FogExp2('#728e9d', .0038);
  const mat = (color: THREE.ColorRepresentation, roughness = .62, metalness = .15, map?: THREE.Texture) => new THREE.MeshStandardMaterial({ color, roughness, metalness, map });
  const steel = mat('#3c5056', .37, .8, steelMap);
  const darkSteel = mat('#34454e', .48, .6, steelMap);
  const rusty = mat('#805541', .7, .6, steelMap);
  const concrete = mat('#94958a', .73, .03, concreteMap);
  const wall = mat('#66767a', .71, .12, concreteMap);
  const pale = mat('#b6c5bf', .44, .5, steelMap);
  const yellow = mat('#dda740', .55, .35, steelMap);
  const orange = mat('#c9794d', .62, .38, steelMap);
  const teal = mat('#589e98', .55, .45, steelMap);
  const blue = mat('#6a819d', .57, .45, steelMap);
  const black = mat('#101a1e', .6, .35);
  const cyanGlow = new THREE.MeshStandardMaterial({ color: '#84e8ff', emissive: '#46d5ff', emissiveIntensity: 2.4, roughness: .3 });
  const amberGlow = new THREE.MeshStandardMaterial({ color: '#ffc181', emissive: '#ff8b31', emissiveIntensity: 2.8, roughness: .3 });
  const redGlow = new THREE.MeshStandardMaterial({ color: '#ff3329', emissive: '#ff1707', emissiveIntensity: 3 });
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const batches = new Map<THREE.Material, THREE.Matrix4[]>();
  const dummy = new THREE.Object3D();
  function detail(x: number, y: number, z: number, sx: number, sy: number, sz: number, material: THREE.Material, rz = 0, ry = 0) {
    dummy.position.set(x, y, z); dummy.rotation.set(0, ry, rz); dummy.scale.set(sx, sy, sz); dummy.updateMatrix();
    const batch = batches.get(material) || []; batch.push(dummy.matrix.clone()); batches.set(material, batch);
  }
  function solid(x: number, y: number, z: number, sx: number, sy: number, sz: number, material: THREE.Material, collision = true) {
    const mesh = new THREE.Mesh(boxGeo, material); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz);
    mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); occluders.push(mesh);
    if (collision) colliders.push({ x, y, z, hx: sx / 2, hy: sy / 2, hz: sz / 2 }); return mesh;
  }
  const wetTime = { value: 0 };
  const groundMaterial = new THREE.MeshStandardMaterial({ color: '#a7b4bb', map: asphalt, roughness: .5, metalness: .12, envMapIntensity: .24, bumpMap: asphalt, bumpScale: .12 });
  // Analytic reflections of practical lamps use their mirrored positions below the
  // road. The puddle mask and broken rain ripples avoid a costly second scene render.
  groundMaterial.onBeforeCompile = shader => {
    shader.uniforms.uWetTime = wetTime;
    shader.vertexShader = 'varying vec3 vWetWorld;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvWetWorld = (modelMatrix * vec4(position, 1.0)).xyz;');
    shader.fragmentShader = `
      varying vec3 vWetWorld;
      uniform float uWetTime;
      float wetHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float wetNoise(vec2 p) {
        vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(wetHash(i), wetHash(i + vec2(1,0)), f.x), mix(wetHash(i + vec2(0,1)), wetHash(i + vec2(1,1)), f.x), f.y);
      }
      vec3 wetLamp(vec3 lamp, vec3 tint, float water) {
        float eye = max(cameraPosition.y, 0.5);
        vec2 mirror = (lamp.xz * eye + cameraPosition.xz * lamp.y) / (eye + lamp.y);
        vec2 axis = normalize(lamp.xz - cameraPosition.xz + vec2(0.001));
        vec2 d = vWetWorld.xz - mirror;
        float along = dot(d, axis), across = dot(d, vec2(-axis.y, axis.x));
        float ripple = wetNoise(vWetWorld.xz * vec2(14.0, 42.0) + vec2(0.0, uWetTime * 1.4));
        across += (ripple - 0.5) * .38;
        float core = exp(-across * across * 4.5 - along * along * .45);
        float streak = exp(-across * across * 2.4 - along * along * .055) * .29;
        return tint * (core + streak) * water * (.32 + .68 * ripple) * .95;
      }
    ` + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `
      #include <roughnessmap_fragment>
      float waterMask = smoothstep(.53, .76, wetNoise(vWetWorld.xz * .37) * .7 + wetNoise(vWetWorld.xz * 1.9) * .3);
      roughnessFactor = mix(.76, .19, waterMask);
      diffuseColor.rgb *= mix(1.08, .42, waterMask);
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `
      #include <emissivemap_fragment>
      totalEmissiveRadiance += wetLamp(vec3(-7.8,7.55,12.0), vec3(.19,.64,1.0), waterMask);
      totalEmissiveRadiance += wetLamp(vec3(7.8,7.55,12.0), vec3(1.0,.44,.13), waterMask);
      totalEmissiveRadiance += wetLamp(vec3(-7.8,7.55,-7.0), vec3(.19,.64,1.0), waterMask);
      totalEmissiveRadiance += wetLamp(vec3(7.8,7.55,-7.0), vec3(1.0,.44,.13), waterMask);
      totalEmissiveRadiance += wetLamp(vec3(-7.8,7.55,-25.0), vec3(.19,.64,1.0), waterMask);
      totalEmissiveRadiance += wetLamp(vec3(7.8,7.55,-25.0), vec3(1.0,.44,.13), waterMask);
      totalEmissiveRadiance += wetLamp(vec3(0.0,3.6,-35.0), vec3(.16,.85,1.0), waterMask);
    `);
  };
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(43, 61), groundMaterial);
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, .012, -10.5); ground.receiveShadow = true; root.add(ground);


  // Traffic paint and tyre wear live in one atlas rather than hundreds of meshes.
  const laneMap = canvasTexture(1024, 2048, ctx => {
    ctx.clearRect(0, 0, 1024, 2048); ctx.fillStyle = '#c7a658';
    for (const x of [185, 827]) ctx.fillRect(x, 0, 5, 2048);
    ctx.fillStyle = '#787d70';
    for (let y = 0; y < 1800; y += 220) ctx.fillRect(510, y, 4, 40);
    ctx.save(); ctx.translate(510, 1280); ctx.scale(.4, .4); ctx.fillStyle = '#949782'; ctx.beginPath(); ctx.moveTo(0, -85); ctx.lineTo(35, -38); ctx.lineTo(13, -38); ctx.lineTo(13, 55); ctx.lineTo(-13, 55); ctx.lineTo(-13, -38); ctx.lineTo(-35, -38); ctx.closePath(); ctx.fill(); ctx.restore();
    ctx.font = 'bold 30px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#898b74'; ctx.fillText('KEEP CLEAR', 512, 1490);
    ctx.save(); ctx.translate(512, 198); ctx.fillStyle = '#b79544';
    for (let x = -390; x < 390; x += 45) { ctx.beginPath(); ctx.moveTo(x, -48); ctx.lineTo(x + 22, -48); ctx.lineTo(x + 82, 48); ctx.lineTo(x + 60, 48); ctx.closePath(); ctx.fill(); } ctx.restore();
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 24000; i++) { ctx.fillStyle = `rgba(0,0,0,${.2 + random() * .8})`; ctx.fillRect(random() * 1024, random() * 2048, 1 + random() * 7, 1 + random() * 12); }
  });
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(42, 60), new THREE.MeshStandardMaterial({ map: laneMap, transparent: true, roughness: .42, metalness: .1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
  lane.rotation.x = -Math.PI / 2; lane.position.set(0, .026, -10); lane.receiveShadow = true; root.add(lane);

  function sign(text: string, sub: string, x: number, y: number, z: number, width: number, height: number, color = '#c7e4de') {
    const tex = canvasTexture(1024, 256, ctx => {
      ctx.fillStyle = '#11232b'; ctx.fillRect(0, 0, 1024, 256); ctx.strokeStyle = color; ctx.lineWidth = 7; ctx.strokeRect(16, 16, 992, 224);
      ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.font = '900 112px Arial'; ctx.fillText(text, 512, 143);
      ctx.font = 'bold 31px monospace'; ctx.fillText(sub, 512, 205);
      ctx.fillStyle = 'rgba(11,24,31,.3)'; for (let i = 0; i < 800; i++) ctx.fillRect(random() * 1024, random() * 256, random() * 12, 1);
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: '#8cacaa', emissiveIntensity: .35, roughness: .5, metalness: .2 }));
    mesh.position.set(x, y, z); root.add(mesh); return mesh;
  }
  function container(x: number, z: number, material: THREE.Material, level = 0, number = '03') {
    const y = level * 3.08 + 1.52;
    solid(x, y, z, 4.6, 3, 8.8, material);
    for (let i = 0; i < 21; i++) for (const side of [-1, 1]) detail(x + side * 2.33, y, z - 4.2 + i * .42, .08, 2.75, .1, material);
    for (const side of [-1, 1]) for (const dz of [-4.42, 4.42]) detail(x + side * 2.21, y, z + dz, .18, 3.08, .13, steel);
    for (const dz of [-4.44, 4.44]) {
      detail(x, y + 1.42, z + dz, 4.5, .15, .14, steel); detail(x, y - 1.42, z + dz, 4.5, .15, .14, steel);
      detail(x, y, z + dz, .07, 2.8, .09, darkSteel);
      for (const dx of [-1.3, 1.3]) { detail(x + dx, y, z + dz * 1.004, .055, 2.66, .075, pale); detail(x + dx, y - .1, z + dz * 1.016, .36, .08, .12, steel); }
    }
    if (level === 0) sign('NORTH / ' + number, 'INTERMODAL  •  MAX GROSS 32 500 KG', x, y + .35, z + 4.51, 3.5, .85, '#b7c7b8');
    detail(x + 1.82, y - 1.04, z + 4.51, .22, .28, .01, yellow);
  }
  container(-15, 6, teal, 0, '07'); container(-15, 6, blue, 1);
  container(15, 1, orange, 0, '12'); container(15, 1, teal, 1);
  container(-16, -14, blue, 0, '04'); container(-16, -14, orange, 1);
  container(16, -22, teal, 0, '09'); container(16, -22, blue, 1);
  container(-16, -34, orange, 0, '16');
  // Cover gives lateral options while preserving the centre sightline to extraction.
  for (const [x, z] of [[-5.8, 1], [6.2, -8], [-6, -18], [6.5, -27], [-10, -24]]) {
    solid(x, .64, z, 3.5, 1.28, 1.25, concrete);
    detail(x, 1.31, z, 3.52, .12, 1.28, pale);
    for (let i = -3; i <= 3; i++) detail(x + i * .42, .66, z + .631, .25, .75, .01, i % 2 ? yellow : black, -.35);
    detail(x - 1.3, .13, z + .65, .22, .18, .1, amberGlow); detail(x + 1.3, .13, z + .65, .22, .18, .1, amberGlow);
  }
  for (const [x, z, size] of [[-9, -4, 1.35], [9.5, -17, 1.45], [-10, -30, 1.2], [10, 10, 1.15], [19, -10, 1.5]]) {
    solid(x, size / 2, z, size * 1.3, size, size, steel);
    for (const dx of [-size * .48, size * .48]) detail(x + dx, size / 2, z + size / 2 + .012, .12, size, .035, yellow);
    detail(x, size + .045, z, size * 1.34, .09, size * 1.06, darkSteel);
  }

  // Freestanding port buildings leave broad approaches around all four sides.
  for (const [x, z, w, d, h] of [[-34, -8, 10, 14, 6.2], [35, -20, 12, 16, 7.4], [-27, -45, 11, 8, 5]]) {
    const base = heightAt(x, z);
    solid(x, base + h / 2, z, w, h, d, wall);
    detail(x, base + h + .12, z, w + .9, .24, d + .9, rusty);
    detail(x, base + 2.3, z + d / 2 + .04, w * .65, 1.4, .08, darkSteel);
    for (let dx = -w * .25; dx <= w * .25; dx += 1.4) detail(x + dx, base + 2.3, z + d / 2 + .09, 1.1, 1.1, .035, cyanGlow);
    detail(x - w * .33, base + 1.25, z + d / 2 + .08, 1.4, 2.5, .08, steel);
    for (const dx of [-w * .4, w * .4]) detail(x + dx, base + h * .5, z + d * .5, .12, h, .12, pale);
  }
  sign('COLD HARBOUR', 'ORISON COLONY / MILITARY FREIGHT', -9, 6.3, -42.72, 12, 2.6);
  for (const x of [-15, -3]) detail(x, 3.1, -42.8, .16, 6.2, .16, steel);
  const approachSign = sign('NORTHWATCH  /  TIDEBREAK', 'COAST ROAD  /  SOUTH LANDING BEHIND YOU', 0, 6.5, 20.5, 12, 1.8, '#e4b65a');
  approachSign.rotation.y = Math.PI;
  for (const x of [-6.5, 6.5]) detail(x, 3.55, 20.5, .16, 7.1, .16, steel);
  detail(0, 7.5, 20.5, 13.2, .18, .2, steel);
  const extractionLight = new THREE.PointLight('#66e5ff', 35, 16, 2); extractionLight.position.set(0, 3.6, -35); root.add(extractionLight);
  for (const x of [-10.8, 10.8]) { solid(x, 4.4, -31.5, .5, 8.8, .5, steel); detail(x, .1, -31.5, 1, .2, 1, concrete); }
  detail(0, 8.6, -31.5, 22, .5, 1.1, steel);
  detail(0, 9.55, -31.5, 22, .12, .12, steel);
  for (let x = -10; x <= 10; x += 1.5) detail(x, 9.15, -31.5, .065, 1.15, .065, steel);
  for (let x = -10; x < 10; x += 2.5) detail(x + 1.25, 7.95, -31.5, 2.7, .14, .16, rusty, x % 5 ? -.43 : .43);

  function pipe(x: number, y: number, z: number, radius: number, length: number, material: THREE.Material, axis: 'x' | 'y' | 'z' = 'y') {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 10), material);
    mesh.position.set(x, y, z); if (axis === 'z') mesh.rotation.x = Math.PI / 2; if (axis === 'x') mesh.rotation.z = Math.PI / 2;
    root.add(mesh); return mesh;
  }
  for (let i = 0; i < 6; i++) {
    const x = i % 2 ? 19.5 : -19.3, z = 16 - i * 8.6;
    pipe(x, .58, z, .42, 1.15, i % 2 ? rusty : blue);
    pipe(x, .25, z, .435, .06, steel); pipe(x, .88, z, .435, .06, steel);
  }
  // One used loading station beside the near-left container, clear of the main lane.
  const palletWood = mat('#786245', .91, .015, concreteMap);
  for (let layer = 0; layer < 2; layer++) {
    const y = .11 + layer * .25;
    for (const dx of [-.84, 0, .84]) detail(-12 + dx, y, 12.6, .17, .17, 1.55, palletWood);
    for (let slat = 0; slat < 7; slat++) detail(-12, y + .115, 11.91 + slat * .23, 2.05, .07, .18, palletWood);
  }
  colliders.push({ x: -12, y: .255, z: 12.6, hx: 1.04, hy: .255, hz: .78 });
  const loadingDrums = new THREE.InstancedMesh(new THREE.CylinderGeometry(.4, .4, 1.08, 16), orange, 2);
  const drumRings = new THREE.InstancedMesh(new THREE.CylinderGeometry(.417, .417, .045, 16), steel, 4);
  for (let i = 0; i < 2; i++) {
    const x = -12.52 + i * 1.02;
    dummy.position.set(x, 1.055, 12.6); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); loadingDrums.setMatrixAt(i, dummy.matrix);
    for (let band = 0; band < 2; band++) { dummy.position.y = .76 + band * .61; dummy.updateMatrix(); drumRings.setMatrixAt(i * 2 + band, dummy.matrix); }
    colliders.push({ x, y: 1.055, z: 12.6, hx: .4, hy: .54, hz: .4 });
    detail(x, 1.15, 13.005, .2, .28, .012, pale);
  }
  loadingDrums.castShadow = loadingDrums.receiveShadow = true; drumRings.castShadow = true;
  root.add(loadingDrums, drumRings); occluders.push(loadingDrums);
  const hosePoints: THREE.Vector3[] = [];
  for (let i = 0; i <= 100; i++) {
    const angle = i / 100 * Math.PI * 6, radius = .64 - i / 100 * .37;
    hosePoints.push(new THREE.Vector3(-10.32 + Math.cos(angle) * radius, .065 + i / 100 * .03, 12.55 + Math.sin(angle) * radius));
  }
  hosePoints.push(new THREE.Vector3(-10.05, .065, 13.17), new THREE.Vector3(-9.68, .065, 13.4));
  const hose = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(hosePoints), 128, .047, 6, false), black);
  hose.castShadow = hose.receiveShadow = true; root.add(hose);
  colliders.push({ x: -10.28, y: .08, z: 12.73, hx: .68, hy: .08, hz: .75 });
  // Overhead conduits, hanging warning placards and practical luminaires.
  for (const z of [12, -7, -25]) {
    for (const x of [-9, 9]) {
      detail(x, 4.2, z, .18, 8.4, .18, steel); detail(x, .13, z, .52, .26, .52, concrete);
      detail(x - Math.sign(x) * .65, 8.2, z, 1.5, .12, .12, steel);
      detail(x - Math.sign(x) * 1.22, 8.12, z, .72, .13, .38, black);
      detail(x - Math.sign(x) * 1.22, 8.04, z, .6, .035, .28, x < 0 ? cyanGlow : amberGlow);
      const light = new THREE.PointLight(x < 0 ? '#73cfff' : '#ffb35c', 100, 23, 2);
      light.position.set(x - Math.sign(x) * 1.2, 7.55, z); root.add(light);
    }
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-22, 10.5, z), new THREE.Vector3(-10, 9, z + .1), new THREE.Vector3(0, 8.3, z + .3), new THREE.Vector3(10, 9, z + .1), new THREE.Vector3(22, 10.5, z)]);
    root.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 24, .025, 4, false), black));
  }
  sign('ORISON / 07', 'COLONIAL DEFENCE FORCE', 0, 8.2, -31, 6.8, 1.5, '#e4b65a');

  // Long-distance silhouettes retain scale through fog: cranes, tanks and towers.
  function crane(x: number, z: number, scale: number, facing: number) {
    const h = 24 * scale;
    for (const dx of [-3, 3]) detail(x + dx * scale, h / 2, z, .65 * scale, h, .65 * scale, rusty);
    for (let y = 3; y < h; y += 4 * scale) {
      detail(x, y, z, 6 * scale, .25 * scale, .3 * scale, rusty);
      detail(x, y + 1.7 * scale, z, 7 * scale, .2 * scale, .23 * scale, rusty, .53);
    }
    detail(x + facing * 7 * scale, h, z, 25 * scale, .55 * scale, .9 * scale, rusty);
    detail(x + facing * 7 * scale, h + 2 * scale, z, 25 * scale, .2 * scale, .25 * scale, steel);
    for (let i = -5; i < 19; i += 2) detail(x + facing * i * scale, h + scale, z, .15 * scale, 2 * scale, .18 * scale, steel, -.3 * facing);
    detail(x + facing * 14 * scale, h - 6 * scale, z, .045, 12 * scale, .045, black);
    detail(x + facing * 14 * scale, h - 12 * scale, z, .6 * scale, .7 * scale, .4 * scale, yellow);
    detail(x - facing * 3 * scale, h - .7 * scale, z, 3 * scale, 2 * scale, 2.2 * scale, darkSteel);
    detail(x, h + 2.3 * scale, z, .16, .25, .16, redGlow);
  }
  crane(-35, -60, 1.2, 1); crane(29, -66, 1.45, -1); crane(50, -33, 1, -1);
  const moon = new THREE.DirectionalLight('#b7cfe0', 2.8); moon.position.set(-22, 38, 12);
  moon.castShadow = true; moon.shadow.mapSize.set(2048, 2048); moon.shadow.camera.left = -32; moon.shadow.camera.right = 32;
  moon.shadow.camera.top = 35; moon.shadow.camera.bottom = -35; moon.shadow.camera.near = .5; moon.shadow.camera.far = 110;
  moon.shadow.normalBias = .035; moon.shadow.bias = -.0003; moon.target.position.set(0, 0, -14); root.add(moon, moon.target);
  root.add(new THREE.HemisphereLight('#a3becb', '#374952', 2.15));
  const entryLight = new THREE.PointLight('#a4deff', 52, 24, 2); entryLight.position.set(0, 6, 17); root.add(entryLight);

  // Irregular water films pick up the same sky and practical lights as the asphalt.
  const puddleTexture = canvasTexture(256, 256, ctx => {
    const g = ctx.createRadialGradient(128, 128, 28, 128, 128, 126); g.addColorStop(0, 'rgba(210,235,240,.8)'); g.addColorStop(.7, 'rgba(190,225,230,.5)'); g.addColorStop(1, 'rgba(150,220,225,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
    ctx.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 50; i++) { ctx.beginPath(); ctx.ellipse(random() * 256, random() * 256, 5 + random() * 20, 3 + random() * 7, random() * 3, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fill(); }
  });
  const puddles = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ color: '#243c44', map: puddleTexture, transparent: true, opacity: .13, roughness: .28, metalness: .16, envMapIntensity: .18, depthWrite: false }), 44);
  for (let i = 0; i < 44; i++) {
    dummy.position.set((random() - .5) * 38, .022 + random() * .002, 18 - random() * 60);
    dummy.rotation.set(-Math.PI / 2, 0, random() * Math.PI); dummy.scale.set(1 + random() * 5, .8 + random() * 3, 1); dummy.updateMatrix(); puddles.setMatrixAt(i, dummy.matrix);
  }
  root.add(puddles);
  const contactBoxes = colliders.filter(box => box.hx < 5 && box.hz < 5 && box.y - box.hy < .2);
  const contactShadows = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#010609', map: puddleTexture, transparent: true, opacity: .6, depthWrite: false }), contactBoxes.length);
  contactBoxes.forEach((box, i) => {
    dummy.position.set(box.x, .017, box.z); dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.scale.set(box.hx * 2 + 2.2, box.hz * 2 + 2.2, 1); dummy.updateMatrix(); contactShadows.setMatrixAt(i, dummy.matrix);
  });
  root.add(contactShadows);
  // Drain grates and debris are instanced along the service edge.
  for (let z = -39; z < 21; z += 6) for (const x of [-8.05, 8.05]) {
    detail(x, .025, z, .48, .025, 1.2, black);
    for (let i = 0; i < 8; i++) detail(x, .047, z - .5 + i * .14, .45, .025, .025, steel);
  }
  for (let i = 0; i < 85; i++) {
    const x = (random() > .5 ? 1 : -1) * (9 + random() * 12);
    detail(x, .035, 20 - random() * 61, .04 + random() * .25, .035, .04 + random() * .3, random() > .5 ? rusty : pale, 0, random() * 6);
  }
  for (const [material, matrices] of batches) {
    const mesh = new THREE.InstancedMesh(boxGeo, material, matrices.length);
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix)); mesh.castShadow = material !== cyanGlow && material !== amberGlow && material !== redGlow;
    mesh.receiveShadow = true; mesh.computeBoundingSphere(); root.add(mesh);
  }

  const rainCount = 2400, rainArray = new Float32Array(rainCount * 6), rainVelocity = new Float32Array(rainCount);
  for (let i = 0; i < rainCount; i++) {
    const n = i * 6; rainArray[n] = (random() - .5) * 66; rainArray[n + 1] = random() * 22; rainArray[n + 2] = 25 - random() * 88;
    rainArray[n + 3] = rainArray[n] + .065; rainArray[n + 4] = rainArray[n + 1] - .25 - random() * .35; rainArray[n + 5] = rainArray[n + 2] + .02;
    rainVelocity[i] = 15 + random() * 9;
  }
  const rainGeometry = new THREE.BufferGeometry(); rainGeometry.setAttribute('position', new THREE.BufferAttribute(rainArray, 3).setUsage(THREE.DynamicDrawUsage));
  const rain = new THREE.LineSegments(rainGeometry, new THREE.LineBasicMaterial({ color: '#a8cdd9', transparent: true, opacity: .21, depthWrite: false })); rain.frustumCulled = false; root.add(rain);
  const mistMap = canvasTexture(128, 128, ctx => {
    const g = ctx.createRadialGradient(64, 64, 1, 64, 64, 63); g.addColorStop(0, 'rgba(170,210,215,.5)'); g.addColorStop(.5, 'rgba(170,210,215,.2)'); g.addColorStop(1, 'rgba(170,210,215,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  });
  const mists: THREE.Mesh[] = [];
  for (let i = 0; i < 10; i++) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(10 + random() * 8, 3 + random() * 4), new THREE.MeshBasicMaterial({ map: mistMap, color: '#739fa7', transparent: true, opacity: .1, depthWrite: false, side: THREE.DoubleSide }));
    mesh.position.set((i % 2 ? 1 : -1) * (10 + random() * 9), 1.8, 11 - i * 6); mesh.userData.baseX = mesh.position.x; root.add(mesh); mists.push(mesh);
  }
  const beacon = new THREE.PointLight('#ff4b22', 6, 7); beacon.position.set(-3.9, 4.8, -37.8); root.add(beacon);
  const region = buildRegion(scene, colliders, occluders);
  return {
    colliders, occluders, terrain: region.terrain, setSiteComplete: region.setSiteComplete,
    update(dt, time, player) {
      wetTime.value = time;
      region.update(dt, time, player);
      rain.position.set(player.x, player.y, player.z);
      const shadowX=Math.floor(player.x/32)*32,shadowY=Math.floor(player.y/8)*8,shadowZ=Math.floor(player.z/32)*32;
      moon.position.set(shadowX - 22, shadowY + 38, shadowZ + 12);
      moon.target.position.set(shadowX, shadowY, shadowZ - 14);
      const step = Math.min(dt, .05);
      for (let i = 0; i < rainCount; i++) {
        const n = i * 6, fall = rainVelocity[i] * step;
        rainArray[n + 1] -= fall; rainArray[n + 4] -= fall; rainArray[n] += step * 1.8; rainArray[n + 3] += step * 1.8;
        if (rainArray[n + 1] < -.4) { rainArray[n + 1] += 22; rainArray[n + 4] += 22; rainArray[n] = (random() - .5) * 66; rainArray[n + 3] = rainArray[n] + .065; }
      }
      rainGeometry.attributes.position.needsUpdate = true;
      for (let i = 0; i < mists.length; i++) { const mist = mists[i]; mist.position.x = mist.userData.baseX + Math.sin(time * .13 + i) * 1.5; mist.rotation.y = Math.atan2(player.x - mist.position.x, player.z - mist.position.z); }
      beacon.intensity = 4 + Math.sin(time * 4) * 2;
    },
  };
}
