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
import type { Arena } from './game/arena';
const INITIAL: Snapshot = {
  mode: 'menu',
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
  boss: 0,
};
export default function Home() {
  const host = useRef<HTMLDivElement>(null),
    game = useRef<Arena | null>(null),
    bestRef = useRef(0),
    savedRef = useRef(0);
  const [ready, setReady] = useState(false),
    [error, setError] = useState(''),
    [state, setState] = useState(INITIAL),
    [best, setBest] = useState(0),
    [sound, setSound] = useState(false),
    [manual, setManual] = useState(false);
  useEffect(() => {
    let gone = false;
    let instance: Arena | undefined;
    try {
      const saved = Number(localStorage.getItem('ark22-best'));
      if (Number.isFinite(saved) && saved > 0) {
        bestRef.current = saved;
        savedRef.current = saved;
      }
    } catch {}
    import('./game/arena')
      .then(({ Arena }) => {
        if (gone || !host.current) return;
        instance = new Arena(host.current, (s) => {
          if (gone) return;
          setState(s);
          setBest(bestRef.current);
          if (s.score > bestRef.current) {
            bestRef.current = s.score;
            setBest(s.score);
          }
          if (
            ['clear', 'gameover', 'victory'].includes(s.mode) &&
            bestRef.current > savedRef.current
          )
            try {
              localStorage.setItem('ark22-best', String(bestRef.current));
              savedRef.current = bestRef.current;
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
      try {
        localStorage.setItem('ark22-best', String(bestRef.current));
      } catch {}
      instance?.dispose();
      game.current = null;
    };
  }, []);
  const action = () => game.current?.action();
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
    <main className="game-shell">
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
          <small>BEST · THIS DEVICE</small>
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
              <em> / {state.total}</em>
            </strong>
          </div>
        )}
      </div>
      <div className="power-stack">
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
            <time>{p.seconds}s</time>
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
        <div className="boss-health">
          <span>THE LIGHT KEEPER</span>
          <meter min={0} max={18} value={state.boss} />
        </div>
      )}
      <output
        className={`notice ${state.captured ? 'danger' : ''}`}
        aria-live="polite"
      >
        {!overlay && state.notice}
      </output>
      {overlay && !manual && (
        <section className="start-card">
          <div className="eyebrow">
            <Radio size={15} />{' '}
            {state.mode === 'menu'
              ? 'SYSTEMS ONLINE · 2186'
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
                A brighter kind
                <br />
                of destruction.
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
                Shatter the grid. Outsmart the raiders.
                <br />
                Keep the light alive.
              </>
            ) : state.mode === 'paused' ? (
              'Your flight is right where you left it.'
            ) : state.mode === 'clear' ? (
              `${SECTORS[state.level]} cleared. ${SECTORS[state.level + 1]} awaits.`
            ) : state.mode === 'victory' ? (
              'Six sectors cleared. The light keeper is restored.'
            ) : (
              <>
                The garden is waiting.
                <br />
                Launch again and beat your best.
              </>
            )}
          </p>
          {isEnd && (
            <div className="final-score">
              {state.score.toLocaleString()}
              <small>POINTS</small>
            </div>
          )}
          <button
            className="primary"
            disabled={!ready || !!error}
            onClick={action}
          >
            {!ready
              ? 'Preparing arena'
              : state.mode === 'menu'
                ? 'Enter the arena'
                : state.mode === 'paused'
                  ? 'Resume flight'
                  : state.mode === 'clear'
                    ? 'Next sector'
                    : 'Fly again'}
            {isEnd ? <RotateCcw size={18} /> : <ArrowUpRight size={20} />}
          </button>
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
            Keep the ball alive. Clear all six sectors.
          </DialogDescription>
          <div className="manual-controls">
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
              stolen cargo, and save low balls. Bricks and time recharge it.
            </p>
            <p>
              <b>Raiders</b> Pink drones steal descending balls and capsules.
              Hit them with a ball or laser, or pulse before they escape.
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
            Silver plates take two hits. Luminous bricks chain-react. Keep
            consecutive brick hits going to grow your score multiplier.
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
