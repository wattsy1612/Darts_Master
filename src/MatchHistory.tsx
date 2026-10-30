import { useState } from 'react';
import { playerStats, replay } from './domain/match';
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
                {new Date(entry.completedAt).toLocaleString()}
              </option>
            ))}
          </select>
        </label>
        {match ? (
          <>
            <div className="result-banner">
              <span className="eyebrow">
                {match.winner === null ? 'MATCH IN PROGRESS' : 'FINAL RESULT'}
              </span>
              <h2>
                {match.winner === null
                  ? match.setup.players.join(' vs ')
                  : `${match.setup.players[match.winner]} wins`}
              </h2>
              <div className="result-score">
                {match.legs[0]} <span>—</span> {match.legs[1]}
              </div>
              <p>
                {match.setup.start} · Double out · First to{' '}
                {match.setup.legsToWin}
              </p>
            </div>
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
            <h2>Visit by visit</h2>
            {match.visits.length ? (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Visit</th>
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
                        <td>{v.leg}</td>
                        <td>{match.setup.players[v.player]}</td>
                        <td>{v.total}</td>
                        <td>{v.darts}</td>
                        <td>
                          {v.bust
                            ? 'Bust · no score'
                            : v.checkout
                              ? 'Game shot'
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
          {archives.length} completed{' '}
          {archives.length === 1 ? 'match' : 'matches'} saved on this browser.
          The latest 100 are kept. Export results to keep a separate copy;
          clearing browser data removes local history.
        </p>
      </section>
    </div>
  );
}
