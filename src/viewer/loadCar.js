import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { buildPlaceholderCar } from './placeholder.js';
import { adaptFL5 } from './adapters/fl5.js';
import { adaptDE5Approx } from './adapters/de5Approx.js';

// Chassis registry: DE5 is the flagship, FL5 is a real supported chassis
// (planned UI toggle). Files live in assets/models/, served from models/
// (relative URLs: the site deploys under a subpath on GitHub Pages).
// `adapt` reshapes a raw downloaded model into the mesh naming convention
// (renames, per-corner wheel groups, normalized scale/origin). Until a true
// DE5 model exists, the default is the FL5 progressively converted toward
// DE5 in code ($0 strategy); the label is honest about the approximation.
const CHASSIS = [
  { id: 'de5', label: 'Integra Type S (DE5)', url: 'models/de5.glb' },
  { id: 'de5a', label: 'Integra Type S (DE5, approximation)', url: 'models/fl5.glb', adapt: adaptDE5Approx },
  { id: 'fl5', label: 'Civic Type R (FL5)', url: 'models/fl5.glb', adapt: adaptFL5 },
];

export const CHASSIS_IDS = CHASSIS.map((c) => c.id);

// Loads the first chassis model that exists, preferring `preferredId` when
// given (registry order otherwise), falling back to the placeholder proxy so
// every downstream system can be built before a model exists.
export async function loadCar(preferredId) {
  const loader = new GLTFLoader();
  const draco = new DRACOLoader();
  draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');
  loader.setDRACOLoader(draco);

  const preferred = CHASSIS.find((c) => c.id === preferredId);
  const order = preferred ? [preferred, ...CHASSIS.filter((c) => c !== preferred)] : CHASSIS;
  for (const chassis of order) {
    try {
      const gltf = await loader.loadAsync(chassis.url);
      const car = chassis.adapt ? chassis.adapt(gltf.scene) : gltf.scene;
      car.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = true;
          node.receiveShadow = true;
        }
      });
      return { car, source: chassis.label };
    } catch {
      // try the next chassis
    }
  }
  return { car: buildPlaceholderCar(), source: 'placeholder' };
}
