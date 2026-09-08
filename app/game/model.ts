import { CAMPAIGN, ENEMIES, type EnemyKind, type Supply } from './campaign';
import { stepEnemies } from './encounters';
export { SECTORS } from './campaign';
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
  | 'life'
  | 'pierce'
  | 'freeze'
  | 'magnet';
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
  pierce: { label: 'Prism pierce', glyph: 'P', color: 0xffa85b, duration: 12 },
  freeze: { label: 'Cryo field', glyph: 'F', color: 0x9feaff, duration: 8 },
  magnet: {
    label: 'Capsule magnet',
    glyph: 'A',
    color: 0xd6a4ff,
    duration: 18,
  },
};
export type Ball = {
  id: number;
  x: number;
  z: number;
  vx: number;
  vz: number;
  held: boolean;
  captor: number | null;
  safe: number;
  contacts: Set<number>;
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
  kind: EnemyKind;
  fireIn: number;
  aimX: number;
  x: number;
  z: number;
  age: number;
  hp: number;
  ball: number | null;
  cargo: Power | null;
  escape: number;
  phase: number;
};
export type Bomb = { id: number; x: number; z: number; vx: number; vz: number };
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
  bossMax: number;
  bossWarning: boolean;
  jam: number;
  supply: Supply;
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
  bossMax = 0;
  bossFireIn = 6;
  bossAim = 0;
  enemyTime = 0;
  wave = 0;
  jam = 0;
  supply: Supply = 'shield';
  bombs: Bomb[] = [];
  balls: Ball[] = [];
  bricks: Brick[] = [];
  drops: Drop[] = [];
  drones: Drone[] = [];
  shots: Shot[] = [];
  powers: Partial<Record<Power, number>> = {};
  events: FX[] = [];
  private serial = 0;
  spawnIn = 8;
  private fireIn = 0;
  private broken = 0;
  private total = 0;
  private sequence = 0;
  constructor(public random: () => number = Math.random) {
    this.loadLevel();
  }
  get width() {
    return (this.powers.wide ? 7 : 5.4) * (this.jam > 0 ? 0.72 : 1);
  }
  get speed() {
    return (
      (9.4 + Math.min(this.level, 7) * 0.6 + Math.min(this.broken * 0.028, 2)) *
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
  start(checkpoint = 0) {
    this.score = 0;
    this.level = [0, 4, 8].includes(checkpoint) ? checkpoint : 0;
    this.lives = 3;
    this.energy = 100;
    this.time = 0;
    this.sequence = 0;
    this.loadLevel();
    this.mode = 'ready';
    this.say(CAMPAIGN[this.level].hint, 8);
  }
  loadLevel() {
    this.bricks = [];
    this.balls = [];
    this.drops = [];
    this.drones = [];
    this.shots = [];
    this.bombs = [];
    this.jam = 0;
    this.enemyTime = 0;
    this.wave = 0;
    this.supply = 'shield';
    this.bossFireIn = 6;
    this.bossAim = 0;
    this.bossX = 0;
    this.powers = {};
    this.combo = 0;
    this.shield = 0;
    this.spawnIn = 8;
    this.fireIn = 0;
    this.broken = 0;
    this.paddle = 0;
    this.target = 0;
    this.bossMax = CAMPAIGN[this.level].guardian?.hp ?? 0;
    this.boss = this.bossMax;
    for (let r = 0; r < 9; r++)
      for (let c = 0; c < 11; c++) {
        if (!CAMPAIGN[this.level].pattern(r, c)) continue;
        const hp =
          this.level === 9 && (r === 0 || r === 8 || c === 0 || c === 10)
            ? 3
            : this.level > 0 && (r + c + this.level) % 5 === 0
              ? 2
              : 1;
        this.bricks.push({
          id: this.id(),
          x: (c - 5) * 1.42,
          z: -9.4 + r * 1.04,
          hp,
          max: hp,
          row: r % 6,
          burst:
            this.level > 1 && (r * 11 + c) % (this.level === 6 ? 5 : 13) === 0,
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
      contacts: new Set(),
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
      const reward = this.supply;
      this.level++;
      this.loadLevel();
      this.energy = 100;
      if (reward === 'shield') this.shield = 2;
      else if (reward === 'repair') {
        if (this.lives < 5) this.lives++;
        else this.score += 1500;
      } else {
        this.powers.laser = 18;
        this.powers.wide = 20;
      }
      this.mode = 'ready';
      this.say(CAMPAIGN[this.level].hint, 8);
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
  chooseSupply(supply: Supply) {
    if (
      this.mode === 'clear' &&
      ['shield', 'repair', 'arsenal'].includes(supply)
    )
      this.supply = supply;
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
    this.bombs = [];
    this.jam = 0;
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
  hitDrone(d: Drone) {
    if (!this.drones.includes(d)) return;
    d.hp--;
    if (d.hp <= 0) this.destroyDrone(d);
    else {
      this.score += 50;
      this.events.push({
        kind: 'hit',
        x: d.x,
        z: d.z,
        color: ENEMIES[d.kind].color,
      });
    }
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
    this.score += d.kind === 'sentinel' ? 400 : 250;
    this.energy = clamp(this.energy + 12, 0, 100);
    this.events.push({
      kind: 'drone',
      x: d.x,
      z: d.z,
      color: ENEMIES[d.kind].color,
    });
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
        'pierce',
        'freeze',
        'magnet',
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
    this.jam = Math.max(0, this.jam - dt);
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
      for (const id of b.contacts) {
        const br = this.bricks.find((br) => br.id === id);
        if (!br || Math.abs(b.x - br.x) >= 0.86 || Math.abs(b.z - br.z) >= 0.51)
          b.contacts.delete(id);
      }
      for (const br of this.bricks) {
        const dx = b.x - br.x,
          dz = b.z - br.z;
        if (Math.abs(dx) < 0.86 && Math.abs(dz) < 0.51) {
          if (b.contacts.has(br.id)) continue;
          if (this.powers.pierce) {
            b.contacts.add(br.id);
            this.hitBrick(br);
            continue;
          }
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
          this.hitDrone(d);
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
      if (this.powers.magnet)
        drop.x += clamp(this.paddle - drop.x, -5 * dt, 5 * dt);
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
    stepEnemies(this, dt);
    // A completed sector takes precedence over a simultaneous last-ball loss.
    if (this.bricks.length === 0 && this.boss === 0) {
      this.score += 1000 * (this.level + 1);
      this.mode = this.level === CAMPAIGN.length - 1 ? 'victory' : 'clear';
      this.say('Sector clear');
      return;
    }
    if (this.balls.length === 0) {
      this.lives--;
      this.combo = 0;
      this.powers = {};
      this.shots = [];
      this.drones = [];
      this.drops = [];
      this.bombs = [];
      this.jam = 0;
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
  }
  hitBoss() {
    if (this.boss <= 0) return;
    this.boss--;
    this.score += 200;
    this.events.push({ kind: 'boss', x: this.bossX, z: -9, color: 0xffd78f });
    if (this.boss === 0) {
      this.bombs = [];
      this.say(`${CAMPAIGN[this.level].guardian?.name ?? 'Guardian'} restored`);
    }
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
      bossMax: this.bossMax,
      bossWarning: this.boss > 0 && this.bossFireIn <= 1,
      jam: Math.ceil(this.jam),
      supply: this.supply,
    };
  }
}
