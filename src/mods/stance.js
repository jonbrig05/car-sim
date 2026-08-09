import * as THREE from 'three';

const IN_TO_M = 0.0254;
const WHEELBASE_M = 2.735;

// Lowering is modeled as the body dropping toward the wheels, which stay on
// the ground. Everything that is not a wheel gets reparented once into a
// body group; drops (with rake) are then pure transforms on that group.
export function ensureBodyGroup(car) {
  let body = car.getObjectByName('body_group');
  if (body) return body;

  body = new THREE.Group();
  body.name = 'body_group';
  const rest = car.children.filter((c) => !c.name.startsWith('wheel_') && c !== body);
  for (const child of rest) body.add(child); // add() reparents in place
  car.add(body);
  return body;
}

// dropFrontIn / dropRearIn are positive inches of lowering (DB convention).
export function applyStance(car, { dropFrontIn = 0, dropRearIn = 0 }) {
  const body = ensureBodyGroup(car);
  const f = dropFrontIn * IN_TO_M;
  const r = dropRearIn * IN_TO_M;
  body.position.y = -(f + r) / 2;
  // Small-angle pitch about the car center; nose is +z, so a bigger front
  // drop pitches the nose down.
  body.rotation.x = (f - r) / WHEELBASE_M;
}
