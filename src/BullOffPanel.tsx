import { bullHitLabel, bullThrower } from './domain/bullOff';
import type { BullOff, BullCommand } from './domain/bullOff';
export default function BullOffPanel({
  state,
  players,
  enabled = false,
  onCommand,
  onUndo,
  canUndo = false,
}: {
  state: BullOff;
  players: [string, string];
  enabled?: boolean;
  onCommand?: (command: BullCommand) => void;
  onUndo?: () => void;
  canUndo?: boolean;
}) {
  const round = state.rounds.at(-1)!,
    thrower = bullThrower(state);
  const interactive = enabled && state.winner === null && !!onCommand;
  return (
    <section className="panel bull-off-panel" aria-label="Bull-off">
      <div className="section-label">DECIDE WHO STARTS</div>
      <h2>
        {state.winner !== null
          ? `${players[state.winner]} won the bull-off`
          : !enabled
            ? 'Unfinished bull-off'
            : thrower !== null
              ? `${players[thrower]} throws for the bull`
              : 'Compare the darts'}
      </h2>
      {state.winner === null && (
        <p>
          Round {state.rounds.length} · {players[round.first]} then{' '}
          {players[1 - round.first]}. Record only darts that stay in the scoring
          surface; throw again after a bounce-out.
        </p>
      )}
      <p className="muted">
        Inner bull beats outer bull. Matching bulls mean a rethrow in reverse
        order. When both darts are outside the bull, confirm which is closer or
        rethrow if unsure.
      </p>
      {interactive && (
        <div className="bull-off-actions">
          {thrower !== null ? (
            (['inner', 'outer', 'outside'] as const).map((hit) => (
              <button
                type="button"
                className="button secondary"
                key={hit}
                onClick={() =>
                  onCommand!({ type: 'bull-throw', player: thrower, hit })
                }
              >
                {bullHitLabel(hit)}
              </button>
            ))
          ) : (
            <>
              {players.map((name, i) => (
                <button
                  type="button"
                  key={i}
                  className="button secondary"
                  onClick={() =>
                    onCommand!({ type: 'bull-closest', winner: i as 0 | 1 })
                  }
                >
                  Confirm {name} is closer
                </button>
              ))}
              <button
                type="button"
                className="button secondary"
                onClick={() =>
                  onCommand!({ type: 'bull-closest', winner: 'tie' })
                }
              >
                Too close to call · rethrow
              </button>
            </>
          )}
          {onUndo && (
            <button
              type="button"
              className="text-button"
              disabled={!canUndo}
              onClick={onUndo}
            >
              ↶ Undo bull-off action
            </button>
          )}
          {round.hits.some((h) => h !== null) && (
            <button
              type="button"
              className="text-button"
              onClick={() => onCommand!({ type: 'bull-rethrow' })}
            >
              Dart dislodged · both rethrow
            </button>
          )}
        </div>
      )}
      <div className="table-scroll">
        <table>
          <caption>Bull-off record</caption>
          <thead>
            <tr>
              <th>Round</th>
              <th>{players[0]}</th>
              <th>{players[1]}</th>
              <th>Decision</th>
            </tr>
          </thead>
          <tbody>
            {state.rounds.map((entry, i) => (
              <tr key={i}>
                <td>
                  {i + 1}
                  <small>{players[entry.first]} first</small>
                </td>
                <td>{bullHitLabel(entry.hits[0])}</td>
                <td>{bullHitLabel(entry.hits[1])}</td>
                <td>
                  {entry.reason === 'dislodged'
                    ? 'Dislodged · rethrow'
                    : entry.reason === 'tie'
                      ? 'Tie · reverse order'
                      : entry.winner !== undefined && entry.winner !== null
                        ? `${players[entry.winner]}${entry.reason === 'closest' ? ' · closer dart' : ''}`
                        : 'Awaiting decision'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="entry-hint">
        Bull-off darts are separate from match scores and averages. Use Undo
        last action to correct an entry.
      </p>
    </section>
  );
}
