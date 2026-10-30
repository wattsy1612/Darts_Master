import { describe, expect, it } from 'vitest';
import { addPlayer, readPlayers, renamePlayer, playerSummary } from './players';
import { createMatch, replay } from './match';
import type { Session, Setup } from './match';
import type { ArchivedMatch } from './archive';

function result(
  id: string,
  win = true,
  practice = false,
  linked = true,
): ArchivedMatch {
  const setup: Setup = {
    players: ['Old name', practice ? 'Practice Bot' : 'Bob'],
    start: 301,
    legsToWin: 1,
    bot: practice ? 'regular' : undefined,
    playerIds: linked ? ['alice', practice ? null : 'bob'] : undefined,
  };
  const session: Session = {
    version: 1,
    id,
    setup,
    commands: win
      ? [
          { type: 'visit', visit: { total: 180, darts: 3, double: false } },
          { type: 'visit', visit: { total: 60, darts: 3, double: false } },
          { type: 'visit', visit: { total: 121, darts: 3, double: true } },
        ]
      : [
          { type: 'visit', visit: { total: 60, darts: 3, double: false } },
          { type: 'visit', visit: { total: 180, darts: 3, double: false } },
          { type: 'visit', visit: { total: 0, darts: 1, double: false } },
          { type: 'visit', visit: { total: 121, darts: 3, double: true } },
        ],
  };
  return { session, completedAt: '2026-10-30T12:00:00Z' };
}
describe('saved players', () => {
  it('creates and reads a trimmed name with a stable identifier', () => {
    const players = addPlayer([], '  Alice  ', 'alice');
    expect(players[0].name).toBe('Alice');
    expect(readPlayers(JSON.stringify({ version: 1, players }))).toEqual(
      players,
    );
    expect(readPlayers(null)).toEqual([]);
  });
  it('rejects blank, long and duplicate names regardless of case', () => {
    const players = addPlayer([], 'Alice', 'alice');
    expect(() => addPlayer(players, ' ALICE ')).toThrow(/already saved/);
    expect(() => addPlayer(players, '')).toThrow();
    expect(() => addPlayer(players, 'x'.repeat(31))).toThrow();
    expect(() => addPlayer(players, 'Bob', 'alice')).toThrow(/identifier/);
    expect(() => addPlayer(players, 'Bob', '')).toThrow();
  });
  it('renames without changing identity, creation date or old match reports', () => {
    const players = addPlayer([], 'Old name', 'alice');
    const renamed = renamePlayer(players, 'alice', 'Alice');
    expect(renamed[0]).toEqual({ ...players[0], name: 'Alice' });
    expect(players[0].name).toBe('Old name');
    const archive = [result('one')];
    expect(playerSummary(archive, renamed[0].id, false).wins).toBe(1);
    expect(replay(archive[0].session).setup.players[0]).toBe('Old name');
  });
  it('rejects conflicting renames and malformed saved players', () => {
    const players = addPlayer(addPlayer([], 'Alice', 'alice'), 'Bob', 'bob');
    expect(() => renamePlayer(players, 'alice', 'BOB')).toThrow();
    expect(() => renamePlayer(players, 'missing', 'New')).toThrow();
    for (const raw of [
      '{invalid',
      JSON.stringify({ version: 2, players }),
      JSON.stringify({ version: 1, players: [players[0], players[0]] }),
      JSON.stringify({
        version: 1,
        players: [{ ...players[0], createdAt: 'invalid' }],
      }),
    ])
      expect(() => readPlayers(raw)).toThrow();
  });
  it('rejects the same saved profile on both sides and a profile for a bot', () => {
    const setup: Setup = {
      players: ['Alice', 'Bob'],
      start: 301,
      legsToWin: 1,
    };
    expect(() =>
      createMatch({ ...setup, playerIds: ['alice', 'alice'] }),
    ).toThrow(/different player/);
    expect(() =>
      createMatch({ ...setup, playerIds: ['alice', 'bob'], bot: 'regular' }),
    ).toThrow(/practice opponent/);
    expect(() => createMatch({ ...setup, playerIds: ['alice', ''] })).toThrow();
    expect(() =>
      createMatch({ ...setup, playerIds: ['alice', null], bot: 'regular' }),
    ).not.toThrow();
  });
});
describe('profile statistics', () => {
  it('weights averages by actual darts and counts wins, losses, legs and maximums', () => {
    const stats = playerSummary(
      [result('win'), result('loss', false)],
      'alice',
      false,
    );
    expect(stats).toMatchObject({
      matches: 2,
      wins: 1,
      losses: 1,
      legsWon: 1,
      legsLost: 1,
      average: '108.3',
      darts: 10,
      maximums: 1,
      best: 180,
      highestCheckout: 121,
    });
    expect(stats.recent[0]).toMatchObject({
      opponent: 'Bob',
      won: true,
      score: '1–0',
    });
  });
  it('separates practice and ignores guest games with matching display names', () => {
    const archive = [
      result('local'),
      result('practice', true, true),
      result('guest', true, false, false),
    ];
    expect(playerSummary(archive, 'alice', false).matches).toBe(1);
    expect(playerSummary(archive, 'alice', true).matches).toBe(1);
    expect(playerSummary(archive, 'bob', true).matches).toBe(0);
  });
  it('ignores duplicate results and unfinished games', () => {
    const finished = result('one');
    const unfinished: ArchivedMatch = {
      ...finished,
      session: { ...finished.session, id: 'unfinished', commands: [] },
    };
    expect(
      playerSummary([finished, finished, unfinished], 'alice', false).matches,
    ).toBe(1);
    expect(playerSummary([], 'alice', false)).toMatchObject({
      matches: 0,
      average: '—',
      darts: 0,
    });
  });
});
