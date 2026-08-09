import * as THREE from 'three';
import { adaptFL5 } from './fl5.js';
import { findConnectedComponents, removeTriangles } from './splitGeometry.js';
import { buildFrontSurfacePanel, scaleOutline } from './surfacePanel.js';

// DE5-from-FL5 conversion. Step 1, the "de-Civic" pass: remove the loudest
// Civic tells. The DE5 Type S has no big wing (subtle ducktail; a proper one
// comes with the rear resculpt) and no Honda/CIVIC badging. The chassis
// label carries the honesty disclaimer ("approximation") into the HUD.
export function adaptDE5Approx(scene) {
  const car = adaptFL5(scene);
  removeWing(car);
  removeBadges(car);
  reshapeGrille(car);
  reshapeRear(car);
  return car;
}

// DE5 rear approximation: an emissive lightbar projected onto the hatch
// face (the model's own garnish strip lives in a shadowed groove, unusable),
// riding over the smoked corner clusters so it spans the full width. The
// Civic clusters become translucent smoked lenses, muting their L-shaped
// signature while keeping lens depth.
const LIGHTBAR = [
  { x: -0.72, y: 0.925 },
  { x: 0.72, y: 0.925 },
  { x: 0.78, y: 0.895 },
  { x: 0.72, y: 0.865 },
  { x: -0.72, y: 0.865 },
  { x: -0.78, y: 0.895 },
];

function reshapeRear(car) {
  const smoke = new THREE.MeshPhysicalMaterial({
    color: 0x150a0c,
    roughness: 0.22,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    transparent: true,
    opacity: 0.45,
  });
  for (const name of ['taillight', 'taillight_2', 'taillight_3']) {
    const mesh = car.getObjectByName(name);
    if (mesh) mesh.material = smoke;
  }

  const targets = ['body_paint', 'trim_black', 'trim_black_2', 'taillight', 'taillight_3']
    .map((n) => car.getObjectByName(n))
    .filter(Boolean);
  buildFrontSurfacePanel(car, LIGHTBAR, {
    facing: 'rear',
    offset: 0.008,
    zBand: [-2.35, -1.8],
    zFallback: -2.1,
    name: 'taillight_bar',
    targets,
    material: new THREE.MeshPhysicalMaterial({
      color: 0x2a0407,
      emissive: new THREE.Color(0xd0182a),
      emissiveIntensity: 2.2,
      roughness: 0.2,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
    }),
  });
}

// Acura "diamond pentagon" grille, approximated as surface-conforming
// overlays: a body-color cover hides the FL5's slot-shaped upper grille,
// a black pentagon reads as the new opening, and a body-color frame ring
// gives it a crisp outline. body_paint_* names opt the panels into the
// paint system. Coordinates are car space: x right, y up, nose +z.
// Measured on the model: FL5 upper slot spans y 0.545-0.68 at the nose, the
// body-color bar above it 0.68-0.80 (hood lip starts curving back ~0.72).
// The pentagon runs slightly taller than the slot, per the DE5's face.
const PENTAGON = [
  { x: -0.28, y: 0.70 },
  { x: 0.28, y: 0.70 },
  { x: 0.33, y: 0.635 },
  { x: 0.15, y: 0.522 },
  { x: -0.15, y: 0.522 },
  { x: -0.33, y: 0.635 },
];
// Cover ends at x +-0.40 where the headlight LED clusters begin (measured);
// the dark lamp housing that shows beyond it reads as headlight, and the
// slot remnants under the lamps read as under-light shadow.
const GRILLE_COVER = [
  { x: -0.40, y: 0.705 },
  { x: 0.40, y: 0.705 },
  { x: 0.41, y: 0.62 },
  { x: 0.38, y: 0.505 },
  { x: -0.38, y: 0.505 },
  { x: -0.41, y: 0.62 },
];

function reshapeGrille(car) {
  const targets = ['body_paint', 'trim_black', 'trim_black_2']
    .map((n) => car.getObjectByName(n))
    .filter(Boolean);
  const bodyColor = () => new THREE.MeshPhysicalMaterial({
    color: 0xeceef0, clearcoat: 1.0, roughness: 0.35, metalness: 0.6,
  }); // replaced by applyPaint via the body_paint_ name prefix
  const grilleBlack = new THREE.MeshStandardMaterial({
    color: 0x0b0b0d, roughness: 0.85, side: THREE.DoubleSide,
  });

  // Sample several heights per x column and ride the front-most surface:
  // the slot's lower lip juts forward of the body bar in places.
  const SWEEP_Y = [0.53, 0.58, 0.64, 0.70];
  buildFrontSurfacePanel(car, GRILLE_COVER, {
    offset: 0.005, sweepY: SWEEP_Y,
    name: 'body_paint_grille_cover', material: bodyColor(), targets,
  });
  buildFrontSurfacePanel(car, PENTAGON, {
    offset: 0.010, sweepY: SWEEP_Y,
    name: 'grille_pentagon', material: grilleBlack, targets,
  });
  buildFrontSurfacePanel(car, scaleOutline(PENTAGON, 1.1), {
    fStart: 0.91, rings: 1, offset: 0.014, sweepY: SWEEP_Y,
    name: 'body_paint_grille_frame', material: bodyColor(), targets,
  });
}

// The wing is topologically separate geometry floating above the hatch:
// components entirely behind the rear glass, entirely above the hatch deck,
// and wing-sized in chord. The body shell fails on size, the hatch garnish
// and glass fail on position, so only wing pieces match.
function removeWing(car) {
  dropComponents(car, ['body_paint', 'trim_black', 'trim_black_2'], (b) =>
    b.min.y > 0.8 && b.max.z < -1.4 && b.max.z - b.min.z < 0.8);
}

// Badging is scattered across the model's materials (the grille H lives in a
// Lamp mesh, the TYPE R plate in trim), so remove by shape instead: small
// isolated components in the front/rear center badge zones. Real light
// elements span most of the car's width and fail the size test.
function removeBadges(car) {
  const badges = car.getObjectByName('badges');
  if (badges) {
    car.remove(badges);
    badges.geometry.dispose();
  }
  const small = (b) =>
    b.max.x - b.min.x < 0.45 && b.max.y - b.min.y < 0.3 && Math.abs(b.min.x + b.max.x) / 2 < 0.9;
  dropComponents(
    car,
    ['headlight', 'headlight_2', 'taillight', 'taillight_2', 'taillight_3',
      'trim_black', 'trim_black_2', 'interior_baked'],
    (b) => small(b)
      && ((b.min.z > 1.9 && b.min.y > 0.25 && b.max.y < 1.0) // nose zone
        || (b.max.z < -1.9 && b.min.y > 0.5 && b.max.y < 1.2)), // hatch zone
  );
}

function dropComponents(car, meshNames, predicate) {
  for (const name of meshNames) {
    const mesh = car.getObjectByName(name);
    if (!mesh) continue;
    const drop = new Set();
    for (const comp of findConnectedComponents(mesh.geometry)) {
      if (predicate(comp.box)) for (const t of comp.triangles) drop.add(t);
    }
    if (drop.size) removeTriangles(mesh.geometry, drop);
  }
}
