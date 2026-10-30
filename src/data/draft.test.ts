import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { openLocalRepository, openDatabase } from './repository';
import {
  emptyDraft,
  openDraftStore,
  turnIdentity,
  validateDraft,
} from './draft';
import type { Session } from '../domain/match';
import { objectStoreName } from './workspace';
const session: Session = {
  version: 1,
  id: 'draft-match',
  setup: { players: ['A', 'B'], start: 301, legsToWin: 1 },
  commands: [],
};
const draft = {
  ...emptyDraft(),
  hits: [{ number: 20, multiplier: 3 as const }],
};
async function fixture() {
  const factory = new IDBFactory();
  const repo = await openLocalRepository({
    factory,
    storage: { getItem: () => null },
  });
  await repo.saveMatch(session);
  const store = await openDraftStore({ factory, tab: 'a' });
  return { factory, repo, store };
}
describe('unsubmitted visit drafts', () => {
  it('restores exact-turn drafts without recording a visit and keeps tabs separate', async () => {
    const { factory, repo, store } = await fixture();
    expect(await store.read(session)).toBeNull();
    await store.save(session, draft);
    const reopened = await openDraftStore({ factory, tab: 'a' });
    expect(await reopened.read(session)).toEqual(draft);
    const other = await openDraftStore({ factory, tab: 'b' });
    expect(await other.read(session)).toBeNull();
    expect(repo.document.data.current?.commands).toEqual([]);
    await reopened.save(session, null);
    expect(await reopened.read(session)).toBeNull();
  });
  it('rejects stale duplicate-tab writes without losing the saved draft', async () => {
    const { factory, store } = await fixture();
    const duplicate = await openDraftStore({ factory, tab: 'a' });
    await store.read(session);
    await duplicate.read(session);
    await store.save(session, draft);
    await expect(
      duplicate.save(session, { ...emptyDraft(), score: '180' }),
    ).rejects.toThrow('Another copy');
    expect(await duplicate.read(session)).toEqual(draft);
  });
  it('does not restore an old draft after a visit is recorded and undone', async () => {
    const { repo, store } = await fixture();
    await store.read(session);
    await store.save(session, draft);
    await repo.saveMatch({
      ...session,
      commands: [
        { type: 'visit', visit: { total: 60, darts: 3, double: false } },
      ],
    });
    await expect(store.save(session, draft)).rejects.toThrow(
      'saved turn changed',
    );
    await repo.saveMatch(session);
    expect(await store.read(session)).toBeNull();
  });
  it('matches the complete history, not only its length or resulting score', () => {
    const a = {
      ...session,
      commands: [
        {
          type: 'visit' as const,
          visit: { total: 60, darts: 3, double: false },
        },
      ],
    };
    const b = {
      ...session,
      commands: [
        {
          type: 'visit' as const,
          visit: { total: 60, darts: 2, double: false },
        },
      ],
    };
    expect(turnIdentity(a)).not.toBe(turnIdentity(b));
  });
  it('rejects bad segments, extra darts after a finish and bot/completed turns', () => {
    expect(() =>
      validateDraft(
        { ...draft, hits: [{ number: 25, multiplier: 3 }] },
        session,
      ),
    ).toThrow();
    expect(() =>
      validateDraft(
        {
          ...draft,
          hits: [
            { number: 0, multiplier: 1 },
            { number: 0, multiplier: 1 },
            { number: 0, multiplier: 1 },
            { number: 0, multiplier: 1 },
          ],
        },
        session,
      ),
    ).toThrow();
    const atBull: Session = {
      ...session,
      commands: [180, 0, 71, 0].map((total) => ({
        type: 'visit',
        visit: { total, darts: 3, double: false },
      })),
    };
    expect(() =>
      validateDraft(
        {
          ...draft,
          hits: [
            { number: 25, multiplier: 2 },
            { number: 0, multiplier: 1 },
          ],
        },
        atBull,
      ),
    ).toThrow(/ended/);
    const finished: Session = {
      ...atBull,
      commands: [
        ...atBull.commands,
        {
          type: 'visit',
          visit: {
            total: 50,
            darts: 1,
            double: true,
            hits: [{ number: 25, multiplier: 2 }],
          },
        },
      ],
    };
    expect(() => validateDraft(draft, finished)).toThrow(/cannot be used/);
    expect(() =>
      validateDraft({ ...draft, score: '<script>' }, session),
    ).toThrow();
    expect(() =>
      validateDraft(draft, {
        ...session,
        setup: { ...session.setup, bot: 'regular', starter: 1 },
      }),
    ).toThrow();
  });
  it('expires abandoned drafts without touching the workspace', async () => {
    const { factory, repo, store } = await fixture();
    await store.read(session);
    await store.save(session, draft);
    const db = await openDatabase(factory);
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(objectStoreName, 'readwrite');
      const s = tx.objectStore(objectStoreName);
      const r = s.get('draft:a');
      r.onsuccess = () =>
        s.put({ ...r.result, savedAt: Date.now() - 8 * 86400000 }, 'draft:a');
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
    const reopened = await openDraftStore({ factory, tab: 'a' });
    expect(await reopened.read(session)).toBeNull();
    expect(repo.document.data.current).toEqual(session);
  });
});
