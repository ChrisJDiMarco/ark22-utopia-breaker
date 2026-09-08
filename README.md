# ARK / 22 — Utopia Breaker

A real-time Three.js brick-breaker in a sunlit glass atrium. Built with GPT Sites, using the user-approved generated concept and achimala's Dream Loop workflow.

## Play

Move the paddle with mouse, touch drag, arrows, or A/D. Click or Space launches. E spends a charged rescue pulse. P pauses. The game also pauses when the window loses focus.

Restore twelve distinct sectors and defeat guardians in sectors 4, 8, and 12. Raiders steal descending balls and falling capsules; hit a carrier with another ball or a laser, or use pulse to recover its cargo. If all balls are captured, align the paddle underneath a carrier and press Space to reclaim one for 35 charge. Armored violet sentinels take two hits, rising to three in the final chapter. Amber bombers warn and lock their aim before firing; their bombs briefly narrow your paddle and drain charge, and can be intercepted with balls, lasers, or pulse.

All ten pickups remain: multiball, twin lasers, wide paddle, slow time, magnet catch, floor shields, extra hull, prism pierce, cryo field, and capsule magnet. Specials come from three gold-ringed cache bricks per sector, four in the final chapter. Rewards queue and release one at a time with at least eight seconds between fresh drops; ordinary and rebuilt bricks do not generate drops. Multiball caps rise from three to four to five across the chapters. Lasers have six twin bursts; laser and pierce replace each other. Pierce cuts through three bricks per paddle return and permanently seals regenerative cores, including armored ones.

Green-ringed bricks appear from sector 3. They rebuild once, or twice in the final chapter, with a visible wireframe warning. Regrowth waits for balls to leave the slot and stops while cryo is active. Clearing the live grid and guardian cancels all pending growth. Rebuilt bricks award only 25 points and no new supplies or pulse charge. Ball speed and armor continue increasing through the campaign, with a calmer early enemy cadence.

Each cleared sector awards one salvage. Bank it or buy one shield (one salvage), one hull repair (two), or a short laser/wide-paddle launch (two). Clearing sectors 4 and 8 unlocks checkpoints at 5 and 9. Checkpoint flights begin with a fresh score, zero salvage, and three lives; best score and unlocked checkpoints stay on the current device.

## Development

`npm install`, `npm run dev`, `npm test`, `node tests/projection.test.mjs`, `node tests/effects.test.mjs`, `node tests/campaign.test.cjs`, `npm run build`.

Game simulation is in `app/game/model.ts`, campaign patterns in `campaign.ts`, enemy behavior in `encounters.ts`, rendering in `arena.ts` and `encounter-visuals.ts`, and the React HUD in `app/page.tsx`. Tests cover collisions, power-ups, pause, captures, rescue, escape, armor, warnings, freeze, supplies, and campaign progression. The seeded campaign test plays through real physics with an automated paddle; it verifies reachability and state invariants, not human difficulty or rendering performance. Projection tests protect the approved board framing and pointer alignment.

Rendering reuses ball-trail buffers, capsule/laser geometry and glyph materials, limits live fragments to 90, and compacts debris once per frame. Simulation processes short frame dips in bounded slices instead of discarding elapsed time below 20fps. Tests verify buffer reuse and equal elapsed simulation time at 60, 15, and 10fps; these are not GPU frame-rate measurements.

## Sources and original assets

- [Original Arkanoid instruction manual](https://files.stardustarcade.com/PDF_Arcade_Manuals_and_Schematics/Arkanoid.pdf): angled rebounds, collectible capsules, expansion, catch, lasers, multiple balls, and progression informed this reinterpretation. Raider cargo and rescue pulse are new mechanics.
- [Dream Loop by achimala](https://github.com/achimala/dream-loop): concept target, live screenshots, independent visual critique, and iterative refinement.
- [Three.js physical materials](https://threejs.org/docs/pages/MeshPhysicalMaterial.html).

The paddle and drone are original Blender models. The detailed arena is an original generated backplate aligned to the live 3D play plane; gameplay objects, shadows, reflections, particles and lighting render in real time. The reflection environment is an original generated image (sRGB LDR). No external model libraries, paid assets, or API keys are required at runtime.
