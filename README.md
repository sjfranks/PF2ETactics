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

## Project layout
- `index.html` — the built, single-file game (what GitHub Pages serves).
- `src/` — engine (`engine.js`, `actions.js`, `ai.js`), data (`data_*.js`), renderer (`render3d.js`, `models.js`, `gfx.js`) and UI (`ui_*.js`, `shell.html`, `style.css`).
- `build.py` — concatenates `src/` into `dist/three-action-tactics.html` and `dist/local.html` (offline build using `vendor/three.min.js`).
- `test/` — rules unit tests and AI-vs-AI battle simulations (`node test/rules.js`, `node test/sim.js`, `node test/mc_all.js`).
- `tools/` — importers that generate `src/data_mc.js` and `src/data_spells_auto.js` from the Foundry VTT pf2e data packs.

To rebuild after changing `src/`: `python3 build.py && cp dist/three-action-tactics.html index.html`.

## Legal
Unofficial fan project; not affiliated with or endorsed by Paizo Inc. This product contains material from Pathfinder Monster Core and Pathfinder Player Core (Paizo Inc.), used under the ORC License (Open RPG Creative License). Creature, ability and spell rules text are ORC licensed material. The pregenerated heroes, miniature designs and code are original. three.js is © its authors under the MIT license.
