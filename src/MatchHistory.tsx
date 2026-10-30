import VisitCorrection from './VisitCorrection';
import type { CorrectionReview } from './VisitCorrection';
import type { CorrectionInput, CorrectionPolicy } from './domain/correction';
import ScoreEvidence from './ScoreEvidence';
import { dataCoverage, inputSourceLabels } from './domain/metrics';
import { useState } from 'react';
import BullOffPanel from './BullOffPanel';
import { dartLabel } from './domain/darts';
import { difficulties } from './domain/bot';
import { ruleSummary } from './domain/x01';
import {
  playerStats,
  replay,
  formatSummary,
  isTerminal,
  bullNames,
  participantStats,
} from './domain/match';
import type { Session } from './domain/match';
import { exportMatch } from './domain/archive';
import type { ArchivedMatch } from './domain/archive';

export default function MatchHistory({
  current,
  archives,
  correction,
}: {
  current: Session | null;
  archives: ArchivedMatch[];
  correction?: {
    revision: number;
    enabled: boolean;
    canUndo: boolean;
    hasRecovery: boolean;
    onBegin: () => void;
    onApply: (
      review: CorrectionReview,
      input: CorrectionInput,
      policy: CorrectionPolicy,
      replaceCurrent: boolean,
    ) => Promise<boolean>;
    onUndo: () => Promise<void>;
    onDownload: () => Promise<void>;
  };
}) {
  const [selected, setSelected] = useState('current');
  const [review, setReview] = useState<CorrectionReview | null>(null);
  const [recoveryError, setRecoveryError] = useState('');
  const session =
    selected === 'current'
      ? current
      : (archives.find((a) => a.session.id === selected)?.session ?? current);
  const commandIndices =
    session?.commands.flatMap((c, i) => (c.type === 'visit' ? [i] : [])) ?? [];
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
            disabled={!!review}
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
        {correction?.hasRecovery && (
          <div className="correction-recovery">
            <button
              className="button secondary"
              disabled={!correction.enabled || !correction.canUndo || !!review}
              onClick={async () => {
                try {
                  await correction.onUndo();
                  setRecoveryError('');
                } catch (e) {
                  setRecoveryError(
                    e instanceof Error ? e.message : 'Recovery failed.',
                  );
                }
              }}
            >
              Undo last correction
            </button>
            <button
              className="text-button"
              onClick={async () => {
                try {
                  await correction.onDownload();
                  setRecoveryError('');
                } catch (e) {
                  setRecoveryError(
                    e instanceof Error ? e.message : 'Download failed.',
                  );
                }
              }}
            >
              Download pre-correction backup
            </button>
            {!correction.canUndo && (
              <p>
                Data changed after the last correction. Its backup is still
                available; direct undo is disabled.
              </p>
            )}
          </div>
        )}
        {recoveryError && (
          <p role="alert" className="error">
            {recoveryError}
          </p>
        )}
        {review && correction && (
          <VisitCorrection
            review={review}
            currentId={current?.id}
            onApply={correction.onApply}
            onClose={() => setReview(null)}
          />
        )}
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
                {(match.setup.setsToWin ? match.sets : match.legs).join(' — ')}{' '}
                {match.setup.setsToWin && <small>sets</small>}
              </div>
              <p>
                {match.setup.start} · {ruleSummary(match.setup)} ·{' '}
                {formatSummary(match.setup)}
                {match.setup.bot &&
                  ` · Practice: ${difficulties[match.setup.bot].name}`}
              </p>
            </div>
            {match.setup.bot === 'custom' && match.setup.botSettings && (
              <p className="notice">
                Custom opponent targets: treble{' '}
                {Math.round(match.setup.botSettings.treble * 100)}% · double /
                bull {Math.round(match.setup.botSettings.double * 100)}% ·
                single / outer bull{' '}
                {Math.round(match.setup.botSettings.single * 100)}%. Settings
                version {match.setup.botSettings.version}.
              </p>
            )}
            <ScoreEvidence
              coverage={dataCoverage(match.visits)}
              importedMatches={session?.imported ? 1 : 0}
            />
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
              (c) =>
                c.type === 'pause' ||
                c.type === 'resume' ||
                c.type === 'concede' ||
                c.type === 'abandon',
            ) && (
              <section aria-label="Match action history">
                <h2>Match actions</h2>
                <ol>
                  {session.commands
                    .filter(
                      (c) =>
                        c.type === 'pause' ||
                        c.type === 'resume' ||
                        c.type === 'concede' ||
                        c.type === 'abandon',
                    )
                    .map((c, i) => (
                      <li key={i}>
                        {c.type === 'pause'
                          ? 'Match paused'
                          : c.type === 'resume'
                            ? 'Match resumed'
                            : c.type === 'abandon'
                              ? 'Match abandoned without a winner'
                              : c.type === 'concede'
                                ? `${match.setup.players[c.player]} ${match.sides.length > 2 ? 'withdrew' : 'conceded'}`
                                : ''}
                      </li>
                    ))}
                </ol>
              </section>
            )}
            {match.bullOff && (
              <BullOffPanel state={match.bullOff} players={bullNames(match)} />
            )}
            {match.sides.some((s) => s.members.length > 1) && (
              <section aria-label="Individual thrower records">
                <h2>Individual throwers</h2>
                <div className="comparison-grid">
                  {match.sides.flatMap((side) =>
                    side.members.map((member) => {
                      const stats = participantStats(match, member.id);
                      return (
                        <article className="summary-player" key={member.id}>
                          <h3>
                            {member.name} · {side.name}
                          </h3>
                          <p>
                            {stats.darts} darts · 3-dart average {stats.average}{' '}
                            · Best visit {stats.best || '—'}
                          </p>
                        </article>
                      );
                    }),
                  )}
                </div>
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
                      <th>
                        {match.sides.some((s) => s.members.length > 1)
                          ? 'Side'
                          : 'Player'}
                      </th>
                      {match.sides.some((s) => s.members.length > 1) && (
                        <th>Thrower</th>
                      )}
                      <th>Score</th>
                      <th>Darts</th>
                      <th>Result</th>
                      <th>Input</th>
                      {correction && <th>Correction</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {match.visits.map((v, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        {match.setup.setsToWin && <td>{v.set}</td>}
                        <td>{v.leg}</td>
                        <td>{match.setup.players[v.player]}</td>
                        {match.sides.some((s) => s.members.length > 1) && (
                          <td>{v.throwerName}</td>
                        )}
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
                        <td>{inputSourceLabels[v.origin]}</td>
                        {correction && (
                          <td>
                            {match.setup.bot && v.player === 1 ? (
                              <small>Simulated</small>
                            ) : (
                              <button
                                type="button"
                                className="text-button"
                                aria-label={`Correct visit ${i + 1}`}
                                disabled={
                                  !correction.enabled ||
                                  !!review ||
                                  !session?.id
                                }
                                onClick={() => {
                                  correction.onBegin();
                                  setReview({
                                    session: structuredClone(session!),
                                    commandIndex: commandIndices[i],
                                    revision: correction.revision,
                                  });
                                }}
                              >
                                Correct
                              </button>
                            )}
                          </td>
                        )}
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
