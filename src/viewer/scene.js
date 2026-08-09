import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

// Viewer core: renderer, camera, controls, environment, ground.
// Phase 1 will replace the RoomEnvironment with a proper HDRI and add
// camera presets; keep this file free of car-specific logic.
export function createViewer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c0c0e);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(
    40,
    container.clientWidth / container.clientHeight,
    0.1,
    200,
  );
  camera.position.set(6, 2, 6);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.maxPolarAngle = Math.PI / 2 - 0.03; // stay above the floor
  controls.minDistance = 1.8; // allows the wheel close-up preset
  controls.maxDistance = 15;
  controls.autoRotate = true;
  controls.autoRotateSpeed = 0.8;
  controls.target.set(0, 0.6, 0);
  // First user interaction stops the turntable spin.
  controls.addEventListener('start', () => { controls.autoRotate = false; });

  // Key light for shadows; the environment map does most of the shading.
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(5, 8, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -5;
  sun.shadow.camera.right = 5;
  sun.shadow.camera.top = 5;
  sun.shadow.camera.bottom = -5;
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(14, 64),
    new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.95, metalness: 0 }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  window.addEventListener('resize', () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  // Camera preset flight: simple eased lerp handled in the render loop.
  let flight = null;
  function flyTo(position, target, ms = 700) {
    controls.autoRotate = false;
    controls.enabled = false; // controls.update() would fight the lerp
    flight = {
      fromPos: camera.position.clone(),
      fromTgt: controls.target.clone(),
      toPos: new THREE.Vector3(...position),
      toTgt: new THREE.Vector3(...target),
      t: 0,
      ms,
    };
  }

  function updateFlight(dt) {
    if (!flight) return;
    flight.t = Math.min(1, flight.t + dt / flight.ms);
    const e = 1 - Math.pow(1 - flight.t, 3); // ease-out cubic
    camera.position.lerpVectors(flight.fromPos, flight.toPos, e);
    controls.target.lerpVectors(flight.fromTgt, flight.toTgt, e);
    if (flight.t >= 1) {
      flight = null;
      controls.enabled = true;
      controls.update();
    }
  }

  function frameObject(object) {
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const radius = Math.max(size.x, size.z) / 2;
    controls.target.set(center.x, center.y, center.z);
    camera.position.set(center.x + radius * 1.9, center.y + radius * 0.75, center.z + radius * 1.9);
    controls.update();
  }

  // One frame of work. Public so tests can drive frames without rAF
  // (Chrome pauses rAF entirely in background tabs).
  let last = performance.now();
  function tick(now) {
    updateFlight(Math.max(0, now - last));
    last = now;
    if (flight === null) controls.update();
    camera.lookAt(controls.target);
    renderer.render(scene, camera);
  }

  function start() {
    last = performance.now();
    renderer.setAnimationLoop(tick);
  }

  return { renderer, scene, camera, controls, frameObject, flyTo, start, tick };
}

// Preset views tuned for a ~4.7m car at origin, nose toward +z.
export const CAMERA_PRESETS = {
  'front 3/4': { position: [3.9, 1.4, 4.6], target: [0, 0.55, 0] },
  side: { position: [6.6, 1.1, 0], target: [0, 0.55, 0] },
  'rear 3/4': { position: [3.9, 1.4, -4.6], target: [0, 0.55, 0] },
  top: { position: [0.01, 9.5, 0.01], target: [0, 0, 0] },
  wheel: { position: [-2.3, 0.6, 2.6], target: [-0.81, 0.33, 1.37] },
};
