const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const ts = require('typescript');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'ark22-campaign-'));
for (const name of ['model', 'campaign', 'encounters', 'rewards']) {
  const source = fs.readFileSync(
    path.resolve(__dirname, `../app/game/${name}.ts`),
    'utf8',
  );
  fs.writeFileSync(
    path.join(temp, `${name}.js`),
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
  );
}
const { Game } = require(path.join(temp, 'model.js'));
const runs = [];
for (let run = 0; run < 6; run++) {
  const initial = 0;
  let seed = 1421 + run;
  const rand = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const g = new Game(rand);
  g.start();
  g.level = initial;
  g.loadLevel();
  g.action();
  let captures = 0,
    losses = 0,
    clears = 0,
    maxBalls = 0,
    peakScore = 0;
  for (let frame = 0; frame < 180000; frame++) {
    if (g.mode === 'gameover' || g.mode === 'victory') break;
    if (g.mode === 'ready' || g.balls.some((b) => b.held)) g.action();
    if (g.mode === 'clear') {
      clears++;
      g.chooseSupply(
        g.lives < 3 ? 'repair' : g.level % 2 ? 'arsenal' : 'shield',
      );
      g.action();
      g.action();
    }
    const ball = g.balls
      .filter((b) => !b.held && b.captor === null)
      .sort((a, b) => b.z - a.z)[0];
    if (ball) {
      let aim = ball.x;
      if (ball.vz > 0) {
        aim += (ball.vx * Math.max(0, 8.16 - ball.z)) / ball.vz;
        while (aim > 7.8 || aim < -7.8)
          aim = aim > 7.8 ? 15.6 - aim : -15.6 - aim;
      }
      g.target = aim + Math.sin(g.time * 0.55) * 0.65;
      const drop = g.drops.find((d) => d.z > 3.5 && d.z < 8.5);
      if (drop && ball.vz < 0 && ball.z < 5) g.target = drop.x;
      if (ball.z > 9 && ball.vz > 0 && g.energy >= 100) g.pulse();
    }
    if (g.balls.some((b) => b.captor !== null)) {
      captures++;
      if (g.stranded) {
        const carrier = g.drones.find((d) => d.ball !== null);
        if (carrier) g.target = carrier.x;
        if (g.tetherTarget && g.energy >= 35) g.action();
      } else if (g.energy >= 100) g.pulse();
    }
    const prevLives = g.lives;
    g.step(1 / 60);
    if (g.lives < prevLives) losses++;
    maxBalls = Math.max(maxBalls, g.balls.length);
    peakScore = Math.max(peakScore, g.score);
    for (const b of g.balls) {
      assert(
        Number.isFinite(b.x) &&
          Number.isFinite(b.z) &&
          Number.isFinite(b.vx) &&
          Number.isFinite(b.vz),
      );
      assert(
        b.captor === null || g.drones.some((d) => d.id === b.captor),
        'orphan captor at sector ' + initial + ' frame ' + frame,
      );
    }
    assert(g.bombs.length <= 12);
    for (const d of g.drones)
      assert(Number.isFinite(d.x) && Number.isFinite(d.z));
    assert(g.energy >= 0 && g.energy <= 100);
    assert(g.boss >= 0);
    assert(g.lives >= 0 && g.lives <= 5);
    g.events = [];
  }
  runs.push({
    seed: 1421 + run,
    initialSector: initial + 1,
    finalSector: g.level + 1,
    mode: g.mode,
    gameSeconds: +g.time.toFixed(1),
    lives: g.lives,
    bricks: g.bricks.length,
    capturedFrames: captures,
    losses,
    clears,
    maxBalls,
    peakScore,
  });
  if (g.mode === 'victory') break;
}
fs.rmSync(temp, { recursive: true, force: true });
console.log(JSON.stringify(runs, null, 2));
assert(
  runs.some((r) => r.mode === 'victory'),
  'At least one seeded full campaign must be winnable',
);
