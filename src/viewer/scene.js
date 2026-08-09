import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Viewer core: renderer, camera, controls, environment, ground.
// Keep this file free of car-specific logic.

// Procedural automotive studio environment for PMREM: long softbox strips
// make the horizontal highlights that sell car paint (a generic room env
// reads flat on pearls). Colors above 1.0 are HDR radiance.
function buildStudioEnvScene() {
  const env = new THREE.Scene();

  const strip = (w, h, color) => new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }),
  );

  // Ambient dome, slightly brighter toward the horizon.
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(30, 32, 16),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(0.04, 0.045, 0.05), side: THREE.BackSide }),
  );
  env.add(dome);

  // Main overhead softbox: the long roof highlight.
  const key = strip(9, 2.4, new THREE.Color(4.2, 4.1, 4.0));
  key.position.set(0, 4.3, 0);
  key.rotation.x = Math.PI / 2;
  env.add(key);

  // Tall side strips: shoulder-line highlights, one cool one warm, uneven
  // so reflections have direction.
  const left = strip(10, 1.3, new THREE.Color(1.7, 1.8, 2.0));
  left.position.set(-5.5, 1.9, 0);
  left.rotation.y = Math.PI / 2;
  env.add(left);

  const right = strip(10, 1.1, new THREE.Color(0.9, 0.85, 0.8));
  right.position.set(5.5, 1.7, 0);
  right.rotation.y = -Math.PI / 2;
  env.add(right);

  // Nose and tail fills so bumpers do not fall to black.
  const front = strip(5, 1.0, new THREE.Color(0.7, 0.7, 0.72));
  front.position.set(0, 1.5, 6.5);
  env.add(front);

  const rear = strip(5, 0.8, new THREE.Color(0.5, 0.5, 0.52));
  rear.position.set(0, 1.4, -6.5);
  rear.rotation.y = Math.PI;
  env.add(rear);

  // Floor bounce keeps sills and diffusers readable.
  const floor = strip(16, 16, new THREE.Color(0.1, 0.1, 0.11));
  floor.position.set(0, -0.02, 0);
  floor.rotation.x = -Math.PI / 2;
  env.add(floor);

  return env;
}

// Radial-gradient canvas texture: studio floor pool of light / blob shadow.
function radialTexture(inner, outer, size = 512) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
export function createViewer(container) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.92; // tuned so Platinum White Pearl holds detail
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0c0c0e);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(buildStudioEnvScene(), 0.06).texture;

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
  const sun = new THREE.DirectionalLight(0xffffff, 0.55);
  sun.position.set(5, 8, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -5;
  sun.shadow.camera.right = 5;
  sun.shadow.camera.top = 5;
  sun.shadow.camera.bottom = -5;
  sun.shadow.bias = -0.0004;
  scene.add(sun);

  // Studio floor: pool of light under the car fading to the backdrop color.
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(14, 64),
    new THREE.MeshStandardMaterial({
      map: radialTexture('#131316', '#0b0b0d'),
      color: 0xbbbbbb,
      roughness: 0.95,
      metalness: 0,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Contact-shadow blob: grounds the car regardless of shadow-map softness.
  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 5.4),
    new THREE.MeshBasicMaterial({
      map: radialTexture('rgba(0,0,0,0.62)', 'rgba(0,0,0,0)'),
      transparent: true,
      depthWrite: false,
    }),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.003;
  scene.add(blob);

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
