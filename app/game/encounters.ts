import { ENEMIES, CAMPAIGN } from './campaign';
import { clamp, type Game, type Drop, type Drone } from './model';

export function spawnEnemy(g: Game) {
  const lineup = CAMPAIGN[g.level].enemies;
  const kind = lineup[g.wave++ % lineup.length];
  g.drones.push({
    id: g.id(),
    kind,
    x: (g.random() - 0.5) * 12,
    z: -9.7,
    age: 0,
    hp: ENEMIES[kind].hp + (kind === 'sentinel' && g.level >= 8 ? 1 : 0),
    ball: null,
    cargo: null,
    escape: 0,
    phase: g.random() * Math.PI * 2,
    fireIn: 4,
    aimX: 0,
  });
  g.say(`${ENEMIES[kind].label} inbound · E to repel`, 2.5);
}

export function launchBomb(g: Game, x: number, z: number, aim: number) {
  if (g.bombs.length >= 12) return;
  const dz = 8.5 - z,
    dx = aim - x,
    length = Math.hypot(dx, dz);
  g.bombs.push({
    id: g.id(),
    x,
    z,
    vx: (dx / length) * 6,
    vz: (dz / length) * 6,
  });
}

function thief(g: Game, d: Drone, dt: number) {
  const drop = g.drops.reduce<Drop | undefined>(
    (best, p) =>
      !best ||
      Math.hypot(p.x - d.x, p.z - d.z) < Math.hypot(best.x - d.x, best.z - d.z)
        ? p
        : best,
    undefined,
  );
  const ball = g.balls.find(
    (b) => !b.held && b.captor === null && b.safe <= 0 && b.z > -2,
  );
  const tx = drop?.x ?? ball?.x ?? Math.sin(d.age * 0.8 + d.phase) * 6;
  const tz = drop?.z ?? ball?.z ?? 1 + Math.sin(d.age * 0.5) * 3;
  const dist = Math.hypot(tx - d.x, tz - d.z) || 1;
  d.x += ((tx - d.x) / dist) * 2.1 * dt;
  d.z += ((tz - d.z) / dist) * 2.1 * dt;
  if (drop && Math.hypot(drop.x - d.x, drop.z - d.z) < 0.7) {
    d.cargo = drop.kind;
    g.drops = g.drops.filter((o) => o.id !== drop.id);
    g.say('Raider stole a capsule · hit it to recover');
  }
}

export function stepEnemies(g: Game, dt: number) {
  // Every hostile clock shares this pause, including warnings and carrier escapes.
  const frozen = !!g.powers.freeze;
  if (!frozen) {
    g.enemyTime += dt;
    g.spawnIn -= dt;
    if (
      g.spawnIn <= 0 &&
      g.drones.length < (g.level < 3 ? 1 : g.level < 8 ? 2 : 3)
    ) {
      g.spawnIn = Math.max(9, 18 - g.level * 0.8);
      spawnEnemy(g);
    }
    if (g.boss > 0) {
      g.bossX = Math.sin(g.enemyTime * 0.65) * 4.8;
      const previous = g.bossFireIn;
      g.bossFireIn -= dt;
      if (previous > 1 && g.bossFireIn <= 1) g.bossAim = g.paddle;
      if (g.bossFireIn <= 0) {
        const spread = g.boss <= g.bossMax / 2 ? [-2, 0, 2] : [0];
        for (const offset of spread)
          launchBomb(g, g.bossX, -8.1, clamp(g.bossAim + offset, -7, 7));
        g.bossFireIn = Math.max(3.5, 6 - g.level * 0.15);
      }
    }
  }
  for (const d of g.drones) {
    if (!frozen) d.age += dt;
    if (d.ball !== null || d.cargo) {
      if (!frozen) {
        d.escape += dt;
        d.z -= 1.65 * dt;
        d.x += Math.sin(g.enemyTime * 3 + d.phase) * dt * 0.7;
      }
      if (d.ball !== null) {
        const b = g.balls.find((b) => b.id === d.ball);
        if (b) {
          b.x = d.x;
          b.z = d.z;
        }
      }
      if (d.z < -11 || d.escape > 8) {
        g.balls = g.balls.filter((b) => b.id !== d.ball);
        g.drones = g.drones.filter((o) => o.id !== d.id);
        g.say(
          d.ball !== null
            ? 'Ball stolen · intercept the next raider'
            : 'Power-up stolen',
        );
        continue;
      }
    } else if (!frozen) {
      if (d.kind === 'thief') thief(g, d, dt);
      else {
        d.z += (d.z < -0.5 ? 2 : Math.sin(d.age + d.phase) * 0.3) * dt;
        d.x = clamp(
          d.x + Math.cos(d.age * 0.8 + d.phase) * dt * 2.2,
          -6.5,
          6.5,
        );
        if (d.kind === 'bomber') {
          const previous = d.fireIn;
          d.fireIn -= dt;
          if (previous > 0.9 && d.fireIn <= 0.9) d.aimX = g.paddle;
          if (d.fireIn <= 0) {
            launchBomb(g, d.x, d.z, d.aimX);
            d.fireIn = 4.5;
          }
        }
      }
    }
    for (const b of g.balls) {
      if (b.held || b.captor !== null || b.safe > 0) continue;
      if (Math.hypot(b.x - d.x, b.z - d.z) >= 0.75) continue;
      if (
        !frozen &&
        d.kind === 'thief' &&
        b.vz > 0 &&
        !d.cargo &&
        d.ball === null &&
        !g.powers.pierce
      ) {
        b.captor = d.id;
        d.ball = b.id;
        g.say(
          'BALL CAPTURED · align below + Space (35 charge), or E to pulse',
          5,
        );
      } else {
        if (!g.powers.pierce) b.vz = -b.vz;
        b.safe = 0.3;
        g.hitDrone(d);
      }
      break;
    }
    if (d.age > 25 && d.ball === null && !d.cargo)
      g.drones = g.drones.filter((o) => o.id !== d.id);
  }
  for (const bomb of g.bombs) {
    if (!frozen) {
      bomb.x += bomb.vx * dt;
      bomb.z += bomb.vz * dt;
    }
    const ball = g.balls.find(
      (b) =>
        !b.held &&
        b.captor === null &&
        Math.hypot(b.x - bomb.x, b.z - bomb.z) < 0.55,
    );
    const shot = g.shots.find(
      (s) => Math.hypot(s.x - bomb.x, s.z - bomb.z) < 0.45,
    );
    const hitsPaddle =
      bomb.z >= 8 &&
      bomb.z < 8.8 &&
      Math.abs(bomb.x - g.paddle) < g.width / 2 + 0.2;
    if (ball || shot || hitsPaddle || bomb.z > 11 || Math.abs(bomb.x) > 8.5) {
      g.bombs = g.bombs.filter((o) => o.id !== bomb.id);
      if (shot) g.shots = g.shots.filter((o) => o.id !== shot.id);
      if (ball || shot) g.score += 75;
      else if (hitsPaddle) {
        g.jam = 3;
        g.energy = Math.max(0, g.energy - 20);
        g.say('Paddle disrupted · 3 seconds. Pulse clears it.', 3);
      }
      if (ball || shot || hitsPaddle)
        g.events.push({ kind: 'hit', x: bomb.x, z: bomb.z, color: 0xffa14d });
    }
  }
}
