import * as THREE from 'three';
import { splitMeshByCentroid } from './splitGeometry.js';

// Adapter for the Sketchfab FL5 by Mona x Supercars (@Car2022, CC-BY).
// The raw GLB is one flat list of meshes split by material (Object_N with
// material names like Paintid..., Rimid..., Tyre...), all four wheels fused
// per mesh, Z-up baked via a root rotation, arbitrary units, off-origin.
// This adapter renames meshes to the CLAUDE.md convention, splits wheels
// into hub-centered wheel_FL/FR/RL/RR groups, and normalizes scale and
// origin, so paint/stance/wheel systems work on the raw download.

const FL5_LENGTH_M = 4.595;

// Material name prefix -> convention mesh name. Lamp and wheel materials are
// handled separately (they need front/rear or per-corner splits).
const MATERIAL_NAMES = [
  ['Paint', 'body_paint'],
  ['Body01', 'interior_baked'], // baked cabin card seen through the glass
  ['Body02', 'body_antenna'],
  ['Trim', 'trim_black'],
  ['Windshield', 'glass'],
];

const WHEEL_MATERIALS = ['Rim', 'Tyre', 'Discbrake', 'Caliper'];
const LAMP_MATERIAL = 'Lamp';

function bakeWorldTransforms(scene) {
  scene.updateMatrixWorld(true);
  const flat = new THREE.Group();
  flat.name = 'car';
  const meshes = [];
  scene.traverse((node) => {
    if (node.isMesh) meshes.push(node);
  });
  for (const mesh of meshes) {
    mesh.geometry.applyMatrix4(mesh.matrixWorld);
    mesh.position.set(0, 0, 0);
    mesh.quaternion.identity();
    mesh.scale.set(1, 1, 1);
    flat.add(mesh);
  }
  flat.updateMatrixWorld(true);
  return flat;
}

export function adaptFL5(scene) {
  const car = bakeWorldTransforms(scene);

  // Normalize: uniform scale so length (z) is real, ground at y=0, centered
  // in x/z. The source nose points -z, so flip 180 around y at the same time
  // (convention: +z is the nose). Baked directly into the geometry.
  const box = new THREE.Box3().setFromObject(car);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const s = FL5_LENGTH_M / size.z;
  const normalize = new THREE.Matrix4()
    .makeRotationY(Math.PI)
    .multiply(new THREE.Matrix4().makeScale(s, s, s))
    .multiply(new THREE.Matrix4().makeTranslation(-center.x, -box.min.y, -center.z));
  for (const mesh of car.children) mesh.geometry.applyMatrix4(normalize);
  car.updateMatrixWorld(true);

  // Classify meshes by material name.
  const wheelSource = [];
  const lampSource = [];
  for (const mesh of [...car.children]) {
    const mat = mesh.material?.name ?? '';
    if (WHEEL_MATERIALS.some((p) => mat.startsWith(p))) {
      wheelSource.push(mesh);
    } else if (mat.startsWith(LAMP_MATERIAL)) {
      lampSource.push(mesh);
    } else {
      const hit = MATERIAL_NAMES.find(([p]) => mat.startsWith(p));
      if (hit) mesh.name = uniqueName(car, hit[1]);
    }
  }

  splitWheels(car, wheelSource);
  splitLamps(car, lampSource);

  car.traverse((node) => {
    if (node.isMesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
  return car;
}

function uniqueName(car, base) {
  if (!car.getObjectByName(base)) return base;
  let i = 2;
  while (car.getObjectByName(`${base}_${i}`)) i += 1;
  return `${base}_${i}`;
}

// The wheel-ish materials are not clean: "Rimbadge" also holds the grille and
// hatch badges, "Tyre" includes arch liners, "Rim" has stray body geometry.
// So instead of trusting materials, locate the four wheel centers from the
// pure tire meshes (ground-touching, wheel-height), then capture only the
// triangles inside a wheel-sized cylinder around each hub. Captured geometry
// becomes hub-centered wheel_FL/FR/RL/RR groups; the rest stays on the body.
function splitWheels(car, wheelSource) {
  if (!wheelSource.length) return;

  const corner = (p) => `${p.z > 0 ? 'F' : 'R'}${p.x < 0 ? 'L' : 'R'}`;

  // Pure tires: Tyre-material meshes whose bounds sit on the ground and stay
  // under wheel height. Their per-quadrant bounds give hub center + radius.
  const tireBoxes = { FL: new THREE.Box3(), FR: new THREE.Box3(), RL: new THREE.Box3(), RR: new THREE.Box3() };
  const v = new THREE.Vector3();
  for (const mesh of wheelSource) {
    if (!mesh.material.name.startsWith('Tyre')) continue;
    mesh.geometry.computeBoundingBox();
    const b = mesh.geometry.boundingBox;
    if (b.min.y > 0.1 || b.max.y > 0.7) continue;
    const pos = mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i += 1) {
      v.fromBufferAttribute(pos, i);
      tireBoxes[corner(v)].expandByPoint(v);
    }
  }

  const hubs = {};
  const radii = {};
  for (const key of ['FL', 'FR', 'RL', 'RR']) {
    const group = new THREE.Group();
    group.name = `wheel_${key}`;
    group.position.copy(tireBoxes[key].getCenter(new THREE.Vector3()));
    radii[key] = (tireBoxes[key].max.y - tireBoxes[key].min.y) / 2;
    car.add(group);
    hubs[key] = group;
  }

  // Capture cylinder per corner: along the wheel (x) axis, slightly larger
  // than the tire, reaching from outer face past the caliper inboard.
  const captures = (p) => {
    for (const key of ['FL', 'FR', 'RL', 'RR']) {
      const h = hubs[key].position;
      const dy = p.y - h.y;
      const dz = p.z - h.z;
      if (Math.abs(p.x - h.x) < 0.35 && Math.hypot(dy, dz) < radii[key] * 1.2) return key;
    }
    return 'body';
  };

  const PART_NAMES = [
    ['Rimbadge', 'rim_badge', 'badges'],
    ['Rim', 'rim', 'trim_metal'],
    ['Tyre', 'tire', 'arch_liner'], // NOT wheel_*: stance must treat arches as body
    ['Discbrake', 'brake_disc', 'brake_misc'],
    ['Caliper', 'brake_caliper', 'brake_misc'],
  ];

  for (const mesh of wheelSource) {
    const [, part, restName] = PART_NAMES.find(([p]) => mesh.material.name.startsWith(p)) ?? [null, 'wheel_part', 'body_misc'];
    const pieces = splitMeshByCentroid(mesh, captures);
    for (const [key, geometry] of pieces) {
      if (key === 'body') {
        const rest = new THREE.Mesh(geometry, mesh.material);
        rest.name = uniqueName(car, restName);
        car.add(rest);
        continue;
      }
      const hub = hubs[key];
      // Re-express world-space geometry relative to the hub origin.
      geometry.translate(-hub.position.x, -hub.position.y, -hub.position.z);
      const piece = new THREE.Mesh(geometry, mesh.material);
      piece.name = uniqueName(car, `${part}_${key}`);
      hub.add(piece);
    }
    car.remove(mesh);
    mesh.geometry.dispose();
  }
}

// Lamp materials span both ends of the car (lens/reflector layers). Split
// front/rear at the car midpoint: +z half is headlight, -z is taillight.
function splitLamps(car, lampSource) {
  for (const mesh of lampSource) {
    const pieces = splitMeshByCentroid(mesh, (p) => (p.z > 0 ? 'headlight' : 'taillight'));
    if (pieces.size === 1) {
      // Single-ended lamp (e.g. the rear light bar): rename in place.
      mesh.name = uniqueName(car, pieces.keys().next().value);
      for (const geo of pieces.values()) geo.dispose();
      continue;
    }
    for (const [key, geometry] of pieces) {
      const piece = new THREE.Mesh(geometry, mesh.material);
      piece.name = uniqueName(car, key);
      car.add(piece);
    }
    car.remove(mesh);
    mesh.geometry.dispose();
  }
}
