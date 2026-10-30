import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import MatchHistory from './MatchHistory';
import DartboardEntry from './DartboardEntry';
import { dartLabel } from './domain/darts';
import { botVisit, difficulties } from './domain/bot';
import PlayerProfiles, { PlayerField } from './PlayerProfiles';
import { usePlayers } from './usePlayers';
import { useRoute } from './useRoute';
import ActionButton from './ui/ActionButton';
import ComponentGallery from './ui/ComponentGallery';
import DataManager from './DataManager';
import { browserRepository } from './data/repository';
import type { LocalRepository } from './data/repository';
import { matchId, readArchive, updateArchive } from './domain/archive';
import type { ArchivedMatch } from './domain/archive';
import type { Command, Session, Setup } from './domain/match';
import {
  checkoutRoute,
  createMatch,
  playerStats,
  replay,
} from './domain/match';

const initialSetup: Setup = {
  players: ['Player 1', 'Player 2'],
  start: 501,
  legsToWin: 3,
};
export default function App() {
  const [repository, setRepository] = useState<LocalRepository | null>(null);
  useEffect(() => {
    let active = true;
    browserRepository().then((value) => {
      if (active) setRepository(value);
    });
    return () => {
      active = false;
    };
  }, []);
  return repository ? (
    <DartsApplication repository={repository} />
  ) : (
    <main className="boot-panel panel">
      <h1>Opening your saved games…</h1>
      <p role="status">Checking local data before starting the scorer.</p>
    </main>
  );
}

function DartsApplication({ repository }: { repository: LocalRepository }) {
  const saved = {
    session: repository.document.data.current,
    warning: repository.legacyErrors.current ?? repository.problem,
  };
  const savedArchive = {
    matches: repository.document.data.archive,
    warning: repository.legacyErrors.archive ?? '',
  };

  const playerStore = usePlayers(repository);
  const saveState = useSyncExternalStore(
    repository.subscribe,
    repository.getSaveState,
  );
  const [session, setSession] = useState<Session | null>(saved.session);
  const [setup, setSetup] = useState<Setup>(
    saved.session?.setup ?? initialSetup,
  );
  const [archives, setArchives] = useState<ArchivedMatch[]>(
    savedArchive.matches,
  );
  const [archiveError, setArchiveError] = useState(savedArchive.warning);
  const [redoGroups, setRedoGroups] = useState<Command[][]>([]);
  const [botPaused, setBotPaused] = useState(() => {
    try {
      const control = JSON.parse(
        localStorage.getItem('darts-master.practice-control.v1') ?? 'null',
      );
      return (
        !!saved.session?.id &&
        control?.id === saved.session.id &&
        control?.paused === true
      );
    } catch {
      return false;
    }
  });
  const [replaceConfirmed, setReplaceConfirmed] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const [editing, setEditing] = useState(!saved.session);
  const [entryMode, setEntryMode] = useState<'board' | 'keypad'>(() => {
    try {
      return localStorage.getItem('darts-master.input-mode') === 'keypad'
        ? 'keypad'
        : 'board';
    } catch {
      return 'board';
    }
  });
  const [score, setScore] = useState('');
  const [darts, setDarts] = useState(3);
  const [double, setDouble] = useState(false);
  const [error, setError] = useState('');
  const [storageWarning, setStorageWarning] = useState(saved.warning);
  const [tab, setTab] = useRoute();
  const [focusMode, setFocusMode] = useState(() => {
    try {
      return localStorage.getItem('darts-master.focus-mode') === 'true';
    } catch {
      return false;
    }
  });
  const playing = !!session && !editing && tab === 'score';
  useEffect(() => {
    if (playing) window.scrollTo(0, 0);
  }, [playing]);
  useEffect(() => {
    try {
      localStorage.setItem('darts-master.focus-mode', String(focusMode));
    } catch {
      /* Preference only. */
    }
  }, [focusMode]);
  useEffect(() => {
    const exit = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && playing && focusMode) setFocusMode(false);
    };
    window.addEventListener('keydown', exit);
    return () => window.removeEventListener('keydown', exit);
  }, [playing, focusMode]);
  const match = useMemo(() => (session ? replay(session) : null), [session]);
  const botTurn =
    !!match?.setup.bot && match.turn === 1 && match.legWinner === null;
  const entryBlocked = !match || match.legWinner !== null || botTurn;
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
    let active = true;
    repository
      .saveMatch(session)
      .then((result) => {
        if (!active) return;
        setArchives(result.data.archive);
        setStorageWarning('');
      })
      .catch((error) => {
        if (!active) return;
        setStorageWarning(
          error instanceof Error && error.message.includes('Another tab')
            ? error.message
            : 'Some match data could not be saved. Browser storage may be unavailable or full. Keep this page open and export your result.',
        );
      });
    return () => {
      active = false;
    };
  }, [session]);

  useEffect(() => {
    if (!session?.setup.bot) return;
    try {
      localStorage.setItem(
        'darts-master.practice-control.v1',
        JSON.stringify({ id: session.id, paused: botPaused }),
      );
    } catch {
      /* A blocked preference store does not prevent a local practice match. */
    }
  }, [session?.id, session?.setup.bot, botPaused]);

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
      setRedoGroups([]);
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
    if (!score || entryBlocked) return;
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
    if (!session.commands.length) return;
    const last = session.commands.at(-1);
    const previous = session.commands.at(-2);
    const pair =
      !!session.setup.bot &&
      last?.type === 'visit' &&
      previous?.type === 'visit' &&
      match?.visits.at(-1)?.player === 1 &&
      match.visits.at(-2)?.player === 0;
    const count = pair ? 2 : 1;
    setRedoGroups([session.commands.slice(-count), ...redoGroups]);
    setSession({ ...session, commands: session.commands.slice(0, -count) });
    setAnnouncement(
      pair
        ? 'Your visit and the opponent reply were undone.'
        : 'Last action undone.',
    );
    setScore('');
    setError('');
    setDouble(false);
    setDarts(3);
  }
  function redo() {
    if (!session || !redoGroups.length) return;
    const next = {
      ...session,
      commands: [...session.commands, ...redoGroups[0]],
    };
    replay(next);
    setSession(next);
    setRedoGroups(redoGroups.slice(1));
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
        entryMode !== 'keypad' ||
        tab !== 'score' ||
        !match ||
        entryBlocked ||
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
  useEffect(() => {
    if (
      !session ||
      !match ||
      !botTurn ||
      botPaused ||
      redoGroups.length ||
      editing ||
      tab !== 'score'
    )
      return;
    const timer = window.setTimeout(() => {
      append({
        type: 'visit',
        visit: botVisit(match, `${session.id}-${session.commands.length}`),
      });
    }, 1400);
    return () => window.clearTimeout(timer);
  }, [session, botTurn, botPaused, redoGroups.length, editing, tab]);

  function start(event: React.FormEvent) {
    event.preventDefault();
    try {
      if (replacementNeedsConfirmation && !replaceConfirmed)
        throw new Error(
          'Confirm that you want to replace this match, or go back to continue or export it.',
        );
      const linkedNames = setup.players.map((name, index) => {
        const id = setup.playerIds?.[index];
        if (!id) return name;
        const player = playerStore.players.find((p) => p.id === id);
        if (!player)
          throw new Error('Select an available saved player, or choose Guest.');
        return player.name;
      }) as [string, string];
      const checked = createMatch({ ...setup, players: linkedNames });
      setSession({
        version: 1,
        id: matchId(),
        setup: checked.setup,
        commands: [],
      });
      setRedoGroups([]);
      setReplaceConfirmed(false);
      setBotPaused(false);
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
    <div
      className={`app-shell ${playing ? 'is-playing' : ''} ${playing && focusMode ? 'is-focused' : ''}`}
    >
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
              ['players', '♙', 'Players'],
              ['data', '↓', 'Data & backups'],
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
          Development build <span>v0.7</span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span>YOUR BOARD. YOUR GAME.</span>
          <span className="local-badge">
            <span className="status-dot" />
            Local play
          </span>
          <span className={`save-state ${saveState}`}>
            {saveState === 'saved'
              ? 'Saved on this device'
              : saveState === 'saving'
                ? 'Saving…'
                : 'Not saved'}
          </span>
        </header>
        <main>
          <div className="page-heading">
            {playing && (
              <details className="workspace-menu">
                <summary aria-label="Match navigation">☰</summary>
                <nav aria-label="Match pages">
                  {(
                    [
                      ['players', 'Players'],
                      ['history', 'Match history'],
                      ['roadmap', 'What’s next'],
                      ['data', 'Data & backups'],
                    ] as const
                  ).map(([route, label]) => (
                    <button
                      key={route}
                      onClick={(e) => {
                        setTab(route);
                        e.currentTarget
                          .closest('details')
                          ?.removeAttribute('open');
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </nav>
              </details>
            )}
            <div>
              <div className="eyebrow">STEP UP TO THE OCHE</div>
              <h1>
                {tab === 'score'
                  ? playing
                    ? match?.setup.bot
                      ? 'Practice match'
                      : 'Local match'
                    : 'Let’s play darts.'
                  : tab === 'history'
                    ? 'Every visit counts.'
                    : tab === 'players'
                      ? 'Your players. Their game.'
                      : tab === 'data'
                        ? 'Keep your game safe.'
                        : tab === 'ui'
                          ? 'Interface foundation.'
                          : 'Beyond the scoreboard.'}
              </h1>
              <p>
                {tab === 'score'
                  ? 'A proper game. A clear score. One dart at a time.'
                  : tab === 'history'
                    ? 'Saved matches, player stats and every visit at the board.'
                    : tab === 'players'
                      ? 'A familiar line-up, with a record that grows with every match.'
                      : tab === 'data'
                        ? 'Back up, review and restore your local players and results.'
                        : 'One home for your game, your team and your competition.'}
              </p>
            </div>
            <div className="heading-actions">
              {playing && (
                <ActionButton
                  variant="secondary"
                  aria-pressed={focusMode}
                  aria-label="Focus mode"
                  onClick={() => setFocusMode(!focusMode)}
                >
                  {focusMode ? 'Exit focus' : 'Focus mode'}
                </ActionButton>
              )}
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
                onClick={async () => {
                  if (
                    window.confirm(
                      'Reset the unreadable match archive? This cannot be undone.',
                    )
                  ) {
                    try {
                      await repository.resetLegacy('archive');
                      window.location.reload();
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
          {(tab === 'players' || (tab === 'score' && editing)) &&
            playerStore.problem && (
              <div className="notice" role="alert">
                {playerStore.problem}
                {playerStore.locked && (
                  <button className="text-button" onClick={playerStore.reset}>
                    Reset saved players
                  </button>
                )}
              </div>
            )}
          {tab === 'score' && match?.setup.bot && !editing && (
            <div className="practice-status" role="status">
              <div>
                <span className="eyebrow">
                  PRACTICE · {difficulties[match.setup.bot].name.toUpperCase()}
                </span>
                <strong>
                  {match.winner !== null
                    ? 'Practice match complete'
                    : match.legWinner !== null
                      ? 'Leg complete · ready for the next leg'
                      : botPaused || redoGroups.length
                        ? 'Opponent paused'
                        : botTurn
                          ? 'Opponent is throwing…'
                          : 'Your turn at the board'}
                </strong>
                <small>
                  {redoGroups.length
                    ? 'Redo your correction, or resume to continue.'
                    : 'Simulated darts use the same rules as your own throws.'}
                </small>
              </div>
              {match.winner === null && (
                <button
                  className="button secondary"
                  onClick={() => {
                    if (botPaused || redoGroups.length) {
                      setBotPaused(false);
                      setRedoGroups([]);
                    } else setBotPaused(true);
                  }}
                >
                  {botPaused || redoGroups.length
                    ? 'Resume opponent'
                    : 'Pause opponent'}
                </button>
              )}
            </div>
          )}
          {tab === 'score' &&
            (editing ? (
              <section className="setup-panel panel">
                <div className="section-label">01 / MATCH SETUP</div>
                <h2>Who’s at the board?</h2>
                <p className="muted">
                  {setup.bot
                    ? 'Practice against a simulated opponent. Double out.'
                    : 'Two players. Alternate starts. Double out.'}
                </p>
                <form onSubmit={start}>
                  <div
                    className="match-mode-picker"
                    role="group"
                    aria-label="Match mode"
                  >
                    <button
                      type="button"
                      aria-pressed={!setup.bot}
                      onClick={() =>
                        setSetup({
                          ...setup,
                          bot: undefined,
                          players: [
                            setup.players[0],
                            setup.players[1] === 'Practice Bot'
                              ? 'Player 2'
                              : setup.players[1],
                          ],
                        })
                      }
                    >
                      <strong>Local match</strong>
                      <span>Two players at one board</span>
                    </button>
                    <button
                      type="button"
                      aria-pressed={!!setup.bot}
                      onClick={() =>
                        setSetup({
                          ...setup,
                          bot: setup.bot ?? 'regular',
                          players: [setup.players[0], 'Practice Bot'],
                          playerIds: [setup.playerIds?.[0] ?? null, null],
                        })
                      }
                    >
                      <strong>Practice opponent</strong>
                      <span>Play a simulated opponent</span>
                    </button>
                  </div>
                  {setup.bot && (
                    <div
                      className="difficulty-picker"
                      role="group"
                      aria-label="Practice difficulty"
                    >
                      {Object.entries(difficulties).map(([key, value]) => (
                        <button
                          key={key}
                          type="button"
                          aria-pressed={setup.bot === key}
                          onClick={() =>
                            setSetup({ ...setup, bot: key as Setup['bot'] })
                          }
                        >
                          <strong>{value.name}</strong>
                          <span>{value.description}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="form-grid">
                    {setup.players.map((name, index) => (
                      <PlayerField
                        key={index}
                        index={index}
                        name={name}
                        bot={index === 1 && !!setup.bot}
                        profileId={setup.playerIds?.[index] ?? null}
                        players={playerStore.players}
                        onName={(name) =>
                          setSetup({
                            ...setup,
                            players: setup.players.map((p, i) =>
                              i === index ? name : p,
                            ) as [string, string],
                          })
                        }
                        onSelect={(id) => {
                          const ids: [string | null, string | null] = [
                            ...(setup.playerIds ?? [null, null]),
                          ];
                          ids[index] = id || null;
                          const player = playerStore.players.find(
                            (p) => p.id === id,
                          );
                          setSetup({
                            ...setup,
                            playerIds: ids,
                            players: setup.players.map((p, i) =>
                              i === index && player ? player.name : p,
                            ) as [string, string],
                          });
                        }}
                        onSave={async () => {
                          const player = await playerStore.add(name);
                          if (!player) return;
                          setSetup((previous) => {
                            if (
                              previous.players[index] !== name ||
                              (index === 1 && previous.bot)
                            )
                              return previous;
                            const ids: [string | null, string | null] = [
                              ...(previous.playerIds ?? [null, null]),
                            ];
                            ids[index] = player.id;
                            return {
                              ...previous,
                              playerIds: ids,
                              players: previous.players.map((p, i) =>
                                i === index ? player.name : p,
                              ) as [string, string],
                            };
                          });
                        }}
                      />
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
                    <label>
                      Throws first
                      <select
                        value={setup.starter ?? 0}
                        onChange={(e) =>
                          setSetup({
                            ...setup,
                            starter: Number(e.target.value) as 0 | 1,
                          })
                        }
                      >
                        <option value={0}>
                          {playerStore.players.find(
                            (p) => p.id === setup.playerIds?.[0],
                          )?.name ?? setup.players[0]}
                        </option>
                        <option value={1}>
                          {playerStore.players.find(
                            (p) => p.id === setup.playerIds?.[1],
                          )?.name ?? setup.players[1]}
                        </option>
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
                      <span className="live-label">
                        {match.setup.bot ? '● PRACTICE MATCH' : '● LIVE MATCH'}
                      </span>
                      <span>
                        {match.setup.start} · Double out · First to{' '}
                        {match.setup.legsToWin}
                      </span>
                    </div>
                    <strong>LEG {match.leg.toString().padStart(2, '0')}</strong>
                  </div>
                  <div
                    className={`play-grid ${entryMode === 'board' ? 'dartboard-mode' : ''}`}
                  >
                    <div className="score-column">
                      <section
                        className={`board ${match.legWinner !== null ? 'completed' : ''}`}
                        aria-label="Scoreboard"
                      >
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
                        <div
                          className={`board-bottom ${match.legWinner === null && !route ? 'empty-guide' : ''}`}
                        >
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
                                    {match.setup.players[match.turn]}, you’re
                                    up.
                                  </h2>
                                )}
                              </div>
                              <p>
                                {route
                                  ? 'Finish on a double. Make it count.'
                                  : botTurn
                                    ? 'Your opponent’s score will appear shortly.'
                                    : entryMode === 'board'
                                      ? 'Tap where your darts landed on the board.'
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
                              disabled={!redoGroups.length}
                              aria-label="Redo"
                              onClick={redo}
                            >
                              ↷ Redo
                            </button>
                          </div>
                        </div>
                      </section>
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
                                  <span>
                                    {match.setup.players[visit.player]}
                                  </span>
                                  <strong>
                                    {visit.bust ? 'BUST' : visit.total}
                                  </strong>
                                  {visit.hits && (
                                    <span className="visit-dart-labels">
                                      {visit.hits.map(dartLabel).join(' · ')}
                                    </span>
                                  )}
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
                    </div>
                    <section
                      className="entry-panel panel"
                      aria-label="Score entry"
                    >
                      <div
                        className="input-mode-switch"
                        role="group"
                        aria-label="Score entry method"
                      >
                        {(['board', 'keypad'] as const).map((mode) => (
                          <button
                            key={mode}
                            aria-pressed={entryMode === mode}
                            onClick={() => {
                              setEntryMode(mode);
                              setError('');
                              try {
                                localStorage.setItem(
                                  'darts-master.input-mode',
                                  mode,
                                );
                              } catch {
                                /* The scoring method still works without persistence. */
                              }
                            }}
                          >
                            {mode === 'board' ? '◎ Dartboard' : '▦ Keypad'}
                          </button>
                        ))}
                      </div>
                      <div
                        hidden={entryMode !== 'board'}
                        className="dartboard-entry-container"
                      >
                        <DartboardEntry
                          key={`${session?.id}-${session?.commands.length}`}
                          remaining={match.scores[match.turn]}
                          playerName={match.setup.players[match.turn]}
                          waitingForOpponent={botTurn}
                          disabled={entryBlocked}
                          error={error}
                          onRecord={(visit) => append({ type: 'visit', visit })}
                        />
                      </div>
                      <div
                        hidden={entryMode !== 'keypad'}
                        className="keypad-entry"
                      >
                        <div className="section-label">YOUR VISIT</div>
                        <h2>
                          {botTurn
                            ? 'Opponent’s turn'
                            : match.legWinner !== null
                              ? 'Nicely thrown.'
                              : 'What did you hit?'}
                        </h2>
                        <fieldset disabled={entryBlocked}>
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
                      </div>
                    </section>
                  </div>
                </>
              )
            ))}
          {tab === 'history' && (
            <MatchHistory current={session} archives={archives} />
          )}
          {tab === 'players' && (
            <PlayerProfiles
              players={playerStore.players}
              archives={archives}
              onAdd={playerStore.add}
              onRename={playerStore.rename}
              onPlay={(player) => {
                setSetup({
                  ...setup,
                  players: [player.name, setup.players[1]],
                  playerIds: [
                    player.id,
                    setup.playerIds?.[1] === player.id
                      ? null
                      : (setup.playerIds?.[1] ?? null),
                  ],
                });
                setReplaceConfirmed(false);
                setEditing(true);
                setError('');
                setTab('score');
              }}
            />
          )}
          {import.meta.env.DEV && tab === 'ui' && <ComponentGallery />}
          {tab === 'data' && (
            <DataManager
              repository={repository}
              availableData={{
                ...repository.document.data,
                current: session,
                archive: archives,
                players: playerStore.players,
              }}
            />
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
                  'Accounts & registration',
                  'Sign-up, email verification, sign-in, password recovery and linking local profiles to an account.',
                  'Planned',
                ],
                [
                  '03',
                  'Connected boards',
                  'Camera detection and adapters for supported scoring systems.',
                  'Planned',
                ],
                [
                  '04',
                  'Match rooms & teams',
                  'Online opponents, team lobbies and club nights.',
                  'Planned',
                ],
                [
                  '05',
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
