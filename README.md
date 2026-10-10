# Three-Action Tactics — PF2e Tactics

**▶ Play in your browser: https://sjfranks.github.io/PF2ETactics/**

Alternate link (served straight from this repo): https://raw.githack.com/sjfranks/PF2ETactics/main/index.html

An XCOM-style 3D tactics sandbox that runs the Pathfinder Second Edition (Remaster) rules. Build heroes from level 1 to 20, assemble encounters on the GM Core XP budget from all 492 Monster Core creatures, and fight them turn by turn on textured, animated battlefields. Every Strike, save, flank and Reactive Strike is rolled and explained.

## Features
- **Rules engine:** three actions + reaction, multiple attack penalty, degrees of success, flanking/off-guard, cover and concealment, Reactive Strike, Shield Block, champion reactions, dying/wounded, Hero Points, persistent damage, afflictions, resistances/weaknesses/immunities, Delay and Ready.
- **Characters:** 7 ancestries, 16 backgrounds, 11 classes, feats, spells, gear; pregenerated heroes rebuilt at any level.
- **Monster Core:** all 492 creatures with their strikes, spells and (about half) automated abilities; 974 Remaster spells imported (314 automated).
- **Encounters:** 26 prebuilt skirmishes, a generator, and a custom creature builder using the GM Core tables.
- **Maps:** 9 battlefields with walls, cover, difficult terrain, elevation, water and lava.
- **Presentation:** procedural rigged and animated miniatures, procedural textures, ambient occlusion, bloom, particles and spell effects, XCOM-style HUD with hit-chance breakdowns.
- **Phone play:** compact command dock, movement previews with action costs and hazard warnings, pinch-to-zoom and two-finger rotation, camera shortcuts, and a dedicated Tactics tab for class and defensive actions.
- **Getting started:** Quick Battle picks a level 1–3 encounter; First Skirmish offers a guided level-1 battle. All higher-level encounters remain available in the encounter builder.
- **Feedback:** optional sound effects and vibration in Settings, clear turn cues, and expandable roll details. Reduced-motion preferences disable automatic camera swings and menu rotation.

## Project layout
- `index.html` — the built, single-file game (what GitHub Pages serves).
- `src/` — engine (`engine.js`, `actions.js`, `ai.js`), data (`data_*.js`), renderer (`render3d.js`, `models.js`, `gfx.js`) and UI (`ui_*.js`, `shell.html`, `style.css`).
- `build.py` — rebuilds `index.html` and the `dist/` copies. Standalone builds embed the checked-in three.js library, so a CDN failure cannot prevent the game from starting. `dist/local.html` references `vendor/three.min.js` for local development.
- `test/` — rules unit tests and AI-vs-AI battle simulations (`node test/rules.js`, `node test/sim.js`, `node test/mc_all.js`).
- `tools/` — importers that generate `src/data_mc.js` and `src/data_spells_auto.js` from the Foundry VTT pf2e data packs.

To rebuild after changing `src/`: `npm run build` (or `python3 build.py`). The script updates the GitHub Pages entry point automatically; no copy step is needed. Fonts are optional network enhancements with local fallbacks.

On a phone, tap a highlighted square to preview movement, then **Move here** to spend the displayed actions. A second tap on the same square also confirms. **Cancel** costs nothing. Choose a weapon or spell to preview a target, then confirm; open **Roll & damage details** for the full calculation. Drag to pan, pinch to zoom, and twist with two fingers to rotate. The center camera button returns to the acting hero.

Run `npm test` for rules checks and `npm run test:sim` for AI battle simulations. For browser regression checks, install `python3 -m pip install -r test/requirements.txt` and Chromium (`python3 -m playwright install chromium` if needed), then run `npm run build && npm run test:ui`. The browser test serves the game locally, checks touch gestures and action costs at phone, tablet and desktop sizes, and writes review screenshots to `test/artifacts/mobile/`. Set `BROWSER_PATH` to use a specific Chromium executable.

## Legal
Unofficial fan project; not affiliated with or endorsed by Paizo Inc. This product contains material from Pathfinder Monster Core and Pathfinder Player Core (Paizo Inc.), used under the ORC License (Open RPG Creative License). Creature, ability and spell rules text are ORC licensed material. The pregenerated heroes, miniature designs and code are original. three.js is © its authors under the MIT license.
