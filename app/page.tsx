'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpRight,
  AudioLines,
  CircleHelp,
  Maximize2,
  Pause,
  Play,
  Radio,
  RotateCcw,
  VolumeX,
  Zap,
  Shield,
  Sparkles,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { POWER, SECTORS, type Snapshot, type Power } from './game/model';
import { VARIANTS, recordKey, type Variant } from './game/disco';
import { CAMPAIGN, SUPPLIES } from './game/campaign';
import type { Arena } from './game/arena';
const INITIAL: Snapshot = {
  mode: 'menu',
  variant: 'classic',
  disco: null,
  score: 0,
  level: 0,
  lives: 3,
  energy: 100,
  combo: 1,
  remaining: 66,
  total: 66,
  notice: '',
  powers: [],
  shield: 0,
  captured: false,
  stranded: false,
  tetherReady: false,
  boss: 0,
  bossMax: 0,
  bossWarning: false,
  jam: 0,
  supply: 'save',
  credits: 0,
  growing: 0,
};
export default function Home() {
  const host = useRef<HTMLDivElement>(null),
    game = useRef<Arena | null>(null),
    bestRef = useRef({ classic: 0, disco: 0 }),
    savedRef = useRef({ classic: 0, disco: 0 }),
    checkpointRef = useRef({ classic: 0, disco: 0 });
  const [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [state, setState] = useState(INITIAL),
    [best, setBest] = useState(0),
    [sound, setSound] = useState(false),
    [manual, setManual] = useState(false),
    [checkpoint, setCheckpoint] = useState(0);
  useEffect(() => {
    let gone = false;
    const bestRecords = bestRef.current;
    let instance: Arena | undefined;
    for (const variant of VARIANTS) {
      try {
        const saved = Number(localStorage.getItem(recordKey(variant, 'best')));
        if (Number.isFinite(saved) && saved > 0) {
          bestRef.current[variant] = saved;
          savedRef.current[variant] = saved;
        }
        const checkpoint = Number(
          localStorage.getItem(recordKey(variant, 'checkpoint')),
        );
        if (checkpoint === 4 || checkpoint === 8)
          checkpointRef.current[variant] = checkpoint;
      } catch {}
    }
    import('./game/arena')
      .then(({ Arena }) => {
        if (gone || !host.current) return;
        instance = new Arena(host.current, (s) => {
          if (gone) return;
          setState(s);
          const variant = s.variant;
          const reached = s.level + (s.mode === 'clear' ? 1 : 0);
          const unlocked = Math.min(8, Math.floor(reached / 4) * 4);
          if (unlocked > checkpointRef.current[variant]) {
            checkpointRef.current[variant] = unlocked;
            try {
              localStorage.setItem(
                recordKey(variant, 'checkpoint'),
                String(unlocked),
              );
            } catch {}
          }
          if (s.score > bestRef.current[variant])
            bestRef.current[variant] = s.score;
          setBest(bestRef.current[variant]);
          setCheckpoint(checkpointRef.current[variant]);
          if (
            ['clear', 'gameover', 'victory'].includes(s.mode) &&
            bestRef.current[variant] > savedRef.current[variant]
          )
            try {
              localStorage.setItem(
                recordKey(variant, 'best'),
                String(bestRef.current[variant]),
              );
              savedRef.current[variant] = bestRef.current[variant];
            } catch {}
          if (host.current?.dataset.error) setError(host.current.dataset.error);
        });
        game.current = instance;
        setReady(true);
      })
      .catch((e) => {
        console.error('Arena failed to initialize', e);
        setError(
          'Your browser could not start the 3D arena. Try reloading or enabling graphics acceleration.',
        );
      });
    return () => {
      gone = true;
      for (const variant of VARIANTS) {
        try {
          localStorage.setItem(
            recordKey(variant, 'best'),
            String(bestRecords[variant]),
          );
        } catch {}
      }
      instance?.dispose();
      game.current = null;
    };
  }, []);
  const action = () => game.current?.action();
  const selectVariant = (variant: Variant) => {
    const arena = game.current;
    if (!arena || !['menu', 'gameover', 'victory'].includes(arena.game.mode))
      return;
    arena.game.start(0, variant);
    arena.game.mode = 'menu';
    setState(arena.game.snapshot());
    setBest(bestRef.current[variant]);
    setCheckpoint(checkpointRef.current[variant]);
  };
  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    game.current?.setSound(next);
    host.current?.querySelector('canvas')?.focus();
  };
  const pause = () => {
    game.current?.game.pause();
    host.current?.querySelector('canvas')?.focus();
  };
  const showManual = () => {
    if (
      game.current?.game.mode === 'playing' ||
      game.current?.game.mode === 'ready'
    )
      game.current.game.pause();
    setManual(true);
  };
  const pulse = () => {
    game.current?.game.pulse();
    host.current?.querySelector('canvas')?.focus();
  };
  const screen = () => {
    host.current?.querySelector('canvas')?.focus();
    if (document.fullscreenElement)
      void document.exitFullscreen().catch(() => {});
    else
      void document
        .querySelector('.game-shell')
        ?.requestFullscreen?.()
        .catch(() => {});
  };
  const isEnd = state.mode === 'gameover' || state.mode === 'victory';
  const overlay = ['menu', 'paused', 'clear', 'gameover', 'victory'].includes(
    state.mode,
  );
  return (
    <main
      className={`game-shell ${state.variant === 'disco' ? 'is-disco' : ''}`}
    >
      <div className="arena-backdrop" aria-hidden="true" />
      <div ref={host} className="arena" aria-label="3D brick breaker arena" />
      <header className="topbar">
        <div className="wordmark">
          ARK<span>/</span>22<small>UTOPIA BREAKER</small>
        </div>
        <div className="sector">
          <i /> SECTOR {String(state.level + 1).padStart(2, '0')}
          <span>{SECTORS[state.level].toUpperCase()}</span>
        </div>
        <div className="header-actions">
          <button
            onClick={toggleSound}
            title={sound ? 'Mute sound' : 'Enable sound'}
            aria-pressed={sound}
          >
            {sound ? <AudioLines size={18} /> : <VolumeX size={18} />}
          </button>
          <button
            onClick={pause}
            title={state.mode === 'paused' ? 'Resume game' : 'Pause game'}
            disabled={!['playing', 'ready', 'paused'].includes(state.mode)}
          >
            {state.mode === 'paused' ? <Play size={18} /> : <Pause size={18} />}
          </button>
          <button onClick={screen} title="Fullscreen" className="fullscreen">
            <Maximize2 size={17} />
          </button>
        </div>
      </header>
      <div className="scoreboard">
        <div>
          <small>SCORE</small>
          <strong>{String(state.score).padStart(6, '0')}</strong>
        </div>
        <div>
          <small>
            BEST · {state.variant === 'disco' ? 'DISCO' : 'THIS DEVICE'}
          </small>
          <strong>{String(best).padStart(6, '0')}</strong>
        </div>
        <div className="lives">
          <small>HULL</small>
          <strong aria-label={`${state.lives} lives`}>
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className={i >= state.lives ? 'empty' : ''}>
                ▰
              </span>
            ))}
          </strong>
        </div>
        {state.mode !== 'menu' && (
          <div className="remaining">
            <small>GRID</small>
            <strong>
              {state.remaining}
              <em>
                {' '}
                / {state.total}
                {state.growing > 0 ? ` · ${state.growing} regrowing` : ''}
              </em>
            </strong>
          </div>
        )}
      </div>
      {state.disco && !overlay && (
        <div className="disco-event" style={{ borderColor: state.disco.color }}>
          <span>
            <Sparkles size={14} /> DISCO / {state.disco.name}{' '}
            <time>{state.disco.seconds}s</time>
          </span>
          <small>{state.disco.detail}</small>
        </div>
      )}
      <div className="power-stack">
        {state.jam > 0 && (
          <div className="active-power disrupted">
            <Zap size={14} /> Paddle disrupted <time>{state.jam}s</time>
          </div>
        )}
        {state.combo > 1 && (
          <div className="combo">
            <Sparkles size={14} /> {state.combo}× COMBO
          </div>
        )}
        {state.powers.map((p) => (
          <div
            className="active-power"
            key={p.kind}
            style={{ borderColor: '#' + POWER[p.kind].color.toString(16) }}
          >
            <b>{POWER[p.kind].glyph}</b>
            <span>{POWER[p.kind].label}</span>
            <time>
              {p.kind === 'laser' ? `${p.charges} bursts` : `${p.seconds}s`}
            </time>
          </div>
        ))}
        {state.shield > 0 && (
          <div className="active-power">
            <Shield size={15} />
            <span>Floor shield</span>
            <time>×{state.shield}</time>
          </div>
        )}
      </div>
      {state.boss > 0 && state.mode !== 'menu' && (
        <div className={`boss-health ${state.bossWarning ? 'warning' : ''}`}>
          <span>
            {CAMPAIGN[state.level].guardian?.name.toUpperCase()}
            {state.bossWarning ? ' · VOLLEY INCOMING' : ''}
          </span>
          <meter min={0} max={state.bossMax} value={state.boss} />
        </div>
      )}
      <output
        className={`notice ${state.captured ? 'danger' : ''}`}
        aria-live="polite"
      >
        {!overlay && state.notice}
      </output>
      {overlay && !manual && (
        <section
          className={`start-card ${state.mode === 'clear' ? 'supply-card' : ''}`}
        >
          <div className="eyebrow">
            <Radio size={15} />{' '}
            {state.mode === 'menu'
              ? state.variant === 'disco'
                ? 'AFTER HOURS · 2186'
                : 'SYSTEMS ONLINE · 2186'
              : state.mode === 'paused'
                ? 'FLIGHT SUSPENDED'
                : state.mode === 'clear'
                  ? 'SECTOR RESTORED'
                  : state.mode === 'victory'
                    ? 'ALL SECTORS RESTORED'
                    : 'SIGNAL LOST'}
          </div>
          <h1>
            {state.mode === 'menu' ? (
              <>
                {state.variant === 'disco'
                  ? 'Break the bricks.'
                  : 'A brighter kind'}
                <br />
                {state.variant === 'disco'
                  ? 'Own the dance floor.'
                  : 'of destruction.'}
              </>
            ) : state.mode === 'paused' ? (
              'Take a breath.'
            ) : state.mode === 'clear' ? (
              'Beautifully broken.'
            ) : state.mode === 'victory' ? (
              'Let there be light.'
            ) : (
              'One more flight?'
            )}
          </h1>
          <p>
            {state.mode === 'menu' ? (
              <>
                {state.variant === 'disco'
                  ? 'Power showers. Neon bumpers. Raider rushes.'
                  : 'Twelve sectors. Three guardians. Ten power-ups.'}
                <br />
                {state.variant === 'disco'
                  ? 'The grid grows back. Keep the party alive.'
                  : 'Keep the light alive.'}
              </>
            ) : state.mode === 'paused' ? (
              'Your flight is right where you left it.'
            ) : state.mode === 'clear' ? (
              `${SECTORS[state.level]} cleared. ${SECTORS[state.level + 1]} awaits.`
            ) : state.mode === 'victory' ? (
              'Twelve sectors cleared. Every guardian restored. The future is bright.'
            ) : (
              <>
                The garden is waiting.
                <br />
                Launch again and beat your best.
              </>
            )}
          </p>
          {state.mode === 'clear' && (
            <fieldset className="supply-options">
              <legend>{state.credits} salvage · choose a supply or save</legend>
              {SUPPLIES.map((supply) => (
                <button
                  key={supply.kind}
                  type="button"
                  aria-pressed={state.supply === supply.kind}
                  disabled={
                    state.credits < supply.cost ||
                    (supply.kind === 'repair' && state.lives >= 5)
                  }
                  onClick={() => {
                    game.current?.game.chooseSupply(supply.kind);
                    host.current?.querySelector('canvas')?.focus();
                  }}
                >
                  <b>
                    {supply.title}
                    {supply.cost > 0 ? ` · ${supply.cost} salvage` : ''}
                  </b>
                  <span>{supply.detail}</span>
                </button>
              ))}
              {(state.level === 3 || state.level === 7) && (
                <small>
                  Checkpoint unlocked · Sector{' '}
                  {String(state.level + 2).padStart(2, '0')}
                </small>
              )}
            </fieldset>
          )}
          {isEnd && (
            <div className="final-score">
              {state.score.toLocaleString()}
              <small>POINTS</small>
            </div>
          )}
          {(state.mode === 'menu' || isEnd) && (
            <fieldset className="mode-options" disabled={!ready || !!error}>
              <legend>Choose your flight</legend>
              <button
                type="button"
                aria-pressed={state.variant === 'classic'}
                onClick={() => selectVariant('classic')}
              >
                <b>Classic</b>
                <small>Precision & progression</small>
              </button>
              <button
                type="button"
                aria-pressed={state.variant === 'disco'}
                onClick={() => selectVariant('disco')}
              >
                <b>
                  <Sparkles size={13} /> Disco mode
                </b>
                <small>All-out arcade energy</small>
              </button>
            </fieldset>
          )}
          <button
            className="primary"
            disabled={!ready || !!error}
            onClick={action}
          >
            {!ready
              ? 'Preparing arena'
              : state.mode === 'menu'
                ? state.variant === 'disco'
                  ? 'Start Disco mode'
                  : 'Enter the arena'
                : state.mode === 'paused'
                  ? 'Resume flight'
                  : state.mode === 'clear'
                    ? 'Next sector'
                    : 'Fly again'}
            {isEnd ? <RotateCcw size={18} /> : <ArrowUpRight size={20} />}
          </button>
          {checkpoint > 0 &&
            ['menu', 'gameover', 'victory'].includes(state.mode) && (
              <button
                className="checkpoint-button"
                disabled={!ready || !!error}
                onClick={() => {
                  game.current?.game.start(checkpoint);
                  host.current?.querySelector('canvas')?.focus();
                }}
              >
                Continue from Sector {String(checkpoint + 1).padStart(2, '0')}
                <small>3 hull · fresh score · saved on this device</small>
              </button>
            )}
          {state.mode === 'paused' && (
            <button
              className="text-button"
              onClick={() => {
                game.current?.game.start();
                host.current?.querySelector('canvas')?.focus();
              }}
            >
              Restart flight
            </button>
          )}
          <span className="micro">
            {state.mode === 'menu'
              ? 'MOUSE / ARROW KEYS / TOUCH'
              : 'SPACE TO CONTINUE'}
          </span>
        </section>
      )}
      {error && (
        <div className="error-panel" role="alert">
          {error}
          <button onClick={() => window.location.reload()}>Reload arena</button>
        </div>
      )}
      {!overlay && state.stranded && (
        <button
          className="launch-button"
          disabled={!state.tetherReady}
          onClick={action}
        >
          {state.tetherReady
            ? 'Reclaim ball · 35 charge'
            : state.energy < 35
              ? 'Tether needs 35 charge'
              : 'Align paddle under raider'}{' '}
          <kbd>SPACE</kbd>
        </button>
      )}
      {!overlay && state.mode === 'ready' && (
        <button className="launch-button" onClick={action}>
          <Play size={14} /> Launch ball <kbd>SPACE</kbd>
        </button>
      )}
      <footer className="bottom-bar">
        <div className="control-hint">
          <span className="key">↔</span> Move <span className="key">SPACE</span>{' '}
          Launch / fire
        </div>
        <button
          className={`pulse ${state.energy >= 100 ? 'charged' : ''}`}
          onClick={pulse}
          disabled={state.energy < 100 || state.mode !== 'playing'}
          title="Repel raiders and rescue falling balls (E)"
        >
          <Zap size={17} /> PULSE <span>{Math.floor(state.energy)}%</span>
          <kbd>E</kbd>
          <i style={{ transform: `scaleX(${state.energy / 100})` }} />
        </button>
        <button
          className="help"
          aria-label="Flight manual"
          onClick={showManual}
        >
          <CircleHelp size={18} />
          <span>Flight manual</span>
        </button>
      </footer>
      <Dialog open={manual} onOpenChange={setManual}>
        <DialogContent className="flight-manual">
          <DialogTitle>Flight manual</DialogTitle>
          <DialogDescription>
            Keep the ball alive. Restore 12 sectors and three guardians.
          </DialogDescription>
          <div className="manual-controls">
            <p>
              <b>Disco mode</b> Choose it before launch for a separate 12-sector
              remix and record. Four 14-second events rotate: Power Shower,
              Raider Rush, Speed Fever (double brick points), and Rebuild Remix.
              Seven balls, twelve laser bursts, and laser + pierce together.
              Neon bumpers deflect balls; a third joins in Sector 5. Armored
              enemies arrive from the first sector, guardians are tougher, and
              green cores rebuild up to three times. Cryo pauses events and
              rebuilding; pierce seals cores. Sound enables the disco beat. The
              rules below describe Classic unless stated otherwise.
            </p>
            <p>
              <b>Move</b> Mouse, drag, or ← → / A D. Hit near a paddle edge to
              aim a sharper rebound.
            </p>
            <p>
              <b>Launch</b> Click the arena or press Space. Lasers fire
              automatically while powered.
            </p>
            <p>
              <b>Rescue pulse · E</b> At 100% charge, clear raiders, recover
              stolen cargo, and save low balls. Fresh bricks and time recharge
              it; pulse kills do not refund charge.
            </p>
            <p>
              <b>Raiders</b> Pink drones steal descending balls and capsules.
              Hit them with a ball or laser, or pulse before they escape. If
              your last ball is captured, align your paddle beneath its raider
              and press Space to reclaim it for 35 charge.
            </p>
            <p>
              <b>Sentinels</b> Violet armor takes two hits, or three in late
              sectors. Their rings show when the armor breaks.
            </p>
            <p>
              <b>Bombers & guardians</b> Amber warnings mean an aimed volley is
              coming. Move after they lock on. Balls and lasers destroy bombs;
              paddle hits briefly narrow your paddle and drain pulse charge,
              without directly costing hull.
            </p>
            <p>
              <b>Rare caches</b> Gold-ringed bricks contain specials: three
              caches per sector, four in the final chapter. Earned capsules
              arrive one at a time. Keep the ball alive while you move to catch
              them.
            </p>
            <p>
              <b>Weapons</b> Twin laser provides six bursts. Prism pierce cuts
              through three bricks per paddle return and seals green cores.
              These two weapons replace each other. Multiball is capped at three
              balls early, four mid-campaign, and five late.
            </p>
            <p>
              <b>Regrowth</b> Green-ringed bricks start rebuilding when broken:
              once in early sectors, twice late. Pierce seals them permanently;
              cryo pauses rebuilding. Clear the live grid and guardian to cancel
              every pending regrowth. Rebuilt bricks cannot generate more
              specials.
            </p>
            <p>
              <b>Supplies & checkpoints</b> Each cleared sector earns one
              salvage. Save it or spend it on a shield (one), hull repair (two),
              or a short powered launch (two). Clearing sectors 4 and 8 unlocks
              the next chapter on this device.
            </p>
            <p>
              <b>Pause · P</b> Switching tabs also pauses your flight.
            </p>
          </div>
          <div className="power-guide">
            {(Object.keys(POWER) as Power[]).map((k) => (
              <div key={k}>
                <b style={{ background: '#' + POWER[k].color.toString(16) }}>
                  {POWER[k].glyph}
                </b>
                <span>{POWER[k].label}</span>
              </div>
            ))}
          </div>
          <p className="manual-foot">
            Silver plates take extra hits. The Aurora vault has three-hit armor.
            Luminous bricks chain-react. Keep consecutive brick hits going to
            grow your score multiplier.
          </p>
          <a
            className="source-link"
            href="https://files.stardustarcade.com/PDF_Arcade_Manuals_and_Schematics/Arkanoid.pdf"
            target="_blank"
            rel="noreferrer"
          >
            Inspired by the original Arkanoid mechanics ↗
          </a>
        </DialogContent>
      </Dialog>
    </main>
  );
}
