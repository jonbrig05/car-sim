# car-sim: DE5 Integra Type S 3D Configurator

## What this is

A web-based 3D configurator for Jon's 2024 Acura Integra Type S (chassis DE5). Goal: visualize real, purchasable mods on an accurate model of the car before buying them. Swap wheels, lower it, change paint/wraps and finishes, add aero and carbon parts, and view a carbon-trimmed interior. Every option in the UI maps to a real product with a brand, approximate price, and vendor link, so a saved build doubles as a shopping list.

Distribution plan: no real DE5 model exists anywhere (checked Aug 2026; paid ones forbid redistribution), so the FL5 Civic Type R is the presented default chassis. A HUD toggle (share hash `c=de5a`) opts into the DE5-from-FL5 approximation, currently on hold. Build every mod system chassis-agnostic so adding a chassis is data, not code. The FL5 model (CC-BY, Mona x Supercars on Sketchfab) requires visible attribution in the app wherever it ships.

## The actual car (baseline)

- 2024 Integra Type S, DE5 chassis (shares FL5 Civic Type R platform)
- Currently installed: PRL High Volume Intake, wheel spacers. Otherwise stock.
- Owner's stance goal: street use, no wheel gap. Default the suspension UI to spring-level drops (0.75 to 1.25 in), not slammed.

## Stack

- Three.js + Vite, vanilla JS or lightweight framework, no heavy state library
- Car model: glTF/GLB (see PLAN.md Phase 0 for sourcing)
- Parts data: `data/parts-database.json` (already researched and included, Aug 2026 prices)
- No backend. Builds saved to JSON files / URL params. Keep it a static site.

## Repo layout (target)

```
car-sim/
  CLAUDE.md
  PLAN.md
  data/parts-database.json    # researched parts DB, source of truth
  assets/models/              # car GLB + wheel GLBs (gitignore large binaries if needed)
  src/
    main.js                   # scene bootstrap
    viewer/                   # scene, camera, lighting, env
    materials/                # paint/wrap/carbon material factories
    mods/                     # wheel swap, ride height, aero toggles, interior
    ui/                       # config panel, build summary, price total
  index.html
```

## Domain facts that affect the visuals (do not get these wrong)

- OEM wheel: 19x9.5 +60, 5x120, 265/30ZR19. The +60 offset means aftermarket 18x9.5 +45 sits ~15mm further out per side: model wheel swaps should poke slightly more than stock.
- Common aftermarket fitment: 18x9.5 +45 on 265/35R18 (same rolling diameter as stock, taller sidewall, visibly smaller rim). 18x10 +40 is the aggressive "God Spec".
- Exhaust: factory is a TRIPLE CENTER EXIT (like FL5). All cat-backs keep triple center except the A'PEXi N1-X which converts to dual center 123mm tips. Never model outboard dual exits.
- Spring drops are 0.6 to 1.25 in. Coilovers go lower (BC BR up to ~3 in) but that is not the owner's use case.
- 2024 factory colors only for "factory" palette on his car: Platinum White Pearl, Majestic Black Pearl, Performance Red Pearl, Apex Blue Pearl, Tiger Eye Pearl (2024 exclusive), Liquid Carbon Metallic, Lunar Silver Metallic. 2025/2026-only colors (Double Apex Blue, Solar Silver, Urban Gray) exist in the DB, tag them as different-year if shown.
- The DE5 Type S has wide-body bumpers/fenders vs the base DE4 Integra. When sourcing a 3D model or parts, DE4 parts/models are NOT interchangeable.
- FL5 crossover parts are flagged in the DB `notes`. Keep those flags visible in the UI.

## Material conventions

- Factory pearls/metallics: `MeshPhysicalMaterial` with clearcoat 1.0, metalness ~0.6-0.9, subtle flake via normal/roughness tweak. Pearl colors shift; hexes in the DB are daylight approximations.
- Wraps: gloss = clearcoat 1.0 low roughness; satin = clearcoat ~0.4, roughness ~0.35; matte = no clearcoat, roughness ~0.6; color-flip = iridescence or two-tone sheen approximation.
- Carbon fiber: tiled twill weave texture (generate procedurally or a small repeating texture), clearcoat for gloss carbon, high roughness for forged/matte look.

## Mesh naming convention (whatever model we end up with)

Rename/split meshes in Blender before export so code can target them:
`body_paint`, `hood`, `front_bumper`, `front_lip`, `side_skirt_L/R`, `rear_diffuser`, `spoiler`, `mirror_L/R`, `wheel_FL/FR/RL/RR`, `brake_caliper_*`, `glass`, `trim_black`, `headlight`, `taillight`, `interior_dash`, `interior_console`, `interior_seat_L/R`, `interior_wheel`, `exhaust_tips`.
Wheel meshes must be separate objects with origins at hub center so swaps and ride-height changes are transforms, not remodeling.

## Working agreements

- Prices/fitment in the DB were researched Aug 2026. If a price matters, re-verify before presenting it as current.
- When adding parts to the DB, follow the existing schema and always include `notes` with fitment caveats.
- Keep everything runnable with `npm run dev` from a fresh clone (document any asset download step in PLAN.md).
- No em dashes in user-facing copy or docs.
