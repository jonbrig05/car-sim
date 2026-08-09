import * as THREE from 'three';

// Builds a panel that conforms to the car's front surface: a polar grid over
// a 2D outline (x/y at the nose) is raycast onto the body and pushed a few
// millimeters forward. This is the overlay-mod technique: reshape what the
// eye sees without editing the sculpted shell.
//
// fStart > 0 turns the panel into a ring (frame) from fStart..1 of the way
// centroid -> outline. Winding is auto-corrected so faces point +z.
// sweepY: sample the surface at fixed height(s) instead of each vertex's own
// y, taking the front-most hit per x column. Use it when the panel spans an
// opening in the shell: the profile follows the bumper's plan-view curve,
// cannot fall through the hole, and clears any lip that juts forward
// anywhere in the band.
export function buildFrontSurfacePanel(car, outlineIn, {
  fStart = 0,
  rings = 4,
  offset = 0.005,
  name,
  material,
  targets,
  zBand = [1.9, 2.4],
  zFallback = 2.18,
  sweepY = null,
}) {
  // Ensure counterclockwise outline (positive signed area) viewed from +z.
  const outline = [...outlineIn];
  const area = outline.reduce((s, p, i) => {
    const q = outline[(i + 1) % outline.length];
    return s + (p.x * q.y - q.x * p.y);
  }, 0);
  if (area < 0) outline.reverse();

  const ray = new THREE.Raycaster();
  const dir = new THREE.Vector3(0, 0, -1);
  function surfZ(x, y) {
    ray.set(new THREE.Vector3(x, y, 3), dir);
    for (const hit of ray.intersectObjects(targets, false)) {
      if (hit.point.z >= zBand[0] && hit.point.z <= zBand[1]) return hit.point.z;
    }
    return zFallback;
  }

  const vertexZ = (x, y) => {
    const ys = sweepY == null ? [y] : [].concat(sweepY);
    return Math.max(...ys.map((sy) => surfZ(x, sy))) + offset;
  };

  const pos = [];
  const idx = [];
  if (fStart > 0) {
    // Ring / frame: a thin strip between fStart..1 of centroid -> outline.
    const cx = outline.reduce((s, p) => s + p.x, 0) / outline.length;
    const cy = outline.reduce((s, p) => s + p.y, 0) / outline.length;
    const N = outline.length;
    for (let r = 0; r <= rings; r += 1) {
      const f = fStart + (1 - fStart) * (r / rings);
      for (const p of outline) {
        const x = cx + (p.x - cx) * f;
        const y = cy + (p.y - cy) * f;
        pos.push(x, y, vertexZ(x, y));
      }
    }
    for (let r = 0; r < rings; r += 1) {
      for (let i = 0; i < N; i += 1) {
        const a = r * N + i;
        const b = r * N + ((i + 1) % N);
        const c = (r + 1) * N + i;
        const d = (r + 1) * N + ((i + 1) % N);
        idx.push(a, b, d, a, d, c);
      }
    }
  } else {
    // Filled panel: regular grid clipped to the outline. Small well-shaped
    // quads keep normals sane where the swept surface curves; a polar fan
    // from the centroid makes sliver triangles that fold on steep columns.
    const xs = outline.map((p) => p.x);
    const ys2 = outline.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys2);
    const maxY = Math.max(...ys2);
    const nx = Math.max(8, Math.ceil((maxX - minX) / 0.03));
    const ny = Math.max(4, Math.ceil((maxY - minY) / 0.03));

    const inside = (x, y) => {
      let hit = false;
      for (let i = 0, j = outline.length - 1; i < outline.length; j = i, i += 1) {
        const a = outline[i];
        const b = outline[j];
        if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
      }
      return hit;
    };
    const clampToOutline = (x, y) => {
      let best = null;
      let bestD = Infinity;
      for (let i = 0; i < outline.length; i += 1) {
        const a = outline[i];
        const b = outline[(i + 1) % outline.length];
        const abx = b.x - a.x;
        const aby = b.y - a.y;
        const t = Math.max(0, Math.min(1, ((x - a.x) * abx + (y - a.y) * aby) / (abx * abx + aby * aby)));
        const px = a.x + abx * t;
        const py = a.y + aby * t;
        const d = (px - x) ** 2 + (py - y) ** 2;
        if (d < bestD) { bestD = d; best = { x: px, y: py }; }
      }
      return best;
    };

    const vid = new Map();
    const vertex = (ix, iy) => {
      const key = ix * 10000 + iy;
      if (vid.has(key)) return vid.get(key);
      let x = minX + ((maxX - minX) * ix) / nx;
      let y = minY + ((maxY - minY) * iy) / ny;
      let onEdge = false;
      if (!inside(x, y)) {
        ({ x, y } = clampToOutline(x, y));
        onEdge = true;
      }
      // Taper the standoff toward the boundary so the panel edge sits nearly
      // flush with the shell instead of casting a visible cliff.
      const near = clampToOutline(x, y);
      const edgeDist = onEdge ? 0 : Math.hypot(near.x - x, near.y - y);
      const fade = Math.min(1, edgeDist / 0.05);
      const id = pos.length / 3;
      pos.push(x, y, vertexZ(x, y) - offset + offset * (0.15 + 0.85 * fade));
      vid.set(key, id);
      return id;
    };

    for (let ix = 0; ix < nx; ix += 1) {
      for (let iy = 0; iy < ny; iy += 1) {
        const corners = [[ix, iy], [ix + 1, iy], [ix + 1, iy + 1], [ix, iy + 1]];
        const anyInside = corners.some(([cxi, cyi]) =>
          inside(minX + ((maxX - minX) * cxi) / nx, minY + ((maxY - minY) * cyi) / ny));
        if (!anyInside) continue;
        const [a, b, c, d] = corners.map(([cxi, cyi]) => vertex(cxi, cyi));
        idx.push(a, b, c, a, c, d);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.name = name;
  mesh.castShadow = true;
  car.add(mesh);
  return mesh;
}

// Scales an outline about its centroid.
export function scaleOutline(outline, s) {
  const cx = outline.reduce((sum, p) => sum + p.x, 0) / outline.length;
  const cy = outline.reduce((sum, p) => sum + p.y, 0) / outline.length;
  return outline.map((p) => ({ x: cx + (p.x - cx) * s, y: cy + (p.y - cy) * s }));
}
