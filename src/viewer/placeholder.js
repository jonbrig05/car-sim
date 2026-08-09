import * as THREE from 'three';

// Boxy stand-in for the DE5 at real dimensions (4674 mm long, 2735 mm
// wheelbase, 265/30ZR19 rolling diameter ~642 mm). Mesh names follow the
// CLAUDE.md naming convention and wheels get hub-centered origins, so the
// paint / stance / wheel-swap systems built against this proxy will work
// unchanged when the real GLB lands.
export function buildPlaceholderCar() {
  const car = new THREE.Group();
  car.name = 'car';

  const paint = new THREE.MeshPhysicalMaterial({
    color: 0xeceef0, // Platinum White Pearl, daylight approximation
    metalness: 0.7,
    roughness: 0.32,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
  });
  const black = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.6 });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x111418,
    metalness: 0,
    roughness: 0.05,
    clearcoat: 1.0,
  });
  const tire = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.9 });
  const rim = new THREE.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 0.9, roughness: 0.3 });

  const WHEEL_RADIUS = 0.321;
  const WHEEL_WIDTH = 0.265;
  const WHEELBASE = 2.735;
  const TRACK = 1.62;

  function box(name, material, w, h, d, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.name = name;
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    car.add(mesh);
    return mesh;
  }

  // z+ is the nose. Body sits at ride height leaving room for wheel gap.
  box('body_paint', paint, 1.88, 0.52, 4.55, 0, 0.55, 0);
  box('hood', paint, 1.7, 0.06, 1.1, 0, 0.84, 1.45);
  box('front_bumper', paint, 1.9, 0.4, 0.25, 0, 0.45, 2.28);
  box('rear_bumper', paint, 1.9, 0.4, 0.2, 0, 0.45, -2.28);
  box('trim_black', black, 1.86, 0.14, 4.55, 0, 0.24, 0);

  const cabin = box('glass', glass, 1.6, 0.42, 2.0, 0, 1.08, -0.25);
  cabin.scale.set(1, 1, 1); // kept separate so interior phases can hide it

  const roof = box('body_paint_roof', paint, 1.55, 0.05, 1.7, 0, 1.31, -0.3);
  roof.castShadow = true;

  // Triple center exhaust: the DE5 signature. Never outboard duals.
  const tips = new THREE.Group();
  tips.name = 'exhaust_tips';
  const tipGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.12, 24);
  const tipMat = new THREE.MeshStandardMaterial({ color: 0x8a8a8e, metalness: 1, roughness: 0.25 });
  [-0.14, 0, 0.14].forEach((x, i) => {
    const tip = new THREE.Mesh(tipGeo, tipMat);
    tip.rotation.x = Math.PI / 2;
    tip.position.set(x, i === 1 ? 0.02 : 0, 0);
    tips.add(tip);
  });
  tips.position.set(0, 0.3, -2.36);
  car.add(tips);

  // Wheels: group origin at hub center so swaps / offset / diameter changes
  // are pure transforms.
  const wheelGeo = new THREE.CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, WHEEL_WIDTH, 32);
  const rimGeo = new THREE.CylinderGeometry(WHEEL_RADIUS * 0.62, WHEEL_RADIUS * 0.62, WHEEL_WIDTH + 0.02, 24);
  const positions = [
    ['wheel_FL', -TRACK / 2, WHEELBASE / 2],
    ['wheel_FR', TRACK / 2, WHEELBASE / 2],
    ['wheel_RL', -TRACK / 2, -WHEELBASE / 2],
    ['wheel_RR', TRACK / 2, -WHEELBASE / 2],
  ];
  for (const [name, x, z] of positions) {
    const hub = new THREE.Group();
    hub.name = name;
    hub.position.set(x, WHEEL_RADIUS, z);

    const tyre = new THREE.Mesh(wheelGeo, tire);
    tyre.rotation.z = Math.PI / 2;
    tyre.castShadow = true;
    hub.add(tyre);

    const face = new THREE.Mesh(rimGeo, rim);
    face.rotation.z = Math.PI / 2;
    hub.add(face);

    car.add(hub);
  }

  return car;
}
