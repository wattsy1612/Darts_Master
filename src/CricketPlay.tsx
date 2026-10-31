import { useRef, useState, useSyncExternalStore } from 'react';
import type { LocalRepository } from './data/repository';
import { matchId, updateGameArchive } from './domain/archive';
import {
  cricketRulesVersion,
  cricketTargets,
  createCricket,
  replayCricket,
  rematchCricket,
} from './domain/games/cricket';
import type { CricketCommand, CricketSession } from './domain/games/cricket';
import { replayGame } from './domain/games/registry';
import { terminal } from './domain/games/lifecycle';
import { currentThrower } from './domain/participants';
import { dartLabel } from './domain/darts';
import type { DartHit } from './domain/darts';
import ActionButton from './ui/ActionButton';
import BullOffPanel from './BullOffPanel';
import DataManager from './DataManager';
import { useVisitDraft } from './useVisitDraft';
import { turnIdentity } from './data/draft';
import { useRoute } from './useRoute';
import MatchPageLinks from './ui/MatchPageLinks';
import GameHistory from './GameHistory';
import { OfflineIndicator } from './OfflineSupport';

export default function CricketPlay({
  repository,
  onX01,
}: {
  repository: LocalRepository;
  onX01: () => void;
}) {
  const [route, navigate] = useRoute();
  const view = route === 'history' || route === 'data' ? route : 'score';
  const [session, setSession] = useState<CricketSession | null>(() =>
    repository.document.data.current?.game === 'cricket'
      ? repository.document.data.current
      : null,
  );
  const [names, setNames] = useState(['Player 1', 'Player 2']);
  const [legs, setLegs] = useState(1);
  const [bull, setBull] = useState(false);
  const [other, setOther] = useState(1);
  const [redo, setRedo] = useState<CricketCommand[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [confirm, setConfirm] = useState<'abandon' | 'concede' | null>(null);
  const saveState = useSyncExternalStore(
    repository.subscribe,
    repository.getSaveState,
  );
  const match = session ? replayCricket(session) : null;
  const pendingBull = !!match?.bullOff && match.bullOff.winner === null;
  const playable =
    !!match &&
    match.status === 'active' &&
    match.legWinner === null &&
    !pendingBull;
  const draft = useVisitDraft(
    session,
    saveState === 'saved' &&
      !!session &&
      !!repository.document.data.current &&
      turnIdentity(session) === turnIdentity(repository.document.data.current),
    playable,
  );
  const hits = draft.value.hits;
  const setHits = (value: DartHit[]) => draft.update({ hits: value });
  const locked =
    busy || saveState !== 'saved' || draft.loading || !!draft.recovery;
  async function save(next: CricketSession) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    let checked = false;
    try {
      replayCricket(next);
      checked = true;
      await repository.saveMatch(next);
      setSession(next);
    } catch (e) {
      // Retain the attempted version for recovery, but never publish a saved
      // next turn before the database transaction has completed.
      if (checked) setSession(next);
      setError(e instanceof Error ? e.message : 'Could not save Cricket.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function command(value: CricketCommand) {
    if (!session || locked) return;
    const next = { ...session, commands: [...session.commands, value] };
    try {
      replayCricket(next);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    setHits([]);
    setRedo([]);
    setConfirm(null);
    await save(next);
  }
  function start() {
    const previous = repository.document.data.current;
    if (previous && !terminal(replayGame(previous))) {
      setError('Finish your current match first.');
      return;
    }
    begin();
  }

  function begin() {
    try {
      const setup = createCricket({
        players: names,
        variant: 'standard',
        bull: 'split',
        legsToWin: legs,
        startMethod: bull ? 'bull-off' : 'manual',
      }).setup;
      void save({
        game: 'cricket',
        version: 1,
        rulesVersion: cricketRulesVersion,
        id: matchId(),
        setup,
        commands: [],
      });
    } catch (e) {
      setError((e as Error).message);
    }
  }
  const availableData = session
    ? {
        ...repository.document.data,
        current: session,
        archive: updateGameArchive(repository.document.data.archive, session),
      }
    : repository.document.data;
  return (
    <main
      className={`cricket-workspace ${session ? 'cricket-is-playing' : ''}`}
    >
      <header className="cricket-header">
        <div>
          <div className="section-label">DARTS MASTER · LOCAL PLAY</div>
          <h1>Standard Cricket</h1>
        </div>
        <div className="cricket-save">
          <OfflineIndicator />
          <span role="status">
            {busy
              ? 'Saving…'
              : saveState === 'saved'
                ? 'Saved on this device'
                : 'Unsaved · download a backup'}
          </span>
        </div>
        <nav aria-label="Match pages" className="game-page-links">
          <MatchPageLinks
            pages={[
              ['score', 'Play'],
              ['history', 'Match history'],
              ['data', 'Data & backups'],
            ]}
            current={view}
            onNavigate={navigate}
          />
        </nav>
      </header>
      {draft.recovery && (
        <section className="panel">
          <h2>Restore unrecorded Cricket darts?</h2>
          <p>
            {draft.recovery.hits.map(dartLabel).join(', ')} · exact saved turn
            only
          </p>
          <ActionButton onClick={draft.restore}>
            Restore Cricket draft
          </ActionButton>
          <ActionButton variant="secondary" onClick={draft.discard}>
            Discard Cricket draft
          </ActionButton>
        </section>
      )}
      {draft.notice && <p role="status">{draft.notice}</p>}
      {error && (
        <div role="alert" className="panel">
          {error}
        </div>
      )}
      {saveState !== 'saved' && session && !busy && (
        <section className="panel">
          <h2>Protect your Cricket game</h2>
          <p>
            Your current version is still on this screen. Retry saving or
            download it before closing.
          </p>
          <ActionButton onClick={() => void save(session)}>
            Retry saving Cricket
          </ActionButton>
          <ActionButton variant="secondary" onClick={() => navigate('data')}>
            Open backups
          </ActionButton>
        </section>
      )}
      {view === 'data' && (
        <DataManager repository={repository} availableData={availableData} />
      )}
      {view === 'history' && (
        <GameHistory
          current={availableData.current}
          archives={availableData.archive}
        />
      )}
      {view === 'score' &&
        (!session ? (
          <section className="panel">
            <h2>Cricket match setup</h2>
            <p>Two players · standard scoring · split bull · no round limit</p>
            {names.map((name, i) => (
              <label key={i}>
                Player {i + 1}
                <input
                  maxLength={30}
                  value={name}
                  onChange={(e) =>
                    setNames(
                      names.map((n, j) => (i === j ? e.target.value : n)),
                    )
                  }
                />
              </label>
            ))}
            <label>
              Legs to win
              <input
                type="number"
                min={1}
                max={11}
                value={legs}
                onChange={(e) => setLegs(Number(e.target.value))}
              />
            </label>
            <label>
              <input
                type="checkbox"
                checked={bull}
                onChange={(e) => setBull(e.target.checked)}
              />{' '}
              Decide starter with a bull-off
            </label>
            <div className="cricket-actions">
              <ActionButton disabled={locked} onClick={start}>
                Start Cricket
              </ActionButton>
              <ActionButton variant="secondary" onClick={onX01}>
                Back to X01
              </ActionButton>
            </div>
          </section>
        ) : (
          match && (
            <>
              <div className="cricket-play-grid">
                <section className="panel cricket-score-panel">
                  <h2 aria-live="polite">
                    {terminal(match)
                      ? match.winner === null
                        ? 'Match abandoned'
                        : `${match.sides[match.winner].name} wins`
                      : match.status === 'paused'
                        ? 'Cricket paused'
                        : match.legWinner !== null
                          ? `${match.sides[match.legWinner].name} wins the leg`
                          : `${currentThrower(match).name} to throw`}
                  </h2>
                  <p>
                    Leg {match.leg} · First to {match.setup.legsToWin} · Legs{' '}
                    {match.legs.join('–')}
                  </p>
                  <table className="cricket-board">
                    <caption>Cricket marks and points</caption>
                    <thead>
                      <tr>
                        <th scope="col">Target</th>
                        {match.sides.map((s, i) => (
                          <th
                            scope="col"
                            key={s.id}
                            className={
                              match.turn === i && playable
                                ? 'active-side'
                                : undefined
                            }
                          >
                            <span>{s.name}</span>
                            {match.turn === i && playable ? ' · throwing' : ''}
                            <br />
                            <strong className="cricket-points">
                              {match.points[i]} <small>points</small>
                            </strong>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {cricketTargets.map((n, index) => (
                        <tr key={n}>
                          <th scope="row">{n === 25 ? 'Bull' : n}</th>
                          {match.sides.map((s, i) => (
                            <td
                              key={s.id}
                              aria-label={`${s.name}, ${n === 25 ? 'Bull' : n}: ${match.marks[i][index]} marks${match.marks[i][index] === 3 ? ', closed' : ''}`}
                            >
                              {['—', '/', '×', '⊗'][match.marks[i][index]]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
                {pendingBull && match.bullOff && (
                  <BullOffPanel
                    state={match.bullOff}
                    players={[match.sides[0].name, match.sides[1].name]}
                    enabled={!locked && match.status === 'active'}
                    onCommand={(value) => void command(value)}
                  />
                )}
                {playable && (
                  <>
                    <section
                      className="panel cricket-entry-panel"
                      aria-label="Cricket dart entry"
                    >
                      <h2>Record darts</h2>
                      <div className="cricket-targets">
                        {cricketTargets.map((n) => (
                          <div key={n}>
                            <strong>{n === 25 ? 'Bull' : n}</strong>
                            {([1, 2, 3] as const)
                              .filter((m) => n !== 25 || m !== 3)
                              .map((m) => (
                                <ActionButton
                                  key={m}
                                  variant="secondary"
                                  disabled={locked || hits.length === 3}
                                  onClick={() => {
                                    setError('');
                                    setHits([
                                      ...hits,
                                      { number: n, multiplier: m },
                                    ]);
                                  }}
                                >
                                  {dartLabel({ number: n, multiplier: m })}
                                </ActionButton>
                              ))}
                          </div>
                        ))}
                      </div>
                      <div className="cricket-entry-extras">
                        <ActionButton
                          variant="secondary"
                          disabled={locked || hits.length === 3}
                          onClick={() =>
                            setHits([...hits, { number: 0, multiplier: 1 }])
                          }
                        >
                          Miss
                        </ActionButton>
                        <details>
                          <summary>Other segments (1–14)</summary>
                          <label>
                            Other target
                            <select
                              value={other}
                              onChange={(e) => setOther(Number(e.target.value))}
                            >
                              {Array.from({ length: 14 }, (_, i) => i + 1).map(
                                (n) => (
                                  <option key={n} value={n}>
                                    {n}
                                  </option>
                                ),
                              )}
                            </select>
                          </label>
                          <div className="cricket-actions">
                            {([1, 2, 3] as const).map((m) => (
                              <ActionButton
                                key={m}
                                variant="secondary"
                                disabled={locked || hits.length === 3}
                                onClick={() =>
                                  setHits([
                                    ...hits,
                                    { number: other, multiplier: m },
                                  ])
                                }
                              >
                                Other {['', 'single', 'double', 'treble'][m]}
                              </ActionButton>
                            ))}
                          </div>
                          <p>
                            These darts count as thrown but earn no Cricket
                            marks.
                          </p>
                        </details>
                      </div>
                    </section>
                    <section
                      className="panel cricket-visit-panel"
                      aria-label="Current Cricket visit"
                    >
                      <div>
                        <div className="visit-heading">
                          <strong>{currentThrower(match).name}’s visit</strong>
                          <span>Not recorded yet</span>
                        </div>
                        <p role="status" className="cricket-current-darts">
                          Current darts:{' '}
                          {hits.length
                            ? hits.map(dartLabel).join(', ')
                            : 'none'}{' '}
                          · {hits.length}/3
                        </p>
                        <div className="cricket-dart-slots" aria-hidden="true">
                          {[0, 1, 2].map((i) => (
                            <span key={i} className={hits[i] ? 'chosen' : ''}>
                              {hits[i] ? dartLabel(hits[i]) : '—'}
                            </span>
                          ))}
                        </div>
                        {draft.status && (
                          <p role="status" className="cricket-draft-status">
                            {draft.status}
                          </p>
                        )}
                      </div>
                      <div className="cricket-visit-actions">
                        <ActionButton
                          variant="secondary"
                          disabled={locked || !hits.length}
                          onClick={() => setHits(hits.slice(0, -1))}
                        >
                          Remove last dart
                        </ActionButton>
                        <ActionButton
                          disabled={locked || !hits.length}
                          onClick={() =>
                            void command({
                              type: 'visit',
                              visit: {
                                participantId: currentThrower(match).id,
                                source: 'manual-segments',
                                hits,
                              },
                            })
                          }
                        >
                          Record Cricket visit
                        </ActionButton>
                        <ActionButton
                          variant="secondary"
                          disabled={locked || hits.length > 0}
                          onClick={() =>
                            void command({
                              type: 'pass',
                              participantId: currentThrower(match).id,
                              source: 'manual-pass',
                            })
                          }
                        >
                          Pass without throwing
                        </ActionButton>
                      </div>
                    </section>
                  </>
                )}
              </div>
              <section className="panel cricket-match-controls">
                <h2>Match controls</h2>
                <div className="cricket-actions">
                  <ActionButton
                    variant="secondary"
                    disabled={
                      locked || !!hits.length || !session.commands.length
                    }
                    onClick={() => {
                      const last = session.commands.at(-1)!;
                      setRedo([...redo, last]);
                      void save({
                        ...session,
                        commands: session.commands.slice(0, -1),
                      });
                    }}
                  >
                    Undo last action
                  </ActionButton>
                  <ActionButton
                    variant="secondary"
                    disabled={locked || !!hits.length || !redo.length}
                    onClick={() => {
                      const last = redo.at(-1)!;
                      setRedo(redo.slice(0, -1));
                      void save({
                        ...session,
                        commands: [...session.commands, last],
                      });
                    }}
                  >
                    Redo action
                  </ActionButton>
                  {!terminal(match) && (
                    <>
                      <ActionButton
                        variant="secondary"
                        disabled={locked || !!hits.length}
                        onClick={() =>
                          void command({
                            type:
                              match.status === 'paused' ? 'resume' : 'pause',
                          })
                        }
                      >
                        {match.status === 'paused'
                          ? 'Resume Cricket'
                          : 'Pause Cricket'}
                      </ActionButton>
                      <ActionButton
                        variant="secondary"
                        disabled={locked || !!hits.length}
                        onClick={() => setConfirm('concede')}
                      >
                        Concede…
                      </ActionButton>
                      <ActionButton
                        variant="danger"
                        disabled={locked || !!hits.length}
                        onClick={() => setConfirm('abandon')}
                      >
                        Abandon…
                      </ActionButton>
                    </>
                  )}
                  {match.legWinner !== null && !terminal(match) && (
                    <ActionButton
                      disabled={locked}
                      onClick={() => void command({ type: 'next-leg' })}
                    >
                      Next Cricket leg
                    </ActionButton>
                  )}
                  {terminal(match) && (
                    <>
                      <ActionButton
                        disabled={locked}
                        onClick={() => {
                          setRedo([]);
                          void save(
                            rematchCricket(
                              session,
                              matchId(),
                              1 - match.legStarter,
                            ),
                          );
                        }}
                      >
                        Cricket rematch
                      </ActionButton>
                      <ActionButton
                        variant="secondary"
                        disabled={locked}
                        onClick={onX01}
                      >
                        Set up X01
                      </ActionButton>
                    </>
                  )}
                </div>
                {confirm && (
                  <div role="group" aria-label="Confirm match ending">
                    <p>
                      {confirm === 'abandon'
                        ? 'Abandon this match without a winner?'
                        : 'Which side is conceding?'}
                    </p>
                    {confirm === 'abandon' ? (
                      <ActionButton
                        variant="danger"
                        disabled={locked}
                        onClick={() => void command({ type: 'abandon' })}
                      >
                        Confirm abandon
                      </ActionButton>
                    ) : (
                      match.sides.map((s, i) => (
                        <ActionButton
                          key={s.id}
                          variant="danger"
                          disabled={locked}
                          onClick={() =>
                            void command({
                              type: 'concede',
                              player: i,
                              sideId: s.id,
                            })
                          }
                        >
                          Confirm {s.name} concedes
                        </ActionButton>
                      ))
                    )}
                    <ActionButton
                      variant="secondary"
                      onClick={() => setConfirm(null)}
                    >
                      Cancel
                    </ActionButton>
                  </div>
                )}
              </section>
            </>
          )
        ))}
      {view === 'score' && (
        <details className="cricket-help">
          <summary>Cricket rules and match information</summary>
          <p>
            Close 20 to 15 and bull with three marks. Extra marks score while
            your opponent has the target open. Close everything with equal or
            higher points to win. Split bull · no round limit.
          </p>
          <p>
            Enter each actual dart in order, including misses. Unrecorded darts
            use explicit tab-local draft recovery. Results are local and
            unverified.
          </p>
          <p>
            Local preview: earlier-visit corrections, full profile records and
            device acceptance are still being connected.
          </p>
        </details>
      )}
    </main>
  );
}
