# ARK / 22 — Utopia Breaker

A real-time Three.js brick-breaker in a sunlit glass atrium. Built with GPT Sites, using the user-approved generated concept and achimala's Dream Loop workflow.

## Play

Move the paddle with mouse, touch drag, arrows, or A/D. Click or Space launches. E spends a charged rescue pulse. P pauses. The game also pauses when the window loses focus.

Clear six sectors, then defeat the Light Keeper. Raiders steal descending balls and falling capsules; hit a carrier with another ball or a laser, or use pulse to recover its cargo. Seven pickups provide multiball, automatic twin lasers, a wider paddle, slow time, magnet catch, floor shields, and extra hull. Best score stays on the current device.

## Development

`npm install`, `npm run dev`, `npm test`, `npm run build`.

Game simulation is in `app/game/model.ts`, rendering in `app/game/arena.ts`, and the React HUD in `app/page.tsx`. Tests cover collisions, power-ups, pause, captures, rescue, escape, gameover, stage progression, and the age-limit capture regression.

## Sources and original assets

- [Original Arkanoid instruction manual](https://files.stardustarcade.com/PDF_Arcade_Manuals_and_Schematics/Arkanoid.pdf): angled rebounds, collectible capsules, expansion, catch, lasers, multiple balls, and progression informed this reinterpretation. Raider cargo and rescue pulse are new mechanics.
- [Dream Loop by achimala](https://github.com/achimala/dream-loop): concept target, live screenshots, independent visual critique, and iterative refinement.
- [Three.js physical materials](https://threejs.org/docs/pages/MeshPhysicalMaterial.html).

The paddle and drone are original Blender models. The detailed arena is an original generated backplate aligned to the live 3D play plane; gameplay objects, shadows, reflections, particles and lighting render in real time. The reflection environment is an original generated image (sRGB LDR). No external model libraries, paid assets, or API keys are required at runtime.
