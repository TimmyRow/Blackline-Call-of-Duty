import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

type WeaponState = { time: number; moving: number; sprinting: boolean; aiming: boolean; reload: number; recoil: number };
type EnemyState = { time: number; moving: boolean; firing: boolean; dead: boolean };

// These objects only present simulation state. Hit decisions and movement belong to the game.
const black = new THREE.MeshStandardMaterial({ color: 0x131a1c, roughness: .52, metalness: .65 });
const graphite = new THREE.MeshStandardMaterial({ color: 0x303a3c, roughness: .39, metalness: .8 });
const edge = new THREE.MeshStandardMaterial({ color: 0x687476, roughness: .36, metalness: .9 });
const rubber = new THREE.MeshStandardMaterial({ color: 0x171b1b, roughness: .96 });
const fabric = new THREE.MeshStandardMaterial({ color: 0x48504a, roughness: 1 });
const glove = new THREE.MeshStandardMaterial({ color: 0x222c29, roughness: .93 });
const tan = new THREE.MeshStandardMaterial({ color: 0x8e8a71, roughness: .82, metalness: .13 });
const amber = new THREE.MeshStandardMaterial({ color: 0xf0af46, emissive: 0xd58621, emissiveIntensity: .32, roughness: .28, metalness: .5 });
const red = new THREE.MeshStandardMaterial({ color: 0xb14532, emissive: 0x8b261a, emissiveIntensity: .4, roughness: .55 });
const enemySolid = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .76, metalness: .24 });

function mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geometry, material);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function box(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, material: THREE.Material, bevel = 0) {
  if (!bevel) return mesh(parent, new THREE.BoxGeometry(w, h, d), material, x, y, z);
  const c = Math.min(bevel, w * .2, h * .2, d * .2);
  const shape = new THREE.Shape();
  shape.moveTo(c, 0); shape.lineTo(w - c, 0); shape.lineTo(w, c);
  shape.lineTo(w, h - c); shape.lineTo(w - c, h); shape.lineTo(c, h);
  shape.lineTo(0, h - c); shape.lineTo(0, c); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d - c * 2, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: c * .45, bevelThickness: c });
  geo.translate(-w / 2, -h / 2, -d / 2 + c);
  return mesh(parent, geo, material, x, y, z);
}

function cylinder(parent: THREE.Object3D, x: number, y: number, z: number, radius: number, length: number, material: THREE.Material, axis: 'x' | 'y' | 'z' = 'z', segments = 12, endRadius = radius) {
  const m = mesh(parent, new THREE.CylinderGeometry(radius, endRadius, length, segments), material, x, y, z);
  if (axis === 'z') m.rotation.x = Math.PI / 2;
  if (axis === 'x') m.rotation.z = Math.PI / 2;
  return m;
}

function capsuleBetween(parent: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3, radius: number, material: THREE.Material) {
  const delta = b.clone().sub(a);
  const m = mesh(parent, new THREE.CapsuleGeometry(radius, Math.max(.001, delta.length() - radius * 2), 3, 8), material);
  m.position.copy(a).add(b).multiplyScalar(.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
  return m;
}

function tube(parent: THREE.Object3D, points: number[][], radius: number, material: THREE.Material) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p[0], p[1], p[2])));
  return mesh(parent, new THREE.TubeGeometry(curve, 16, radius, 5, false), material);
}

function label(parent: THREE.Object3D, text: string, x: number, y: number, z: number, width: number, height: number, color = '#adb9b1') {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = color; ctx.font = 'bold 44px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 64);
  const material = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false, opacity: .8 });
  const m = mesh(parent, new THREE.PlaneGeometry(width, height), material, x, y, z);
  m.castShadow = false;
  return m;
}

// Merge rigid surfaces by material while retaining the animated joint hierarchy.
function mergeRigid(parent: THREE.Object3D, recursive = false) {
  parent.updateWorldMatrix(true, true);
  const inverse = parent.matrixWorld.clone().invert();
  const batches = new Map<THREE.Material, THREE.Mesh[]>();
  const collect = (o: THREE.Object3D) => {
    if (!(o instanceof THREE.Mesh) || Array.isArray(o.material)) return;
    const list = batches.get(o.material) ?? [];
    list.push(o); batches.set(o.material, list);
  };
  if (recursive) parent.traverse(collect); else parent.children.forEach(collect);
  for (const [material, sources] of batches) {
    if (sources.length < 2) continue;
    const geometries = sources.map(source => {
      const geo = source.geometry.index ? source.geometry.toNonIndexed() : source.geometry.clone();
      geo.applyMatrix4(inverse.clone().multiply(source.matrixWorld));
      return geo;
    });
    const merged = mergeGeometries(geometries, false);
    geometries.forEach(g => g.dispose());
    if (!merged) continue;
    sources.forEach(source => { source.removeFromParent(); source.geometry.dispose(); });
    mesh(parent, merged, material);
  }
}

function mergeEnemyRigid(parent: THREE.Object3D, recursive = false) {
  parent.updateWorldMatrix(true, true);
  const inverse = parent.matrixWorld.clone().invert();
  const sources: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[] = [];
  const collect = (o: THREE.Object3D) => {
    if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshStandardMaterial && o.material.emissive.getHex() === 0) sources.push(o);
  };
  if (recursive) parent.traverse(collect); else parent.children.forEach(collect);
  if (!sources.length) return;
  const geometries = sources.map(source => {
    const geo = source.geometry.index ? source.geometry.toNonIndexed() : source.geometry.clone();
    geo.applyMatrix4(inverse.clone().multiply(source.matrixWorld));
    const count = geo.getAttribute('position').count;
    const colors = new Float32Array(count * 3);
    const color = source.material.color;
    for (let i = 0; i < count; i++) { colors[i * 3] = color.r; colors[i * 3 + 1] = color.g; colors[i * 3 + 2] = color.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  });
  const merged = mergeGeometries(geometries, false);
  geometries.forEach(g => g.dispose());
  if (!merged) return;
  sources.forEach(source => { source.removeFromParent(); source.geometry.dispose(); });
  const combined = mesh(parent, merged, enemySolid);
  combined.castShadow = false;
}

function weaponSurfaceMaterials(root: THREE.Object3D) {
  // A small private studio environment lights the view model without adding world lights.
  const faces = Array.from({ length: 6 }, (_, face) => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const gradient = ctx.createLinearGradient(0, 0, 64, 64);
    gradient.addColorStop(0, face === 2 ? '#e5efdf' : '#849c9c');
    gradient.addColorStop(.35, face === 3 ? '#344347' : '#c5d2ca');
    gradient.addColorStop(.55, '#566d70'); gradient.addColorStop(1, '#1a252c');
    ctx.fillStyle = gradient; ctx.fillRect(0, 0, 64, 64);
    if (face === 0 || face === 4) { ctx.fillStyle = '#e2d6b9'; ctx.fillRect(12, 8, 6, 43); }
    return canvas;
  });
  const environment = new THREE.CubeTexture(faces); environment.colorSpace = THREE.SRGBColorSpace; environment.needsUpdate = true;
  const makeSurface = (cloth: boolean) => {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    const pixels = ctx.createImageData(256, 256);
    let seed = 5197;
    for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const grain = (seed >>> 24) / 255;
      const weave = cloth ? ((x % 4 < 2) !== (y % 4 < 2) ? 22 : -22) : 0;
      const value = Math.round((cloth ? 174 : 209) + grain * 28 + weave);
      const i = (y * 256 + x) * 4;
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = value; pixels.data[i + 3] = 255;
    }
    ctx.putImageData(pixels, 0, 0);
    if (!cloth) {
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = .6;
      for (let i = 0; i < 50; i++) { const x = (i * 73) % 256, y = (i * 47) % 256; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 2 + i % 7, y - 1); ctx.stroke(); }
    } else {
      ctx.globalAlpha = .12; ctx.fillStyle = '#535f42';
      for (let i = 0; i < 16; i++) { ctx.beginPath(); ctx.ellipse((i * 73) % 256, (i * 57) % 256, 28, 17, i, 0, Math.PI * 2); ctx.fill(); }
    }
    const texture = new THREE.CanvasTexture(canvas); texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(cloth ? 3 : 1, cloth ? 3 : 1); texture.anisotropy = 4;
    return texture;
  };
  const metalSurface = makeSurface(false), clothSurface = makeSurface(true);
  const clones = new Map<THREE.Material, THREE.Material>();
  root.traverse(o => {
    if (!(o instanceof THREE.Mesh) || !(o.material instanceof THREE.MeshStandardMaterial)) return;
    let material = clones.get(o.material);
    if (!material) {
      const original = o.material;
      const copy = original.clone();
      const cloth = original === fabric || original === glove || original === rubber;
      copy.envMap = environment; copy.envMapIntensity = cloth ? .8 : 1.35;
      copy.bumpMap = cloth ? clothSurface : metalSurface; copy.bumpScale = cloth ? .0014 : .00035;
      copy.roughnessMap = cloth ? clothSurface : metalSurface;
      copy.map = cloth ? clothSurface : metalSurface;
      copy.color.multiplyScalar(cloth ? 1.4 : 1.35);
      copy.emissive.copy(copy.color); copy.emissiveIntensity = cloth ? .10 : .045;
      material = copy; clones.set(original, material);
    }
    o.material = material;
    o.castShadow = false;
  });
}

function buildRifle(parent: THREE.Object3D, detailed: boolean) {
  const rifle = new THREE.Group(); parent.add(rifle);
  // Forged receiver with a narrow top spine and faceted upper surface.
  box(rifle, 0, 0, -.29, .079, .092, .275, graphite, .007);
  box(rifle, 0, .039, -.305, .066, .038, .295, black, .008);
  box(rifle, 0, -.041, -.26, .064, .049, .168, black, .004);
  box(rifle, .043, .009, -.273, .007, .036, .11, black, .003);
  box(rifle, .049, .015, -.284, .006, .014, .069, edge, .002);
  box(rifle, .055, -.004, -.213, .008, .012, .035, graphite, .002);
  cylinder(rifle, .048, -.025, -.338, .008, .008, edge, 'x');
  cylinder(rifle, .048, -.027, -.193, .006, .008, black, 'x');
  box(rifle, .05, -.037, -.174, .014, .006, .028, edge, .002).rotation.x = -.25;
  // Charging handle, buffer tube, and skeletal adjustable stock.
  cylinder(rifle, 0, .011, -.058, .023, .19, graphite);
  box(rifle, 0, .049, -.161, .102, .014, .022, black, .003);
  box(rifle, 0, -.015, .035, .081, .088, .135, black, .013);
  box(rifle, 0, -.06, .092, .086, .145, .023, rubber, .005).rotation.x = -.1;
  box(rifle, 0, -.064, .017, .046, .021, .11, graphite, .005).rotation.x = -.18;
  box(rifle, .044, -.017, .04, .008, .028, .067, rubber, .003);
  box(rifle, -.044, -.017, .04, .008, .028, .067, rubber, .003);
  const grip = box(rifle, 0, -.1, -.166, .051, .122, .061, rubber, .009);
  grip.rotation.x = -.32;
  for (let i = 0; i < 5; i++) box(rifle, .026, -.072 - i * .014, -.165 + i * .004, .003, .006, .045, glove, .001);
  // Curved magazine built as a continuous swept silhouette, with pressed ribs.
  const mag = new THREE.Group(); mag.position.set(0, -.067, -.312); mag.rotation.x = -.08; rifle.add(mag);
  box(mag, 0, -.073, .006, .057, .147, .088, graphite, .007).rotation.x = -.11;
  box(mag, 0, -.144, .018, .058, .043, .086, graphite, .006).rotation.x = -.25;
  box(mag, 0, -.166, .024, .064, .013, .094, rubber, .002).rotation.x = -.25;
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) box(mag, side * .030, -.083, -.024 + i * .025, .003, .106, .006, black, .001).rotation.x = -.11;
  }
  tube(rifle, [[-.026, -.05, -.25], [-.027, -.09, -.242], [-.027, -.092, -.2], [-.025, -.062, -.19]], .005, black);
  box(rifle, 0, -.065, -.227, .006, .027, .009, edge, .002).rotation.x = .35;
  // Long, tapered free-floating M-LOK handguard and exposed barrel.
  box(rifle, 0, .006, -.551, .077, .084, .255, black, .012);
  box(rifle, 0, .01, -.664, .067, .077, .032, graphite, .007);
  cylinder(rifle, 0, .008, -.722, .012, .12, edge, 'z', 16);
  cylinder(rifle, 0, .008, -.81, .023, .135, graphite, 'z', 20);
  cylinder(rifle, 0, .008, -.879, .025, .012, black, 'z', 20);
  cylinder(rifle, 0, .008, -.886, .011, .003, rubber, 'z', 16);
  for (let i = 0; i < 6; i++) cylinder(rifle, 0, .008, -.752 - i * .021, .0237, .005, black, 'z', 20);
  for (const side of [-1, 1]) {
    for (let i = 0; i < 5; i++) {
      box(rifle, side * .039, .019, -.46 - i * .043, .002, .011, .027, rubber, .002);
      box(rifle, side * .036, -.019, -.46 - i * .043, .003, .007, .025, graphite, .001);
    }
  }
  box(rifle, 0, .055, -.419, .042, .014, .5, graphite, .002);
  for (let i = 0; i < (detailed ? 27 : 14); i++) box(rifle, 0, .066, -.181 - i * (detailed ? .018 : .035), .049, .011, .009, black, .001);
  box(rifle, 0, -.049, -.57, .039, .02, .122, rubber, .004);
  const forwardGrip = box(rifle, 0, -.085, -.545, .039, .07, .046, rubber, .007);
  forwardGrip.rotation.x = -.26;
  // Compact open reflex optic: the center remains clear when aiming.
  box(rifle, 0, .082, -.323, .047, .027, .071, black, .004);
  box(rifle, 0, .10, -.324, .05, .012, .058, graphite, .002);
  const optic = new THREE.Group(); optic.position.set(0, .133, -.334); rifle.add(optic);
  for (const z of [-.025, .025]) {
    const ring = mesh(optic, new THREE.TorusGeometry(.03, .006, 6, 12), graphite, 0, 0, z);
    ring.scale.y = .93;
  }
  box(optic, -.032, 0, 0, .009, .022, .055, black, .003);
  box(optic, .032, 0, 0, .009, .022, .055, black, .003);
  box(optic, 0, .029, 0, .04, .01, .053, black, .002);
  cylinder(optic, .039, -.015, .001, .012, .014, black, 'x', 12);
  const glass = new THREE.MeshBasicMaterial({ color: 0x63bcae, transparent: true, opacity: .065, depthWrite: false, side: THREE.DoubleSide });
  mesh(optic, new THREE.CircleGeometry(.026, 24), glass, 0, 0, -.021);
  const dotMaterial = new THREE.MeshBasicMaterial({ color: 0xff6544, transparent: true, opacity: .85, toneMapped: false });
  mesh(optic, new THREE.CircleGeometry(.0017, 10), dotMaterial, 0, 0, -.023);
  if (detailed) {
    // Bolts, a side-mounted weapon light, cable, steel sling attachment, and stamps.
    for (const z of [-.18, -.397, -.439, -.649]) {
      cylinder(rifle, .043, -.02, z, .0045, .003, edge, 'x', 6);
      box(rifle, .045, -.02, z, .001, .0012, .004, black);
    }
    cylinder(rifle, .058, -.004, -.573, .019, .115, graphite);
    cylinder(rifle, .058, -.004, -.636, .024, .022, black);
    cylinder(rifle, .058, -.004, -.648, .016, .002, edge);
    box(rifle, .043, -.003, -.558, .033, .029, .035, black, .003);
    tube(rifle, [[.07, 0, -.521], [.081, .04, -.50], [.063, .05, -.46], [.041, .046, -.494]], .0025, rubber);
    tube(rifle, [[-.044, -.025, -.19], [-.073, -.115, -.32], [-.066, -.139, -.56], [-.04, -.027, -.647]], .006, glove);
    label(rifle, 'BL / MK18', .041, .008, -.343, .075, .018).rotation.y = Math.PI / 2;
    label(rifle, '5.56 NATO', .041, -.025, -.29, .045, .009).rotation.y = Math.PI / 2;
    for (let i = 0; i < 3; i++) box(rifle, .04, .006, -.405 - i * .008, .001, .009, .002, tan);
  }
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, .008, -.9); rifle.add(muzzle);
  return { rifle, mag, muzzle };
}

export function createWeapon(camera: THREE.Camera): { group: THREE.Group; muzzle: THREE.Object3D; update: (dt: number, opts: WeaponState) => void; flash: () => void } {
  const group = new THREE.Group(); group.name = 'MK18 / first person'; camera.add(group);
  const { rifle, mag, muzzle } = buildRifle(group, true);
  group.position.set(.245, -.254, -.11);
  const arms = new THREE.Group(); rifle.add(arms);
  capsuleBetween(arms, new THREE.Vector3(.29, -.31, .12), new THREE.Vector3(.077, -.135, -.11), .059, fabric);
  capsuleBetween(arms, new THREE.Vector3(-.29, -.29, .05), new THREE.Vector3(-.072, -.10, -.528), .053, fabric);
  const rightHand = box(arms, .015, -.095, -.14, .09, .074, .097, glove, .016);
  rightHand.rotation.z = -.12; rightHand.rotation.x = -.3;
  const leftHand = box(arms, -.012, -.066, -.551, .10, .062, .098, glove, .014);
  leftHand.rotation.z = -.2;
  box(arms, .07, -.147, -.088, .092, .028, .06, rubber, .005).rotation.z = -.4;
  box(arms, -.085, -.115, -.48, .081, .034, .06, rubber, .005).rotation.x = -.4;
  box(arms, -.10, -.102, -.48, .04, .011, .039, black, .004).rotation.z = -.3;
  box(arms, -.102, -.094, -.48, .027, .004, .026, edge, .003).rotation.z = -.3;
  for (let i = 0; i < 4; i++) {
    box(arms, .035, -.076 - i * .013, -.167, .04, .012, .024, glove, .003);
    box(arms, -.047 + i * .026, -.049, -.568, .02, .019, .057, rubber, .005);
  }
  // Creased sleeves, seam tapes and a separate cuff break up the arm silhouette.
  for (let i = 0; i < 5; i++) {
    const crease = box(arms, -.136 - i * .018, -.144 - i * .016, -.354 + i * .055, .102, .012, .019, glove, .004);
    crease.rotation.set(.40, -.25, -.20);
  }
  const sleevePatch = box(arms, -.179, -.163, -.23, .060, .009, .105, fabric, .005);
  sleevePatch.rotation.z = -.34; sleevePatch.rotation.y = -.28;
  tube(arms, [[-.096, -.080, -.462], [-.13, -.111, -.35], [-.19, -.169, -.19], [-.245, -.21, -.02]], .002, tan);
  // Keep the magazine independent; all other rigid weapon parts become material batches.
  mag.removeFromParent();
  mergeRigid(rifle, true);
  rifle.add(mag); mergeRigid(mag, true);
  weaponSurfaceMaterials(rifle);
  const flashMaterial = new THREE.MeshBasicMaterial({ color: 0xffdb96, transparent: true, opacity: .9, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false });
  const flashGroup = new THREE.Group(); muzzle.add(flashGroup); flashGroup.visible = false;
  const core = mesh(flashGroup, new THREE.ConeGeometry(.045, .22, 7, 1, true), flashMaterial, 0, 0, -.1); core.rotation.x = -Math.PI / 2;
  const halo = mesh(flashGroup, new THREE.ConeGeometry(.073, .13, 5, 1, true), flashMaterial, 0, 0, -.07); halo.rotation.x = -Math.PI / 2;
  let flashTime = 0;
  let aim = 0;
  let sprint = 0;
  let phase = 0;
  return {
    group, muzzle,
    flash: () => { flashTime = .058; flashGroup.rotation.z = Math.random() * Math.PI * 2; },
    update: (dt, opts) => {
      const blend = 1 - Math.exp(-dt * 13);
      aim = THREE.MathUtils.lerp(aim, opts.aiming && !opts.sprinting && !opts.reload ? 1 : 0, blend);
      sprint = THREE.MathUtils.lerp(sprint, opts.sprinting ? 1 : 0, blend);
      phase += dt * (opts.sprinting ? 13 : 9);
      const movement = Math.min(1, opts.moving) * (1 - aim * .82);
      const bobX = Math.sin(phase) * .008 * movement;
      const bobY = Math.abs(Math.cos(phase)) * .008 * movement;
      const reload = opts.reload > 0 ? Math.sin(Math.PI * opts.reload) : 0;
      group.position.set(
        THREE.MathUtils.lerp(.245, 0, aim) + bobX - reload * .07,
        THREE.MathUtils.lerp(-.254, -.133, aim) - bobY - sprint * .065 - reload * .13,
        THREE.MathUtils.lerp(-.11, -.075, aim) + opts.recoil * .052 + reload * .08,
      );
      group.rotation.set(opts.recoil * .045 + sprint * .18 + reload * .34, .055 * (1 - aim) + sprint * -.28, -.025 * (1 - aim) + bobX * .55 + sprint * -.23 + reload * -.60);
      group.position.y += Math.sin(opts.time * 1.8) * .0008 * (1 - aim);
      mag.position.y = -.067 - (opts.reload > .18 && opts.reload < .76 ? Math.sin((opts.reload - .18) / .58 * Math.PI) * .21 : 0);
      mag.rotation.x = -.08 - reload * .08;
      flashTime = Math.max(0, flashTime - dt);
      flashGroup.visible = flashTime > 0;
    },
  };
}

export function createEnemy(scene: THREE.Scene): { group: THREE.Group; hitMeshes: THREE.Object3D[]; update: (dt: number, opts: EnemyState) => void } {
  const group = new THREE.Group(); group.name = 'BLACKLINE / hostile operator'; scene.add(group);
  const rig = new THREE.Group(); group.add(rig);
  const hitMeshes: THREE.Object3D[] = [];
  const suit = new THREE.MeshStandardMaterial({ color: 0x323e3d, roughness: 1 });
  const armor = new THREE.MeshStandardMaterial({ color: 0x444f4c, roughness: .78, metalness: .23 });
  const webbing = new THREE.MeshStandardMaterial({ color: 0x676953, roughness: 1 });
  const torso = new THREE.Group(); torso.position.y = 1.13; rig.add(torso);
  box(torso, 0, .105, 0, .43, .48, .245, suit, .065);
  box(torso, 0, .09, -.138, .35, .35, .083, armor, .035);
  box(torso, 0, .10, .144, .31, .34, .103, armor, .026);
  box(torso, 0, .10, -.187, .24, .26, .012, graphite, .016);
  box(torso, 0, .227, -.187, .25, .025, .017, webbing, .004);
  box(torso, 0, .125, -.197, .13, .025, .009, black, .002);
  for (const x of [-.139, -.047, .047, .139]) {
    box(torso, x, -.025, -.215, .077, .132, .067, webbing, .012);
    box(torso, x, .02, -.252, .061, .026, .006, fabric, .002);
  }
  for (const x of [-.153, .153]) {
    box(torso, x, .241, -.066, .063, .10, .26, webbing, .012).rotation.z = x * -.3;
    box(torso, x, -.195, -.012, .097, .156, .13, webbing, .015);
  }
  box(torso, 0, -.17, .005, .39, .055, .285, black, .01);
  box(torso, 0, -.17, -.147, .066, .045, .014, graphite, .006);
  box(torso, .13, .145, .224, .094, .14, .04, black, .007);
  cylinder(torso, .16, .28, .215, .006, .2, rubber, 'y', 6);
  tube(torso, [[.12, .17, .23], [.18, .28, .10], [.18, .3, -.08], [.13, .15, -.22]], .008, rubber);
  box(torso, -.23, .105, -.012, .017, .079, .106, red, .004);
  box(torso, -.237, .105, -.013, .006, .015, .084, tan, .001);
  const neck = cylinder(torso, 0, .39, 0, .068, .085, glove, 'y'); hitMeshes.push(neck);
  const head = new THREE.Group(); head.position.set(0, .486, -.008); torso.add(head);
  const skull = mesh(head, new THREE.SphereGeometry(.122, 14, 10), glove, 0, -.019, 0); skull.scale.set(.88, 1.13, .96);
  const helmet = mesh(head, new THREE.SphereGeometry(.143, 16, 10, 0, Math.PI * 2, 0, Math.PI * .65), armor, 0, .028, .012); helmet.scale.set(.94, .88, 1.03);
  box(head, 0, .035, -.128, .247, .023, .047, graphite, .008);
  box(head, 0, -.013, -.116, .209, .066, .043, black, .015);
  box(head, 0, -.012, -.141, .183, .043, .011, amber, .011);
  box(head, 0, -.081, -.105, .144, .088, .059, glove, .017);
  box(head, 0, -.079, -.139, .092, .054, .021, black, .009);
  for (let i = -1; i <= 1; i++) box(head, i * .025, -.075, -.152, .006, .025, .003, graphite, .001);
  box(head, 0, .121, -.055, .043, .032, .076, black, .006);
  for (const side of [-1, 1]) {
    cylinder(head, side * .125, -.018, .009, .05, .03, black, 'x', 10);
    box(head, side * .132, .053, .014, .017, .028, .128, graphite, .005);
    box(head, side * .107, .062, -.076, .022, .029, .045, webbing, .003);
  }
  tube(head, [[-.141, -.032, -.008], [-.158, -.07, -.06], [-.098, -.092, -.143]], .007, black);
  head.traverse(o => { if (o instanceof THREE.Mesh) { o.userData.head = true; hitMeshes.push(o); } });
  const pelvis = box(rig, 0, .916, .0, .33, .22, .245, suit, .04); hitMeshes.push(pelvis);
  const legs: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group(); leg.position.set(side * .107, .92, 0); rig.add(leg); legs.push(leg);
    capsuleBetween(leg, new THREE.Vector3(0, -.04, 0), new THREE.Vector3(side * .019, -.36, -.015), .09, suit);
    capsuleBetween(leg, new THREE.Vector3(side * .019, -.38, -.015), new THREE.Vector3(side * .029, -.72, .016), .073, suit);
    box(leg, side * .019, -.41, -.082, .132, .153, .058, armor, .023);
    box(leg, side * .014, -.406, -.116, .077, .086, .012, graphite, .01);
    box(leg, side * .029, -.811, -.045, .158, .185, .258, black, .021);
    box(leg, side * .029, -.897, -.046, .167, .022, .269, rubber, .003);
    box(leg, side * .10, -.16, .009, .052, .183, .13, webbing, .012);
    box(leg, 0, -.27, 0, .189, .034, .17, black, .004);
    leg.traverse(o => { if (o instanceof THREE.Mesh) hitMeshes.push(o); });
  }
  const arms: THREE.Group[] = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group(); arm.position.set(side * .245, .252, 0); torso.add(arm); arms.push(arm);
    capsuleBetween(arm, new THREE.Vector3(0, -.005, 0), new THREE.Vector3(side * .035, -.253, -.06), .073, suit);
    box(arm, side * .018, -.063, 0, .156, .16, .183, armor, .025);
    capsuleBetween(arm, new THREE.Vector3(side * .035, -.253, -.06), new THREE.Vector3(-side * .13, -.21, -.332), .062, suit);
    box(arm, -side * .13, -.207, -.341, .104, .085, .12, glove, .016);
    box(arm, side * .026, -.239, -.049, .113, .101, .111, graphite, .016);
    if (side === -1) box(arm, -.058, -.072, -.098, .079, .064, .011, red, .002);
    arm.traverse(o => { if (o instanceof THREE.Mesh) hitMeshes.push(o); });
  }
  const weapon = new THREE.Group(); weapon.position.set(.103, .076, -.309); weapon.rotation.x = -.025; torso.add(weapon);
  const { rifle: enemyRifle, muzzle } = buildRifle(weapon, false); weapon.scale.setScalar(.82);
  // Broad body meshes are included for reliable picking through gaps between armor pouches.
  torso.children.forEach(o => { if (o instanceof THREE.Mesh && !hitMeshes.includes(o)) hitMeshes.push(o); });
  mergeEnemyRigid(enemyRifle, true);
  mergeEnemyRigid(torso);
  mergeEnemyRigid(head, true);
  legs.forEach(leg => mergeEnemyRigid(leg));
  arms.forEach(arm => mergeEnemyRigid(arm));
  hitMeshes.length = 0;
  rig.traverse(o => { if (o instanceof THREE.Mesh) hitMeshes.push(o); });
  head.traverse(o => { if (o instanceof THREE.Mesh) o.userData.head = true; });
  const flashMaterial = new THREE.MeshBasicMaterial({ color: 0xffc170, transparent: true, opacity: .92, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const muzzleFlash = mesh(muzzle, new THREE.OctahedronGeometry(.078), flashMaterial, 0, 0, -.075); muzzleFlash.scale.z = 2.5; muzzleFlash.visible = false;
  let death = 0;
  let walk = 0;
  return {
    group, hitMeshes,
    update: (dt, opts) => {
      death = THREE.MathUtils.damp(death, opts.dead ? 1 : 0, opts.dead ? 5 : 20, dt);
      walk = THREE.MathUtils.damp(walk, opts.moving && !opts.dead ? 1 : 0, 9, dt);
      const stride = Math.sin(opts.time * 8.5);
      legs[0].rotation.x = stride * .49 * walk;
      legs[1].rotation.x = -stride * .49 * walk;
      torso.position.y = 1.13 + Math.abs(Math.cos(opts.time * 8.5)) * .025 * walk;
      torso.rotation.y = stride * .035 * walk;
      arms[0].rotation.x = stride * .04 * walk;
      arms[1].rotation.x = -stride * .04 * walk;
      head.rotation.y = Math.sin(opts.time * .9) * .035;
      rig.rotation.x = death * -1.45;
      rig.rotation.z = death * .19;
      rig.position.y = death * .14;
      torso.rotation.z = death * -.12;
      weapon.rotation.x = -.025 + (opts.firing ? Math.sin(opts.time * 65) * .021 : 0) + death * .35;
      muzzleFlash.visible = opts.firing && !opts.dead && Math.sin(opts.time * 47) > .45;
      muzzleFlash.rotation.z = opts.time * 15;
    },
  };
}
