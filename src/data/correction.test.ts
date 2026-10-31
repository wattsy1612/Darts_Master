import { requireX01Session } from '../domain/games/identity';
import { afterEach, describe, expect, it } from 'vitest';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { openLocalRepository } from './repository';
import type { LocalRepository } from './repository';
import { workspaceKey } from './workspace';
import { replay } from '../domain/match';
import type { Session } from '../domain/match';
const repos: LocalRepository[] = [];
afterEach(() => {
  for (const r of repos.splice(0)) r.close();
});
async function open(factory = new IDBFactory()) {
  const r = await openLocalRepository({
    factory,
    storage: { getItem: () => null },
  });
  repos.push(r);
  return r;
}
const game: Session = {
  version: 1,
  id: 'finished',
  setup: { players: ['A', 'B'], start: 301, legsToWin: 1 },
  commands: [
    { type: 'visit', visit: { total: 180, darts: 3, double: false } },
    { type: 'visit', visit: { total: 0, darts: 3, double: false } },
    { type: 'visit', visit: { total: 121, darts: 3, double: true } },
  ],
};
const score = (total: number) => ({ total, darts: 3, double: false });
describe('transactional correction and recovery', () => {
  it('rejects an unchanged edit without inventing a new recovery checkpoint', async () => {
    const repo = await open();
    await repo.saveMatch(game);
    const before = structuredClone(repo.document);
    await expect(
      repo.correctMatch(
        game,
        1,
        score(0),
        'keep-following',
        repo.document.revision,
      ),
    ).rejects.toThrow(/does not change/);
    expect(repo.document).toEqual(before);
    expect(await repo.correctionRecovery()).toBeNull();
  });

  it('updates current and history together, preserves recovery through a no-op autosave, and undoes after reload', async () => {
    const factory = new IDBFactory(),
      repo = await open(factory);
    await repo.saveMatch(game);
    const before = structuredClone(repo.document);
    await repo.correctMatch(
      game,
      2,
      score(100),
      'keep-following',
      repo.document.revision,
    );
    expect(repo.document.data.archive).toHaveLength(0);
    expect(replay(requireX01Session(repo.document.data.current!)).status).toBe(
      'active',
    );
    const applied = repo.document.revision;
    await repo.saveMatch(repo.document.data.current!);
    expect(repo.document.revision).toBe(applied);
    expect((await repo.correctionRecovery())?.previous).toEqual(before);
    const reloaded = await open(factory);
    await reloaded.undoCorrection();
    expect(reloaded.document.data).toEqual(before.data);
    await expect(reloaded.undoCorrection()).rejects.toThrow(/Data changed/);
  });
  it('corrects a terminal archived record without replacing another current game', async () => {
    const repo = await open();
    await repo.saveMatch(game);
    await repo.saveMatch({ ...game, id: 'other', commands: [] });
    const target = requireX01Session(repo.document.data.archive[0].session);
    await repo.correctMatch(
      target,
      1,
      score(60),
      'keep-following',
      repo.document.revision,
    );
    expect(repo.document.data.current?.id).toBe('other');
    expect(
      replay(requireX01Session(repo.document.data.archive[0].session)).scores,
    ).toEqual([0, 241]);
  });
  it('requires explicit replacement to reopen an archive and retains the displaced game in recovery', async () => {
    const repo = await open();
    await repo.saveMatch(game);
    await repo.saveMatch({ ...game, id: 'other', commands: [] });
    const before = structuredClone(repo.document);
    await expect(
      repo.correctMatch(
        game,
        2,
        score(100),
        'keep-following',
        repo.document.revision,
      ),
    ).rejects.toThrow(/Confirm replacing/);
    expect(repo.document).toEqual(before);
    expect(await repo.correctionRecovery()).toBeNull();
    await repo.correctMatch(
      game,
      2,
      score(100),
      'keep-following',
      repo.document.revision,
      true,
    );
    expect(repo.document.data.current?.id).toBe('finished');
    expect(repo.document.data.archive).toHaveLength(0);
    expect((await repo.correctionBackup())?.current?.id).toBe('other');
    await repo.undoCorrection();
    expect(repo.document.data).toEqual(before.data);
  });
  it('reopens archived results when there is no current match', async () => {
    const repo = await open();
    await repo.applyImport(
      {
        current: null,
        archive: [{ session: game, completedAt: '2026-10-30T12:00:00Z' }],
        players: [],
        profileImports: [],
      },
      0,
    );
    await repo.correctMatch(
      game,
      2,
      score(100),
      'keep-following',
      repo.document.revision,
    );
    expect(repo.document.data.current?.id).toBe('finished');
    expect(repo.document.data.archive).toHaveLength(0);
  });
  it('rejects stale preview revisions and mismatched target events without changing saved data', async () => {
    const repo = await open();
    await repo.saveMatch(game);
    const rev = repo.document.revision;
    await repo.addPlayer('New player');
    const before = structuredClone(repo.document);
    await expect(
      repo.correctMatch(game, 1, score(60), 'keep-following', rev),
    ).rejects.toThrow(/changed after this review/);
    const changed = structuredClone(game);
    changed.commands[1] = { type: 'visit', visit: score(26) };
    await expect(
      repo.correctMatch(
        changed,
        1,
        score(60),
        'keep-following',
        repo.document.revision,
      ),
    ).rejects.toThrow(/match changed/);
    expect(repo.document).toEqual(before);
    expect(await repo.correctionRecovery()).toBeNull();
  });
  it('refuses stale-tab writes using database revision, not just the preview in memory', async () => {
    const factory = new IDBFactory(),
      repo = await open(factory);
    await repo.saveMatch(game);
    const stale = await open(factory);
    await repo.addPlayer('New player');
    await expect(
      stale.correctMatch(
        game,
        1,
        score(60),
        'keep-following',
        stale.document.revision,
      ),
    ).rejects.toThrow(/Another tab/);
    expect((await open(factory)).document).toEqual(repo.document);
  });
  it('retains downloadable recovery but disables undo after another saved change', async () => {
    const repo = await open();
    await repo.saveMatch(game);
    const before = structuredClone(repo.document.data);
    await repo.correctMatch(
      game,
      1,
      score(60),
      'keep-following',
      repo.document.revision,
    );
    await repo.addPlayer('Later player');
    await expect(repo.undoCorrection()).rejects.toThrow(/Data changed/);
    expect(await repo.correctionBackup()).toEqual(before);
    expect(repo.document.data.players).toHaveLength(1);
  });
  it('rolls back both the correction and checkpoint overwrite on storage failure', async () => {
    const repo = await open();
    await repo.saveMatch(game);
    await repo.correctMatch(
      game,
      1,
      score(60),
      'keep-following',
      repo.document.revision,
    );
    const before = structuredClone(repo.document),
      recovery = await repo.correctionRecovery(),
      original = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (key === workspaceKey)
        throw new DOMException('Full', 'QuotaExceededError');
      return original.call(this, value, key);
    };
    try {
      await expect(
        repo.correctMatch(
          requireX01Session(repo.document.data.current!),
          1,
          score(26),
          'keep-following',
          repo.document.revision,
        ),
      ).rejects.toThrow();
    } finally {
      IDBObjectStore.prototype.put = original;
    }
    expect(repo.document).toEqual(before);
    expect(await repo.correctionRecovery()).toEqual(recovery);
  });
});
