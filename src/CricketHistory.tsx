import { useState } from 'react';
import {
  cricketTargets,
  replayCricket,
  cricketStats,
} from './domain/games/cricket';
import type { CricketSession } from './domain/games/cricket';
import type { GameRecord } from './domain/games/registry';
import type { ArchivedMatch } from './domain/archive';
import { exportGameMatch } from './domain/archive';
import { dartLabel } from './domain/darts';
import ActionButton from './ui/ActionButton';

export default function CricketHistory({
  current,
  archives,
}: {
  current: CricketSession | null;
  archives: ArchivedMatch<GameRecord>[];
}) {
  const records = archives.filter(
    (entry): entry is ArchivedMatch<CricketSession> =>
      entry.session.game === 'cricket',
  );
  const [selected, setSelected] = useState(() =>
    current ? 'current' : (records[0]?.session.id ?? 'current'),
  );
  const session =
    selected === 'current'
      ? current
      : (records.find((e) => e.session.id === selected)?.session ?? null);
  const match = session ? replayCricket(session) : null;
  const stats = match ? cricketStats(match) : null;
  function download() {
    if (!session) return;
    const url = URL.createObjectURL(
      new Blob([exportGameMatch(session)], { type: 'application/json' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = `darts-cricket-${session.id}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section className="panel cricket-history">
      <div className="history-toolbar">
        <div>
          <div className="section-label">YOUR CRICKET MATCHES</div>
          <h2>Cricket match centre</h2>
        </div>
        <ActionButton
          variant="secondary"
          disabled={!session}
          onClick={download}
        >
          Export Cricket match ↓
        </ActionButton>
      </div>
      <label>
        Choose a Cricket match
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          <option value="current">
            Current Cricket match{!current ? ' · none' : ''}
          </option>
          {records.map((e) => (
            <option key={e.session.id} value={e.session.id}>
              {e.session.setup.players.join(' vs ')} ·{' '}
              {replayCricket(e.session).status} ·{' '}
              {new Date(e.completedAt).toLocaleString()}
            </option>
          ))}
        </select>
      </label>
      {!match ? (
        <p>
          No Cricket match selected. Finished matches appear here after they are
          saved or imported.
        </p>
      ) : (
        <>
          <h3>
            {match.setup.players.join(' vs ')} · {match.status}
          </h3>
          <p>
            {match.winner === null
              ? 'No match winner'
              : `${match.sides[match.winner].name} won`}{' '}
            · {match.legs.join('–')} legs · First to {match.setup.legsToWin}
          </p>
          <p className="notice">
            {session?.imported ? 'Imported · ' : ''}Local, unverified record ·
            standard Cricket · split bull
          </p>
          <table className="cricket-board">
            <caption>Recorded Cricket marks and points</caption>
            <thead>
              <tr>
                <th scope="col">Target</th>
                {match.sides.map((s, i) => (
                  <th scope="col" key={s.id}>
                    {s.name}
                    <br />
                    {match.points[i]} points
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cricketTargets.map((n, index) => (
                <tr key={n}>
                  <th scope="row">{n === 25 ? 'Bull' : n}</th>
                  {match.sides.map((s, i) => (
                    <td key={s.id}>
                      {match.marks[i][index]}
                      {match.marks[i][index] === 3 ? ' · closed' : ''}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <dl className="profile-stat-grid">
            {[
              ['Marks per 3 darts', stats!.marksPerThreeDarts],
              ['Actual darts', stats!.darts],
              ['Useful marks', stats!.marks],
              ['Points scored', stats!.points],
              ['Zero-dart passes', stats!.passes],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          <p className="muted">
            Useful marks / actual darts × 3; passes add no darts. Marks and
            points are separate from X01 averages. Board taps identify segments,
            not measured impact coordinates.
          </p>
          <h3>Recorded Cricket visits</h3>
          <ol>
            {match.visits.map((v, i) => (
              <li key={i}>
                {v.throwerName} · Leg {v.leg} ·{' '}
                {v.passed ? 'Pass' : v.hits.map(dartLabel).join(', ')} ·{' '}
                {v.marks} useful marks · {v.points} points
                {v.legWon ? ' · leg won' : ''}
              </li>
            ))}
          </ol>
          <details>
            <summary>Player breakdown</summary>
            {match.sides.flatMap((s) =>
              s.members.map((member) => {
                const own = cricketStats(match, member.id);
                return (
                  <p key={member.id}>
                    {member.name} · {s.name} · {own.darts} darts · {own.marks}{' '}
                    useful marks · {own.marksPerThreeDarts} marks per 3 darts
                  </p>
                );
              }),
            )}
          </details>
        </>
      )}
      <p className="entry-hint">
        Retained history shares a limit of 100 results across games. This view
        is read-only; undo the current game’s last action from Play. Earlier
        Cricket visit corrections are still being connected.
      </p>
    </section>
  );
}
