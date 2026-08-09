import * as THREE from 'three';

// Splits a mesh's geometry into buckets, one triangle at a time, using a
// classifier on the triangle centroid (world space). Sketchfab models fuse
// e.g. all four rims into one mesh; this is how we get per-corner meshes
// back without a Blender pass. Output geometries are non-indexed.
export function splitMeshByCentroid(mesh, classify) {
  const geo = mesh.geometry;
  const pos = geo.attributes.position;
  const index = geo.index;
  const triCount = (index ? index.count : pos.count) / 3;

  const attrNames = Object.keys(geo.attributes);
  const buckets = new Map(); // key -> {name: number[]}

  const v = new THREE.Vector3();
  const centroid = new THREE.Vector3();

  const vertIndex = (tri, corner) => (index ? index.getX(tri * 3 + corner) : tri * 3 + corner);

  for (let tri = 0; tri < triCount; tri += 1) {
    centroid.set(0, 0, 0);
    for (let c = 0; c < 3; c += 1) {
      v.fromBufferAttribute(pos, vertIndex(tri, c));
      mesh.localToWorld(v);
      centroid.add(v);
    }
    centroid.multiplyScalar(1 / 3);

    const key = classify(centroid);
    if (key == null) continue;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = Object.fromEntries(attrNames.map((n) => [n, []]));
      buckets.set(key, bucket);
    }
    for (let c = 0; c < 3; c += 1) {
      const vi = vertIndex(tri, c);
      for (const name of attrNames) {
        const attr = geo.attributes[name];
        for (let k = 0; k < attr.itemSize; k += 1) {
          bucket[name].push(attr.getComponent(vi, k));
        }
      }
    }
  }

  const result = new Map();
  for (const [key, arrays] of buckets) {
    const out = new THREE.BufferGeometry();
    for (const name of attrNames) {
      const itemSize = geo.attributes[name].itemSize;
      out.setAttribute(name, new THREE.Float32BufferAttribute(arrays[name], itemSize));
    }
    result.set(key, out);
  }
  return result;
}

// Groups a geometry's triangles into connected components (triangles sharing
// a vertex position, welded by quantized coordinates so split-normal seams
// still connect). Used to find topologically separate parts inside a fused
// mesh, e.g. the FL5 wing floating above the hatch.
export function findConnectedComponents(geometry) {
  const pos = geometry.attributes.position;
  const index = geometry.index;
  const triCount = (index ? index.count : pos.count) / 3;
  const triVert = (t, c) => (index ? index.getX(t * 3 + c) : t * 3 + c);
  const keyOf = (vi) =>
    `${Math.round(pos.getX(vi) * 1e4)},${Math.round(pos.getY(vi) * 1e4)},${Math.round(pos.getZ(vi) * 1e4)}`;

  const parent = new Map();
  function find(k) {
    let root = k;
    while (parent.get(root) !== root) root = parent.get(root);
    let cur = k;
    while (parent.get(cur) !== cur) {
      const next = parent.get(cur);
      parent.set(cur, root);
      cur = next;
    }
    return root;
  }
  function union(a, b) {
    if (!parent.has(a)) parent.set(a, a);
    if (!parent.has(b)) parent.set(b, b);
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  for (let t = 0; t < triCount; t += 1) {
    const k0 = keyOf(triVert(t, 0));
    union(k0, keyOf(triVert(t, 1)));
    union(k0, keyOf(triVert(t, 2)));
  }

  const comps = new Map();
  const v = new THREE.Vector3();
  for (let t = 0; t < triCount; t += 1) {
    const root = find(keyOf(triVert(t, 0)));
    let comp = comps.get(root);
    if (!comp) {
      comp = { triangles: [], box: new THREE.Box3() };
      comps.set(root, comp);
    }
    comp.triangles.push(t);
    for (let c = 0; c < 3; c += 1) {
      const vi = triVert(t, c);
      v.set(pos.getX(vi), pos.getY(vi), pos.getZ(vi));
      comp.box.expandByPoint(v);
    }
  }
  return [...comps.values()];
}

// Drops the given triangle indices from a geometry in place by rebuilding
// its index (works for indexed and non-indexed input).
export function removeTriangles(geometry, dropSet) {
  const index = geometry.index;
  const triCount = (index ? index.count : geometry.attributes.position.count) / 3;
  const kept = [];
  for (let t = 0; t < triCount; t += 1) {
    if (dropSet.has(t)) continue;
    for (let c = 0; c < 3; c += 1) kept.push(index ? index.getX(t * 3 + c) : t * 3 + c);
  }
  geometry.setIndex(kept);
}
