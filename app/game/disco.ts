import type { Ball, Game, Power } from './model';

export type Variant = 'classic' | 'disco';
export const VARIANTS: Variant[] = ['classic', 'disco'];
export const recordKey = (variant: Variant, kind: 'best' | 'checkpoint') =>
  `ark22-${variant === 'disco' ? 'disco-' : ''}${kind}`;

const PHASES = [
  {
    name: 'Power Shower',
    detail: 'Catch the rain · stack your specials',
    color: '#f28bff',
  },
  {
    name: 'Raider Rush',
    detail: 'Enemy surge · protect your capsules',
    color: '#ffb77d',
  },
  {
    name: 'Speed Fever',
    detail: 'Faster rebounds · double brick points',
    color: '#8beeff',
  },
  {
    name: 'Rebuild Remix',
    detail: 'Bricks rebuild faster · pierce seals cores',
    color: '#acff9b',
  },
];
export const discoPhaseIndex = (time: number) =>
  Math.floor(time / 14) % PHASES.length;
export function discoPhase(time: number) {
  const index = discoPhaseIndex(time);
  return { ...PHASES[index], index, seconds: Math.ceil(14 - (time % 14)) };
}
// Shared by physics and rendering so each visible bumper is its actual collision surface.
export const BUMPERS = [
  { x: -3.7, z: 2.1, radius: 0.7, color: 0xff52d9 },
  { x: 3.7, z: 2.1, radius: 0.7, color: 0x45eaff },
  { x: 0, z: 4.4, radius: 0.6, color: 0xe0ff65 },
];
export function collideBumpers(g: Game, b: Ball) {
  if (g.variant !== 'disco' || b.held || b.captor !== null) return;
  for (let i = 0; i < (g.level >= 4 ? 3 : 2); i++) {
    const bumper = BUMPERS[i];
    const dx = b.x - bumper.x,
      dz = b.z - bumper.z;
    const distance = Math.hypot(dx, dz),
      contact = bumper.radius + 0.2;
    if (distance >= contact) continue;
    const nx = distance > 0.001 ? dx / distance : 0;
    const nz = distance > 0.001 ? dz / distance : 1;
    b.x = bumper.x + nx * (contact + 0.01);
    b.z = bumper.z + nz * (contact + 0.01);
    const incoming = b.vx * nx + b.vz * nz;
    if (incoming >= 0) continue;
    b.vx -= 2 * incoming * nx;
    b.vz -= 2 * incoming * nz;
    g.events.push({
      kind: 'hit',
      x: bumper.x,
      z: bumper.z,
      color: bumper.color,
    });
  }
}
const RAIN: Power[] = [
  'multi',
  'laser',
  'wide',
  'pierce',
  'magnet',
  'shield',
  'slow',
  'freeze',
  'catch',
];
export function stepDisco(g: Game, dt: number) {
  if (g.variant !== 'disco' || g.powers.freeze) return;
  const oldPhase = Math.floor(g.discoTime / 14);
  g.discoTime += dt;
  const index = discoPhaseIndex(g.discoTime);
  if (Math.floor(g.discoTime / 14) !== oldPhase) {
    const phase = discoPhase(g.discoTime);
    g.say(`DISCO · ${phase.name} · ${phase.detail}`, 4);
    if (phase.index === 1) g.spawnIn = Math.min(g.spawnIn, 0.8);
  }
  g.discoDropIn -= dt;
  if (g.discoDropIn <= 0) {
    if (g.pendingDrops.length < 12) {
      const kind = RAIN[g.discoDrops++ % RAIN.length];
      g.pendingDrops.push({ x: (g.random() - 0.5) * 12, z: -4.5, kind });
    }
    g.discoDropIn = index === 0 ? 2.2 : 6;
  }
}
