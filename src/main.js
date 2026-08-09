import { createViewer, CAMERA_PRESETS } from './viewer/scene.js';
import { loadCar, CHASSIS_IDS } from './viewer/loadCar.js';
import { createFactoryPaint, createWrapMaterial, applyPaint } from './materials/paint.js';
import { applyStance } from './mods/stance.js';
import { applyWheels } from './mods/wheels.js';
import { initPanel, buildItems } from './ui/panel.js';
import { encodeBuildHash, decodeBuildHash } from './util/share.js';
import db from '../data/parts-database.json';

const container = document.getElementById('app');
const status = document.getElementById('hud-status');

const viewer = createViewer(container);
viewer.start();

// Build state. paint is {type: 'factory'|'wrap', item}; null part = stock.
const build = {
  // FL5 Civic is the presented default: it is the model we actually have.
  // 'de5a' opts into the DE5-from-FL5 approximation (on hold, experimental).
  chassis: 'fl5',
  paint: { type: 'factory', item: db.factory_colors[0] }, // Platinum White Pearl
  suspension: null,
  wheels: null,
  exhaust: null,
};
// A shared link restores its build over the defaults.
Object.assign(build, decodeBuildHash(location.hash, db));
if (!CHASSIS_IDS.includes(build.chassis)) build.chassis = 'fl5';
const DEFAULT_HASH = encodeBuildHash({ paint: { type: 'factory', item: db.factory_colors[0] } });

let car = null;
let panel = null;

function repaint() {
  if (!car || !build.paint) return;
  const mat = build.paint.type === 'factory'
    ? createFactoryPaint(build.paint.item)
    : createWrapMaterial(build.paint.item);
  const painted = applyPaint(car, mat);
  if (painted === 0) {
    console.warn('No meshes matched the paint naming convention; model needs the Blender rename pass.');
  }
}

function restance() {
  if (!car) return;
  const s = build.suspension;
  applyStance(car, {
    dropFrontIn: s ? (s.drop_front_in ?? 1.0) : 0,
    dropRearIn: s ? (s.drop_rear_in ?? 1.0) : 0,
  });
}

function rewheel() {
  if (!car) return;
  applyWheels(car, build.wheels);
}

function refresh() {
  repaint();
  restance();
  rewheel();
  panel.setBuild(build);
  // Keep the URL shareable at all times; a pure-default build gets no hash.
  const hash = encodeBuildHash(build);
  history.replaceState(null, '', hash === DEFAULT_HASH ? location.pathname : hash);
}

panel = initPanel(document.getElementById('panel'), {
  db,
  actions: {
    selectFactory(color) { build.paint = { type: 'factory', item: color }; refresh(); },
    selectWrap(wrap) { build.paint = { type: 'wrap', item: wrap }; refresh(); },
    selectSuspension(item) { build.suspension = item; refresh(); },
    selectWheels(item) { build.wheels = item; refresh(); },
    selectExhaust(item) { build.exhaust = item; refresh(); },
    openVendorPages() {
      const urls = buildItems(build).map((it) => it.url).filter(Boolean);
      for (const url of urls) window.open(url, '_blank', 'noopener');
    },
    copyBuildLink() {
      return navigator.clipboard.writeText(location.href);
    },
  },
});
panel.setBuild(build);

// Camera preset buttons.
const presetBar = document.getElementById('presets');
for (const [name, view] of Object.entries(CAMERA_PRESETS)) {
  const btn = document.createElement('button');
  btn.textContent = name;
  btn.addEventListener('click', () => viewer.flyTo(view.position, view.target));
  presetBar.appendChild(btn);
}

// Chassis toggle: adapters mutate geometry destructively (baked transforms,
// disposed meshes), so switching chassis is a hash update + page reload, not
// an in-place swap.
const chassisBar = document.getElementById('chassis');
for (const btn of chassisBar.querySelectorAll('button')) {
  btn.classList.toggle('selected', btn.dataset.chassis === build.chassis);
  btn.addEventListener('click', () => {
    if (btn.dataset.chassis === build.chassis) return;
    build.chassis = btn.dataset.chassis;
    const hash = encodeBuildHash(build);
    history.replaceState(null, '', hash === DEFAULT_HASH || !hash ? location.pathname : hash);
    location.reload();
  });
}
if (build.chassis !== 'fl5') {
  document.querySelector('#hud .title').textContent = 'DE5 Integra Type S';
  document.title = 'DE5 Configurator';
}

loadCar(build.chassis).then(({ car: loaded, source }) => {
  car = loaded;
  viewer.scene.add(car);
  viewer.frameObject(car);
  status.textContent =
    source === 'placeholder'
      ? 'placeholder proxy (drop a model at assets/models/de5.glb or fl5.glb)'
      : source;
  refresh();
}).catch((err) => {
  console.error('Failed to load car:', err);
  status.textContent = 'failed to load car, see console';
});

// Debug handle for tests and console poking.
window.__carsim = { viewer, build, getCar: () => car };
