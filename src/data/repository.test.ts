import { afterEach, describe, expect, it } from 'vitest';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import {
  LocalRepository,
  openDatabase,
  openLocalRepository,
} from './repository';
import {
  databaseName,
  emptyData,
  legacySessionKey,
  objectStoreName,
  workspaceKey,
} from './workspace';
import type { Session } from '../domain/match';

const repositories: LocalRepository[] = [];
afterEach(() => {
  for (const repo of repositories.splice(0)) repo.close();
});
const session: Session = {
  version: 1,
  id: 'match-one',
  setup: { players: ['A', 'B'], start: 301, legsToWin: 1 },
  commands: [],
};
const completed: Session = {
  ...session,
  commands: [
    { type: 'visit', visit: { total: 180, darts: 3, double: false } },
    { type: 'visit', visit: { total: 0, darts: 3, double: false } },
    { type: 'visit', visit: { total: 121, darts: 3, double: true } },
  ],
};
function storage(values: Record<string, string> = {}) {
  return { getItem: (key: string) => values[key] ?? null };
}
async function open(
  factory = new IDBFactory(),
  values: Record<string, string> = {},
) {
  const repo = await openLocalRepository({ factory, storage: storage(values) });
  repositories.push(repo);
  return repo;
}
async function stored(factory: IDBFactory) {
  const db = await openDatabase(factory);
  const value = await new Promise<any>((resolve, reject) => {
    const tx = db.transaction(objectStoreName, 'readonly');
    const r = tx.objectStore(objectStoreName).get(workspaceKey);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  db.close();
  return value;
}

describe('transactional local repository', () => {
  it('migrates old profiles and a match once without deleting the original data', async () => {
    const factory = new IDBFactory();
    const values = {
      [legacySessionKey]: JSON.stringify(session),
      'darts-master.players.v1': JSON.stringify({
        version: 1,
        players: [
          { id: 'a', name: 'Alice', createdAt: '2026-10-30T00:00:00Z' },
        ],
      }),
    };
    const repo = await open(factory, values);
    expect(repo.mode).toBe('database');
    expect(repo.document.revision).toBe(1);
    expect(repo.document.data.current?.id).toBe('match-one');
    expect(repo.document.data.players[0].name).toBe('Alice');
    expect(values[legacySessionKey]).toBe(JSON.stringify(session));
    const reopened = await open(factory, { [legacySessionKey]: '{bad' });
    expect(reopened.document).toEqual(repo.document);
  });
  it('preserves unreadable legacy data and refuses to write over it', async () => {
    const factory = new IDBFactory();
    const raw = '{unreadable';
    const repo = await open(factory, {
      'darts-master.archive.v1': raw,
      [legacySessionKey]: JSON.stringify(session),
    });
    expect(repo.mode).toBe('legacy-recovery');
    expect(repo.raw).toHaveProperty('darts-master.archive.v1', raw);
    expect(repo.document.data.current?.id).toBe('match-one');
    await expect(repo.saveMatch(completed)).rejects.toThrow();
    expect(await stored(factory)).toBeUndefined();
  });
  it('saves a result and current match together and removes the result after undo', async () => {
    const factory = new IDBFactory();
    const repo = await open(factory);
    await repo.saveMatch(completed);
    let saved = await stored(factory);
    expect(saved.data.current.commands).toHaveLength(3);
    expect(saved.data.archive).toHaveLength(1);
    await repo.saveMatch({
      ...completed,
      commands: completed.commands.slice(0, -1),
    });
    saved = await stored(factory);
    expect(saved.data.current.commands).toHaveLength(2);
    expect(saved.data.archive).toHaveLength(0);
  });
  it('serialises a winning visit, another match and a new profile without losing data', async () => {
    const repo = await open();
    await Promise.all([
      repo.saveMatch(completed),
      repo.saveMatch({ ...session, id: 'next-match' }),
      repo.addPlayer('Alice'),
    ]);
    expect(repo.document.data.current?.id).toBe('next-match');
    expect(repo.document.data.archive).toHaveLength(1);
    expect(repo.document.data.players).toHaveLength(1);
  });
  it('rejects a stale tab rather than overwriting a newer save', async () => {
    const factory = new IDBFactory();
    const first = await open(factory);
    const second = await open(factory);
    await first.saveMatch(session);
    await expect(second.addPlayer('Another tab')).rejects.toThrow(
      /Another tab/,
    );
    expect((await stored(factory)).data.players).toHaveLength(0);
    expect(second.getSaveState()).toBe('unsaved');
  });
  it('keeps both the old workspace and recovery snapshot unchanged if import fails', async () => {
    const factory = new IDBFactory();
    const repo = await open(factory);
    await repo.saveMatch(session);
    const before = structuredClone(repo.document);
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (key === workspaceKey && value?.data?.players?.length)
        throw new DOMException('Full', 'QuotaExceededError');
      return original.call(this, value, key);
    };
    try {
      await expect(
        repo.applyImport(
          {
            ...emptyData(),
            players: [
              { id: 'a', name: 'Alice', createdAt: '2026-10-30T00:00:00Z' },
            ],
          },
          before.revision,
        ),
      ).rejects.toThrow();
    } finally {
      IDBObjectStore.prototype.put = original;
    }
    expect(await stored(factory)).toEqual(before);
    expect(await repo.recovery()).toBeNull();
  });
  it('supports pre-import recovery and refuses undo after later changes', async () => {
    const repo = await open();
    await repo.saveMatch(session);
    const before = structuredClone(repo.document);
    await repo.applyImport(
      {
        ...emptyData(),
        current: completed,
        archive: [{ session: completed, completedAt: '2026-10-30T00:00:00Z' }],
      },
      before.revision,
    );
    expect((await repo.recovery())?.previous).toEqual(before);
    await repo.saveMatch(completed); // Opening the same match is a no-op, not a new revision.
    await repo.undoImport();
    expect(repo.document.data.current).toEqual(before.data.current);
    expect(repo.document.data.archive).toHaveLength(0);
    await expect(repo.undoImport()).rejects.toThrow(/changed since/);
  });
  it('rejects a stale import preview', async () => {
    const repo = await open();
    const revision = repo.document.revision;
    await repo.addPlayer('Alice');
    await expect(repo.applyImport(emptyData(), revision)).rejects.toThrow(
      /changed after/,
    );
    expect(repo.document.data.players[0].name).toBe('Alice');
  });
  it('does not overwrite a newer or unreadable canonical document', async () => {
    const factory = new IDBFactory();
    const db = await openDatabase(factory, databaseName);
    const raw = { version: 99, revision: 8, data: { important: 'keep' } };
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(objectStoreName, 'readwrite');
      tx.objectStore(objectStoreName).put(raw, workspaceKey);
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
    });
    db.close();
    const repo = await open(factory);
    expect(repo.mode).toBe('unreadable');
    await expect(repo.saveMatch(session)).rejects.toThrow();
    expect(await stored(factory)).toEqual(raw);
    await repo.resetUnreadable();
    expect(repo.document.data).toEqual(emptyData());
    expect((await repo.recovery())?.previous).toEqual(raw);
  });
});

it('does not let an unrelated profile save hide an unsaved match', async () => {
  const repo = await open();
  await repo.saveMatch(session);
  const original = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (value, key) {
    if (key === workspaceKey && value?.data?.current?.commands.length === 3)
      throw new DOMException('Full', 'QuotaExceededError');
    return original.call(this, value, key);
  };
  try {
    await expect(repo.saveMatch(completed)).rejects.toThrow();
  } finally {
    IDBObjectStore.prototype.put = original;
  }
  await repo.addPlayer('Alice');
  expect(repo.getSaveState()).toBe('unsaved');
  await repo.saveMatch(completed);
  expect(repo.getSaveState()).toBe('saved');
});

it('does not mark durable data as unsaved after rejecting a duplicate name', async () => {
  const repo = await open();
  await repo.addPlayer('Alice');
  await expect(repo.addPlayer('ALICE')).rejects.toThrow(/already saved/);
  expect(repo.getSaveState()).toBe('saved');
});
