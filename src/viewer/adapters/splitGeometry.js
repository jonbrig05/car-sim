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
