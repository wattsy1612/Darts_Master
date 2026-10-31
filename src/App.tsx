import CricketPlay from './CricketPlay';
import MatchPageLinks from './ui/MatchPageLinks';
import { x01RulesVersion } from './domain/games/identity';
import { previewCorrection } from './domain/correction';
import { backupText } from './data/backup';
import type { CorrectionReview } from './VisitCorrection';
import type { CorrectionInput, CorrectionPolicy } from './domain/correction';
import { defaultBotSettings } from './domain/botSettings';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import MatchHistory from './GameHistory';
import DartboardEntry from './DartboardEntry';
import { dartLabel } from './domain/darts';
import { botVisit, difficulties } from './domain/bot';
import PlayerProfiles from './PlayerProfiles';
import SideSetup from './SideSetup';
import { changeFormat, getSides, rosterView } from './domain/participants';
import { usePlayers } from './usePlayers';
import { useRoute } from './useRoute';
import ActionButton from './ui/ActionButton';
import ComponentGallery from './ui/ComponentGallery';
import DataManager from './DataManager';
import BullOffPanel from './BullOffPanel';
import { useVisitDraft } from './useVisitDraft';
import { OfflineIndicator } from './OfflineSupport';
import { turnIdentity } from './data/draft';
import { hasDraft } from './data/draft';
import { ruleSummary, rulesFor } from './domain/x01';
import { browserRepository } from './data/repository';
import type { LocalRepository } from './data/repository';
import {
  matchId,
  readArchive,
  updateArchive,
  isX01Archive,
  updateGameArchive,
} from './domain/archive';
import type { ArchivedMatch } from './domain/archive';
import type { Command, Session, Setup } from './domain/match';
import {
  checkoutRoute,
  formatSummary,
  isTerminal,
  bullPending,
  bullNames,
  currentThrower,
  rematch,
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
  const [gameView, setGameView] = useState<'x01' | 'cricket' | null>(null);
  if (
    repository &&
    (gameView === 'cricket' ||
      (gameView === null &&
        repository.document.data.current?.game === 'cricket'))
  )
    return (
      <CricketPlay repository={repository} onX01={() => setGameView('x01')} />
    );
  return repository ? (
    <DartsApplication
      repository={repository}
      onCricket={() => setGameView('cricket')}
    />
  ) : (
    <main className="boot-panel panel">
      <h1>Opening your saved games…</h1>
      <p role="status">Checking local data before starting the scorer.</p>
    </main>
  );
}

function DartsApplication({
  repository,
  onCricket,
}: {
  repository: LocalRepository;
  onCricket: () => void;
}) {
  const saved = {
    session:
      repository.document.data.current?.game === 'cricket'
        ? null
        : repository.document.data.current,
    warning: repository.legacyErrors.current ?? repository.problem,
  };
  const savedArchive = {
    matches: repository.document.data.archive.filter(isX01Archive),
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
  const [customStart, setCustomStart] = useState(
    ![301, 501, 701, 1001].includes(setup.start),
  );
  const [archives, setArchives] = useState<ArchivedMatch[]>(
    savedArchive.matches,
  );
  const [archiveError, setArchiveError] = useState(savedArchive.warning);
  const [rematchStarter, setRematchStarter] = useState<number | null>(null);
  const [redoGroups, setRedoGroups] = useState<Command[][]>([]);
  // A development hot refresh can retain an older repository instance.
  // Keep play usable until reload, rather than calling newly added methods on it.
  const correctionsSupported =
    typeof repository.correctionRecovery === 'function' &&
    typeof repository.correctMatch === 'function' &&
    typeof repository.undoCorrection === 'function' &&
    typeof repository.correctionBackup === 'function';
  const [correctionRecovery, setCorrectionRecovery] = useState<{
    has: boolean;
    undo: boolean;
  }>({ has: false, undo: false });
  useEffect(() => {
    if (!correctionsSupported) return;
    let active = true;
    repository
      .correctionRecovery()
      .then((copy) => {
        if (active)
          setCorrectionRecovery({
            has: !!copy,
            undo:
              !!copy && copy.appliedRevision === repository.document.revision,
          });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [saveState, correctionsSupported]);
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
  const match = useMemo(() => (session ? replay(session) : null), [session]);
  const bullInProgress = !!match && bullPending(match);
  const botTurn =
    !!match?.setup.bot &&
    !bullInProgress &&
    match.status === 'active' &&
    match.turn === 1 &&
    match.legWinner === null;
  const visitDraft = useVisitDraft(
    session,
    saveState === 'saved' &&
      !!session &&
      !!repository.document.data.current &&
      repository.document.data.current.game !== 'cricket' &&
      turnIdentity(session) === turnIdentity(repository.document.data.current),
    !!match &&
      !bullInProgress &&
      match.status === 'active' &&
      match.legWinner === null &&
      !botTurn &&
      repository.mode === 'database',
  );
  const { score, darts, double } = visitDraft.value;
  const opens = visitDraft.value.opens ?? false;
  const rules = rulesFor(match?.setup ?? setup);
  const setScore = (score: string) =>
    visitDraft.update({ score, mode: entryMode });
  const setDarts = (darts: number) =>
    visitDraft.update({ darts, mode: entryMode });
  const setDouble = (double: boolean) =>
    visitDraft.update({ double, mode: entryMode });
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
  }, [playing, bullInProgress]);
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
  const entryBlocked =
    !match ||
    match.status !== 'active' ||
    bullInProgress ||
    match.legWinner !== null ||
    botTurn ||
    visitDraft.loading ||
    !!visitDraft.recovery;
  const route =
    match?.status === 'active' && !bullInProgress
      ? checkoutRoute(
          match.scores[match.turn],
          3,
          rules.outRule,
          !match.opened[match.turn],
        )
      : null;
  const resultSaved =
    !!session && archives.some((entry) => entry.session.id === session.id);
  const replacementNeedsConfirmation =
    !!match &&
    (isTerminal(match)
      ? !resultSaved
      : (session?.commands.length ?? 0) > 0 || match.status === 'paused');
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
        setArchives(result.data.archive.filter(isX01Archive));
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

  async function applyCorrection(
    review: CorrectionReview,
    input: CorrectionInput,
    policy: CorrectionPolicy,
    replaceCurrent: boolean,
  ) {
    if (saveState !== 'saved')
      throw new Error(
        'Changes are not confirmed as saved. Export any unsaved game, then reload and review the correction again.',
      );
    const affectsCurrent =
      session?.id === review.session.id ||
      !isTerminal(
        previewCorrection(review.session, review.commandIndex, input, policy)
          .after,
      );
    if (
      affectsCurrent &&
      (hasDraft(visitDraft.value) || visitDraft.recovery) &&
      !window.confirm(
        'Applying this correction discards this turn’s unsubmitted draft. Continue?',
      )
    )
      return false;
    const result = await repository.correctMatch(
      review.session,
      review.commandIndex,
      input,
      policy,
      review.revision,
      replaceCurrent,
    );
    if (affectsCurrent) {
      visitDraft.discard();
      if (result.data.current?.game === 'cricket') {
        window.location.reload();
        return true;
      }
      setSession(result.data.current);
      setRedoGroups([]);
      setEditing(false);
    }
    setArchives(result.data.archive.filter(isX01Archive));
    setAnnouncement('Reviewed correction saved with a recovery copy.');
    setStorageWarning('');
    return true;
  }
  async function undoReviewedCorrection() {
    const previous = await repository.correctionBackup();
    const affectsCurrent =
      JSON.stringify(previous?.current) !== JSON.stringify(session);
    if (
      affectsCurrent &&
      (hasDraft(visitDraft.value) || visitDraft.recovery) &&
      !window.confirm(
        'Undoing the correction discards this turn’s unsubmitted draft. Continue?',
      )
    )
      return;
    const result = await repository.undoCorrection();
    if (affectsCurrent) {
      visitDraft.discard();
      if (result.data.current?.game === 'cricket') {
        window.location.reload();
        return;
      }
      setSession(result.data.current);
      setRedoGroups([]);
      setEditing(!result.data.current);
    }
    setArchives(result.data.archive.filter(isX01Archive));
    setBotPaused(true);
    setAnnouncement(
      'Previous data restored from the correction recovery copy.',
    );
  }
  async function downloadCorrectionBackup() {
    const data = await repository.correctionBackup();
    if (!data) throw new Error('No correction recovery backup is available.');
    const url = URL.createObjectURL(
      new Blob([backupText(data, ['Pre-correction recovery copy.'])], {
        type: 'application/json',
      }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'darts-before-correction.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function append(command: Command) {
    if (!session) return;
    if (session.version === 5 && match) {
      if (command.type === 'visit')
        command = {
          ...command,
          visit: {
            ...command.visit,
            source:
              command.visit.source ??
              (match.setup.bot && match.turn === 1
                ? 'simulated'
                : command.visit.hits
                  ? 'manual-segments'
                  : 'manual-total'),
            participantId:
              command.visit.participantId ?? currentThrower(match).id,
          },
        };
      if (command.type === 'concede')
        command = {
          ...command,
          sideId: command.sideId ?? match.sides[command.player]?.id,
        };
    }
    const next: Session = {
      ...session,
      version:
        command.type === 'visit' || command.type === 'next-leg'
          ? session.version
          : (Math.max(
              session.version,
              command.type.startsWith('bull-') ? 4 : 3,
            ) as Session['version']),
      commands: [...session.commands, command],
    };
    try {
      const result = replay(next);
      const last = result.visits.at(-1);
      setAnnouncement(
        command.type === 'bull-throw'
          ? `${bullNames(result)[command.player]} bull-off dart recorded.`
          : command.type === 'bull-closest' || command.type === 'bull-rethrow'
            ? 'Bull-off decision recorded.'
            : command.type === 'pause'
              ? 'Match paused.'
              : command.type === 'resume'
                ? 'Match resumed.'
                : command.type === 'abandon'
                  ? 'Match abandoned. No winner awarded.'
                  : command.type === 'concede'
                    ? result.sides.length > 2
                      ? `${result.setup.players[command.player]} withdrew. ${result.winner === null ? 'Remaining players continue.' : `${result.setup.players[result.winner]} wins by concession.`}`
                      : `${result.setup.players[command.player]} conceded the match.`
                    : command.type === 'next-leg'
                      ? `${result.setup.setsToWin ? `Set ${result.set}. ` : ''}Leg ${result.leg}. ${currentThrower(result).name} throws first.`
                      : last
                        ? `${last.throwerName}: ${last.bust ? 'bust. Score unchanged.' : last.checkout ? `${last.total}. Game shot!` : `${last.total} scored. ${result.scores[last.player]} remaining.`}`
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
  function control(command: Command) {
    const discards = hasDraft(visitDraft.value) || !!visitDraft.recovery;
    const message =
      command.type === 'concede'
        ? match!.sides.length > 2
          ? `${match!.setup.players[command.player]} withdraws. Remaining players continue; the last remaining side wins. No unplayed legs are awarded.`
          : `${match!.setup.players[command.player]} concedes this match. The opponent receives the match win; no unplayed legs are awarded.`
        : command.type === 'abandon'
          ? 'Abandon this match with no winner? The played scores stay in history and do not count toward win/loss records.'
          : 'Pause this match?';
    if (
      (command.type === 'concede' || command.type === 'abandon' || discards) &&
      !window.confirm(
        message +
          (discards
            ? ' The unsubmitted visit draft will be discarded. Record it first if you want it counted.'
            : ''),
      )
    )
      return;
    append(command);
  }
  function startRematch() {
    if (!session || !match || !resultSaved || saveState !== 'saved') return;
    const next = rematch(
      session,
      matchId(),
      rematchStarter ?? ((match.setup.starter ?? 0) + 1) % match.sides.length,
    );
    next.setup = resolveNames(next.setup, false);
    setSession(next);
    setSetup(next.setup);
    setRedoGroups([]);
    setBotPaused(false);
    setRematchStarter(null);
    setError('');
    setAnnouncement('Rematch started.');
  }
  function resolveNames(settings: Setup, requireKnownProfiles = true): Setup {
    const sides = getSides(settings).map((s) => ({
      ...s,
      members: s.members.map((m) => {
        if (!m.profileId) return m;
        const profile = playerStore.players.find((p) => p.id === m.profileId);
        if (!profile) {
          if (requireKnownProfiles)
            throw new Error(
              'Select an available saved player, or choose Guest.',
            );
          return m;
        }
        return { ...m, name: profile.name };
      }),
    }));
    return rosterView(settings, sides);
  }
  function submit() {
    if (!score || entryBlocked) return;
    append({
      type: 'visit',
      visit: {
        total: Number(score),
        darts,
        double: finishing && rules.outRule === 'double' && double,
        ...(!match!.opened[match!.turn] ? { opens } : {}),
      },
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
      const checked = createMatch(resolveNames(setup));
      setSession({
        game: 'x01',
        rulesVersion: x01RulesVersion,
        version: 5,
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
          Development build <span>v0.19</span>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <span className="topbar-tagline">YOUR BOARD. YOUR GAME.</span>
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
        <OfflineIndicator />
        <main>
          <div className="page-heading">
            {playing && (
              <details className="workspace-menu">
                <summary aria-label="Match navigation">☰</summary>
                <nav aria-label="Match pages">
                  <MatchPageLinks
                    pages={[
                      ['players', 'Players'],
                      ['history', 'Match history'],
                      ['roadmap', 'What’s next'],
                      ['data', 'Data & backups'],
                    ]}
                    current={tab}
                    onNavigate={setTab}
                  />
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
                  {isTerminal(match)
                    ? match.status === 'abandoned'
                      ? 'Practice abandoned'
                      : 'Practice match complete'
                    : match.status === 'paused'
                      ? 'Match paused'
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
              {match.status === 'active' && (
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
                {(!session || (match && isTerminal(match))) &&
                  saveState === 'saved' && (
                    <ActionButton variant="secondary" onClick={onCricket}>
                      Set up Cricket
                    </ActionButton>
                  )}
                <p className="muted">
                  {setup.bot
                    ? 'Practice against a simulated opponent using your chosen match rules.'
                    : 'Players and sides at one board. Choose your roster and match rules.'}
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
                      onClick={() => {
                        const sides = setup.sides ?? getSides(setup);
                        const human = sides.map((s, i) => ({
                          ...s,
                          members: s.members.map((m) =>
                            i === 1 && setup.bot
                              ? { ...m, name: 'Player 2', profileId: null }
                              : m,
                          ),
                        }));
                        setSetup(
                          rosterView(
                            {
                              ...setup,
                              bot: undefined,
                              botSettings: undefined,
                              botModel: undefined,
                            },
                            human,
                          ),
                        );
                      }}
                    >
                      <strong>Local match</strong>
                      <span>Players or sides at one board</span>
                    </button>
                    <button
                      type="button"
                      aria-pressed={!!setup.bot}
                      onClick={() => {
                        const single = changeFormat(setup, 'singles');
                        const sides = single.sides!.map((s, i) =>
                          i === 1
                            ? {
                                ...s,
                                name: 'Practice Bot',
                                members: [
                                  {
                                    ...s.members[0],
                                    name: 'Practice Bot',
                                    profileId: null,
                                  },
                                ],
                              }
                            : s,
                        );
                        setSetup(
                          rosterView(
                            {
                              ...single,
                              bot: setup.bot ?? 'regular',
                              botModel: 1 as const,
                              startMethod: undefined,
                              starter: 0,
                              startingSideId: sides[0].id,
                            },
                            sides,
                          ),
                        );
                      }}
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
                            setSetup({
                              ...setup,
                              bot: key as Setup['bot'],
                              botSettings:
                                key === 'custom'
                                  ? (setup.botSettings ?? {
                                      ...defaultBotSettings,
                                    })
                                  : undefined,
                            })
                          }
                        >
                          <strong>{value.name}</strong>
                          <span>{value.description}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {setup.bot === 'custom' && setup.botSettings && (
                    <fieldset className="custom-opponent">
                      <legend>Custom opponent accuracy</legend>
                      <p>
                        How often the simulation hits its chosen target. These
                        settings are probabilities, not a promised match
                        average.
                      </p>
                      {(['treble', 'double', 'single'] as const).map((kind) => (
                        <label key={kind}>
                          {kind === 'treble'
                            ? 'Treble'
                            : kind === 'double'
                              ? 'Double / bull'
                              : 'Single / outer bull'}{' '}
                          target hit rate
                          <span>
                            {Math.round(setup.botSettings![kind] * 100)}%
                          </span>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="1"
                            value={Math.round(setup.botSettings![kind] * 100)}
                            onChange={(event) =>
                              setSetup({
                                ...setup,
                                botSettings: {
                                  ...setup.botSettings!,
                                  [kind]: Number(event.target.value) / 100,
                                },
                              })
                            }
                          />
                        </label>
                      ))}
                      <p>
                        A missed target can land in another scoring segment. At
                        0% the bot can still score; at 100% it hits its chosen
                        targets, not every checkout.
                      </p>
                    </fieldset>
                  )}
                  <div className="form-grid">
                    <SideSetup
                      setup={setup}
                      setSetup={setSetup}
                      players={playerStore.players}
                      onAdd={playerStore.add}
                    />
                    <label>
                      Starting score
                      <select
                        value={customStart ? 'custom' : setup.start}
                        onChange={(e) => {
                          setCustomStart(e.target.value === 'custom');
                          if (e.target.value !== 'custom')
                            setSetup({
                              ...setup,
                              start: Number(e.target.value),
                            });
                        }}
                      >
                        {[301, 501, 701, 1001].map((n) => (
                          <option key={n}>{n}</option>
                        ))}
                        <option value="custom">Custom score</option>
                      </select>
                    </label>
                    {customStart && (
                      <label>
                        Custom starting score
                        <input
                          type="number"
                          min="101"
                          max="1001"
                          step="1"
                          required
                          value={setup.start || ''}
                          onChange={(e) =>
                            setSetup({
                              ...setup,
                              start: Number(e.target.value),
                            })
                          }
                        />
                      </label>
                    )}
                    <label>
                      Opening rule
                      <select
                        value={setup.inRule ?? 'straight'}
                        onChange={(e) =>
                          setSetup({
                            ...setup,
                            inRule: e.target.value as 'straight' | 'double',
                          })
                        }
                      >
                        <option value="straight">
                          Straight in — every dart scores
                        </option>
                        <option value="double">
                          Double in — double to start
                        </option>
                      </select>
                    </label>
                    <label>
                      Finishing rule
                      <select
                        value={setup.outRule ?? 'double'}
                        onChange={(e) =>
                          setSetup({
                            ...setup,
                            outRule: e.target.value as 'straight' | 'double',
                          })
                        }
                      >
                        <option value="double">
                          Double out — double to finish
                        </option>
                        <option value="straight">
                          Straight out — any segment to zero
                        </option>
                      </select>
                    </label>
                    <label>
                      Match format
                      <select
                        value={setup.setsToWin ? 'sets' : 'legs'}
                        onChange={(e) =>
                          setSetup({
                            ...setup,
                            setsToWin:
                              e.target.value === 'sets' ? 1 : undefined,
                            starterPolicy:
                              e.target.value === 'sets'
                                ? 'alternate-sets'
                                : undefined,
                          })
                        }
                      >
                        <option value="legs">Legs</option>
                        <option value="sets">Sets</option>
                      </select>
                    </label>
                    {setup.setsToWin && (
                      <label>
                        Sets to win
                        <select
                          value={setup.setsToWin}
                          onChange={(e) =>
                            setSetup({
                              ...setup,
                              setsToWin: Number(e.target.value),
                            })
                          }
                        >
                          {[1, 2, 3, 4, 5, 7, 9, 11].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <label>
                      {setup.setsToWin ? 'Legs per set to win' : 'First to'}
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
                    {setup.setsToWin && (
                      <label>
                        Starting-player rotation
                        <select
                          value={setup.starterPolicy ?? 'alternate-legs'}
                          onChange={(e) =>
                            setSetup({
                              ...setup,
                              starterPolicy: e.target
                                .value as Setup['starterPolicy'],
                            })
                          }
                        >
                          <option value="alternate-legs">
                            Alternate every leg across the match
                          </option>
                          <option value="alternate-sets">
                            Alternate set starters, then legs within each set
                          </option>
                        </select>
                      </label>
                    )}
                    <label>
                      Choose the starter
                      <select
                        value={setup.startMethod ?? 'manual'}
                        onChange={(e) =>
                          setSetup({
                            ...setup,
                            startMethod: e.target.value as Setup['startMethod'],
                          })
                        }
                      >
                        <option value="manual">Choose who starts</option>
                        <option
                          value="bull-off"
                          disabled={!!setup.bot || setup.players.length !== 2}
                        >
                          Throw for the bull (two local players)
                        </option>
                      </select>
                    </label>
                    {setup.bot && (
                      <p className="muted">
                        Practice uses a chosen starter. Bull-off requires two
                        physical players.
                      </p>
                    )}
                    <label>
                      {setup.startMethod === 'bull-off'
                        ? 'Throws for the bull first'
                        : 'Throws first'}
                      <select
                        value={setup.starter ?? 0}
                        onChange={(e) => {
                          const roster = setup.sides ?? getSides(setup),
                            index = Number(e.target.value);
                          setSetup(
                            rosterView(
                              {
                                ...setup,
                                starter: index,
                                startingSideId: roster[index].id,
                              },
                              roster,
                            ),
                          );
                        }}
                      >
                        {setup.players.map((name, i) => (
                          <option key={i} value={i}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <p className="rule-explanation">
                    {ruleSummary(setup)} · {formatSummary(setup)}.{' '}
                    {setup.inRule === 'double'
                      ? 'The opening double counts; earlier darts do not. A bust cancels the whole visit, including an opening double. '
                      : ''}
                    {setup.outRule === 'straight'
                      ? 'Leaving one is allowed; reach exactly zero on any segment.'
                      : 'Leaving one or reaching zero without a double is a bust.'}{' '}
                    {setup.setsToWin
                      ? 'No win-by-two or deciding-set tie-break.'
                      : ''}
                  </p>
                  {match && (
                    <p className="notice">
                      {!isTerminal(match)
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
                      {match && !isTerminal(match)
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
                  <section
                    className="match-controls"
                    aria-label="Match controls"
                  >
                    {match.status === 'paused' && (
                      <p role="status">
                        Match paused. Resume to continue from this score and
                        thrower.
                      </p>
                    )}
                    {!isTerminal(match) ? (
                      <>
                        <button
                          className="button secondary"
                          disabled={visitDraft.loading}
                          onClick={() =>
                            control({
                              type:
                                match.status === 'paused' ? 'resume' : 'pause',
                            })
                          }
                        >
                          {match.status === 'paused'
                            ? 'Resume match'
                            : 'Pause match'}
                        </button>
                        <details>
                          <summary>End match</summary>
                          <div className="end-match-actions">
                            {match.setup.players.map((name, i) => (
                              <button
                                key={i}
                                className="text-button"
                                disabled={
                                  visitDraft.loading || match.withdrawn[i]
                                }
                                onClick={() =>
                                  control({
                                    type: 'concede',
                                    player: i,
                                  })
                                }
                              >
                                {name}{' '}
                                {match.sides.length > 2
                                  ? 'withdraws'
                                  : 'concedes'}
                              </button>
                            ))}
                            <button
                              className="text-button"
                              disabled={visitDraft.loading}
                              onClick={() => control({ type: 'abandon' })}
                            >
                              Abandon without a winner
                            </button>
                          </div>
                        </details>
                      </>
                    ) : (
                      <>
                        <label>
                          Rematch first thrower
                          <select
                            value={
                              rematchStarter ??
                              ((match.setup.starter ?? 0) + 1) %
                                match.sides.length
                            }
                            onChange={(e) =>
                              setRematchStarter(Number(e.target.value))
                            }
                          >
                            {match.setup.players.map((name, i) => (
                              <option key={i} value={i}>
                                {name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          className="button secondary"
                          disabled={!resultSaved || saveState !== 'saved'}
                          onClick={startRematch}
                        >
                          Start rematch
                        </button>
                        {!resultSaved && (
                          <span className="muted">
                            Save or export this result before replacing it.
                          </span>
                        )}
                      </>
                    )}
                  </section>
                  {match.bullOff &&
                    (match.bullOff.winner === null ? (
                      <BullOffPanel
                        state={match.bullOff}
                        players={bullNames(match)}
                        enabled={match.status === 'active'}
                        onCommand={append}
                        onUndo={undo}
                        canUndo={
                          session?.commands.at(-1)?.type.startsWith('bull-') ??
                          false
                        }
                      />
                    ) : (
                      <details className="bull-result">
                        <summary>
                          Bull-off: {match.setup.players[match.bullOff.winner]}{' '}
                          starts
                        </summary>
                        <BullOffPanel
                          state={match.bullOff}
                          players={bullNames(match)}
                        />
                      </details>
                    ))}
                  <div className="match-meta">
                    <div>
                      <span className="live-label">
                        {isTerminal(match)
                          ? '● MATCH FINISHED'
                          : match.status === 'paused'
                            ? '● PAUSED'
                            : bullInProgress
                              ? '● BULL-OFF'
                              : match.setup.bot
                                ? '● PRACTICE MATCH'
                                : '● LIVE MATCH'}
                      </span>
                      <span>
                        {match.setup.start} · {ruleSummary(match.setup)} ·{' '}
                        {formatSummary(match.setup)}
                      </span>
                    </div>
                    <strong>
                      {match.setup.setsToWin ? `SET ${match.set} · ` : ''}LEG{' '}
                      {match.leg.toString().padStart(2, '0')}
                    </strong>
                  </div>
                  <div
                    className={`play-grid ${entryMode === 'board' ? 'dartboard-mode' : ''} ${match.status !== 'active' || bullInProgress ? 'is-stopped' : ''}`}
                  >
                    <div className="score-column">
                      <section
                        className={`board ${match.legWinner !== null ? 'completed' : ''}`}
                        aria-label="Scoreboard"
                      >
                        <div
                          className={`players ${match.sides.length > 2 ? 'has-many' : ''}`}
                        >
                          {match.setup.players.map((name, index) => {
                            const stats = playerStats(match, index);
                            const active =
                              match.status === 'active' &&
                              !bullInProgress &&
                              match.turn === index &&
                              match.legWinner === null;
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
                                  {match.withdrawn[index] && (
                                    <span className="throwing">WITHDRAWN</span>
                                  )}
                                  {active && (
                                    <span className="throwing">THROWING</span>
                                  )}
                                </div>
                                {match.sides[index].members.length > 1 && (
                                  <p className="side-thrower">
                                    {match.legWinner !== null ||
                                    isTerminal(match)
                                      ? `Roster: ${match.sides[index].members.map((m) => m.name).join(', ')}`
                                      : `${active ? 'At the oche' : 'Next member'}: ${match.sides[index].members[match.memberCursor[index]].name}`}
                                  </p>
                                )}
                                <div className="remaining">
                                  {match.scores[index]}
                                </div>
                                <div className="legs">
                                  <span>
                                    {match.setup.setsToWin
                                      ? 'SETS WON'
                                      : 'LEGS WON'}
                                  </span>
                                  <strong>
                                    {match.setup.setsToWin
                                      ? match.sets[index]
                                      : match.legs[index]}
                                    <small>
                                      {' '}
                                      /{' '}
                                      {match.setup.setsToWin ??
                                        match.setup.legsToWin}
                                    </small>
                                  </strong>
                                </div>
                                {match.setup.setsToWin && (
                                  <p className="set-leg-progress">
                                    {match.setLegs[index]} /{' '}
                                    {match.setup.legsToWin} legs in set{' '}
                                    {match.set}
                                  </p>
                                )}
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
                          className={`board-bottom ${match.status === 'active' && !bullInProgress && match.legWinner === null && !route ? 'empty-guide' : ''}`}
                        >
                          {bullInProgress && match.status === 'active' ? (
                            <h2>Finish the bull-off to begin scoring</h2>
                          ) : match.status === 'conceded' ||
                            match.status === 'abandoned' ? (
                            <>
                              <span className="eyebrow">
                                {match.status === 'conceded'
                                  ? 'CONCESSION'
                                  : 'NO WINNER AWARDED'}
                              </span>
                              <h2>
                                {match.status === 'abandoned'
                                  ? 'Match abandoned'
                                  : `${match.setup.players[match.winner!]} wins by concession`}
                              </h2>
                              <p>Only played legs and scores are recorded.</p>
                              <button
                                className="button primary"
                                onClick={() => setTab('history')}
                              >
                                View match summary →
                              </button>
                            </>
                          ) : match.status === 'paused' ? (
                            <h2>Match paused</h2>
                          ) : match.legWinner !== null ? (
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
                                  : match.setWinner !== null
                                    ? 'takes the set.'
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
                                  {match.setWinner !== null
                                    ? 'Next set →'
                                    : 'Next leg →'}
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
                                    {currentThrower(match).name}, you’re up.
                                  </h2>
                                )}
                              </div>
                              <p>
                                {route
                                  ? rules.outRule === 'double'
                                    ? 'Finish on a double. Make it count.'
                                    : 'Finish exactly on zero. Any segment counts.'
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
                                    {visit.throwerName}
                                    {match.sides[visit.player].members.length >
                                    1
                                      ? ` · ${match.setup.players[visit.player]}`
                                      : ''}
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
                      hidden={match.status !== 'active' || bullInProgress}
                      aria-label="Score entry"
                    >
                      {match.legWinner === null &&
                        (match.sides.length > 2 ||
                          match.sides[match.turn].members.length > 1) && (
                          <p className="turn-label" role="status">
                            At the oche:{' '}
                            <strong>{currentThrower(match).name}</strong> ·{' '}
                            {match.sides[match.turn].name}
                          </p>
                        )}
                      {visitDraft.loading && (
                        <p role="status">Checking this turn’s draft…</p>
                      )}
                      {visitDraft.recovery && (
                        <div
                          className="draft-recovery"
                          role="region"
                          aria-label="Unsubmitted visit recovery"
                        >
                          <h2>Pick up your unfinished visit?</h2>
                          <p>
                            A draft was saved for{' '}
                            {match.setup.players[match.turn]} on this exact
                            turn. It has not been recorded.
                          </p>
                          <button
                            className="button primary"
                            onClick={() => {
                              setEntryMode(visitDraft.recovery!.mode);
                              visitDraft.restore();
                            }}
                          >
                            Restore visit draft
                          </button>
                          <button
                            className="text-button"
                            onClick={visitDraft.discard}
                          >
                            Discard visit draft
                          </button>
                        </div>
                      )}
                      {visitDraft.notice && (
                        <p className="notice" role="status">
                          {visitDraft.notice}
                        </p>
                      )}
                      {visitDraft.status && (
                        <p className="draft-save-status" role="status">
                          {visitDraft.status}
                        </p>
                      )}
                      <div hidden={visitDraft.loading || !!visitDraft.recovery}>
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
                                visitDraft.update({ mode });
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
                            hits={visitDraft.value.hits}
                            onHitsChange={(hits) =>
                              visitDraft.update({ hits, mode: 'board' })
                            }
                            inRule={rules.inRule}
                            outRule={rules.outRule}
                            opened={match.opened[match.turn]}
                            remaining={match.scores[match.turn]}
                            playerName={
                              match.legWinner === null
                                ? currentThrower(match).name
                                : match.visits.at(-1)?.throwerName
                            }
                            waitingForOpponent={botTurn}
                            disabled={entryBlocked}
                            error={error}
                            onRecord={(visit) =>
                              append({ type: 'visit', visit })
                            }
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
                            {!match.opened[match.turn] && (
                              <div className="opening-entry">
                                <p>
                                  Double to start. Enter only the points from
                                  your opening double onwards; count all darts
                                  thrown.
                                </p>
                                <label>
                                  <input
                                    type="checkbox"
                                    checked={opens}
                                    onChange={(e) =>
                                      visitDraft.update({
                                        opens: e.target.checked,
                                        mode: 'keypad',
                                      })
                                    }
                                  />
                                  Opened on a double this visit
                                </label>
                              </div>
                            )}
                            <legend className="sr-only">
                              Enter visit score
                            </legend>
                            <label
                              className="score-label"
                              htmlFor="visit-score"
                            >
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
                                <button
                                  key={n}
                                  onClick={() => input(String(n))}
                                >
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
                                onChange={(e) =>
                                  setDarts(Number(e.target.value))
                                }
                              >
                                {[1, 2, 3].map((n) => (
                                  <option key={n} value={n}>
                                    {n}
                                  </option>
                                ))}
                              </select>
                            </label>
                            {finishing && rules.outRule === 'double' && (
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
                            {finishing &&
                              rules.outRule === 'double' &&
                              !double && (
                                <p className="entry-hint">
                                  Confirm the finishing double, or this visit is
                                  a bust.
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
                      </div>
                    </section>
                  </div>
                </>
              )
            ))}
          {tab === 'history' && (
            <MatchHistory
              current={session}
              archives={[
                ...archives,
                ...repository.document.data.archive.filter(
                  (e) => e.session.game === 'cricket',
                ),
              ]}
              correction={
                correctionsSupported
                  ? {
                      revision: repository.document.revision,
                      enabled:
                        repository.mode === 'database' && saveState === 'saved',
                      canUndo: correctionRecovery.undo,
                      hasRecovery: correctionRecovery.has,
                      onBegin: () => setBotPaused(true),
                      onApply: applyCorrection,
                      onUndo: undoReviewedCorrection,
                      onDownload: downloadCorrectionBackup,
                    }
                  : undefined
              }
            />
          )}
          {tab === 'players' && (
            <PlayerProfiles
              players={playerStore.players}
              archives={archives}
              onAdd={playerStore.add}
              onRename={playerStore.rename}
              onPlay={(player) => {
                const single = changeFormat(setup, 'singles');
                const sides = single.sides!.map((s, i) => ({
                  ...s,
                  members: s.members.map((m) =>
                    i === 0
                      ? { ...m, name: player.name, profileId: player.id }
                      : m.profileId === player.id
                        ? { ...m, profileId: null }
                        : m,
                  ),
                }));
                setSetup(rosterView(single, sides));
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
                archive: session
                  ? updateGameArchive(
                      [
                        ...archives,
                        ...repository.document.data.archive.filter(
                          (e) => e.session.game === 'cricket',
                        ),
                      ],
                      session,
                    )
                  : [
                      ...archives,
                      ...repository.document.data.archive.filter(
                        (e) => e.session.game === 'cricket',
                      ),
                    ],
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
