import * as THREE from 'three';

// Paint conventions per CLAUDE.md: pearls/metallics are MeshPhysicalMaterial
// with clearcoat 1.0; wraps vary clearcoat/roughness by finish; color-flip
// approximated with iridescence. Hexes are daylight approximations.

export function createFactoryPaint({ hex, name }) {
  const metallic = /metallic/i.test(name);
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(hex),
    metalness: metallic ? 0.85 : 0.65,
    roughness: metallic ? 0.45 : 0.38,
    clearcoat: 1.0,
    clearcoatRoughness: metallic ? 0.1 : 0.06,
  });
}

export function createWrapMaterial({ hex, finish }) {
  const base = { color: new THREE.Color(hex), metalness: 0.2 };
  switch (finish) {
    case 'gloss':
      return new THREE.MeshPhysicalMaterial({
        ...base, roughness: 0.15, clearcoat: 1.0, clearcoatRoughness: 0.05,
      });
    case 'satin':
      return new THREE.MeshPhysicalMaterial({
        ...base, roughness: 0.35, clearcoat: 0.4, clearcoatRoughness: 0.25,
      });
    case 'matte':
      return new THREE.MeshPhysicalMaterial({
        ...base, roughness: 0.6, clearcoat: 0,
      });
    case 'color-flip':
      return new THREE.MeshPhysicalMaterial({
        ...base,
        metalness: 0.6,
        roughness: 0.3,
        clearcoat: 1.0,
        clearcoatRoughness: 0.06,
        iridescence: 0.9,
        iridescenceIOR: 1.6,
        iridescenceThicknessRange: [200, 600],
      });
    default:
      return new THREE.MeshPhysicalMaterial({ ...base, roughness: 0.3, clearcoat: 0.8 });
  }
}

// Meshes that take body color. Prefix match against the naming convention;
// spoiler/mirrors stay painted until the carbon phases override them.
const PAINTED_PREFIXES = [
  'body_paint', 'hood', 'front_bumper', 'rear_bumper',
  'front_lip', 'side_skirt', 'spoiler', 'mirror_',
];

export function isPaintedMesh(name) {
  return PAINTED_PREFIXES.some((p) => name.startsWith(p));
}

export function applyPaint(car, material) {
  let count = 0;
  car.traverse((node) => {
    if (node.isMesh && isPaintedMesh(node.name)) {
      node.material = material;
      count += 1;
    }
  });
  return count; // 0 means the model has not been mesh-renamed yet
}
