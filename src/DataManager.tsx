import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { LocalRepository } from './data/repository';
import {
  backupText,
  buildImportPlan,
  defaultOptions,
  maxBackupBytes,
} from './data/backup';
import type { ImportOptions, IncomingBackup } from './data/backup';
import { inspectFileText } from './data/inspectFile';
import { validateDocument } from './data/workspace';
import type { WorkspaceData } from './data/workspace';
import { replay } from './domain/match';
import ActionButton from './ui/ActionButton';
import { OfflineSettings } from './OfflineSupport';

function download(text: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: 'application/json' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function DataManager({
  repository,
  availableData,
}: {
  repository: LocalRepository;
  availableData: WorkspaceData;
}) {
  const saveState = useSyncExternalStore(
    repository.subscribe,
    repository.getSaveState,
  );
  const [incoming, setIncoming] = useState<IncomingBackup | null>(null);
  const [options, setOptions] = useState<ImportOptions | null>(null);
  const [base, setBase] = useState(() => structuredClone(repository.document));
  const [busy, setBusy] = useState(false),
    [problem, setProblem] = useState(''),
    [replace, setReplace] = useState(false),
    [recoveryReady, setRecoveryReady] = useState(false);
  const [undoRevision, setUndoRevision] = useState<number | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    repository
      .recovery()
      .then((value) => {
        setRecoveryReady(!!value);
        if (value) {
          try {
            validateDocument(value.previous);
            setUndoRevision(value.importedRevision);
          } catch {
            /* Raw recovery remains downloadable. */
          }
        }
      })
      .catch(() => {});
    return () => controller.current?.abort();
  }, [repository]);
  const plan = useMemo(
    () =>
      incoming && options
        ? buildImportPlan(base.data, incoming, options)
        : null,
    [incoming, options, base],
  );
  async function chooseFile(file: File | undefined) {
    controller.current?.abort();
    setIncoming(null);
    setOptions(null);
    setProblem('');
    setReplace(false);
    if (!file) return;
    if (file.size > maxBackupBytes) {
      setProblem('Choose a backup smaller than 20 MB.');
      return;
    }
    const operation = new AbortController();
    controller.current = operation;
    setBusy(true);
    try {
      const result = await inspectFileText(await file.text(), operation.signal);
      if (operation.signal.aborted) return;
      const snapshot = structuredClone(repository.document);
      setBase(snapshot);
      setIncoming(result);
      setOptions(defaultOptions(snapshot.data, result));
    } catch (e) {
      if (!operation.signal.aborted)
        setProblem(
          e instanceof Error ? e.message : 'The file could not be reviewed.',
        );
    } finally {
      if (controller.current === operation) setBusy(false);
    }
  }
  async function apply() {
    if (!plan || !incoming || plan.errors.length) return;
    if (plan.replacesCurrent && !replace) {
      setProblem('Confirm replacement of the open match first.');
      return;
    }
    setBusy(true);
    setProblem('');
    try {
      await repository.applyImport(plan.data, base.revision);
      window.location.reload();
    } catch (e) {
      setProblem(
        e instanceof DOMException
          ? 'Import could not be saved. Existing data was preserved. Browser storage may be unavailable or full.'
          : e instanceof Error
            ? e.message
            : 'Import failed. Existing data was preserved.',
      );
      setBusy(false);
    }
  }
  async function previousBackup() {
    try {
      const recovery = await repository.recovery();
      if (!recovery) throw new Error('No recovery backup is available.');
      let text: string;
      try {
        text = backupText(validateDocument(recovery.previous).data);
      } catch {
        text = JSON.stringify(
          {
            format: 'darts-master-recovery',
            version: 1,
            raw: recovery.previous,
          },
          null,
          2,
        );
      }
      download(text, 'darts-before-import.json');
    } catch (e) {
      setProblem((e as Error).message);
    }
  }
  return (
    <div className="data-manager">
      <OfflineSettings />
      <section className="panel data-panel">
        <div className="section-label">YOUR DATA, ON THIS DEVICE</div>
        <h2>Back up before you need it.</h2>
        <p className="muted">
          Backups contain player names, match details and the open game. They
          stay in a downloaded file; nothing is uploaded. Keep a copy somewhere
          safe before clearing browser data.
        </p>
        <div className="data-counts">
          <span>
            <strong>{availableData.players.length}</strong> players
          </span>
          <span>
            <strong>{availableData.archive.length}</strong> saved matches
          </span>
          <span>
            <strong>{availableData.current ? '1' : '0'}</strong> open game
          </span>
        </div>
        <ActionButton
          disabled={busy || saveState === 'saving'}
          onClick={() => {
            try {
              download(
                backupText(
                  availableData,
                  repository.mode === 'database'
                    ? []
                    : [
                        'Partial recovery backup: unreadable older data is not included. Keep the raw recovery copy as well.',
                      ],
                ),
                `darts-backup-${new Date().toISOString().slice(0, 10)}.json`,
              );
            } catch (e) {
              setProblem((e as Error).message);
            }
          }}
        >
          {repository.mode === 'database'
            ? 'Download full backup ↓'
            : 'Download readable data ↓'}
        </ActionButton>
        {saveState === 'unsaved' && (
          <p className="notice">
            Some changes are not saved. A backup includes the readable match
            currently in memory.
          </p>
        )}
      </section>
      {repository.mode !== 'database' && (
        <section className="panel data-panel">
          <h2>Saved data needs attention</h2>
          <p className="notice">{repository.problem}</p>
          <ActionButton
            variant="secondary"
            onClick={() =>
              download(
                JSON.stringify(
                  {
                    format: 'darts-master-recovery',
                    version: 1,
                    raw: repository.raw,
                  },
                  null,
                  2,
                ),
                'darts-recovery.json',
              )
            }
          >
            Download raw recovery copy ↓
          </ActionButton>
          {Object.keys(repository.legacyErrors).map((part) => (
            <ActionButton
              key={part}
              variant="secondary"
              onClick={async () => {
                if (
                  window.confirm(
                    `Reset unreadable ${part} data? Download a recovery copy first. Other old saved data will remain.`,
                  )
                ) {
                  try {
                    await repository.resetLegacy(
                      part as 'current' | 'archive' | 'players',
                    );
                    window.location.reload();
                  } catch (e) {
                    setProblem((e as Error).message);
                  }
                }
              }}
            >
              Reset unreadable {part}
            </ActionButton>
          ))}
          {repository.mode === 'unreadable' && (
            <ActionButton
              variant="danger"
              onClick={async () => {
                if (
                  window.confirm(
                    'Reset unreadable local data and start empty? Download a recovery copy first. The old data will also be retained as the last recovery snapshot.',
                  )
                ) {
                  try {
                    await repository.resetUnreadable();
                    window.location.reload();
                  } catch (e) {
                    setProblem((e as Error).message);
                  }
                }
              }}
            >
              Reset unreadable workspace
            </ActionButton>
          )}
        </section>
      )}
      <section className="panel data-panel">
        <div className="section-label">REVIEW BEFORE IMPORT</div>
        <h2>Restore or combine saved games.</h2>
        <p className="muted">
          Choose a full backup or an individual match export, up to 20 MB.
          Nothing changes until you confirm. Imported results are labelled;
          matching display names never claim a saved player.
        </p>
        <label className="file-picker">
          Choose backup file
          <input
            type="file"
            accept=".json,application/json"
            disabled={repository.mode !== 'database'}
            onChange={(e) => {
              void chooseFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
        {busy && !incoming && <p role="status">Checking the backup…</p>}
        {incoming && options && plan && (
          <div className="import-preview">
            <h3>Import preview</h3>
            <div className="data-counts">
              <span>
                <strong>{plan.addedMatches}</strong> new matches
              </span>
              <span>
                <strong>{plan.addedPlayers}</strong> new players
              </span>
              <span>
                <strong>{plan.duplicates}</strong> duplicate matches skipped
              </span>
            </div>
            {incoming.data.players.length > 0 && (
              <>
                <h3>Link players deliberately</h3>
                {incoming.data.players.map((player) => (
                  <label className="import-choice" key={player.id}>
                    {player.name}
                    <select
                      value={options.profileLinks[player.id]}
                      onChange={(e) =>
                        setOptions({
                          ...options,
                          profileLinks: {
                            ...options.profileLinks,
                            [player.id]: e.target.value,
                          },
                        })
                      }
                    >
                      <option value="new">Create separate player</option>
                      <option value="skip">
                        Keep their imported results as guest games
                      </option>
                      {base.data.players.map((local) => (
                        <option key={local.id} value={local.id}>
                          Link to {local.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </>
            )}
            {incoming.data.archive.length > 0 && (
              <>
                <h3>Choose results</h3>
                {incoming.data.archive.map((entry) => (
                  <label className="import-choice" key={entry.session.id}>
                    <span>
                      {entry.session.setup.players.join(' vs ')}
                      <small>
                        {new Date(entry.completedAt).toLocaleDateString()} ·{' '}
                        {replay(entry.session).legs.join('–')}
                      </small>
                    </span>
                    <select
                      value={options.matches[entry.session.id!]}
                      onChange={(e) =>
                        setOptions({
                          ...options,
                          matches: {
                            ...options.matches,
                            [entry.session.id!]: e.target.value as
                              'import' | 'skip' | 'copy',
                          },
                        })
                      }
                    >
                      <option value="import">
                        Import / skip identical result
                      </option>
                      <option value="skip">Do not import</option>
                      <option value="copy">
                        Import separate copy if ID conflicts
                      </option>
                    </select>
                  </label>
                ))}
              </>
            )}
            {incoming.data.current &&
              replay(incoming.data.current).winner === null && (
                <label className="replace-confirm">
                  <input
                    type="checkbox"
                    checked={options.resumeCurrent}
                    onChange={(e) =>
                      setOptions({
                        ...options,
                        resumeCurrent: e.target.checked,
                      })
                    }
                  />
                  Restore the in-progress match from this backup
                </label>
              )}
            {plan.notes.map((note, index) => (
              <p className="notice" key={index}>
                {note}
              </p>
            ))}
            {plan.errors.map((error, index) => (
              <p className="error" role="alert" key={index}>
                {error}
              </p>
            ))}
            {plan.replacesCurrent && (
              <label className="replace-confirm">
                <input
                  type="checkbox"
                  checked={replace}
                  onChange={(e) => setReplace(e.target.checked)}
                />
                Replace the game currently open on this device
              </label>
            )}
            <ActionButton
              pending={busy}
              disabled={
                saveState !== 'saved' ||
                !!plan.errors.length ||
                (plan.replacesCurrent && !replace)
              }
              onClick={() => void apply()}
            >
              Confirm import
            </ActionButton>
            <p className="entry-hint">
              The complete pre-import workspace is kept in a recovery snapshot
              within the same database transaction. Current data is preserved if
              the transaction fails.
            </p>
          </div>
        )}
      </section>
      {recoveryReady && (
        <section className="panel data-panel">
          <h2>Last import recovery</h2>
          <p className="muted">
            Download the data from before your last import. Undo is available
            only while no later changes have been saved.
          </p>
          <div className="gallery-row">
            <ActionButton
              variant="secondary"
              onClick={() => void previousBackup()}
            >
              Download pre-import backup ↓
            </ActionButton>
            <ActionButton
              variant="secondary"
              pending={busy}
              disabled={
                undoRevision !== repository.document.revision ||
                saveState !== 'saved'
              }
              onClick={async () => {
                if (
                  window.confirm(
                    'Undo the last import and restore its previous workspace?',
                  )
                ) {
                  setBusy(true);
                  try {
                    await repository.undoImport();
                    window.location.reload();
                  } catch (e) {
                    setProblem((e as Error).message);
                    setBusy(false);
                  }
                }
              }}
            >
              Undo last import
            </ActionButton>
          </div>
        </section>
      )}
      {problem && (
        <p className="error" role="alert">
          {problem}
        </p>
      )}
    </div>
  );
}
