import { useState } from 'react';
import { dartLabel } from './domain/darts';
import { difficulties } from './domain/bot';
import { ruleSummary } from './domain/x01';
import { playerStats, replay, formatSummary, isTerminal } from './domain/match';
import type { Session } from './domain/match';
import { exportMatch } from './domain/archive';
import type { ArchivedMatch } from './domain/archive';

export default function MatchHistory({
  current,
  archives,
}: {
  current: Session | null;
  archives: ArchivedMatch[];
}) {
  const [selected, setSelected] = useState('current');
  const session =
    selected === 'current'
      ? current
      : (archives.find((a) => a.session.id === selected)?.session ?? current);
  const match = session ? replay(session) : null;
  function download() {
    if (!session) return;
    const url = URL.createObjectURL(
      new Blob([exportMatch(session)], { type: 'application/json' }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `darts-match-${session.id ?? 'current'}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="history-layout">
      <section className="panel history">
        <div className="history-toolbar">
          <div>
            <div className="section-label">YOUR MATCHES</div>
            <h2>Match centre</h2>
          </div>
          <button
            className="button secondary"
            disabled={!session}
            onClick={download}
          >
            Export match ↓
          </button>
        </div>
        <label className="history-select">
          Choose a match
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            <option value="current">Current match</option>
            {archives.map((entry) => (
              <option key={entry.session.id} value={entry.session.id}>
                {entry.session.setup.players.join(' vs ')} ·{' '}
                {replay(entry.session).status} ·{' '}
                {new Date(entry.completedAt).toLocaleString()}
              </option>
            ))}
          </select>
        </label>
        {match ? (
          <>
            {session?.imported && (
              <p className="notice">
                Imported match · not a verified online or tournament record.
              </p>
            )}
            <div className="result-banner">
              <span className="eyebrow">
                {match.status === 'abandoned'
                  ? 'ABANDONED · NO WINNER'
                  : match.status === 'paused'
                    ? 'MATCH PAUSED'
                    : match.status === 'conceded'
                      ? 'DECIDED BY CONCESSION'
                      : isTerminal(match)
                        ? 'FINAL RESULT'
                        : 'MATCH IN PROGRESS'}
              </span>
              <h2>
                {match.status === 'abandoned'
                  ? 'Match abandoned'
                  : match.winner === null
                    ? match.setup.players.join(' vs ')
                    : `${match.setup.players[match.winner]} wins${match.status === 'conceded' ? ' by concession' : ''}`}
              </h2>
              <div className="result-score">
                {match.setup.setsToWin ? match.sets[0] : match.legs[0]}{' '}
                <span>—</span>{' '}
                {match.setup.setsToWin ? match.sets[1] : match.legs[1]}{' '}
                {match.setup.setsToWin && <small>sets</small>}
              </div>
              <p>
                {match.setup.start} · {ruleSummary(match.setup)} ·{' '}
                {formatSummary(match.setup)}
                {match.setup.bot &&
                  ` · Practice: ${difficulties[match.setup.bot].name}`}
              </p>
            </div>
            {match.setup.setsToWin && (
              <p className="muted">
                Total legs: {match.legs.join('–')} · Set {match.set} legs:{' '}
                {match.setLegs.join('–')}
              </p>
            )}
            <div className="comparison-grid">
              {match.setup.players.map((name, index) => {
                const stats = playerStats(match, index);
                return (
                  <article className="summary-player" key={index}>
                    <h3>{name}</h3>
                    <dl>
                      {[
                        ['3-dart average', stats.average],
                        ['Best visit', stats.best || '—'],
                        ['Highest checkout', stats.highestCheckout || '—'],
                        ['100–139 visits', stats.tons],
                        ['140–179 visits', stats.ton40s],
                        ['180s', stats.maximums],
                        ['Darts thrown', stats.darts],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                  </article>
                );
              })}
            </div>
            {(match.status === 'conceded' || match.status === 'abandoned') && (
              <p className="notice">
                Only played scores and legs are shown.{' '}
                {match.status === 'abandoned'
                  ? 'This match has no winner and is excluded from win/loss records.'
                  : 'The concession counts as a match win/loss; unplayed legs and sets are not awarded.'}
              </p>
            )}
            {session?.commands.some(
              (c) => c.type !== 'visit' && c.type !== 'next-leg',
            ) && (
              <section aria-label="Match action history">
                <h2>Match actions</h2>
                <ol>
                  {session.commands
                    .filter((c) => c.type !== 'visit' && c.type !== 'next-leg')
                    .map((c, i) => (
                      <li key={i}>
                        {c.type === 'pause'
                          ? 'Match paused'
                          : c.type === 'resume'
                            ? 'Match resumed'
                            : c.type === 'abandon'
                              ? 'Match abandoned without a winner'
                              : c.type === 'concede'
                                ? `${match.setup.players[c.player]} conceded`
                                : ''}
                      </li>
                    ))}
                </ol>
              </section>
            )}
            <h2>Visit by visit</h2>
            {match.visits.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Visit</th>
                      {match.setup.setsToWin && <th>Set</th>}
                      <th>Leg</th>
                      <th>Player</th>
                      <th>Score</th>
                      <th>Darts</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {match.visits.map((v, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        {match.setup.setsToWin && <td>{v.set}</td>}
                        <td>{v.leg}</td>
                        <td>{match.setup.players[v.player]}</td>
                        <td>
                          {v.total}
                          {v.hits && (
                            <small className="history-hit-labels">
                              {v.hits.map(dartLabel).join(' · ')}
                            </small>
                          )}
                        </td>
                        <td>{v.darts}</td>
                        <td>
                          {v.bust
                            ? 'Bust · no score'
                            : v.checkout
                              ? 'Game shot'
                              : v.openingRequired && !v.opens
                                ? 'Not opened'
                                : 'Scored'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="muted">
                No visits yet. Start a match and step up to the board.
              </p>
            )}
          </>
        ) : (
          <p className="muted">Start a match to see your statistics here.</p>
        )}
        <p className="entry-hint">
          {archives.length} finished{' '}
          {archives.length === 1 ? 'match' : 'matches'} saved on this browser.
          The latest 100 are kept. Export results to keep a separate copy;
          clearing browser data removes local history.
        </p>
      </section>
    </div>
  );
}
