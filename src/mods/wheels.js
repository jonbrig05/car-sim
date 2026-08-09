import * as THREE from 'three';

// Procedural aftermarket wheels: every DB entry maps to a parametric style
// (spoke count/pairing/width/concavity) plus a finish material, built as
// geometry at swap time. No wheel asset files; diameter, width, and offset
// come from the DB strings. Stock rims/tires stay in the scene hidden so
// "Stock" restores them; brakes are untouched and show through the spokes.

const ROLLING_R = 0.321; // 265/30R19 and 265/35R18 share rolling diameter
const OEM_OFFSET = 60;

const STYLES = [
  [/split 5/i, { count: 5, pairGapDeg: 14, width: 0.015, thick: 0.024, concave: 0.3 }],
  [/split 10/i, { count: 10, pairGapDeg: 0, width: 0.018, thick: 0.022, concave: 0.35 }],
  [/6-spoke/i, { count: 6, pairGapDeg: 0, width: 0.036, thick: 0.03, concave: 0.4 }],
  [/10-spoke concave|slim 10-spoke/i, { count: 10, pairGapDeg: 0, width: 0.02, thick: 0.022, concave: 1.0 }],
  [/twin 5/i, { count: 5, pairGapDeg: 10, width: 0.02, thick: 0.024, concave: 0.3 }],
  [/12-spoke/i, { count: 12, pairGapDeg: 0, width: 0.013, thick: 0.02, concave: 0.45 }],
  [/10-spoke/i, { count: 10, pairGapDeg: 0, width: 0.02, thick: 0.022, concave: 0.5 }],
  [/5-spoke/i, { count: 5, pairGapDeg: 13, width: 0.018, thick: 0.026, concave: 0.5 }],
];

const FINISHES = [
  [/bronze|copper/i, { color: 0x8f6a33, metalness: 1.0, roughness: 0.32 }],
  [/gold/i, { color: 0x9c7c1e, metalness: 1.0, roughness: 0.3 }],
  [/white|ceramic/i, { color: 0xe8e8ea, metalness: 0.4, roughness: 0.38 }],
  [/silver|brushed|machine/i, { color: 0xb9bcc2, metalness: 1.0, roughness: 0.3 }],
  [/titanium|gunmetal|anthracite|grey|gray/i, { color: 0x5a5d63, metalness: 1.0, roughness: 0.35 }],
  [/blue/i, { color: 0x1f3f8f, metalness: 0.9, roughness: 0.3 }],
  [/red/i, { color: 0x8f1620, metalness: 0.9, roughness: 0.3 }],
  [/pink|sakura/i, { color: 0xd98fa6, metalness: 0.5, roughness: 0.35 }],
  [/black/i, { color: 0x121216, metalness: 0.9, roughness: 0.4 }],
];

export function parseWheel(item) {
  const [dia, width] = item.size.split('x').map(Number);
  const offset = Number((item.offset.match(/[+-]?\d+/) || [OEM_OFFSET])[0].replace('+', ''));
  const style = (STYLES.find(([re]) => re.test(item.style)) || STYLES[1])[1];
  const finishName = (item.finishes || [])[0] || 'black';
  const finish = (FINISHES.find(([re]) => re.test(finishName)) || FINISHES[8])[1];
  return {
    rimR: (dia * 0.0254) / 2,
    rimW: width * 0.0254,
    pokeM: (OEM_OFFSET - offset) / 1000,
    style,
    finish,
    finishName,
  };
}

// Wheel built face-out along +x (right-side orientation); left wheels get
// rotated pi around y by the caller.
export function buildWheel({ rimR, rimW, style, finish }) {
  const g = new THREE.Group();
  const rw = rimW / 2;
  const hw = 0.265 / 2;
  const bulge = Math.max(hw, rw + 0.008);
  const tread = hw * 0.58;
  const midR = (rimR + ROLLING_R) / 2 + 0.012;

  const rubber = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.92 });
  const metal = new THREE.MeshPhysicalMaterial({
    ...finish, clearcoat: 0.7, clearcoatRoughness: 0.15,
  });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1b1b1f, metalness: 0.8, roughness: 0.5 });

  // Tire: lathe profile bead -> sidewall bulge -> tread and back.
  const profile = [
    [rimR - 0.002, -rw],
    [midR, -bulge],
    [ROLLING_R - 0.006, -tread],
    [ROLLING_R, -tread * 0.75],
    [ROLLING_R, tread * 0.75],
    [ROLLING_R - 0.006, tread],
    [midR, bulge],
    [rimR - 0.002, rw],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const tireGeo = new THREE.LatheGeometry(profile, 48);
  tireGeo.rotateZ(-Math.PI / 2); // lathe axis y -> wheel axis x
  const tire = new THREE.Mesh(tireGeo, rubber);
  tire.castShadow = true;
  g.add(tire);

  // Barrel + outer lip.
  const barrelGeo = new THREE.CylinderGeometry(rimR, rimR, rimW, 40, 1, true);
  barrelGeo.rotateZ(-Math.PI / 2);
  const barrel = new THREE.Mesh(barrelGeo, new THREE.MeshPhysicalMaterial({
    ...finish, clearcoat: 0.7, clearcoatRoughness: 0.15, side: THREE.DoubleSide,
  }));
  g.add(barrel);

  const lipGeo = new THREE.TorusGeometry(rimR - 0.002, 0.008, 10, 40);
  lipGeo.rotateY(Math.PI / 2);
  lipGeo.translate(rw - 0.006, 0, 0);
  g.add(new THREE.Mesh(lipGeo, metal));

  // Spokes from hub to rim, optionally in pairs, tilted inboard for concave.
  const faceX = rw - 0.028;
  const hubX = faceX - style.concave * 0.055;
  const hubR = 0.062;
  const outR = rimR - 0.018;
  const angles = [];
  for (let i = 0; i < style.count; i += 1) {
    const base = (i / style.count) * Math.PI * 2;
    if (style.pairGapDeg > 0) {
      const half = (style.pairGapDeg / 2) * (Math.PI / 180);
      angles.push(base - half, base + half);
    } else {
      angles.push(base);
    }
  }
  const up = new THREE.Vector3(0, 1, 0);
  for (const a of angles) {
    const c = Math.cos(a);
    const s = Math.sin(a);
    const p0 = new THREE.Vector3(hubX, hubR * c, hubR * s);
    const p1 = new THREE.Vector3(faceX, outR * c, outR * s);
    const dir = p1.clone().sub(p0);
    const len = dir.length() + 0.02;
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(style.thick, len, style.width), metal);
    spoke.quaternion.setFromUnitVectors(up, dir.normalize());
    spoke.position.copy(p0.clone().add(p1).multiplyScalar(0.5));
    spoke.castShadow = true;
    g.add(spoke);
  }

  // Hub face + center cap.
  const hubGeo = new THREE.CylinderGeometry(hubR + 0.012, hubR + 0.012, 0.026, 28);
  hubGeo.rotateZ(-Math.PI / 2);
  hubGeo.translate(hubX, 0, 0);
  g.add(new THREE.Mesh(hubGeo, metal));

  const capGeo = new THREE.CylinderGeometry(0.032, 0.032, 0.03, 20);
  capGeo.rotateZ(-Math.PI / 2);
  capGeo.translate(hubX + 0.004, 0, 0);
  g.add(new THREE.Mesh(capGeo, darkMetal));

  return g;
}

const CORNERS = ['FL', 'FR', 'RL', 'RR'];

export function applyWheels(car, item) {
  const spec = item ? parseWheel(item) : null;
  for (const key of CORNERS) {
    const hub = car.getObjectByName(`wheel_${key}`);
    if (!hub) continue;
    const old = hub.getObjectByName('wheel_aftermarket');
    if (old) {
      hub.remove(old);
      old.traverse((n) => n.geometry?.dispose());
    }
    for (const child of hub.children) {
      if (/^(rim|tire)/.test(child.name)) child.visible = !spec;
    }
    if (!spec) continue;
    const wheel = buildWheel(spec);
    wheel.name = 'wheel_aftermarket';
    const sign = key.endsWith('L') ? -1 : 1;
    if (sign < 0) wheel.rotation.y = Math.PI;
    wheel.position.x = sign * spec.pokeM;
    hub.add(wheel);
  }
}