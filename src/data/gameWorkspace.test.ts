import { afterEach, describe, expect, it } from 'vitest';
import { IDBFactory, IDBObjectStore, IDBCursor } from 'fake-indexeddb';
import {
  openLocalRepository,
  openDatabase,
  workspaceMigrationKey,
} from './repository';
import type { LocalRepository } from './repository';
import {
  emptyData,
  workspaceKey,
  objectStoreName,
  validateDocument,
  sessionContent,
} from './workspace';
import { createCricket, cricketRulesVersion } from '../domain/games/cricket';
import type { CricketSession } from '../domain/games/cricket';
import type { Session } from '../domain/match';
import { exportGameMatch } from '../domain/archive';
import {
  backupText,
  inspectBackup,
  buildImportPlan,
  defaultOptions,
} from './backup';
import { emptyDraft, openDraftStore, turnIdentity } from './draft';
const repos: LocalRepository[] = [];
afterEach(() => {
  for (const repo of repos.splice(0)) repo.close();
});
async function open(factory = new IDBFactory()) {
  const repo = await openLocalRepository({
    factory,
    storage: { getItem: () => null },
  });
  repos.push(repo);
  return repo;
}
async function put(factory: IDBFactory, values: Record<string, unknown>) {
  const db = await openDatabase(factory);
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(objectStoreName, 'readwrite');
    for (const [key, value] of Object.entries(values))
      tx.objectStore(objectStoreName).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
  db.close();
}
async function get(factory: IDBFactory, key = workspaceKey): Promise<any> {
  const db = await openDatabase(factory);
  const value = await new Promise((resolve, reject) => {
    const tx = db.transaction(objectStoreName, 'readonly');
    const r = tx.objectStore(objectStoreName).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  db.close();
  return value;
}
const x01: Session = {
  version: 1,
  id: 'x01-record',
  setup: { players: ['A', 'B'], start: 301, legsToWin: 1 },
  commands: [
    { type: 'visit', visit: { total: 180, darts: 3, double: false } },
    { type: 'visit', visit: { total: 0, darts: 3, double: false } },
    { type: 'visit', visit: { total: 121, darts: 3, double: true } },
  ],
};
function cricket(id = 'cricket-record', complete = false): CricketSession {
  return {
    game: 'cricket',
    version: 1,
    rulesVersion: cricketRulesVersion,
    id,
    setup: createCricket({
      players: ['C', 'D'],
      variant: 'standard',
      bull: 'split',
      legsToWin: 1,
      playerIds: ['c', 'd'],
    }).setup,
    commands: complete
      ? [{ type: 'concede', player: 0, sideId: 'side-1' }]
      : [
          {
            type: 'visit',
            visit: {
              participantId: 'participant-1-1',
              source: 'manual-segments',
              hits: [{ number: 20, multiplier: 3 }],
            },
          },
        ],
  };
}
const date = '2026-10-30T12:00:00Z';
describe('recoverable shared-game workspace upgrade', () => {
  it('upgrades v2 once, preserves the exact source workspace and never rewrites legacy records', async () => {
    const factory = new IDBFactory(),
      old = {
        version: 2,
        revision: 7,
        data: {
          ...emptyData(),
          current: x01,
          archive: [{ session: x01, completedAt: date }],
        },
      };
    await put(factory, { [workspaceKey]: old });
    const repo = await open(factory);
    expect(repo.document).toMatchObject({ version: 3, revision: 8 });
    expect(repo.document.data.current).toEqual(x01);
    expect((await get(factory, workspaceMigrationKey)).previous).toEqual(old);
    expect(await repo.migrationBackup()).toEqual(old.data);
    const reopened = await open(factory);
    expect(reopened.document).toEqual(repo.document);
    expect((await get(factory, workspaceMigrationKey)).previous).toEqual(old);
  });
  it('serialises simultaneous openers into one upgrade and one original checkpoint', async () => {
    const factory = new IDBFactory(),
      old = {
        version: 2,
        revision: 7,
        data: {
          ...emptyData(),
          current: x01,
          archive: [{ session: x01, completedAt: date }],
        },
      };
    await put(factory, { [workspaceKey]: old });
    const [first, second] = await Promise.all([open(factory), open(factory)]);
    expect(first.document).toEqual(second.document);
    expect(first.document.revision).toBe(8);
    expect(await get(factory, workspaceMigrationKey)).toEqual({
      previous: old,
      appliedRevision: 8,
    });
  });
  it('retags only exact-turn/current-revision drafts without changing token, contents or expiry', async () => {
    const factory = new IDBFactory(),
      current = { ...x01, commands: [] },
      old = { version: 2, revision: 4, data: { ...emptyData(), current } },
      draft = {
        version: 1,
        token: 'same-token',
        revision: 4,
        turn: turnIdentity(current),
        savedAt: Date.now(),
        value: { ...emptyDraft(), score: '60', mode: 'keypad' },
      };
    await put(factory, {
      [workspaceKey]: old,
      'draft:valid': draft,
      'draft:stale': { ...draft, revision: 3 },
      'draft:other': { ...draft, turn: 'different' },
    });
    await open(factory);
    expect(await get(factory, 'draft:valid')).toEqual({
      ...draft,
      revision: 5,
    });
    expect((await get(factory, 'draft:stale')).revision).toBe(3);
    expect((await get(factory, 'draft:other')).revision).toBe(4);
    const store = await openDraftStore({ factory, tab: 'valid' });
    expect(await store.read(current)).toEqual(draft.value);
    store.close();
  });
  it('rolls the whole upgrade back on a write failure while retaining readable original data', async () => {
    const factory = new IDBFactory(),
      old = {
        version: 2,
        revision: 7,
        data: {
          ...emptyData(),
          current: x01,
          archive: [{ session: x01, completedAt: date }],
        },
      };
    await put(factory, { [workspaceKey]: old });
    const original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (key === workspaceKey && value.version === 3)
        throw new DOMException('Full', 'QuotaExceededError');
      return original.call(this, value, key);
    };
    let repo: LocalRepository;
    try {
      repo = await open(factory);
    } finally {
      IDBObjectStore.prototype.put = original;
    }
    expect(repo!.mode).toBe('memory');
    expect(repo!.document.data.current).toEqual(x01);
    expect(await get(factory)).toEqual(old);
    expect(await get(factory, workspaceMigrationKey)).toBeUndefined();
    await expect(repo!.saveMatch({ ...x01, id: 'new' })).rejects.toThrow();
    expect((await open(factory)).mode).toBe('database');
  });
  it('rolls back main, checkpoint and draft changes if a draft update fails mid-upgrade', async () => {
    const factory = new IDBFactory(),
      current = { ...x01, commands: [] },
      old = { version: 2, revision: 7, data: { ...emptyData(), current } },
      draft = {
        version: 1,
        token: 'keep',
        revision: 7,
        turn: turnIdentity(current),
        savedAt: Date.now(),
        value: { ...emptyDraft(), score: '60', mode: 'keypad' },
      };
    await put(factory, { [workspaceKey]: old, 'draft:a': draft });
    const original = IDBCursor.prototype.update;
    IDBCursor.prototype.update = function () {
      throw new DOMException('Full', 'QuotaExceededError');
    };
    try {
      expect((await open(factory)).mode).toBe('memory');
    } finally {
      IDBCursor.prototype.update = original;
    }
    expect(await get(factory)).toEqual(old);
    expect(await get(factory, 'draft:a')).toEqual(draft);
    expect(await get(factory, workspaceMigrationKey)).toBeUndefined();
  });
  it('preserves malformed, future and revision-exhausted workspaces rather than overwriting them', async () => {
    for (const old of [
      { version: 99, revision: 2, data: emptyData() },
      { version: 2, revision: 4, data: { ...emptyData(), current: cricket() } },
      { version: 2, revision: Number.MAX_SAFE_INTEGER, data: emptyData() },
    ]) {
      const factory = new IDBFactory();
      await put(factory, { [workspaceKey]: old });
      const repo = await open(factory);
      expect(repo.mode).not.toBe('database');
      expect(await get(factory)).toEqual(old);
      expect(await get(factory, workspaceMigrationKey)).toBeUndefined();
    }
  });
});
describe('shared game persistence, import and recovery', () => {
  it('archives both games together and reloads their correct canonical records', async () => {
    const factory = new IDBFactory(),
      repo = await open(factory);
    await repo.saveMatch(x01);
    const game = cricket(undefined, true);
    await repo.saveMatch(game);
    expect(repo.document.version).toBe(3);
    expect(repo.document.data.archive.map((e) => e.session.id)).toEqual([
      game.id,
      x01.id,
    ]);
    expect((await open(factory)).document).toEqual(repo.document);
  });
  it('removes an undone Cricket result without dropping X01 history or the upgrade recovery', async () => {
    const repo = await open();
    await repo.saveMatch(x01);
    await repo.saveMatch(cricket(undefined, true));
    await repo.saveMatch(cricket());
    expect(repo.document.data.archive.map((e) => e.session.id)).toEqual([
      x01.id,
    ]);
  });
  it('rejects cross-game identifier collisions in current and archive without writes', async () => {
    const repo = await open();
    await repo.saveMatch(x01);
    const before = structuredClone(repo.document);
    await expect(repo.saveMatch(cricket(x01.id))).rejects.toThrow(
      /Another game/,
    );
    expect(repo.document).toEqual(before);
    await repo.saveMatch({ ...x01, id: 'other', commands: [] });
    const later = structuredClone(repo.document);
    await expect(repo.saveMatch(cricket(x01.id))).rejects.toThrow(
      /Another game/,
    );
    expect(repo.document).toEqual(later);
    await expect(repo.saveMatch({ ...x01, id: undefined })).rejects.toThrow(
      /identifier/,
    );
  });
  it('exports mixed backup version 2, requires the explicit internal gate, and restores atomically', async () => {
    const repo = await open();
    await repo.saveMatch(x01);
    await repo.saveMatch(cricket(undefined, true));
    const text = backupText(repo.document.data);
    expect(JSON.parse(text).version).toBe(2);
    expect(() => inspectBackup(text)).toThrow(/Cricket file restore is not enabled/);
    const incoming = inspectBackup(text, { allowUnavailableGames: true }),
      plan = buildImportPlan(
        emptyData(),
        incoming,
        defaultOptions(emptyData(), incoming),
      );
    expect(plan.errors).toEqual([]);
    expect(plan.data.archive).toHaveLength(2);
    const target = await open();
    await target.applyImport(plan.data, 0);
    expect(
      target.document.data.archive.map((e) => e.session.game ?? 'x01'),
    ).toEqual(expect.arrayContaining(['cricket', 'x01']));
    await target.undoImport();
    expect(target.document.data.archive).toEqual([]);
  });
  it('clears every standalone Cricket profile link without changing segment or pass evidence', () => {
    const game = cricket(undefined, true),
      text = exportGameMatch(game);
    expect(JSON.parse(text)).toMatchObject({
      format: 'darts-master-match',
      version: 2,
      result: { game: 'cricket', metricsVersion: 'cricket-recorded-v1' },
    });
    const incoming = inspectBackup(text, { allowUnavailableGames: true }),
      record = incoming.data.archive[0].session;
    expect(
      record.setup.sides!.flatMap((s) => s.members.map((m) => m.profileId)),
    ).toEqual([null, null]);
    expect(record.commands).toEqual(game.commands);
  });
  it('links full-backup profiles explicitly, deduplicates repeat imports and keeps game-qualified content', () => {
    const game = cricket(undefined, true),
      data = {
        ...emptyData(),
        current: null,
        archive: [{ session: game, completedAt: date }],
        players: [
          { id: 'c', name: 'C', createdAt: date },
          { id: 'd', name: 'D', createdAt: date },
        ],
      };
    const incoming = inspectBackup(backupText(data), {
      allowUnavailableGames: true,
    });
    const local = {
      ...emptyData(),
      players: [{ id: 'local', name: 'Local', createdAt: date }],
    };
    const options = defaultOptions(local, incoming);
    options.profileLinks.c = 'local';
    const first = buildImportPlan(local, incoming, options);
    expect(first.errors).toEqual([]);
    expect(
      first.data.archive[0].session.setup.sides![0].members[0].profileId,
    ).toBe('local');
    const second = buildImportPlan(
      first.data,
      incoming,
      defaultOptions(first.data, incoming),
    );
    expect(second.duplicates).toBe(1);
    expect(second.data.players).toHaveLength(2);
    expect(sessionContent(game)).not.toBe(sessionContent(x01));
  });
  it('preserves both game types in correction recovery and rejects a cross-game target', async () => {
    const repo = await open();
    await repo.saveMatch(cricket(undefined, true));
    await repo.saveMatch(x01);
    const before = structuredClone(repo.document.data);
    await repo.correctMatch(
      x01,
      1,
      { total: 60, darts: 3, double: false },
      'keep-following',
      repo.document.revision,
    );
    expect((await repo.correctionBackup())?.archive).toHaveLength(2);
    await repo.undoCorrection();
    expect(repo.document.data).toEqual(before);
    await expect(
      repo.correctMatch(
        { ...x01, id: 'cricket-record' },
        1,
        { total: 60, darts: 3, double: false },
        'keep-following',
        repo.document.revision,
      ),
    ).rejects.toThrow(/match changed/);
    expect(repo.document.data).toEqual(before);
    expect(() =>
      validateDocument({
        version: 3,
        revision: 1,
        data: {
          ...emptyData(),
          current: cricket(x01.id),
          archive: [{ session: x01, completedAt: date }],
        },
      }),
    ).toThrow(/conflicts/);
  });
});
