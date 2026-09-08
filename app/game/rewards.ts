import { discoPhaseIndex } from './disco';
import type { Brick, Game, Power } from './model';

export type Regrowth = {
  id: number;
  brick: Brick;
  wait: number;
  duration: number;
};
const CACHE_POWERS: Power[] = [
  'wide',
  'multi',
  'laser',
  'slow',
  'pierce',
  'magnet',
  'catch',
  'freeze',
  'shield',
  'life',
];

export function prepareCaches(g: Game) {
  const eligible = g.bricks.filter((b) => !b.burst);
  const count =
    g.variant === 'disco'
      ? Math.min(14 + g.level, eligible.length)
      : g.level < 8
        ? 3
        : 4;
  for (let i = 0; i < count; i++) {
    const brick =
      eligible[Math.floor(((i + 1) * eligible.length) / (count + 1))];
    brick.cache = CACHE_POWERS[(g.level * 3 + i) % CACHE_POWERS.length];
  }
  if (g.variant === 'disco' || g.level >= 2)
    for (let i = 0; i < g.bricks.length; i++) {
      const brick = g.bricks[i];
      if (
        !brick.cache &&
        !brick.burst &&
        (i + g.level) % (g.variant === 'disco' ? 3 : 7) === 0
      )
        brick.regen =
          g.variant === 'disco' ? (g.level < 4 ? 2 : 3) : g.level < 8 ? 1 : 2;
    }
}

export function releaseCache(g: Game) {
  if (
    !g.pendingDrops.length ||
    g.time < g.nextDropAt ||
    g.drops.length >= (g.variant === 'disco' ? 3 : 1) ||
    (g.variant === 'classic' && g.drones.some((d) => d.cargo))
  )
    return;
  const drop = g.pendingDrops.shift()!;
  g.drops.push({ ...drop, id: g.id() });
  g.nextDropAt = g.time + (g.variant === 'disco' ? 0.75 : 8);
}

export function brickReward(g: Game, brick: Brick, sealed: boolean) {
  if (brick.cache && (g.variant === 'classic' || g.pendingDrops.length < 12)) {
    g.pendingDrops.push({ x: brick.x, z: brick.z, kind: brick.cache });
    releaseCache(g);
  }
  if (
    !sealed &&
    brick.regen &&
    g.regrowth.length < (g.variant === 'disco' ? 8 : 6)
  ) {
    const duration =
      g.variant === 'disco'
        ? Math.max(3.5, 6 - g.level * 0.2)
        : Math.max(7, 12 - (g.level - 2) * 0.5);
    g.regrowth.push({
      id: g.id(),
      duration,
      wait: duration,
      brick: {
        ...brick,
        id: g.id(),
        hp: 1,
        max: 1,
        cache: undefined,
        burst: false,
        regen: brick.regen - 1,
        grown: true,
      },
    });
  }
}

export function stepRewards(g: Game, dt: number) {
  releaseCache(g);
  // Finishing the live grid cancels every pending reconstruction.
  if (!g.bricks.length && !g.boss) {
    g.regrowth = [];
    return;
  }
  if (g.powers.freeze) return;
  let count = 0;
  for (const growth of g.regrowth) {
    growth.wait -=
      dt *
      (g.variant === 'disco' && discoPhaseIndex(g.discoTime) === 3 ? 1.8 : 1);
    if (growth.wait <= 0) {
      const b = growth.brick;
      const occupied = g.balls.some(
        (ball) =>
          !ball.held &&
          ball.captor === null &&
          Math.abs(ball.x - b.x) < 1.05 &&
          Math.abs(ball.z - b.z) < 0.7,
      );
      if (occupied) growth.wait = 0.2;
      else {
        g.bricks.push(b);
        g.events.push({ kind: 'hit', x: b.x, z: b.z, color: 0x65dba9 });
        continue;
      }
    }
    g.regrowth[count++] = growth;
  }
  g.regrowth.length = count;
}
