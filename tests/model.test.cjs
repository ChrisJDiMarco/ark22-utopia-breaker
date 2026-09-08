const fs = require('node:fs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const ts = require('typescript');
const path = require('node:path');
const os = require('node:os');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ark22-test-'));
const compiled = path.join(temp, 'model.js');
const file = path.resolve(__dirname, '../app/game/model.ts');
const source = fs.readFileSync(file, 'utf8');
fs.writeFileSync(
  compiled,
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText,
);
for (const name of ['campaign', 'encounters']) {
  const helper = path.resolve(__dirname, `../app/game/${name}.ts`);
  if (fs.existsSync(helper))
    fs.writeFileSync(
      path.join(temp, `${name}.js`),
      ts.transpileModule(fs.readFileSync(helper, 'utf8'), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
    );
}
const { Game } = require(compiled);
const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, pass: true });
  } catch (e) {
    results.push({ name, pass: false, error: e.message });
  }
}
function ready() {
  const g = new Game(() => 0.5);
  g.start();
  return g;
}
function play() {
  const g = ready();
  g.action();
  g.spawnIn = 1e8;
  return g;
}
function advance(g, s) {
  for (let i = 0; i < s * 180; i++) {
    g.step(1 / 180);
    g.events = [];
  }
}
function drone(g, props = {}) {
  const d = {
    id: g.id(),
    x: 0,
    z: 0,
    age: 0,
    hp: 1,
    kind: 'thief',
    fireIn: 4,
    aimX: 0,
    ball: null,
    cargo: null,
    escape: 0,
    phase: 0,
    ...props,
  };
  g.drones.push(d);
  return d;
}
test('start creates 99 bricks and one held ball', () => {
  const g = ready();
  assert.equal(g.bricks.length, 99);
  assert.equal(g.balls.length, 1);
  assert(g.balls[0].held);
  assert.equal(g.mode, 'ready');
});
test('pause preserves all gameplay state and timers', () => {
  const g = play();
  g.collect('laser');
  g.pause();
  g.events = [];
  const before = JSON.stringify(g);
  advance(g, 30);
  assert.equal(JSON.stringify(g), before);
  g.pause();
  assert.equal(g.mode, 'playing');
});
test('walls reflect at maximum ball speed', () => {
  const g = play();
  g.level = 5;
  g.broken = 80;
  Object.assign(g.balls[0], { x: 7.79, z: 1, vx: 20, vz: 5 });
  g.step(0.05);
  assert(g.balls[0].vx < 0);
  assert(g.balls[0].x <= 7.8);
});
test('paddle intercept reflects downward ball', () => {
  const g = play();
  Object.assign(g.balls[0], { x: 0, z: 8.14, vx: 0, vz: 10 });
  g.step(0.05);
  assert(g.balls[0].vz < 0);
  assert.equal(g.lives, 3);
});
test('brick collision damages only once per encounter', () => {
  const g = play();
  g.bricks = [{ id: g.id(), x: 0, z: 0, hp: 2, max: 2, row: 0, burst: false }];
  Object.assign(g.balls[0], { x: 0, z: 0.7, vx: 0, vz: -10 });
  g.step(0.05);
  assert.equal(g.bricks[0].hp, 1);
  assert(g.balls[0].vz > 0);
});
test('three unshielded losses trigger gameover', () => {
  const g = play();
  for (let i = 0; i < 3; i++) {
    Object.assign(g.balls[0], { z: 11.3, x: 6, vz: 10 });
    g.step(0.01);
    if (i < 2) {
      assert.equal(g.mode, 'ready');
      g.action();
    }
  }
  assert.equal(g.lives, 0);
  assert.equal(g.mode, 'gameover');
});
test('shield saves ball and consumes one charge', () => {
  const g = play();
  g.collect('shield');
  Object.assign(g.balls[0], { z: 10.19, x: 6, vz: 10 });
  g.step(0.02);
  assert.equal(g.shield, 0);
  assert(g.balls[0].vz < 0);
  assert.equal(g.lives, 3);
});
test('magnet held ball remains launchable after timer expires', () => {
  const g = play();
  g.collect('catch');
  Object.assign(g.balls[0], { x: 0, z: 8.14, vx: 0, vz: 10 });
  g.step(0.02);
  assert(g.balls[0].held);
  advance(g, 17);
  assert(!g.powers.catch);
  g.action();
  assert(!g.balls[0].held);
});
test('multiball limits to seven balls', () => {
  const g = play();
  for (let i = 0; i < 10; i++) g.collect('multi');
  assert.equal(g.balls.length, 7);
});
test('twelve sector completion transitions reach victory', () => {
  const g = play();
  for (let level = 0; level < 12; level++) {
    assert.equal(g.level, level);
    g.bricks = [];
    g.boss = 0;
    g.step(0.01);
    assert.equal(g.mode, level === 11 ? 'victory' : 'clear');
    if (level < 11) {
      g.action();
      assert.equal(g.mode, 'ready');
      g.action();
    }
  }
  assert.equal(g.level, 11);
});
test('capture then rescue pulse releases ball', () => {
  const g = play();
  const d = drone(g, { z: 2 });
  const b = g.balls[0];
  Object.assign(b, { x: 0, z: 2, vx: 0, vz: 10, safe: 0 });
  g.step(0.005);
  assert.equal(b.captor, d.id);
  g.pulse();
  assert.equal(b.captor, null);
  assert.equal(g.drones.length, 0);
  assert(b.safe >= 3);
});
test('stolen capsule is returned when carrier destroyed', () => {
  const g = play();
  const d = drone(g);
  g.drops.push({ id: g.id(), x: 0, z: 0, kind: 'life' });
  Object.assign(g.balls[0], { x: 6, z: 6 });
  g.step(0.005);
  assert.equal(d.cargo, 'life');
  assert.equal(g.drops.length, 0);
  g.destroyDrone(d);
  assert.equal(g.drops[0].kind, 'life');
});
test('captured final ball escape costs life and allows relaunch', () => {
  const g = play();
  const b = g.balls[0];
  const d = drone(g, { z: -10.99, ball: b.id });
  b.captor = d.id;
  g.step(0.05);
  assert.equal(g.mode, 'ready');
  assert.equal(g.lives, 2);
  assert.equal(g.balls[0].captor, null);
});
test('capture at raider age limit never leaves an orphan ball', () => {
  const g = play();
  const d = drone(g, { age: 24.999, z: 2 });
  const b = g.balls[0];
  Object.assign(b, { x: 0, z: 2, vx: 0, vz: 10, safe: 0 });
  g.step(0.005);
  assert(
    g.drones.some((d) => d.id === b.captor) || b.captor === null,
    JSON.stringify({ captor: b.captor, drones: g.drones.length, mode: g.mode }),
  );
});
test('pierce damages armor once per passage and keeps its direction', () => {
  const g = play();
  g.bricks = [{ id: g.id(), x: 0, z: 0, hp: 3, max: 3, row: 0, burst: false }];
  g.collect('pierce');
  Object.assign(g.balls[0], { x: 0, z: 0.7, vx: 0, vz: -10 });
  advance(g, 0.14);
  assert.equal(g.bricks[0].hp, 2);
  assert(g.balls[0].vz < 0);
});
test('sentinel requires two hits and pays only once', () => {
  const g = play(),
    d = drone(g, { kind: 'sentinel', hp: 2 });
  const before = g.score;
  g.hitDrone(d);
  assert.equal(d.hp, 1);
  assert(g.drones.includes(d));
  g.hitDrone(d);
  assert(!g.drones.includes(d));
  const paid = g.score;
  g.hitDrone(d);
  assert(paid > before);
  assert.equal(g.score, paid);
});
test('freeze halts enemy, bomb, escape and spawn clocks but not ball physics', () => {
  const g = play();
  const d = drone(g, { kind: 'bomber', fireIn: 0.5 });
  g.bombs.push({ id: g.id(), x: 5, z: 2, vx: 0, vz: 6 });
  g.collect('freeze');
  const before = JSON.stringify([g.drones, g.bombs, g.spawnIn, g.enemyTime]);
  const z = g.balls[0].z;
  advance(g, 0.25);
  assert.equal(
    JSON.stringify([g.drones, g.bombs, g.spawnIn, g.enemyTime]),
    before,
  );
  assert.notEqual(g.balls[0].z, z);
  assert(g.powers.freeze < 8);
});
test('bomber locks warning target before releasing its bomb', () => {
  const g = play(),
    d = drone(g, { kind: 'bomber', fireIn: 1, z: 1, x: 4 });
  g.paddle = g.target = -3;
  advance(g, 0.15);
  assert.equal(g.bombs.length, 0);
  assert(d.fireIn < 0.9);
  const locked = d.aimX;
  g.target = 3;
  advance(g, 0.9);
  assert.equal(g.bombs.length, 1);
  assert.equal(d.aimX, locked);
});
test('bomb hit jams briefly without directly removing hull and pulse clears bombs', () => {
  const g = play();
  Object.assign(g.balls[0], { x: 6, z: 3 });
  g.bombs.push({ id: g.id(), x: 0, z: 8.12, vx: 0, vz: 6 });
  g.step(0.02);
  assert.equal(g.lives, 3);
  assert(g.jam > 0 && g.width < 5.4);
  assert.equal(g.bombs.length, 0);
  g.bombs.push({ id: g.id(), x: 5, z: 2, vx: 0, vz: 6 });
  g.energy = 100;
  g.pulse();
  assert.equal(g.bombs.length, 0);
  assert.equal(g.jam, 0);
});
test('magnet pulls capsules toward paddle without overshoot', () => {
  const g = play();
  g.collect('magnet');
  g.drops.push({ id: g.id(), x: 6, z: 3, kind: 'wide' });
  advance(g, 0.4);
  assert(g.drops[0].x < 6 && g.drops[0].x >= 0);
});
test('supply applies after reset, only once, and remains until launch', () => {
  const g = play();
  g.bricks = [];
  g.boss = 0;
  g.step(0.01);
  g.chooseSupply('arsenal');
  g.action();
  assert.equal(g.mode, 'ready');
  assert(g.powers.laser && g.powers.wide);
  const seconds = g.powers.laser;
  advance(g, 4);
  assert.equal(g.powers.laser, seconds);
  g.chooseSupply('repair');
  assert.equal(g.lives, 3);
});
test('guardians appear in sectors 4, 8, 12 with increasing health', () => {
  const g = ready(),
    health = [];
  for (let level = 0; level < 12; level++) {
    g.level = level;
    g.loadLevel();
    if ((level + 1) % 4 === 0) {
      assert(g.boss > 0);
      health.push(g.boss);
    } else assert.equal(g.boss, 0);
  }
  assert(health[0] < health[1] && health[1] < health[2]);
});
test('last-brick clear wins the same tick as final ball loss', () => {
  const g = play();
  g.lives = 1;
  g.bricks = [];
  g.boss = 0;
  g.balls = [];
  g.step(0.01);
  assert.equal(g.mode, 'clear');
  assert.equal(g.lives, 1);
});
test('restart clears hazards and supports campaign checkpoint starts', () => {
  const g = play();
  g.jam = 3;
  g.bombs.push({ id: g.id(), x: 0, z: 1, vx: 0, vz: 6 });
  g.start(8);
  assert.equal(g.level, 8);
  assert.equal(g.score, 0);
  assert.equal(g.bombs.length, 0);
  assert.equal(g.jam, 0);
  assert.equal(g.mode, 'ready');
});
const output = {
  sha256: crypto.createHash('sha256').update(source).digest('hex'),
  results,
};
console.log(JSON.stringify(output, null, 2));
fs.rmSync(temp, { recursive: true, force: true });
if (results.some((r) => !r.pass)) process.exitCode = 1;
