const fs = require('node:fs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const ts = require('typescript');
const path = require('node:path');
const os = require('node:os');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ark22-test-'));
const compiled = path.join(temp, 'model.cjs');
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
test('six sector completion transitions reach victory', () => {
  const g = play();
  for (let level = 0; level < 6; level++) {
    assert.equal(g.level, level);
    g.bricks = [];
    g.boss = 0;
    g.step(0.01);
    assert.equal(g.mode, level === 5 ? 'victory' : 'clear');
    if (level < 5) {
      g.action();
      assert.equal(g.mode, 'ready');
      g.action();
    }
  }
  assert.equal(g.level, 5);
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
const output = {
  sha256: crypto.createHash('sha256').update(source).digest('hex'),
  results,
};
console.log(JSON.stringify(output, null, 2));
fs.rmSync(temp, { recursive: true, force: true });
if (results.some((r) => !r.pass)) process.exitCode = 1;
