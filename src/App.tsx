import { useEffect, useMemo, useState } from 'react';
import MatchHistory from './MatchHistory';
import {
  archiveKey,
  matchId,
  readArchive,
  updateArchive,
} from './domain/archive';
import type { ArchivedMatch } from './domain/archive';
import type { Command, Session, Setup } from './domain/match';
import {
  checkoutRoute,
  createMatch,
  playerStats,
  replay,
} from './domain/match';

const storageKey = 'darts-master.match.v1';
const initialSetup: Setup = {
  players: ['Player 1', 'Player 2'],
  start: 501,
  legsToWin: 3,
};
function load(): { session: Session | null; warning: string } {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { session: null, warning: '' };
    const session: Session = JSON.parse(raw);
    replay(session);
    session.id ??= matchId();
    return { session, warning: '' };
  } catch {
    return {
      session: null,
      warning:
        'Your saved match could not be loaded. You can start a new match.',
    };
  }
}
const saved = load();
function loadArchive() {
  try {
    return {
      matches: readArchive(localStorage.getItem(archiveKey)),
      warning: '',
    };
  } catch {
    return {
      matches: [],
      warning:
        'Your match archive could not be loaded. Existing archive data will be kept until you choose to reset it.',
    };
  }
}
const savedArchive = loadArchive();

export default function App() {
  const [session, setSession] = useState<Session | null>(saved.session);
  const [setup, setSetup] = useState<Setup>(
    saved.session?.setup ?? initialSetup,
  );
  const [archives, setArchives] = useState<ArchivedMatch[]>(
    savedArchive.matches,
  );
  const [archiveError, setArchiveError] = useState(savedArchive.warning);
  const [redoCommands, setRedoCommands] = useState<Command[]>([]);
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [editing, setEditing] = useState(!saved.session);
  const [score, setScore] = useState('');
  const [darts, setDarts] = useState(3);
  const [double, setDouble] = useState(false);
  const [error, setError] = useState('');
  const [storageWarning, setStorageWarning] = useState(saved.warning);
  const [tab, setTab] = useState<'score' | 'history' | 'roadmap'>('score');
  const match = useMemo(() => (session ? replay(session) : null), [session]);
  const route = match ? checkoutRoute(match.scores[match.turn]) : null;
  const resultSaved =
    !!session && archives.some((entry) => entry.session.id === session.id);
  const replacementNeedsConfirmation =
    !!match &&
    match.visits.length > 0 &&
    (match.winner === null || !resultSaved);
  const finishing =
    !!match && score !== '' && Number(score) === match.scores[match.turn];

  useEffect(() => {
    if (!session) return;
    if (!session.id) {
      setSession({ ...session, id: matchId() });
      return;
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(session));
      if (!archiveError) {
        const nextArchives = updateArchive(archives, session);
        localStorage.setItem(
          archiveKey,
          JSON.stringify({ version: 1, matches: nextArchives }),
        );
        setArchives(nextArchives);
      }
      setStorageWarning('');
    } catch {
      setStorageWarning(
        'Some match data could not be saved. Browser storage may be unavailable or full. Keep this page open and export your result.',
      );
    }
  }, [session]);

  function append(command: Command) {
    if (!session) return;
    const next: Session = {
      ...session,
      commands: [...session.commands, command],
    };
    try {
      const result = replay(next);
      const last = result.visits.at(-1);
      setAnnouncement(
        command.type === 'next-leg'
          ? `Leg ${result.leg}. ${result.setup.players[result.turn]} throws first.`
          : last
            ? `${result.setup.players[last.player]}: ${last.bust ? 'bust. Score unchanged.' : last.checkout ? `${last.total}. Game shot!` : `${last.total} scored. ${result.scores[last.player]} remaining.`}`
            : '',
      );
      setRedoCommands([]);
      setSession(next);
      setScore('');
      setDouble(false);
      setDarts(3);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to record score.');
    }
  }
  function submit() {
    if (!score) return;
    append({
      type: 'visit',
      visit: { total: Number(score), darts, double: finishing && double },
    });
  }
  function input(value: string) {
    setScore(value.slice(0, 3));
    setDouble(false);
    setError('');
  }
  function undo() {
    if (!session) return;
    const removed = session.commands.at(-1);
    if (!removed) return;
    setRedoCommands([removed, ...redoCommands]);
    setSession({ ...session, commands: session.commands.slice(0, -1) });
    setAnnouncement('Last action undone.');
    setScore('');
    setError('');
    setDouble(false);
    setDarts(3);
  }
  function redo() {
    if (!session || !redoCommands.length) return;
    const next = {
      ...session,
      commands: [...session.commands, redoCommands[0]],
    };
    replay(next);
    setSession(next);
    setRedoCommands(redoCommands.slice(1));
    setScore('');
    setDouble(false);
    setDarts(3);
    setError('');
    setAnnouncement('Last action restored.');
  }
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (
        editing ||
        tab !== 'score' ||
        !match ||
        match.legWinner !== null ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      if (
        event.target instanceof HTMLElement &&
        ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(event.target.tagName)
      )
        return;
      if (/^\d$/.test(event.key)) {
        event.preventDefault();
        input(score + event.key);
      }
      if (event.key === 'Backspace') {
        event.preventDefault();
        input(score.slice(0, -1));
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        submit();
      }
    }
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });
  function start(event: React.FormEvent) {
    event.preventDefault();
    try {
      if (replacementNeedsConfirmation && !replaceConfirmed)
        throw new Error(
          'Confirm that you want to replace this match, or go back to continue or export it.',
        );
      const checked = createMatch(setup);
      setSession({
        version: 1,
        id: matchId(),
        setup: checked.setup,
        commands: [],
      });
      setRedoCommands([]);
      setReplaceConfirmed(false);
      setAnnouncement('');
      setEditing(false);
      setError('');
      setScore('');
      setDouble(false);
      setDarts(3);
      setTab('score');
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          href="#"
          className="brand"
          aria-label="Darts Master home"
          onClick={(e) => {
            e.preventDefault();
            setTab('score');
          }}
        >
          <span className="brand-mark">◎</span>
          <span>
            DARTS<span className="brand-sub">WORKING TITLE / 001</span>
          </span>
        </a>
        <div className="nav-label">THE CLUBHOUSE</div>
        <nav aria-label="Main navigation">
          {(
            [
              ['score', '◎', 'Local scorer'],
              ['history', '≡', 'Match history'],
              ['roadmap', '↗', 'What’s next'],
            ] as const
          ).map(([id, icon, title]) => (
            <button
              key={id}
              className={`nav-item ${tab === id ? 'selected' : ''}`}
              onClick={() => setTab(id)}
            >
              <span aria-hidden="true">{icon}</span>
              {title}
              {tab === id && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="eyebrow">THE FIRST THROW</span>
          <p>
            Good games start
            <br />
            at the oche.
          </p>
          <small>
            Local play is ready.
            <br />
            More ways to play are coming.
          </small>
        </div>
        <div className="sidebar-footer">
          <span className="status-dot" />
          Development build <span>v0.2</span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>YOUR BOARD. YOUR GAME.</span>
          <span className="local-badge">
            <span className="status-dot" />
            Local play
          </span>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">STEP UP TO THE OCHE</div>
              <h1>
                {tab === 'score'
                  ? 'Let’s play darts.'
                  : tab === 'history'
                    ? 'Every visit counts.'
                    : 'Beyond the scoreboard.'}
              </h1>
              <p>
                {tab === 'score'
                  ? 'A proper game. A clear score. One dart at a time.'
                  : tab === 'history'
                    ? 'Saved matches, player stats and every visit at the board.'
                    : 'One home for your game, your team and your competition.'}
              </p>
            </div>
            {match && !editing && (
              <button
                className="button secondary"
                onClick={() => {
                  setSetup(match.setup);
                  setReplaceConfirmed(false);
                  setTab('score');
                  setEditing(true);
                  setError('');
                }}
              >
                + New match
              </button>
            )}
          </div>
          {storageWarning && (
            <p role="status" className="notice">
              {storageWarning}
            </p>
          )}
          {archiveError && (
            <div role="alert" className="notice">
              {archiveError}{' '}
              <button
                className="text-button"
                onClick={() => {
                  if (
                    window.confirm(
                      'Reset the unreadable match archive? This cannot be undone.',
                    )
                  ) {
                    try {
                      localStorage.removeItem(archiveKey);
                      setArchiveError('');
                    } catch {
                      setArchiveError(
                        'Browser storage is unavailable. The archive could not be reset.',
                      );
                    }
                  }
                }}
              >
                Reset archive
              </button>
            </div>
          )}
          {announcement && tab === 'score' && !editing && (
            <div className="score-feedback" role="status" aria-live="polite">
              {announcement}
            </div>
          )}
          {tab === 'score' &&
            (editing ? (
              <section className="setup-panel panel">
                <div className="section-label">01 / MATCH SETUP</div>
                <h2>Who’s at the board?</h2>
                <p className="muted">
                  Two players. Alternate starts. Double out.
                </p>
                <form onSubmit={start}>
                  <div className="form-grid">
                    {setup.players.map((name, index) => (
                      <label key={index}>
                        Player {index + 1}
                        <input
                          required
                          maxLength={30}
                          value={name}
                          autoComplete="off"
                          onChange={(event) =>
                            setSetup({
                              ...setup,
                              players: setup.players.map((p, i) =>
                                i === index ? event.target.value : p,
                              ) as [string, string],
                            })
                          }
                        />
                      </label>
                    ))}
                    <label>
                      Starting score
                      <select
                        value={setup.start}
                        onChange={(e) =>
                          setSetup({ ...setup, start: Number(e.target.value) })
                        }
                      >
                        {[301, 501, 701].map((n) => (
                          <option key={n}>{n}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      First to
                      <select
                        value={setup.legsToWin}
                        onChange={(e) =>
                          setSetup({
                            ...setup,
                            legsToWin: Number(e.target.value),
                          })
                        }
                      >
                        {[1, 2, 3, 4, 5, 7, 9, 11].map((n) => (
                          <option key={n} value={n}>
                            {n} {n === 1 ? 'leg' : 'legs'}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  {match && (
                    <p className="notice">
                      {match.winner === null
                        ? 'Starting a new match replaces your unfinished game.'
                        : resultSaved
                          ? 'This result is saved in match history on this device.'
                          : 'This result has not been saved in history. Export it before starting another match.'}
                    </p>
                  )}
                  {replacementNeedsConfirmation && (
                    <label className="replace-confirm">
                      <input
                        type="checkbox"
                        checked={replaceConfirmed}
                        onChange={(e) => setReplaceConfirmed(e.target.checked)}
                      />
                      {match?.winner === null
                        ? 'Replace my unfinished match'
                        : 'Continue without saving this result'}
                    </label>
                  )}
                  {error && (
                    <p role="alert" className="error">
                      {error}
                    </p>
                  )}
                  <div className="form-actions">
                    <button className="button primary" type="submit">
                      Start match <span>↗</span>
                    </button>
                    {match && (
                      <button
                        className="button secondary"
                        type="button"
                        onClick={() => {
                          setEditing(false);
                          setError('');
                        }}
                      >
                        Back to match
                      </button>
                    )}
                  </div>
                </form>
                <div className="setup-footer">
                  <span>✓ No account needed</span>
                  <span>✓ Saved on this device</span>
                  <span>✓ Manual scoring</span>
                </div>
              </section>
            ) : (
              match && (
                <>
                  <div className="match-meta">
                    <div>
                      <span className="live-label">● LIVE MATCH</span>
                      <span>
                        {match.setup.start} · Double out · First to{' '}
                        {match.setup.legsToWin}
                      </span>
                    </div>
                    <strong>LEG {match.leg.toString().padStart(2, '0')}</strong>
                  </div>
                  <div className="play-grid">
                    <section className="board" aria-label="Scoreboard">
                      <div className="players">
                        {match.setup.players.map((name, index) => {
                          const stats = playerStats(match, index);
                          const active =
                            match.turn === index && match.legWinner === null;
                          return (
                            <article
                              key={index}
                              className={`player-card ${active ? 'active' : ''}`}
                              aria-label={`${name} score`}
                            >
                              <div className="player-top">
                                <span className="avatar">
                                  {name.charAt(0).toUpperCase()}
                                </span>
                                <span>{name}</span>
                                {active && (
                                  <span className="throwing">THROWING</span>
                                )}
                              </div>
                              <div className="remaining">
                                {match.scores[index]}
                              </div>
                              <div className="legs">
                                <span>LEGS WON</span>
                                <strong>
                                  {match.legs[index]}
                                  <small> / {match.setup.legsToWin}</small>
                                </strong>
                              </div>
                              <div className="stats">
                                <div>
                                  <span>3-DART AVG</span>
                                  <strong>{stats.average}</strong>
                                </div>
                                <div>
                                  <span>BEST VISIT</span>
                                  <strong>{stats.best || '—'}</strong>
                                </div>
                                <div>
                                  <span>DARTS</span>
                                  <strong>{stats.darts}</strong>
                                </div>
                              </div>
                            </article>
                          );
                        })}
                      </div>
                      <div className="board-bottom">
                        {match.legWinner !== null ? (
                          <>
                            <span className="eyebrow">
                              {match.winner !== null
                                ? 'GAME SHOT. AND THE MATCH.'
                                : 'GAME SHOT.'}
                            </span>
                            <h2>
                              {match.setup.players[match.legWinner]}{' '}
                              {match.winner !== null
                                ? 'wins the match!'
                                : 'takes the leg.'}
                            </h2>
                            {match.winner !== null && (
                              <button
                                className="button primary"
                                onClick={() => setTab('history')}
                              >
                                View match summary →
                              </button>
                            )}
                            {match.winner === null && (
                              <button
                                className="button primary"
                                onClick={() => append({ type: 'next-leg' })}
                              >
                                Next leg →
                              </button>
                            )}
                          </>
                        ) : (
                          <>
                            <span className="eyebrow">
                              {route ? 'CHECKOUT ROUTE' : 'AT THE OCHE'}
                            </span>
                            <div className="checkout-route">
                              {route ? (
                                route.map((segment, i) => (
                                  <span key={i}>
                                    {i > 0 && <small>→</small>}
                                    {segment}
                                  </span>
                                ))
                              ) : (
                                <h2>
                                  {match.setup.players[match.turn]}, you’re up.
                                </h2>
                              )}
                            </div>
                            <p>
                              {route
                                ? 'Finish on a double. Make it count.'
                                : 'Enter your visit total on the right.'}
                            </p>
                          </>
                        )}
                      </div>
                      <div className="board-actions">
                        <span>
                          Manual scoring{' '}
                          <span className="muted">
                            / camera connection coming later
                          </span>
                        </span>
                        <div className="correction-actions">
                          <button
                            disabled={!session?.commands.length}
                            className="text-button"
                            onClick={undo}
                          >
                            ↶ Undo last action
                          </button>
                          <button
                            className="text-button"
                            disabled={!redoCommands.length}
                            aria-label="Redo"
                            onClick={redo}
                          >
                            ↷ Redo
                          </button>
                        </div>
                      </div>
                    </section>
                    <section
                      className="entry-panel panel"
                      aria-label="Score entry"
                    >
                      <div className="section-label">YOUR VISIT</div>
                      <h2>
                        {match.legWinner !== null
                          ? 'Nicely thrown.'
                          : 'What did you hit?'}
                      </h2>
                      <fieldset disabled={match.legWinner !== null}>
                        <legend className="sr-only">Enter visit score</legend>
                        <label className="score-label" htmlFor="visit-score">
                          Visit total
                        </label>
                        <input
                          id="visit-score"
                          className="score-input"
                          value={score}
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder="0"
                          onChange={(e) =>
                            input(e.target.value.replace(/\D/g, ''))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              submit();
                            }
                          }}
                        />
                        <div className="quick-scores">
                          {[26, 60, 100, 140, 180].map((n) => (
                            <button key={n} onClick={() => input(String(n))}>
                              {n}
                            </button>
                          ))}
                        </div>
                        <div className="keypad">
                          {[
                            '1',
                            '2',
                            '3',
                            '4',
                            '5',
                            '6',
                            '7',
                            '8',
                            '9',
                            'C',
                            '0',
                            '⌫',
                          ].map((key) => (
                            <button
                              key={key}
                              aria-label={
                                key === 'C'
                                  ? 'Clear score'
                                  : key === '⌫'
                                    ? 'Delete last digit'
                                    : key
                              }
                              onClick={() =>
                                input(
                                  key === 'C'
                                    ? ''
                                    : key === '⌫'
                                      ? score.slice(0, -1)
                                      : score + key,
                                )
                              }
                            >
                              {key}
                            </button>
                          ))}
                        </div>
                        <label className="darts-select">
                          Darts thrown
                          <select
                            value={darts}
                            onChange={(e) => setDarts(Number(e.target.value))}
                          >
                            {[1, 2, 3].map((n) => (
                              <option key={n} value={n}>
                                {n}
                              </option>
                            ))}
                          </select>
                        </label>
                        {finishing && (
                          <label className="double-confirm">
                            <input
                              type="checkbox"
                              checked={double}
                              onChange={(e) => setDouble(e.target.checked)}
                            />
                            Last dart was a double / bull
                          </label>
                        )}
                        {error && (
                          <p className="error" role="alert">
                            {error}
                          </p>
                        )}
                        {finishing && !double && (
                          <p className="entry-hint">
                            Confirm the finishing double, or this visit is a
                            bust.
                          </p>
                        )}
                        <button
                          className="button primary submit-score"
                          disabled={!score}
                          onClick={submit}
                        >
                          Record score <span>↵</span>
                        </button>
                      </fieldset>
                      <p className="keyboard-hint">
                        Your keyboard works here, too.
                      </p>
                    </section>
                  </div>
                  <section className="recent panel">
                    <div className="recent-heading">
                      <h2>Last at the board</h2>
                      <button
                        className="text-button"
                        onClick={() => setTab('history')}
                      >
                        All visits ↗
                      </button>
                    </div>
                    {match.visits.length ? (
                      <div className="recent-visits">
                        {match.visits
                          .slice(-4)
                          .reverse()
                          .map((visit, index) => (
                            <div className="recent-visit" key={index}>
                              <span>{match.setup.players[visit.player]}</span>
                              <strong>
                                {visit.bust ? 'BUST' : visit.total}
                              </strong>
                              <small>
                                {visit.checkout
                                  ? 'GAME SHOT'
                                  : `LEG ${visit.leg} · ${visit.darts} DARTS`}
                              </small>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p className="muted">
                        A clean board. Your first visit will appear here.
                      </p>
                    )}
                  </section>
                </>
              )
            ))}
          {tab === 'history' && (
            <MatchHistory current={session} archives={archives} />
          )}
          {tab === 'roadmap' && (
            <section className="roadmap">
              <div className="roadmap-intro">
                <span className="eyebrow">A BIGGER GAME PLAN</span>
                <h2>
                  Built around darts.
                  <br />
                  Open to every player.
                </h2>
                <p>
                  Manual scoring first. Connections to automatic scoring systems
                  as their interfaces allow.
                </p>
              </div>
              {[
                [
                  '01',
                  'Local scoring',
                  'Two-player X01, double-out rules, checkouts and undo.',
                  'Available now',
                ],
                [
                  '02',
                  'Connected boards',
                  'Camera detection and adapters for supported scoring systems.',
                  'Planned',
                ],
                [
                  '03',
                  'Match rooms & teams',
                  'Online opponents, team lobbies and club nights.',
                  'Planned',
                ],
                [
                  '04',
                  'Tournaments & streams',
                  'Competition management, spectator views and live video.',
                  'Planned',
                ],
              ].map(([number, title, description, status]) => (
                <article className="roadmap-item panel" key={number}>
                  <span className="roadmap-number">{number}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                  </div>
                  <span
                    className={number === '01' ? 'ready-tag' : 'planned-tag'}
                  >
                    {status}
                  </span>
                </article>
              ))}
            </section>
          )}
          <footer className="page-footer">
            <span>MADE FOR THE GAME.</span>
            <span>Local scorer · Early development</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
