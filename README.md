# ARK / 22 — Utopia Breaker

A real-time Three.js brick-breaker in a sunlit glass atrium. Built with GPT Sites, using the user-approved generated concept and achimala's Dream Loop workflow.

## Play

Move the paddle with mouse, touch drag, arrows, or A/D. Click or Space launches. E spends a charged rescue pulse. P pauses. The game also pauses when the window loses focus.

Restore twelve distinct sectors and defeat guardians in sectors 4, 8, and 12. Raiders steal descending balls and falling capsules; hit a carrier with another ball or a laser, or use pulse to recover its cargo. Armored violet sentinels take two hits. Amber bombers warn and lock their aim before firing; their bombs briefly narrow your paddle and drain charge, and can be intercepted with balls, lasers, or pulse.

Ten pickups include multiball, twin lasers, wide paddle, slow time, magnet catch, floor shields, extra hull, prism pierce, cryo field, and capsule magnet. Pierce damages each brick once per passage; cryo freezes hostile clocks and bombs while balls stay live. Guardians fire wider volleys below half health.

Between sectors, choose two shields, a hull repair, or a powered launch. Clearing sectors 4 and 8 unlocks checkpoints at 5 and 9. Checkpoint flights begin with a fresh score and three lives; best score and unlocked checkpoints stay on the current device.

## Development

`npm install`, `npm run dev`, `npm test`, `node tests/projection.test.mjs`, `node tests/campaign.test.cjs`, `npm run build`.

Game simulation is in `app/game/model.ts`, campaign patterns in `campaign.ts`, enemy behavior in `encounters.ts`, rendering in `arena.ts` and `encounter-visuals.ts`, and the React HUD in `app/page.tsx`. Tests cover collisions, power-ups, pause, captures, rescue, escape, armor, warnings, freeze, supplies, and campaign progression. The seeded campaign test plays through real physics with an automated paddle; it verifies reachability and state invariants, not human difficulty or rendering performance. Projection tests protect the approved board framing and pointer alignment.

## Sources and original assets

- [Original Arkanoid instruction manual](https://files.stardustarcade.com/PDF_Arcade_Manuals_and_Schematics/Arkanoid.pdf): angled rebounds, collectible capsules, expansion, catch, lasers, multiple balls, and progression informed this reinterpretation. Raider cargo and rescue pulse are new mechanics.
- [Dream Loop by achimala](https://github.com/achimala/dream-loop): concept target, live screenshots, independent visual critique, and iterative refinement.
- [Three.js physical materials](https://threejs.org/docs/pages/MeshPhysicalMaterial.html).

The paddle and drone are original Blender models. The detailed arena is an original generated backplate aligned to the live 3D play plane; gameplay objects, shadows, reflections, particles and lighting render in real time. The reflection environment is an original generated image (sRGB LDR). No external model libraries, paid assets, or API keys are required at runtime.
