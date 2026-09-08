const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const ts = require('typescript');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ark22-disco-'));
for (const name of ['model', 'campaign', 'encounters', 'rewards', 'disco']) {
  const file = path.resolve(__dirname, `../app/game/${name}.ts`);
  if (!fs.existsSync(file)) continue;
  fs.writeFileSync(
    path.join(temp, `${name}.js`),
    ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
  );
}
const { Game } = require(path.join(temp, 'model.js'));
// An exact deterministic trace recorded before Disco existed protects Classic physics and balance.
let seed = 761;
const classic = new Game(
  () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 2 ** 32,
);
classic.start();
classic.action();
const trace = [];
for (let frame = 0; frame < 18000; frame++) {
  const ball = classic.balls.find((b) => !b.held && b.captor === null);
  classic.target = ball?.x ?? 0;
  if (classic.mode === 'ready' || classic.mode === 'clear') classic.action();
  if (frame % 600 === 0) classic.pulse();
  classic.advance(1 / 60);
  classic.events.length = 0;
  if (frame % 60 === 0) {
    const snapshot = classic.snapshot();
    delete snapshot.variant;
    delete snapshot.disco;
    trace.push([snapshot, classic.balls, classic.bricks]);
  }
}
const digest = crypto
  .createHash('sha256')
  .update(JSON.stringify(trace))
  .digest('hex');
const baseline = path.join(__dirname, 'classic-baseline.sha256');
if (process.env.RECORD_CLASSIC === '1') {
  fs.writeFileSync(baseline, digest + '\n');
} else {
  assert.equal(
    digest,
    fs.readFileSync(baseline, 'utf8').trim(),
    'Classic must exactly match its pre-Disco trace',
  );
  const { discoPhase, collideBumpers, BUMPERS, recordKey } = require(
    path.join(temp, 'disco.js'),
  );
  const { stepRewards, releaseCache } = require(path.join(temp, 'rewards.js'));
  const { spawnEnemy } = require(path.join(temp, 'encounters.js'));
  const game = () => {
    const g = new Game(() => 0.5);
    g.start(0, 'disco');
    return g;
  };
  let g = game();
  assert.equal(g.snapshot().variant, 'disco');
  assert(g.bricks.filter((b) => b.cache).length >= 12);
  assert(g.bricks.some((b) => b.regen >= 2));
  assert(g.bricks.some((b) => b.hp > 1));
  g.action();
  for (let i = 0; i < 20; i++) g.collect('multi');
  assert.equal(g.balls.length, 7);
  g.collect('laser');
  g.collect('pierce');
  assert(g.powers.laser && g.powers.pierce, 'Disco weapons stack');
  assert.equal(g.laserAmmo, 12);
  for (let i = 0; i < 20; i++) spawnEnemy(g);
  assert.equal(g.drones.length, 4);
  assert.deepEqual(
    new Set(g.drones.map((d) => d.kind)),
    new Set(['thief', 'sentinel', 'bomber']),
  );
  for (const br of [...g.bricks]) {
    while (g.bricks.includes(br)) g.hitBrick(br);
  }
  assert(
    g.pendingDrops.length <= 12 &&
      g.regrowth.length <= 8 &&
      g.drops.length <= 3,
  );
  g.nextDropAt = 0;
  releaseCache(g);
  g.nextDropAt = 0;
  releaseCache(g);
  for (const d of [...g.drones]) {
    d.cargo = 'wide';
    g.destroyDrone(d);
  }
  assert(
    g.drops.length <= 3 && g.pendingDrops.length <= 12,
    'Recovered cargo also respects bounds',
  );
  g = game();
  const regenerating = g.bricks.find((b) => b.regen && !b.cache);
  while (g.bricks.includes(regenerating)) g.hitBrick(regenerating);
  assert.equal(g.regrowth[0].brick.regen, regenerating.regen - 1);
  const wait = g.regrowth[0].wait;
  g.powers.freeze = 2;
  stepRewards(g, 1);
  assert.equal(g.regrowth[0].wait, wait);
  delete g.powers.freeze;
  g.discoTime = 43;
  stepRewards(g, 1);
  assert(
    g.regrowth[0].wait < wait - 1,
    'Rebuild Remix accelerates finite regeneration',
  );
  g.bricks = [];
  g.boss = 0;
  stepRewards(g, 1);
  assert.equal(g.regrowth.length, 0);
  g = game();
  g.action();
  g.powers.freeze = 2;
  g.advance(0.1);
  assert.equal(g.discoTime, 0);
  delete g.powers.freeze;
  g.advance(0.1);
  const time = g.discoTime;
  g.pause();
  g.advance(0.1);
  assert.equal(g.discoTime, time);
  assert.equal(discoPhase(0).name, 'Power Shower');
  assert.equal(discoPhase(14).name, 'Raider Rush');
  assert.equal(discoPhase(28).name, 'Speed Fever');
  assert.equal(discoPhase(42).name, 'Rebuild Remix');
  assert.equal(discoPhase(56).name, 'Power Shower');
  g = game();
  const b = g.balls[0],
    bumper = BUMPERS[0];
  Object.assign(b, {
    held: false,
    x: bumper.x,
    z: bumper.z + 0.7,
    vx: 0,
    vz: -10,
  });
  collideBumpers(g, b);
  assert(
    b.vz > 0 && b.z > bumper.z + 0.7,
    'Bumper separates and reflects incoming balls',
  );
  const v = b.vz;
  collideBumpers(g, b);
  assert.equal(b.vz, v, 'No repeat flip after leaving bumper');
  g.mode = 'clear';
  g.action();
  assert.equal(g.variant, 'disco');
  g.start(4);
  assert.equal(g.variant, 'disco');
  assert.equal(g.level, 4);
  g.collect('laser');
  g.pendingDrops.push({ kind: 'wide', x: 0, z: 0 });
  g.discoTime = 20;
  g.start(0, 'classic');
  assert.equal(g.variant, 'classic');
  assert.equal(g.discoTime, 0);
  assert.equal(g.pendingDrops.length, 0);
  assert.equal(g.laserAmmo, 0);
  assert.equal(g.bricks.filter((b) => b.cache).length, 3);
  assert.equal(recordKey('classic', 'best'), 'ark22-best');
  assert.equal(recordKey('disco', 'best'), 'ark22-disco-best');
  assert.notEqual(
    recordKey('classic', 'checkpoint'),
    recordKey('disco', 'checkpoint'),
  );
  console.log(
    'Disco: mode isolation, Classic trace, weapon stacking, entity caps, phases, pause/cryo, regrowth, bumpers, and record keys passed.',
  );
}
fs.rmSync(temp, { recursive: true, force: true });
