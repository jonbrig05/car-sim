# car-sim: Integra Type S (DE5) 3D Configurator

A free, browser-based 3D configurator for the 2024 Acura Integra Type S. Swap wheels, drop the suspension, change paint and wraps, and build a parts list where every option maps to a real product with a price and vendor link. A saved build doubles as a shopping list, shareable by URL.

**Live site:** https://jonbrig05.github.io/car-sim/

No backend, no accounts, no cost. Static site built with Three.js and Vite.

## Run it locally

```
npm install
npm run dev
```

That is the whole setup. The car model ships in the repo.

## Current state

The body is a Honda Civic Type R (FL5) model progressively converted toward the DE5 in code (the two cars share a platform). The app labels it honestly as an approximation. Conversion so far: wing removed, badges removed, Acura pentagon grille, rear lightbar, smoked taillights. Remaining: hood vent, DRL signature, ducktail. Contributions welcome, especially on the DE5 body conversion; contributors get credited in the app.

## Model attribution

Car model: "Honda Civic Type R (FL5)" by [Mona x Supercars (@Car2022) on Sketchfab](https://sketchfab.com/3d-models/honda-civic-type-r-fl5-2f54931a83744e048cacc3886d6cf5da), licensed [CC Attribution 4.0](https://creativecommons.org/licenses/by/4.0/). The copy in `assets/models/fl5.glb` is redistributed under that license; all in-app modifications are applied at load time in code.

Parts data in `data/parts-database.json` was researched August 2026. Verify prices with vendors before buying anything.
