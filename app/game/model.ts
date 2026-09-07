export type Mode =
  | 'menu'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'clear'
  | 'gameover'
  | 'victory';
export type Power =
  | 'multi'
  | 'laser'
  | 'wide'
  | 'slow'
  | 'catch'
  | 'shield'
  | 'life';
export const POWER: Record<
  Power,
  { label: string; glyph: string; color: number; duration: number }
> = {
  multi: { label: 'Multiball', glyph: 'M', color: 0x34e0e9, duration: 0 },
  laser: { label: 'Twin laser', glyph: 'L', color: 0xff718c, duration: 18 },
  wide: { label: 'Wide paddle', glyph: 'W', color: 0x4fdfa8, duration: 20 },
  slow: { label: 'Slow time', glyph: 'S', color: 0x82a7ff, duration: 14 },
  catch: { label: 'Magnet catch', glyph: 'C', color: 0xe6bd68, duration: 16 },
  shield: { label: 'Floor shield', glyph: 'H', color: 0x74dff3, duration: 0 },
  life: { label: 'Extra hull', glyph: '+', color: 0xffb6da, duration: 0 },
};
export const SECTORS = [
  'The glass garden',
  'Prism cascade',
  'Orbital bloom',
  'Solar lattice',
  'Crystal current',
  'The light keeper',
];
export type Ball = {
  id: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  held: boolean;
  captor: number | null;
  safe: number;
};
export type Brick = {
  id: number;
  x: number;
  z: number;
  hp: number;
  max: number;
  row: number;
  burst: boolean;
};
export type Drop = { id: number; x: number; z: number; kind: Power };
export type Drone = {
  id: number;
  x: number;
  z: number;
  age: number;
  hp: number;
  ball: number | null;
  cargo: Power | null;
  escape: number;
  phase: number;
};
export type Shot = { id: number; x: number; z: number };
export type FX = {
  kind:
    | 'brick'
    | 'hit'
    | 'paddle'
    | 'power'
    | 'drone'
    | 'pulse'
    | 'lost'
    | 'launch'
    | 'boss';
  x: number;
  z: number;
  color: number;
};
export type Snapshot = {
  mode: Mode;
  score: number;
  level: number;
  lives: number;
  energy: number;
  combo: number;
  remaining: number;
  total: number;
  notice: string;
  powers: { kind: Power; seconds: number }[];
  shield: number;
  captured: boolean;
  boss: number;
};
export const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));
export function rebound(offset: number, speed: number) {
  const a = clamp(offset, -1, 1) * 1.04;
  return { vx: Math.sin(a) * speed, vz: -Math.cos(a) * speed };
}
export class Game {
  mode: Mode = 'menu';
  resumeMode: Mode = 'ready';
  score = 0;
  level = 0;
  lives = 3;
  energy = 100;
  combo = 0;
  shield = 0;
  paddle = 0;
  target = 0;
  time = 0;
  notice = '';
  noticeUntil = 0;
  boss = 0;
  bossX = 0;
  balls: Ball[] = [];
  bricks: Brick[] = [];
  drops: Drop[] = [];
  drones: Drone[] = [];
  shots: Shot[] = [];
  powers: Partial<Record<Power, number>> = {};
  events: FX[] = [];
  private serial = 0;
  private spawnIn = 8;
  private fireIn = 0;
  private broken = 0;
  private total = 0;
  private sequence = 0;
  constructor(public random: () => number = Math.random) {
    this.loadLevel();
  }
  get width() {
    return this.powers.wide ? 7 : 5.4;
  }
  get speed() {
    return (
      (9.4 + this.level * 0.75 + Math.min(this.broken * 0.028, 2)) *
      (this.powers.slow ? 0.68 : 1)
    );
  }
  id() {
    return ++this.serial;
  }
  say(text: string, duration = 3) {
    this.notice = text;
    this.noticeUntil = this.time + duration;
  }
  start() {
    this.score = 0;
    this.level = 0;
    this.lives = 3;
    this.energy = 100;
    this.time = 0;
    this.sequence = 0;
    this.loadLevel();
    this.mode = 'ready';
    this.say('Click or press Space to launch', 5);
  }
  loadLevel() {
    this.bricks = [];
    this.balls = [];
    this.drops = [];
    this.drones = [];
    this.shots = [];
    this.powers = {};
    this.combo = 0;
    this.shield = 0;
    this.spawnIn = 8;
    this.fireIn = 0;
    this.broken = 0;
    this.paddle = 0;
    this.target = 0;
    this.boss = this.level === 5 ? 18 : 0;
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 11; c++) {
        const skip =
          (this.level === 1 && (c + r) % 5 === 0) ||
          (this.level === 2 && Math.abs(c - 5) > r + 2) ||
          (this.level === 3 && (r === 2 || r === 3) && c % 3 === 0) ||
          (this.level === 4 && (c + r) % 4 === 0) ||
          (this.level === 5 && r < 2);
        if (skip) continue;
        const hp = this.level > 0 && (r + c + this.level) % 5 === 0 ? 2 : 1;
        this.bricks.push({
          id: this.id(),
          x: (c - 5) * 1.42,
          z: -9.4 + r * 1.04,
          hp,
          max: hp,
          row: r % 6,
          burst: this.level > 1 && (r * 11 + c) % 13 === 0,
        });
      }
    this.total = this.bricks.length;
    this.addBall(0, 7.85, true);
  }
  addBall(x: number, z: number, held = false, angle = 0) {
    if (this.balls.length >= 7) return;
    const v = rebound(angle, this.speed);
    this.balls.push({
      id: this.id(),
      x,
      z,
      ...v,
      held,
      captor: null,
      safe: 1.5,
    });
  }
  action() {
    if (
      this.mode === 'menu' ||
      this.mode === 'gameover' ||
      this.mode === 'victory'
    ) {
      this.start();
      return;
    }
    if (this.mode === 'clear') {
      this.level++;
      this.loadLevel();
      this.mode = 'ready';
      this.say('New sector. Click to launch');
      return;
    }
    if (this.mode === 'paused') {
      this.mode = this.resumeMode;
      return;
    }
    if (this.mode === 'ready' || this.mode === 'playing') {
      this.mode = 'playing';
      this.notice = '';
      for (const b of this.balls)
        if (b.held) {
          b.held = false;
          Object.assign(b, rebound((this.random() - 0.5) * 0.55, this.speed));
          b.safe = 1.5;
          this.events.push({ kind: 'launch', x: b.x, z: b.z, color: 0x55ddee });
        }
      if (this.powers.laser) this.fire();
    }
  }
  pause() {
    if (this.mode === 'paused') {
      this.mode = this.resumeMode;
      return;
    }
    if (this.mode === 'playing' || this.mode === 'ready') {
      this.resumeMode = this.mode;
      this.mode = 'paused';
    }
  }
  fire() {
    if (this.fireIn > 0) return;
    this.fireIn = 0.28;
    for (const x of [-this.width * 0.38, this.width * 0.38])
      this.shots.push({ id: this.id(), x: this.paddle + x, z: 8.1 });
  }
  pulse() {
    if (this.mode !== 'playing' || this.energy < 100) return;
    this.energy = 0;
    this.events.push({
      kind: 'pulse',
      x: this.paddle,
      z: 8.5,
      color: 0x67eafa,
    });
    for (const d of this.drones) this.destroyDrone(d);
    for (const b of this.balls) {
      if (!b.held && b.z > 3 && b.vz > 0) b.vz = -Math.abs(b.vz);
      b.safe = 3;
    }
    this.say('Pulse released · raiders cleared');
  }
  collect(kind: Power) {
    this.events.push({
      kind: 'power',
      x: this.paddle,
      z: 8.5,
      color: POWER[kind].color,
    });
    this.say(POWER[kind].label + ' online');
    this.score += 150;
    if (kind === 'multi') {
      const src = this.balls.find((b) => b.captor === null && !b.held);
      if (src) {
        this.addBall(src.x, src.z, false, -0.55);
        this.addBall(src.x, src.z, false, 0.55);
      } else {
        this.addBall(this.paddle, 7.6, false, -0.4);
        this.addBall(this.paddle, 7.6, false, 0.4);
      }
    } else if (kind === 'shield') this.shield = Math.min(3, this.shield + 1);
    else if (kind === 'life') this.lives = Math.min(5, this.lives + 1);
    else this.powers[kind] = POWER[kind].duration;
  }
  destroyDrone(d: Drone) {
    if (!this.drones.includes(d)) return;
    if (d.ball !== null) {
      const b = this.balls.find((b) => b.id === d.ball);
      if (b) {
        b.captor = null;
        b.x = d.x;
        b.z = d.z + 0.7;
        b.safe = 3;
        Object.assign(b, rebound(0.4, this.speed));
        b.vz = Math.abs(b.vz);
      }
    }
    if (d.cargo)
      this.drops.push({ id: this.id(), x: d.x, z: d.z, kind: d.cargo });
    this.drones = this.drones.filter((o) => o.id !== d.id);
    this.score += 250;
    this.energy = clamp(this.energy + 12, 0, 100);
    this.events.push({ kind: 'drone', x: d.x, z: d.z, color: 0xff7fa5 });
  }
  hitBrick(br: Brick, chain = false) {
    if (!this.bricks.includes(br)) return;
    br.hp--;
    this.events.push({
      kind: br.hp > 0 ? 'hit' : 'brick',
      x: br.x,
      z: br.z,
      color: [0xf3c881, 0x71cfde, 0x91baf1, 0xf59dba, 0x74d8cc, 0xc1aaee][
        br.row
      ],
    });
    if (br.hp > 0) {
      this.score += 25;
      return;
    }
    this.bricks = this.bricks.filter((o) => o.id !== br.id);
    this.broken++;
    this.combo++;
    this.score +=
      100 * Math.min(8, Math.max(1, Math.floor(this.combo / 4) + 1));
    this.energy = clamp(this.energy + 4, 0, 100);
    if (this.broken % 4 === 0) {
      const seq: Power[] = [
        'multi',
        'wide',
        'laser',
        'shield',
        'slow',
        'catch',
        'multi',
        'life',
      ];
      const kind = seq[this.sequence++ % seq.length];
      this.drops.push({ id: this.id(), x: br.x, z: br.z, kind });
    }
    if (br.burst && !chain) {
      for (const other of this.bricks)
        if (Math.hypot(other.x - br.x, other.z - br.z) < 2.25)
          this.hitBrick(other, true);
    }
  }
  step(dt: number) {
    dt = clamp(dt, 0, 0.05);
    if (this.mode !== 'playing' && this.mode !== 'ready') return;
    if (this.mode === 'ready') {
      this.paddle +=
        (clamp(this.target, -8 + this.width / 2, 8 - this.width / 2) -
          this.paddle) *
        Math.min(1, dt * 22);
      for (const b of this.balls) {
        b.x = this.paddle;
        b.z = 7.85;
      }
      return;
    }
    const n = Math.max(1, Math.ceil(dt * 180));
    for (let i = 0; i < n && this.mode === 'playing'; i++) this.tick(dt / n);
  }
  private tick(dt: number) {
    this.time += dt;
    this.energy = clamp(this.energy + dt * 1.15, 0, 100);
    this.fireIn -= dt;
    for (const key of Object.keys(this.powers) as Power[]) {
      this.powers[key]! -= dt;
      if (this.powers[key]! <= 0) delete this.powers[key];
    }
    this.paddle +=
      (clamp(this.target, -8 + this.width / 2, 8 - this.width / 2) -
        this.paddle) *
      Math.min(1, dt * 22);
    if (this.powers.laser) this.fire();
    this.bossX = Math.sin(this.time * 0.65) * 4.8;
    for (const b of this.balls) {
      b.safe -= dt;
      if (b.captor !== null) continue;
      if (b.held) {
        b.x = this.paddle;
        b.z = 7.85;
        continue;
      }
      const oldZ = b.z,
        oldX = b.x;
      const norm = Math.hypot(b.vx, b.vz) || 1;
      b.vx = (b.vx / norm) * this.speed;
      b.vz = (b.vz / norm) * this.speed;
      if (Math.abs(b.vz) < this.speed * 0.27) {
        b.vz = (b.vz < 0 ? -1 : 1) * this.speed * 0.4;
        b.vx = Math.sign(b.vx) * Math.sqrt(this.speed ** 2 - b.vz ** 2);
      }
      b.x += b.vx * dt;
      b.z += b.vz * dt;
      if (b.x < -7.8) {
        b.x = -7.8;
        b.vx = Math.abs(b.vx);
      }
      if (b.x > 7.8) {
        b.x = 7.8;
        b.vx = -Math.abs(b.vx);
      }
      if (b.z < -10.2) {
        b.z = -10.2;
        b.vz = Math.abs(b.vz);
      }
      if (
        b.vz > 0 &&
        oldZ < 8.16 &&
        b.z >= 8.16 &&
        Math.abs(b.x - this.paddle) < this.width / 2 + 0.2
      ) {
        b.z = 8.12;
        Object.assign(
          b,
          rebound((b.x - this.paddle) / (this.width / 2), this.speed),
        );
        this.combo = 0;
        this.events.push({ kind: 'paddle', x: b.x, z: 8.4, color: 0x5ff2eb });
        if (this.powers.catch) b.held = true;
      }
      if (b.z > 10.2 && this.shield > 0) {
        this.shield--;
        b.z = 10.15;
        b.vz = -Math.abs(b.vz);
        this.events.push({ kind: 'pulse', x: b.x, z: 10.2, color: 0x58ccff });
        this.say('Shield saved your ball');
      }
      if (b.z > 11.2) {
        this.balls = this.balls.filter((o) => o.id !== b.id);
        continue;
      }
      for (const br of this.bricks) {
        const dx = b.x - br.x,
          dz = b.z - br.z;
        if (Math.abs(dx) < 0.86 && Math.abs(dz) < 0.51) {
          if (Math.abs(oldZ - br.z) >= 0.5) {
            b.vz = -b.vz;
            b.z = br.z + Math.sign(oldZ - br.z) * 0.52;
          } else if (Math.abs(oldX - br.x) >= 0.85) {
            b.vx = -b.vx;
            b.x = br.x + Math.sign(oldX - br.x) * 0.87;
          } else if (0.86 - Math.abs(dx) < 0.51 - Math.abs(dz)) {
            b.vx = -b.vx;
            b.x = br.x + Math.sign(dx || 1) * 0.87;
          } else {
            b.vz = -b.vz;
            b.z = br.z + Math.sign(dz || 1) * 0.52;
          }
          this.hitBrick(br);
          break;
        }
      }
      if (
        this.boss > 0 &&
        Math.abs(b.x - this.bossX) < 1.8 &&
        Math.abs(b.z + 9) < 0.8
      ) {
        b.vz = Math.abs(b.vz);
        b.z = -8.15;
        this.hitBoss();
      }
    }
    for (const s of this.shots) {
      s.z -= 24 * dt;
      let hit = false;
      for (const d of this.drones)
        if (Math.hypot(s.x - d.x, s.z - d.z) < 0.75) {
          this.destroyDrone(d);
          hit = true;
          break;
        }
      if (!hit)
        for (const br of this.bricks)
          if (Math.abs(s.x - br.x) < 0.68 && Math.abs(s.z - br.z) < 0.48) {
            this.hitBrick(br);
            hit = true;
            break;
          }
      if (
        !hit &&
        this.boss > 0 &&
        Math.abs(s.x - this.bossX) < 1.8 &&
        Math.abs(s.z + 9) < 0.7
      ) {
        this.hitBoss();
        hit = true;
      }
      if (hit || s.z < -11)
        this.shots = this.shots.filter((o) => o.id !== s.id);
    }
    for (const drop of this.drops) {
      drop.z += 2.4 * dt;
      if (
        drop.z >= 8 &&
        drop.z < 9 &&
        Math.abs(drop.x - this.paddle) < this.width / 2 + 0.35
      ) {
        this.collect(drop.kind);
        this.drops = this.drops.filter((o) => o.id !== drop.id);
      } else if (drop.z > 11)
        this.drops = this.drops.filter((o) => o.id !== drop.id);
    }
    this.spawnIn -= dt;
    if (this.spawnIn <= 0 && this.drones.length < 2) {
      this.spawnIn = Math.max(6, 11 - this.level);
      this.drones.push({
        id: this.id(),
        x: (this.random() - 0.5) * 12,
        z: -9.7,
        age: 0,
        hp: 1,
        ball: null,
        cargo: null,
        escape: 0,
        phase: this.random() * 6.28,
      });
      this.say('Raider inbound · E to repel', 2.5);
    }
    for (const d of this.drones) {
      d.age += dt;
      if (d.ball !== null || d.cargo) {
        d.escape += dt;
        d.z -= 1.65 * dt;
        d.x += Math.sin(this.time * 3 + d.phase) * dt * 0.7;
        if (d.ball !== null) {
          const b = this.balls.find((b) => b.id === d.ball);
          if (b) {
            b.x = d.x;
            b.z = d.z;
          }
        }
        if (d.z < -11 || d.escape > 8) {
          if (d.ball !== null) {
            this.balls = this.balls.filter((b) => b.id !== d.ball);
            this.say('Ball stolen · intercept the next raider');
          } else this.say('Power-up stolen');
          this.drones = this.drones.filter((o) => o.id !== d.id);
        }
        continue;
      }
      const drop = this.drops.reduce<Drop | undefined>(
        (best, p) =>
          !best ||
          Math.hypot(p.x - d.x, p.z - d.z) <
            Math.hypot(best.x - d.x, best.z - d.z)
            ? p
            : best,
        undefined,
      );
      const ball = this.balls.find(
        (b) => !b.held && b.captor === null && b.safe <= 0 && b.z > -2,
      );
      const tx = drop?.x ?? ball?.x ?? Math.sin(d.age * 0.8 + d.phase) * 6,
        tz = drop?.z ?? ball?.z ?? 1 + Math.sin(d.age * 0.5) * 3;
      const dist = Math.hypot(tx - d.x, tz - d.z) || 1;
      d.x += ((tx - d.x) / dist) * 2.1 * dt;
      d.z += ((tz - d.z) / dist) * 2.1 * dt;
      if (drop && Math.hypot(drop.x - d.x, drop.z - d.z) < 0.7) {
        d.cargo = drop.kind;
        this.drops = this.drops.filter((o) => o.id !== drop.id);
        this.say('Raider stole a capsule · hit it to recover');
      }
      for (const b of this.balls) {
        if (b.held || b.captor !== null || b.safe > 0) continue;
        if (Math.hypot(b.x - d.x, b.z - d.z) < 0.7) {
          if (b.vz > 0 && !d.cargo && d.ball === null) {
            b.captor = d.id;
            d.ball = b.id;
            this.say('BALL CAPTURED · press E to rescue', 5);
          } else {
            b.vz = -b.vz;
            b.safe = 0.8;
            this.destroyDrone(d);
          }
          break;
        }
      }
      if (d.age > 25 && d.ball === null && !d.cargo)
        this.drones = this.drones.filter((o) => o.id !== d.id);
    }
    if (this.balls.length === 0) {
      this.lives--;
      this.combo = 0;
      this.powers = {};
      this.shots = [];
      this.drones = [];
      this.drops = [];
      this.events.push({ kind: 'lost', x: this.paddle, z: 9, color: 0xff648b });
      if (this.lives <= 0) {
        this.mode = 'gameover';
      } else {
        this.mode = 'ready';
        this.energy = Math.max(70, this.energy);
        this.addBall(this.paddle, 7.85, true);
        this.say('Hull lost · click or Space to relaunch', 8);
      }
    }
    if (this.bricks.length === 0 && this.boss === 0) {
      this.score += 1000 * (this.level + 1);
      this.mode = this.level === 5 ? 'victory' : 'clear';
      this.say('Sector clear');
    }
  }
  hitBoss() {
    this.boss--;
    this.score += 200;
    this.events.push({ kind: 'boss', x: this.bossX, z: -9, color: 0xffd78f });
    if (this.boss === 0) this.say('Light keeper restored');
  }
  snapshot(): Snapshot {
    return {
      mode: this.mode,
      score: this.score,
      level: this.level,
      lives: this.lives,
      energy: this.energy,
      combo: Math.min(8, Math.floor(this.combo / 4) + 1),
      remaining: this.bricks.length,
      total: this.total,
      notice: this.time < this.noticeUntil ? this.notice : '',
      powers: (Object.keys(this.powers) as Power[]).map((kind) => ({
        kind,
        seconds: Math.ceil(this.powers[kind]!),
      })),
      shield: this.shield,
      captured: this.balls.some((b) => b.captor !== null),
      boss: this.boss,
    };
  }
}
