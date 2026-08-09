import { defineConfig } from 'vite';

// assets/ is served at the site root, so the car model resolves as /models/de5.glb
// (repo layout keeps it at assets/models/de5.glb per CLAUDE.md).
export default defineConfig({
  publicDir: 'assets',
});
