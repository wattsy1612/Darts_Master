import { describe, expect, it } from 'vitest';
import { exportMatch, readArchive, updateArchive } from './archive';
import { playerStats, replay } from './match';
import type { Session } from './match';
const finished: Session = {
  version: 1,
  id: 'match-one',
  setup: { players: ['Alice', 'Bob'], start: 301, legsToWin: 1 },
  commands: [
    { type: 'visit', visit: { total: 180, darts: 3, double: false } },
    { type: 'visit', visit: { total: 0, darts: 3, double: false } },
    { type: 'visit', visit: { total: 121, darts: 3, double: true } },
  ],
};
const now = '2026-10-30T12:00:00Z';
describe('saved match archive', () => {
  it('saves a result once and preserves its completion date on refresh', () => {
    const archive = updateArchive([], finished, now);
    const refreshed = updateArchive(archive, finished, '2026-10-31T12:00:00Z');
    expect(refreshed).toHaveLength(1);
    expect(refreshed[0].completedAt).toBe(now);
    expect(
      readArchive(JSON.stringify({ version: 1, matches: refreshed })),
    ).toEqual(refreshed);
  });
  it('removes a result when a winning visit is undone and restores it on redo', () => {
    const archive = updateArchive([], finished, now);
    const undone = { ...finished, commands: finished.commands.slice(0, -1) };
    expect(updateArchive(archive, undone)).toEqual([]);
    expect(
      updateArchive(updateArchive(archive, undone), finished, now),
    ).toHaveLength(1);
  });
  it('keeps other matches when the current match is unfinished', () => {
    const archive = updateArchive([], finished, now);
    const next = { ...finished, id: 'next-match', commands: [] };
    expect(updateArchive(archive, next)).toEqual(archive);
  });
  it('keeps only the 100 most recent results', () => {
    let archive = updateArchive([], finished, now);
    for (let i = 0; i < 101; i++)
      archive = updateArchive(archive, { ...finished, id: `match-${i}` }, now);
    expect(archive).toHaveLength(100);
    expect(archive[0].session.id).toBe('match-100');
    expect(archive.some((a) => a.session.id === 'match-one')).toBe(false);
  });
  it('rejects invalid or unfinished archive data', () => {
    expect(readArchive(null)).toEqual([]);
    expect(() => readArchive('{invalid')).toThrow();
    expect(() =>
      readArchive(JSON.stringify({ version: 2, matches: [] })),
    ).toThrow();
    expect(() =>
      readArchive(
        JSON.stringify({
          version: 1,
          matches: [
            { session: { ...finished, commands: [] }, completedAt: now },
          ],
        }),
      ),
    ).toThrow();
    expect(() =>
      readArchive(
        JSON.stringify({
          version: 1,
          matches: [{ session: finished, completedAt: 'invalid' }],
        }),
      ),
    ).toThrow();
  });
  it('exports replayable data and an accurate result', () => {
    const result = JSON.parse(exportMatch(finished));
    expect(result.format).toBe('darts-master-match');
    expect(result.result).toEqual({
      metricsVersion: 'x01-recorded-v1',
      players: ['Alice', 'Bob'],
      legs: [1, 0],
      winner: 'Alice',
    });
    expect(replay(result.session).winner).toBe(0);
  });
  it('reports scoring bands and highest checkout separately', () => {
    expect(playerStats(replay(finished), 0)).toMatchObject({
      tons: 1,
      ton40s: 0,
      maximums: 1,
      highestCheckout: 121,
    });
    expect(playerStats(replay(finished), 1)).toMatchObject({
      tons: 0,
      maximums: 0,
      highestCheckout: 0,
    });
  });
});
