import { parseGameRecord } from '../domain/games/registry';
import type { GameRecord } from '../domain/games/registry';
import { gameIdOf } from '../domain/games/identity';
import { previewCorrection } from '../domain/correction';
import type { CorrectionInput, CorrectionPolicy } from '../domain/correction';
import { isTerminal, replay } from '../domain/match';
import { updateGameArchive } from '../domain/archive';
import { addPlayer, renamePlayer } from '../domain/players';
import type { Session } from '../domain/match';
import {
  databaseName,
  emptyData,
  legacySessionKey,
  normaliseSession,
  objectStoreName,
  readLegacy,
  recoveryKey,
  validateData,
  validateDocument,
  workspaceKey,
} from './workspace';
import type {
  LegacyErrors,
  WorkspaceData,
  WorkspaceDocument,
} from './workspace';

export type SaveState = 'saved' | 'saving' | 'unsaved';
export const workspaceMigrationKey = 'before-game-workspace-migration';
export const correctionRecoveryKey = 'before-correction';
type Mode = 'database' | 'legacy-recovery' | 'unreadable' | 'memory';
class RejectedChange extends Error {}
class ExternalConflict extends Error {}
export class LocalRepository {
  private queue: Promise<unknown> = Promise.resolve();
  private listeners = new Set<() => void>();
  private pending = 0;
  private failures = new Set<'match' | 'other' | 'external'>();
  private state: SaveState;
  problem: string;
  constructor(
    private db: IDBDatabase | null,
    public document: WorkspaceDocument,
    public mode: Mode,
    public legacyErrors: LegacyErrors = {},
    public raw: unknown = null,
    problem = '',
  ) {
    this.problem = problem;
    this.state = mode === 'database' ? 'saved' : 'unsaved';
    if (mode !== 'database') this.failures.add('other');
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  getSaveState = () => this.state;
  private emit() {
    for (const listener of this.listeners) listener();
  }
  private write(
    transform: (data: WorkspaceData) => WorkspaceData,
    backup: boolean | 'correction' = false,
    kind: 'match' | 'other' = 'other',
  ): Promise<WorkspaceDocument> {
    this.pending++;
    this.state = 'saving';
    this.emit();
    const operation = this.queue
      .catch(() => {})
      .then(
        () =>
          new Promise<WorkspaceDocument>((resolve, reject) => {
            if (!this.db || this.mode !== 'database') {
              reject(
                new Error(
                  this.problem ||
                    'Local storage is unavailable. Export your data before closing this page.',
                ),
              );
              return;
            }
            let failure: unknown;
            let output: WorkspaceDocument;
            const transaction = this.db.transaction(
              objectStoreName,
              'readwrite',
            );
            const store = transaction.objectStore(objectStoreName);
            const request = store.get(workspaceKey);
            request.onsuccess = () => {
              try {
                const latest =
                  request.result === undefined
                    ? { version: 3 as const, revision: 0, data: emptyData() }
                    : validateDocument(request.result);
                if (latest.revision !== this.document.revision)
                  throw new ExternalConflict(
                    'Another tab changed your saved data. Export this match if needed, then reload before continuing.',
                  );
                let data: WorkspaceData;
                try {
                  data = transform(latest.data);
                } catch (error) {
                  throw new RejectedChange(
                    error instanceof Error
                      ? error.message
                      : 'The change was rejected.',
                  );
                }
                if (JSON.stringify(data) === JSON.stringify(latest.data)) {
                  output = latest;
                  return;
                }
                if (!Number.isSafeInteger(latest.revision + 1))
                  throw new Error(
                    'The workspace revision cannot advance safely. Export your readable data before recovery.',
                  );
                output = { version: 3, revision: latest.revision + 1, data };
                if (backup === 'correction')
                  store.put(
                    { previous: latest, appliedRevision: output.revision },
                    correctionRecoveryKey,
                  );
                else if (backup)
                  store.put(
                    { previous: latest, importedRevision: output.revision },
                    recoveryKey,
                  );
                store.put(output, workspaceKey);
              } catch (error) {
                failure = error;
                transaction.abort();
              }
            };
            transaction.oncomplete = () => {
              this.document = output;
              resolve(output);
            };
            transaction.onabort = () =>
              reject(
                failure ??
                  transaction.error ??
                  new Error('The save could not be completed.'),
              );
            transaction.onerror = () => {};
          }),
      );
    this.queue = operation;
    return operation.then(
      (result) => {
        this.pending--;
        this.failures.delete(kind);
        this.state = this.pending
          ? 'saving'
          : this.failures.size
            ? 'unsaved'
            : 'saved';
        if (!this.failures.size) this.problem = '';
        this.emit();
        return result;
      },
      (error) => {
        this.pending--;
        if (!(error instanceof RejectedChange)) {
          this.failures.add(
            error instanceof ExternalConflict ? 'external' : kind,
          );
          this.problem =
            error instanceof Error
              ? error.message
              : 'Local data could not be saved.';
        }
        this.state = this.pending
          ? 'saving'
          : this.failures.size
            ? 'unsaved'
            : 'saved';
        this.emit();
        throw error;
      },
    );
  }
  async saveMatch(session: GameRecord) {
    const checked = parseGameRecord(session);
    return this.write(
      (data) => {
        if (
          data.current &&
          data.current.id === checked.id &&
          gameIdOf(data.current) !== gameIdOf(checked)
        )
          throw new Error(
            'Another game type already uses this match identifier.',
          );
        return JSON.stringify(data.current) === JSON.stringify(checked)
          ? data
          : {
              ...data,
              current: checked,
              archive: updateGameArchive(data.archive, checked),
            };
      },
      false,
      'match',
    );
  }
  async correctMatch(
    expected: Session,
    commandIndex: number,
    input: CorrectionInput,
    policy: CorrectionPolicy,
    expectedRevision: number,
    replaceCurrent = false,
  ) {
    const checkedExpected = normaliseSession(expected);
    const preview = previewCorrection(
      checkedExpected,
      commandIndex,
      input,
      policy,
    );
    const corrected = normaliseSession(preview.session);
    if (JSON.stringify(corrected) === JSON.stringify(checkedExpected))
      throw new Error('The correction does not change this recorded match.');
    return this.write((data) => {
      if (this.document.revision !== expectedRevision)
        throw new Error(
          'Saved data changed after this review. Close the editor and review the visit again.',
        );
      const target =
        data.current?.id === expected.id
          ? data.current
          : data.archive.find((e) => e.session.id === expected.id)?.session;
      if (
        !target ||
        target.game === 'cricket' ||
        JSON.stringify(normaliseSession(target)) !==
          JSON.stringify(checkedExpected)
      )
        throw new Error(
          'The match changed after this review. Review the visit again.',
        );
      const becomesCurrent =
        data.current?.id === expected.id || !isTerminal(replay(corrected));
      if (
        becomesCurrent &&
        data.current &&
        data.current.id !== expected.id &&
        !replaceCurrent
      )
        throw new Error(
          'Confirm replacing the current game before reopening this archived match.',
        );
      return {
        ...data,
        current: becomesCurrent ? corrected : data.current,
        archive: updateGameArchive(data.archive, corrected),
      };
    }, 'correction');
  }
  async correctionRecovery(): Promise<{
    previous: unknown;
    appliedRevision: number;
  } | null> {
    if (!this.db) return null;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(objectStoreName, 'readonly');
      const r = tx.objectStore(objectStoreName).get(correctionRecoveryKey);
      r.onsuccess = () => resolve(r.result ?? null);
      r.onerror = () => reject(r.error);
    });
  }
  async undoCorrection() {
    const recovery = await this.correctionRecovery();
    if (!recovery) throw new Error('There is no correction recovery copy.');
    return this.write(() => {
      if (this.document.revision !== recovery.appliedRevision)
        throw new Error(
          'Data changed after the correction. Undo is no longer available; export the recovery copy instead.',
        );
      return validateDocument(recovery.previous).data;
    });
  }
  async correctionBackup(): Promise<WorkspaceData | null> {
    const recovery = await this.correctionRecovery();
    return recovery ? validateDocument(recovery.previous).data : null;
  }
  async migrationBackup(): Promise<WorkspaceData | null> {
    if (!this.db) return null;
    const previous = await new Promise<unknown>((resolve, reject) => {
      const tx = this.db!.transaction(objectStoreName, 'readonly');
      const request = tx
        .objectStore(objectStoreName)
        .get(workspaceMigrationKey);
      request.onsuccess = () => resolve(request.result?.previous ?? null);
      request.onerror = () => reject(request.error);
    });
    return previous ? validateDocument(previous).data : null;
  }
  async addPlayer(name: string) {
    const result = await this.write((data) => ({
      ...data,
      players: addPlayer(data.players, name),
    }));
    return result.data.players.at(-1)!;
  }
  async renamePlayer(id: string, name: string) {
    return this.write((data) => ({
      ...data,
      players: renamePlayer(data.players, id, name),
    }));
  }
  async applyImport(data: WorkspaceData, expectedRevision: number) {
    const checked = validateData(data);
    if (expectedRevision !== this.document.revision)
      throw new Error(
        'Saved data changed after this preview. Review the file again.',
      );
    return this.write((latest) => {
      if (this.document.revision !== expectedRevision)
        throw new Error(
          'Saved data changed after this preview. Review the file again.',
        );
      return checked;
    }, true);
  }
  async recovery(): Promise<{
    previous: unknown;
    importedRevision: number;
  } | null> {
    if (!this.db) return null;
    return new Promise((resolve, reject) => {
      const tx = this.db!.transaction(objectStoreName, 'readonly');
      const r = tx.objectStore(objectStoreName).get(recoveryKey);
      r.onsuccess = () => resolve(r.result ?? null);
      r.onerror = () => reject(r.error);
    });
  }
  async undoImport() {
    const recovery = await this.recovery();
    if (!recovery) throw new Error('There is no previous import to undo.');
    if (this.document.revision !== recovery.importedRevision)
      throw new Error(
        'Data has changed since that import. Download the recovery backup and import the parts you need instead.',
      );
    return this.write(() => validateDocument(recovery.previous).data);
  }
  async resetLegacy(part: 'current' | 'archive' | 'players') {
    if (!this.legacyErrors[part])
      throw new Error('Use the data recovery tools for this storage problem.');
    const key =
      part === 'current'
        ? legacySessionKey
        : `darts-master.${part === 'archive' ? 'archive' : 'players'}.v1`;
    localStorage.removeItem(key);
  }
  async resetUnreadable() {
    if (!this.db || this.mode !== 'unreadable')
      throw new Error(
        'Storage cannot be reset in the current state. Reload after checking browser storage access.',
      );
    const db = this.db;
    const document = await new Promise<WorkspaceDocument>((resolve, reject) => {
      const tx = db.transaction(objectStoreName, 'readwrite');
      const store = tx.objectStore(objectStoreName);
      const request = store.get(workspaceKey);
      let output: WorkspaceDocument;
      let failure: unknown;
      request.onsuccess = () => {
        try {
          if (JSON.stringify(request.result) !== JSON.stringify(this.raw))
            throw new Error(
              'Another tab changed the saved data. Reload before resetting it.',
            );
          const revision = Number.isSafeInteger(request.result?.revision)
            ? request.result.revision + 1
            : 1;
          output = { version: 3, revision, data: emptyData() };
          store.put(
            { previous: request.result, importedRevision: revision },
            recoveryKey,
          );
          store.put(output, workspaceKey);
        } catch (e) {
          failure = e;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(output);
      tx.onabort = () => reject(failure ?? tx.error);
      tx.onerror = () => {};
    });
    this.document = document;
    this.mode = 'database';
    this.problem = '';
    this.failures.clear();
    this.state = 'saved';
    this.emit();
  }
  close() {
    this.db?.close();
  }
}

export function openDatabase(
  factory: IDBFactory,
  name = databaseName,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(name, 1);
    let settled = false;
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(objectStoreName))
        request.result.createObjectStore(objectStoreName);
    };
    request.onsuccess = () => {
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => {
      settled = true;
      reject(request.error ?? new Error('Could not open local data.'));
    };
    request.onblocked = () => {
      settled = true;
      reject(
        new Error(
          'Close other Darts Master tabs and reload to finish opening local data.',
        ),
      );
    };
  });
}
export async function openLocalRepository(
  options: {
    factory?: IDBFactory;
    storage?: Pick<Storage, 'getItem'>;
    name?: string;
  } = {},
): Promise<LocalRepository> {
  const legacy = readLegacy(options.storage ?? localStorage);
  let db: IDBDatabase;
  try {
    db = await openDatabase(options.factory ?? indexedDB, options.name);
  } catch (error) {
    return new LocalRepository(
      null,
      { version: 3, revision: 0, data: legacy.data },
      'memory',
      legacy.errors,
      legacy.raw,
      error instanceof Error
        ? error.message
        : 'Browser storage is unavailable.',
    );
  }
  let raw: unknown;
  let recoverable: WorkspaceDocument | undefined;
  try {
    const document = await new Promise<WorkspaceDocument>((resolve, reject) => {
      let result: WorkspaceDocument;
      let failure: unknown;
      const tx = db.transaction(objectStoreName, 'readwrite');
      const store = tx.objectStore(objectStoreName);
      const request = store.get(workspaceKey);
      request.onsuccess = () => {
        raw = request.result;
        try {
          if (raw !== undefined) {
            result = validateDocument(raw);
            if ((raw as { version: number }).version === 2) {
              recoverable = result;
              if (!Number.isSafeInteger(result.revision + 1))
                throw new Error(
                  'The workspace revision cannot be upgraded safely.',
                );
              result = { ...result, revision: result.revision + 1 };
              store.put(
                { previous: raw, appliedRevision: result.revision },
                workspaceMigrationKey,
              );
              store.put(result, workspaceKey);
              const turn = recoverable.data.current
                ? JSON.stringify(parseGameRecord(recoverable.data.current))
                : null;
              if (turn) {
                const cursor = store.openCursor();
                cursor.onsuccess = () => {
                  const item = cursor.result;
                  if (!item) return;
                  try {
                    const draft = item.value;
                    if (
                      typeof item.key === 'string' &&
                      item.key.startsWith('draft:') &&
                      draft?.version === 1 &&
                      draft.revision === recoverable!.revision &&
                      draft.turn === turn
                    )
                      item.update({ ...draft, revision: result.revision });
                    item.continue();
                  } catch (error) {
                    failure = error;
                    tx.abort();
                  }
                };
              }
            }
          } else {
            result = { version: 3, revision: 0, data: legacy.data };
            if (!Object.keys(legacy.errors).length && legacy.hasData) {
              result.revision = 1;
              store.put(result, workspaceKey);
            }
          }
        } catch (error) {
          failure = error;
          tx.abort();
        }
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(failure ?? tx.error);
      tx.onerror = () => {};
    });
    if (raw === undefined && Object.keys(legacy.errors).length)
      return new LocalRepository(
        db,
        document,
        'legacy-recovery',
        legacy.errors,
        legacy.raw,
        'Some older saved data could not be read. It has been preserved. Use the recovery controls before saving new data.',
      );
    return new LocalRepository(db, document, 'database', {}, legacy.raw);
  } catch (error) {
    return new LocalRepository(
      db,
      recoverable ?? {
        version: 3,
        revision: 0,
        data: raw === undefined ? legacy.data : emptyData(),
      },
      recoverable || raw === undefined ? 'memory' : 'unreadable',
      {},
      raw,
      recoverable
        ? `Saved data could not be upgraded. The original workspace is preserved; export readable data or reload when storage is available. ${error instanceof Error ? error.message : ''}`
        : error instanceof Error
          ? error.message
          : 'Saved data could not be opened. No data was overwritten.',
    );
  }
}
let singleton: Promise<LocalRepository> | undefined;
export function browserRepository() {
  return (singleton ??= openLocalRepository());
}
