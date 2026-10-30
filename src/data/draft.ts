import { evaluateDarts } from '../domain/darts';
import type { DartHit } from '../domain/darts';
import { replay } from '../domain/match';
import type { Session } from '../domain/match';
import { openDatabase } from './repository';
import {
  objectStoreName,
  workspaceKey,
  validateDocument,
  normaliseSession,
} from './workspace';

export type VisitDraft = {
  mode: 'board' | 'keypad';
  hits: DartHit[];
  score: string;
  darts: number;
  double: boolean;
};
export const emptyDraft = (): VisitDraft => ({
  mode: 'board',
  hits: [],
  score: '',
  darts: 3,
  double: false,
});
export function turnIdentity(session: Session) {
  // The complete command prefix prevents restoring a draft after an edited history
  // happens to reach the same command count, player and remaining score.
  return JSON.stringify(normaliseSession(session));
}
export function validateDraft(value: unknown, session: Session): VisitDraft {
  const d = value as VisitDraft;
  const match = replay(session);
  if (
    !d ||
    !['board', 'keypad'].includes(d.mode) ||
    !Array.isArray(d.hits) ||
    typeof d.score !== 'string' ||
    !/^\d{0,3}$/.test(d.score) ||
    ![1, 2, 3].includes(d.darts) ||
    typeof d.double !== 'boolean' ||
    match.legWinner !== null ||
    (match.setup.bot && match.turn === 1)
  )
    throw new Error('The saved draft cannot be used on this turn.');
  evaluateDarts(match.scores[match.turn], d.hits);
  // Incomplete or impossible keypad totals remain editable drafts, never results.
  return {
    mode: d.mode,
    hits: d.hits.map((h) => ({ number: h.number, multiplier: h.multiplier })),
    score: d.score,
    darts: d.darts,
    double: d.double,
  };
}
export function hasDraft(draft: VisitDraft) {
  return draft.hits.length > 0 || draft.score !== '';
}
type StoredDraft = {
  version: 1;
  token: string;
  turn: string;
  savedAt: number;
  revision: number;
  value: VisitDraft;
};
const retention = 7 * 24 * 60 * 60 * 1000;
export class DraftStore {
  private token: string | null = null;
  constructor(
    private db: IDBDatabase,
    private key: string,
  ) {}
  async read(session: Session): Promise<VisitDraft | null> {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(objectStoreName, 'readonly');
      const store = tx.objectStore(objectStoreName);
      const request = store.get(this.key);
      request.onsuccess = () => {
        const stored = request.result as StoredDraft | undefined;
        this.token = stored?.token ?? null;
        if (
          !stored ||
          stored.turn !== turnIdentity(session) ||
          Date.now() - stored.savedAt > retention
        ) {
          resolve(null);
          return;
        }
        const current = store.get(workspaceKey);
        current.onsuccess = () => {
          try {
            const canonical = validateDocument(current.result);
            if (
              stored.revision !== canonical.revision ||
              !canonical.data.current ||
              turnIdentity(canonical.data.current) !== turnIdentity(session)
            ) {
              resolve(null);
              return;
            }
            if (
              stored.version !== 1 ||
              !Number.isFinite(stored.savedAt) ||
              stored.savedAt > Date.now() + 60000
            )
              throw new Error(
                'This draft uses an unsupported format. It has not been restored.',
              );
            resolve(validateDraft(stored.value, session));
          } catch (error) {
            reject(error);
          }
        };
        current.onerror = () => reject(current.error);
      };
      request.onerror = () => reject(request.error);
    });
  }
  async save(session: Session, value: VisitDraft | null) {
    const checked = value ? validateDraft(value, session) : null;
    const nextToken = crypto.randomUUID();
    return new Promise<void>((resolve, reject) => {
      const tx = this.db.transaction(objectStoreName, 'readwrite');
      const store = tx.objectStore(objectStoreName);
      const current = store.get(workspaceKey);
      let failure: unknown;
      current.onsuccess = () => {
        try {
          const canonical = validateDocument(current.result);
          const saved = canonical.data.current;
          if (!saved || turnIdentity(saved) !== turnIdentity(session))
            throw new Error(
              'The saved turn changed. This draft has not overwritten it.',
            );
          const previous = store.get(this.key);
          previous.onsuccess = () => {
            try {
              if ((previous.result?.token ?? null) !== this.token)
                throw new Error(
                  'Another copy of this tab changed the draft. Reload to review it.',
                );
              if (checked && hasDraft(checked)) {
                store.put(
                  {
                    version: 1,
                    token: nextToken,
                    turn: turnIdentity(session),
                    savedAt: Date.now(),
                    revision: canonical.revision,
                    value: checked,
                  },
                  this.key,
                );
              } else store.delete(this.key);
            } catch (error) {
              failure = error;
              tx.abort();
            }
          };
        } catch (error) {
          failure = error;
          tx.abort();
        }
      };
      tx.oncomplete = () => {
        this.token = checked && hasDraft(checked) ? nextToken : null;
        resolve();
      };
      tx.onabort = () =>
        reject(
          failure ?? tx.error ?? new Error('The draft could not be saved.'),
        );
      tx.onerror = () => {};
    });
  }
  close() {
    this.db.close();
  }
}
export async function openDraftStore(
  options: { factory?: IDBFactory; name?: string; tab?: string } = {},
) {
  let tab = options.tab;
  if (!tab) {
    tab = sessionStorage.getItem('darts-master.tab.v1') ?? crypto.randomUUID();
    sessionStorage.setItem('darts-master.tab.v1', tab);
  }
  const db = await openDatabase(options.factory ?? indexedDB, options.name);
  // Discard abandoned tab drafts after seven days, without touching match data.
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(objectStoreName, 'readwrite');
    const request = tx.objectStore(objectStoreName).openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      if (
        typeof cursor.key === 'string' &&
        cursor.key.startsWith('draft:') &&
        typeof cursor.value?.savedAt === 'number' &&
        cursor.value.savedAt < Date.now() - retention
      )
        cursor.delete();
      cursor.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
    tx.onerror = () => {};
  });
  return new DraftStore(db, `draft:${tab}`);
}
