// Headless pitch-screenshot capture. Renders clean full-bleed frames (no UI)
// of specific builds via their share-URL hashes, using the system Chrome.
//
// Usage: start the site first (npm run dev or vite preview), then
//   node scripts/pitch-shots.mjs [baseUrl]
// baseUrl defaults to http://localhost:4173 (vite preview). Set CHROME_PATH if
// Chrome is not at the default Windows location. Output lands in screenshots/.

import puppeteer from 'puppeteer-core';
import { mkdirSync, writeFileSync } from 'node:fs';

const BASE = process.argv[2] || process.env.SHOT_BASE_URL || 'http://localhost:4173';
const CHROME =
  process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

// Each shot is a share-hash build plus a camera preset button label.
const SHOTS = [
  { file: 'pwp-front34.png', hash: '', preset: 'front 3/4' },
  {
    file: 'red-titan7-eibach-front34.png',
    hash: '#p=f.performance-red-pearl,s=eibach-pro-kit-springs,wh=titan-7-t-s5',
    preset: 'front 3/4',
  },
  { file: 'black-rear34-lightbar.png', hash: '#p=f.majestic-black-pearl', preset: 'rear 3/4' },
  {
    file: 'red-titan7-wheel-closeup.png',
    hash: '#p=f.performance-red-pearl,s=eibach-pro-kit-springs,wh=titan-7-t-s5',
    // The wheel preset crops badly at 16:9, so frame off the real hub instead:
    // camera just outside the front wheel, slightly ahead and above hub height.
    customCamera: true,
  },
];

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  defaultViewport: { width: 2560, height: 1440, deviceScaleFactor: 1 },
});

mkdirSync('screenshots', { recursive: true });

const page = await browser.newPage();
for (const shot of SHOTS) {
  // Bounce through about:blank: consecutive URLs differing only in #hash are
  // same-document navigations (no reload), and the app reads the hash at load.
  await page.goto('about:blank');
  await page.goto(`${BASE}/${shot.hash}`, { waitUntil: 'load' });
  // Car is loaded once the HUD status stops saying "loading".
  await page.waitForFunction(
    () => {
      const s = document.getElementById('hud-status');
      return s && !/loading|failed/.test(s.textContent) && window.__carsim?.getCar();
    },
    { timeout: 60000 },
  );
  // Hide the UI and let the canvas take the full viewport for a clean frame.
  await page.evaluate(() => {
    for (const id of ['panel', 'hud', 'presets']) {
      document.getElementById(id).style.display = 'none';
    }
    document.getElementById('app').style.right = '0';
    window.dispatchEvent(new Event('resize'));
  });
  if (shot.customCamera) {
    await page.evaluate(() => {
      const car = window.__carsim.getCar();
      const wheel = car.getObjectByName('wheel_FL');
      wheel.updateWorldMatrix(true, false);
      const e = wheel.matrixWorld.elements;
      const hub = { x: e[12], y: e[13], z: e[14] };
      const out = Math.sign(hub.x) || 1;
      window.__carsim.viewer.flyTo(
        [hub.x + out * 1.5, hub.y + 0.3, hub.z + 0.42],
        [hub.x, hub.y + 0.06, hub.z],
        1,
      );
    });
    await new Promise((r) => setTimeout(r, 300));
  } else {
    // Preset buttons still respond to programmatic clicks while hidden.
    await page.evaluate((label) => {
      const btn = [...document.querySelectorAll('#presets button')].find(
        (b) => b.textContent === label,
      );
      if (!btn) throw new Error(`No camera preset button labeled "${label}"`);
      btn.click();
    }, shot.preset);
    await new Promise((r) => setTimeout(r, 1500)); // camera flight is ~700ms eased
  }
  // Render and read the canvas in the same task so the buffer is still valid.
  const dataUrl = await page.evaluate(() => {
    window.__carsim.viewer.tick?.();
    return document.querySelector('#app canvas').toDataURL('image/png');
  });
  writeFileSync(
    `screenshots/${shot.file}`,
    Buffer.from(dataUrl.split(',')[1], 'base64'),
  );
  console.log(`captured screenshots/${shot.file}`);
}

await browser.close();
