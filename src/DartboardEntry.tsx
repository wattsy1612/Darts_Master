import { useState } from 'react';
import { dartLabel, dartValue, evaluateDarts } from './domain/darts';
import type { DartHit } from './domain/darts';
import { checkoutRoute } from './domain/match';
import type { Visit } from './domain/match';

const numbers = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
];
function point(radius: number, angle: number) {
  const radians = (angle * Math.PI) / 180;
  return [220 + radius * Math.sin(radians), 220 - radius * Math.cos(radians)];
}
function wedge(inner: number, outer: number, angle: number) {
  const a = point(outer, angle - 9),
    b = point(outer, angle + 9),
    c = point(inner, angle + 9),
    d = point(inner, angle - 9);
  return `M${a} A${outer},${outer} 0 0 1 ${b} L${c} A${inner},${inner} 0 0 0 ${d} Z`;
}
function position(hit: DartHit, index: number) {
  if (!hit.number) return [410, 420 - index * 12];
  if (hit.number === 25)
    return [220 + index * 3, 220 - (hit.multiplier === 1 ? 11 : 0)];
  return point(
    (hit.multiplier === 3 ? 103 : hit.multiplier === 2 ? 166 : 135) +
      index * 1.8,
    numbers.indexOf(hit.number) * 18 + index * 1.1,
  );
}

export default function DartboardEntry({
  remaining,
  disabled,
  onRecord,
  error,
  waitingForOpponent = false,
}: {
  remaining: number;
  disabled: boolean;
  onRecord: (visit: Visit) => void;
  error: string;
  waitingForOpponent?: boolean;
}) {
  const [hits, setHits] = useState<DartHit[]>([]);
  const [precision, setPrecision] = useState(false);
  const [multiplier, setMultiplier] = useState<1 | 2 | 3>(1);
  const [hover, setHover] = useState('');
  const result = evaluateDarts(remaining > 1 ? remaining : 2, hits);
  const ended = result.status !== 'scoring';
  const route =
    !ended && !disabled
      ? checkoutRoute(result.remaining, 3 - hits.length)
      : null;
  const locked = disabled || hits.length === 3 || ended;
  function add(hit: DartHit) {
    if (!locked) setHits([...hits, hit]);
  }
  function key(event: React.KeyboardEvent, hit: DartHit) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      add(hit);
    }
  }
  const targetProps = (hit: DartHit, label: string) => ({
    role: 'button' as const,
    tabIndex: locked ? -1 : 0,
    'aria-label': label,
    'aria-disabled': locked,
    onClick: () => add(hit),
    onKeyDown: (event: React.KeyboardEvent) => key(event, hit),
    onMouseEnter: () => setHover(`${dartLabel(hit)} · ${dartValue(hit)}`),
    onMouseLeave: () => setHover(''),
  });
  return (
    <div className="dartboard-entry">
      <div className="dartboard-heading">
        <div>
          <span className="section-label">TAP YOUR DARTS</span>
          <h2>
            {waitingForOpponent
              ? 'Opponent’s turn'
              : disabled
                ? 'Leg complete'
                : 'Where did it land?'}
          </h2>
        </div>
        <span className="dart-counter">{hits.length} / 3 DARTS</span>
      </div>
      <div className="dartboard-frame">
        <svg
          className="interactive-dartboard"
          viewBox="0 0 440 440"
          aria-label="Interactive dartboard"
        >
          <title>Tap the segment where each dart landed</title>
          <desc>
            Twenty numbered wedges, single, double and treble rings, outer bull
            worth 25 and inner bull worth 50. You can also use the larger number
            buttons below.
          </desc>
          <circle
            cx="220"
            cy="220"
            r="215"
            fill="#101913"
            stroke="#526046"
            strokeWidth="2"
          />
          <circle cx="220" cy="220" r="177" fill="#c7c1a5" />
          {numbers.map((number, index) => {
            const angle = index * 18,
              dark = index % 2 === 0;
            const [x, y] = point(195, angle);
            return (
              <g key={number}>
                <text
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="board-number"
                  aria-hidden="true"
                >
                  {number}
                </text>
                {(
                  [
                    {
                      inner: 15.9,
                      outer: 99,
                      multiplier: 1,
                      label: `Single ${number} inner`,
                    },
                    {
                      inner: 99,
                      outer: 107,
                      multiplier: 3,
                      label: `Treble ${number}`,
                    },
                    {
                      inner: 107,
                      outer: 162,
                      multiplier: 1,
                      label: `Single ${number}`,
                    },
                    {
                      inner: 162,
                      outer: 170,
                      multiplier: 2,
                      label: `Double ${number}`,
                    },
                  ] as const
                ).map((ring, i) => (
                  <path
                    key={i}
                    d={wedge(ring.inner, ring.outer, angle)}
                    fill={
                      ring.multiplier === 1
                        ? dark
                          ? '#19231e'
                          : '#ecdfbe'
                        : dark
                          ? '#b13b35'
                          : '#367955'
                    }
                    stroke="#b9b69e"
                    strokeWidth=".7"
                    className="board-target"
                    {...targetProps(
                      { number, multiplier: ring.multiplier },
                      ring.label,
                    )}
                  />
                ))}
              </g>
            );
          })}
          <circle
            cx="220"
            cy="220"
            r="15.9"
            fill="#367955"
            stroke="#b9b69e"
            strokeWidth=".7"
            className="board-target"
            {...targetProps({ number: 25, multiplier: 1 }, 'Outer bull 25')}
          />
          <circle
            cx="220"
            cy="220"
            r="6.35"
            fill="#b13b35"
            stroke="#b9b69e"
            strokeWidth=".7"
            className="board-target"
            {...targetProps({ number: 25, multiplier: 2 }, 'Inner bull 50')}
          />
          {hits
            .filter((h) => h.number !== 0)
            .map((hit, i) => {
              const [x, y] = position(hit, i);
              return (
                <g key={i} pointerEvents="none" aria-hidden="true">
                  <circle
                    cx={x}
                    cy={y}
                    r="6"
                    fill="#c3ed86"
                    stroke="#14221a"
                    strokeWidth="2"
                  />
                  <text
                    x={x}
                    y={y + 0.5}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize="7"
                    fontWeight="bold"
                    fill="#14221a"
                  >
                    {i + 1}
                  </text>
                </g>
              );
            })}
        </svg>
        <div className="board-hover" aria-hidden="true">
          {hover ||
            (locked
              ? 'Review your visit below'
              : 'Single · double · treble · bull')}
        </div>
      </div>
      <div className="dart-slots" aria-label="Darts this visit">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`dart-slot ${hits[i] ? 'filled' : ''}`}>
            <small>DART {i + 1}</small>
            <strong>{hits[i] ? dartLabel(hits[i]) : '—'}</strong>
            <span>{hits[i] ? `${dartValue(hits[i])} pts` : 'Not thrown'}</span>
          </div>
        ))}
      </div>
      <div className="dart-tools">
        <button
          className="button secondary"
          disabled={locked}
          onClick={() => add({ number: 0, multiplier: 1 })}
        >
          Miss / bounce-out
        </button>
        <button
          className="text-button"
          disabled={disabled || !hits.length}
          onClick={() => setHits(hits.slice(0, -1))}
        >
          ↶ Remove last dart
        </button>
      </div>
      <button
        className="precision-toggle text-button"
        aria-expanded={precision}
        onClick={() => setPrecision(!precision)}
      >
        {precision
          ? 'Hide larger buttons ↑'
          : 'Need larger targets? Use number buttons ↓'}
      </button>
      {precision && (
        <div className="precision-entry">
          <div
            className="multiplier-tabs"
            role="group"
            aria-label="Score multiplier"
          >
            {([1, 2, 3] as const).map((n) => (
              <button
                key={n}
                aria-pressed={multiplier === n}
                disabled={disabled}
                onClick={() => setMultiplier(n)}
              >
                {['', 'Single', 'Double', 'Treble'][n]}
              </button>
            ))}
          </div>
          <div className="number-targets">
            {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                disabled={locked}
                onClick={() => add({ number: n, multiplier })}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="bull-targets">
            <button
              disabled={locked}
              onClick={() => add({ number: 25, multiplier: 1 })}
            >
              Outer bull · 25
            </button>
            <button
              disabled={locked}
              onClick={() => add({ number: 25, multiplier: 2 })}
            >
              Bull · 50
            </button>
          </div>
        </div>
      )}
      <div className={`dart-preview ${result.status}`} aria-live="polite">
        <span>
          {disabled
            ? waitingForOpponent
              ? 'OPPONENT TURN'
              : 'VISIT COMPLETE'
            : result.status === 'checkout'
              ? 'GAME SHOT'
              : result.status === 'bust'
                ? 'BUST · SCORE RETURNS TO'
                : 'LEAVES'}
        </span>
        <strong>
          {disabled
            ? '—'
            : result.status === 'checkout'
              ? '0'
              : result.remaining}
        </strong>
        <small>
          {disabled
            ? waitingForOpponent
              ? 'Their darts will appear in match history.'
              : 'Start the next leg or view your match summary.'
            : result.status === 'bust'
              ? 'The whole visit scores zero.'
              : ended
                ? 'Confirm below to finish your visit.'
                : `${result.total} scored · ${3 - hits.length} ${3 - hits.length === 1 ? 'dart' : 'darts'} left`}
        </small>
      </div>
      {hits.length > 0 && !disabled && !ended && hits.length < 3 && (
        <div className="draft-checkout">
          <span>
            {route
              ? `Checkout with ${3 - hits.length} ${3 - hits.length === 1 ? 'dart' : 'darts'} left`
              : 'No finish with the darts left this visit'}
          </span>
          {route && <strong>{route.join(' → ')}</strong>}
        </div>
      )}
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <button
        className="button primary submit-score"
        disabled={disabled || (!ended && hits.length !== 3)}
        onClick={() =>
          onRecord({
            total: result.total,
            darts: result.darts,
            double: result.double,
            hits,
          })
        }
      >
        {result.status === 'checkout'
          ? 'Confirm game shot'
          : result.status === 'bust'
            ? 'Record bust'
            : `Record ${result.total} points`}
        <span>↵</span>
      </button>
      <p className="keyboard-hint">
        Review your darts before recording. A visit stops on a bust or finish.
      </p>
    </div>
  );
}
