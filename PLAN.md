# Plan of Attack: DE5 Integra Type S 3D Configurator

Phased so every phase ends with something visible and working. Do them in order; each phase is a good Claude Code session.

## Phase 0: Scaffold + model acquisition (the one decision that gates everything)

**Scaffold**
- `npm create vite@latest` (vanilla), add `three`. Set up the repo layout from CLAUDE.md.
- Drop `parts-database.json` into `data/`.

**Get the car model.** Options, best first:

1. **Buy a DE5 model (recommended, ~$50-150).** Known listings:
   - CGTrader "Acura Integra Type S 2024": https://www.cgtrader.com/3d-models/car/car/acura-integra-type-s-2024
   - 3DModels.org "Acura Integra Type S 2025": https://3dmodels.org/3d-models/acura-integra-type-s-2024/
   - TurboSquid Acura Integra search: https://www.turbosquid.com/3d-model/acura-integra
   Buy criteria: it must be the Type S (wide body, triple center exhaust, correct bumpers), mid-poly (50k-300k tris), with FBX/OBJ/BLEND included, and ideally a separated interior. Personal-use license is fine for this project.
2. **Free Sketchfab model** (https://sketchfab.com/tags/integra): check it is a DE5 not a DE4, license is CC-BY or similar, and quality is acceptable.
   **Sourcing result (2026-08-08): no free DE5 exists on Sketchfab.** Going with fallback 3 below. Chosen stand-in: "Honda Civic Type R (FL5)" by Mona x Supercars (@Car2022), CC Attribution, 141.8k tris, stock body: https://sketchfab.com/3d-models/honda-civic-type-r-fl5-2f54931a83744e048cacc3886d6cf5da
   Download step (requires a free Sketchfab login): open the link, Download 3D Model, pick GLB (6 MB, 1k textures), save the file as `assets/models/fl5.glb` (the loader prefers `de5.glb` if it ever appears, then falls back to `fl5.glb`, then the placeholder). No conversion or Blender prep needed: `src/viewer/adapters/fl5.js` renames meshes to the naming convention, splits the fused wheels into hub-centered per-corner groups, and normalizes scale/origin at load time. Done 2026-08-08; the model is in hand locally (gitignored, so fresh clones repeat this download). Note the runner-up "Honda Civic Type R FL5 Custom" (blakebella) is higher poly but is CC BY-NC-ND with an aftermarket widebody kit baked in; the CC-BY re-upload of it by Bobby.2024 is not a trustworthy license, avoid.
   **License note for distribution:** the Car2022 model is CC Attribution, so shipping it publicly is allowed but the app must visibly credit "Mona x Supercars (@Car2022) on Sketchfab" with a link (put it in the UI footer/about). Keep this credit when the DE5 model arrives if the FL5 stays as a selectable chassis.
3. **Fallback:** start with any 11th-gen Civic/FL5 GLB to build all systems, swap the real DE5 model in later. All code should be model-agnostic via the mesh naming convention.

**Prep the model in Blender** (only for a future purchased DE5 model; the FL5 needs none, its adapter does this in code):
- Import, scale to real size (DE5 is 4,674 mm long), Z-up sorted out, origin at ground center.
- Split/rename meshes per the CLAUDE.md naming convention. Separate the wheels, give them hub-centered origins.
- Delete or separate the stock lip/spoiler regions if the model has them fused, so aero add-ons can overlay.
- Export `assets/models/de5.glb` (Draco-compress if >20 MB).

**Done when:** `npm run dev` shows the DE5 spinning in a browser.

## Phase 1: Viewer core

- Scene: PMREM environment (an HDRI like studio or overcast street), soft ground shadow (contact shadow or baked blob), subtle ground plane.
- OrbitControls with sane limits (no going under the floor), damped.
- Tone mapping ACESFilmic, exposure tuned so Platinum White Pearl does not blow out.
- Camera presets: front 3/4, side, rear 3/4, top, wheel close-up.
- **Done when:** the stock car looks like a car ad, 60 fps on a laptop.

## Phase 2: Paint + wraps

- Material factory reading `factory_colors` and `wraps` from the DB (hex + finish -> MeshPhysicalMaterial params per CLAUDE.md conventions).
- Apply to `body_paint` mesh only (not trim/glass). Gloss/satin/matte/color-flip finishes.
- UI: two swatch rows (Factory 2024 / Wraps), finish badge, price shown for wraps (installed estimate from `wrap_cost_note`).
- **Done when:** Tiger Eye Pearl and Satin Battleship Gray both look convincing.

## Phase 3: Stance (wheels + lowering)

- Wheel swap system: 3-4 generic wheel GLBs matching the DB styles (split 5-spoke TE37-like, mesh, 10-spoke concave, twin-5-spoke). Parametric tint for finish colors (bronze, black, titanium, white). Map each DB wheel entry to a style + finish + diameter.
- Diameter/width: scale rim mesh 18 vs 19 in, tire sidewall adjusts to keep rolling diameter (265/35R18 vs 265/30R19). Offset shifts wheel outboard (+60 OEM vs +45 aftermarket = ~15 mm poke per side).
- Ride height: lower the body shell relative to wheels by the DB `drop_front_in`/`drop_rear_in` (rake supported). Slider snapped to real products: stock / H&R (0.75) / Eibach Pro-Kit (1.0) / Swift Spec-R (1.0) / Sportline (1.2) / coilover custom.
- UI: wheel picker with brand/price/link, suspension picker, live "no wheel gap" view.
- **Done when:** Eibach Pro-Kit + TE37 in bronze at 18x9.5 +45 looks like the Instagram builds.

## Phase 4: Aero + exterior carbon

- Add-on meshes (model simple versions in Blender or code): front lip, side skirt extensions, duckbill, GT wing, diffuser fins, hood swap to carbon material, carbon mirror caps, carbon roof accents.
- Each toggle maps to real DB entries: picking "Front lip" offers APR carbon ($1,350) vs AeroflowDynamics ($280) etc, same mesh, different material/price.
- Carbon material variants: gloss twill, forged, matte.
- **Done when:** full APR kit + Seibon hood + GT wing renders as a coherent track build.

## Phase 5: Interior

- Interior camera mode (dolly inside, limited orbit). If the purchased model has no interior, buy/build a simple cockpit: dash, console, seats, wheel.
- Swaps: carbon trim overlays (console/dash/B-pillar per Jogon/Yipmotiv entries), FL5 red buckets vs stock vs Recaro/Bride (material + color change on seat mesh is enough for v1), carbon steering wheel, shift knob.
- **Done when:** you can sit in it and toggle carbon console + red buckets.

## UI debt (Jon, 2026-08-08)

The right panel is currently one indefinite scroll with every product front-loaded. Needs progressive disclosure before release: collapsed category sections that drill down (or lazy "show all" expansion per category), so the default view is a short list of categories with the current selection, not the full catalog.

## Phase 6: Build sheet + price total

- Right panel: running build list of every selected part with brand, price, vendor link; running total (parse "~$X-Y" prices to a midpoint, show as approximate).
- Save/load builds (JSON download + URL hash). Screenshot/export button (renderer.domElement.toDataURL).
- Baseline build pre-loaded: PRL HVI + wheel spacers (already on the car, $0 in the total).
- **Done when:** a saved build exports a shopping list you could actually order from.

## Phase 7: Polish (as desired)

- Exhaust tip visual swap (triple center styles, burnt ti option, A'PEXi dual conversion).
- Exhaust sound library: for every cat-back in the DB, find real sound clips (vendor videos, YouTube) covering each drive mode (Comfort / Sport / Sport+, since the active exhaust valve changes the note), plus cold start and WOT pulls where available. Selecting an exhaust in the UI offers a "hear it" player with per-mode clips and source links.
- Two-tone/roof wraps, brake caliper colors, tint levels on glass.
- Performance parts section (PRL turbo inlet, front pipe, intercooler etc.) as list-only items with prices, no 3D, wiring back into the financial/performance evaluation idea.
- Deploy to Vercel/Netlify as a static site. Distribution target: pitch to the Integra community (IntegraForums etc.) first.
- Chassis toggle (future state): pick DE5 Integra Type S or FL5 Civic Type R at the top of the UI. The FL5 model is already in hand, and the platforms share wheel specs (19x9.5 +60, 5x120) and triple center exhaust, so stance/wheel systems carry over. Needs per-chassis factory color palettes (FL5: Championship White, Rallye Red, Boost Blue, Crystal Black, Sonic Gray), per-chassis parts filtering in the DB (the FL5-crossover `notes` flags become a first-class compatibility field), and a second community pitch to Civic folks. Keep all mod systems chassis-agnostic now so this is a data change, not a rewrite.

## Known risks

- Model quality is the whole ballgame. Spend the money on a good DE5 model rather than fighting a bad free one.
- Fused meshes in purchased models make part swaps painful; budget the Blender prep time.
- Pearl paint realism depends more on the HDRI/environment than the material params.
- FL5-crossover parts in the DB (KW V3, Ohlins, BC BR, H&R) have unverified DE5 fitment; the UI should surface the `notes` flags.

## Data provenance

`data/parts-database.json` researched 2026-08-08 via vendor sites (APR, Seibon, AWE, Borla, Titan 7, Apex, System Motorsports, Fortune Auto, RS-R, Hybrid Racing, Jogon, Carismo, Acura OEM parts sites) and DE5 community fitment threads (IntegraForums, Apex fitment guide). Prices are street prices at research time.
