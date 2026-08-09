import { adaptFL5 } from './fl5.js';
import { findConnectedComponents, removeTriangles } from './splitGeometry.js';

// DE5-from-FL5 conversion. Step 1, the "de-Civic" pass: remove the loudest
// Civic tells. The DE5 Type S has no big wing (subtle ducktail; a proper one
// comes with the rear resculpt) and no Honda/CIVIC badging. The chassis
// label carries the honesty disclaimer ("approximation") into the HUD.
export function adaptDE5Approx(scene) {
  const car = adaptFL5(scene);
  removeWing(car);
  removeBadges(car);
  return car;
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
