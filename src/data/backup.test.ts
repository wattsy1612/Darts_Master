import { describe, expect, it } from 'vitest';
import {
  backupText,
  buildImportPlan,
  defaultOptions,
  inspectBackup,
  maxBackupBytes,
} from './backup';
import { emptyData, normaliseSession } from './workspace';
import { exportMatch } from '../domain/archive';
import type { Session } from '../domain/match';
const date = '2026-10-30T00:00:00Z';
const session: Session = {
  version: 1,
  id: 'one',
  setup: {
    players: ['Alice', 'Bob'],
    playerIds: ['a', 'b'],
    start: 301,
    legsToWin: 1,
  },
  commands: [
    { type: 'visit', visit: { total: 180, darts: 3, double: false } },
    { type: 'visit', visit: { total: 0, darts: 3, double: false } },
    { type: 'visit', visit: { total: 121, darts: 3, double: true } },
  ],
};
const full = {
  ...emptyData(),
  current: session,
  archive: [{ session, completedAt: date }],
  players: [
    { id: 'a', name: 'Alice', createdAt: date },
    { id: 'b', name: 'Bob', createdAt: date },
  ],
};
describe('backup review and import planning', () => {
  it('round-trips a complete backup and rebuilds the original result', () => {
    const incoming = inspectBackup(backupText(full));
    expect(incoming.data.current).toEqual(session);
    const plan = buildImportPlan(
      emptyData(),
      incoming,
      defaultOptions(emptyData(), incoming),
    );
    expect(plan.errors).toEqual([]);
    expect(plan.addedMatches).toBe(1);
    expect(plan.addedPlayers).toBe(2);
    expect(plan.data.archive[0].session.imported?.sourceId).toBe('one');
  });
  it('skips duplicate results and players when importing the same backup again', () => {
    const incoming = inspectBackup(backupText(full));
    const first = buildImportPlan(
      emptyData(),
      incoming,
      defaultOptions(emptyData(), incoming),
    ).data;
    const second = buildImportPlan(
      first,
      incoming,
      defaultOptions(first, incoming),
    );
    expect(second.addedMatches).toBe(0);
    expect(second.addedPlayers).toBe(0);
    expect(second.duplicates).toBe(1);
    expect(second.data.archive).toHaveLength(1);
    expect(second.data.players).toHaveLength(2);
  });
  it('does not merge separate identities because their names match', () => {
    const incoming = inspectBackup(backupText(full));
    const local = {
      ...emptyData(),
      players: [{ id: 'different', name: 'Alice', createdAt: date }],
    };
    const plan = buildImportPlan(
      local,
      incoming,
      defaultOptions(local, incoming),
    );
    expect(plan.data.players.find((p) => p.id === 'a')?.name).toBe(
      'Alice (imported)',
    );
    expect(plan.data.archive[0].session.setup.playerIds?.[0]).toBe('a');
    expect(plan.notes.join(' ')).toContain('names alone do not link');
  });
  it('allows an explicit profile link and preserves the existing name', () => {
    const incoming = inspectBackup(backupText(full));
    const local = {
      ...emptyData(),
      players: [{ id: 'local-alice', name: 'Chris', createdAt: date }],
    };
    const options = defaultOptions(local, incoming);
    options.profileLinks.a = 'local-alice';
    options.profileLinks.b = 'skip';
    const plan = buildImportPlan(local, incoming, options);
    expect(plan.addedPlayers).toBe(0);
    expect(plan.data.archive[0].session.setup.playerIds).toEqual([
      'local-alice',
      null,
    ]);
    expect(plan.data.archive[0].session.setup.players).toEqual([
      'Alice',
      'Bob',
    ]);
  });
  it('makes a separate copy for an ID conflict only when chosen, then deduplicates it', () => {
    const incoming = inspectBackup(backupText(full));
    const other = {
      ...session,
      setup: {
        ...session.setup,
        players: ['Other', 'Bob'] as [string, string],
      },
    };
    const local = {
      ...emptyData(),
      archive: [{ session: other, completedAt: date }],
    };
    const options = defaultOptions(local, incoming);
    expect(options.matches.one).toBe('skip');
    options.matches.one = 'copy';
    const first = buildImportPlan(local, incoming, options);
    expect(first.data.archive).toHaveLength(2);
    expect(first.data.archive[0].session.id).not.toBe('one');
    expect(
      buildImportPlan(first.data, incoming, options).data.archive,
    ).toHaveLength(2);
  });
  it('does not replace an active match without selecting restore and reports the replacement', () => {
    const current = {
      ...session,
      id: 'unfinished',
      commands: session.commands.slice(0, 1),
    };
    const incoming = inspectBackup(backupText({ ...emptyData(), current }));
    const local = { ...emptyData(), current: { ...current, id: 'local' } };
    const options = defaultOptions(local, incoming);
    expect(buildImportPlan(local, incoming, options).data.current?.id).toBe(
      'local',
    );
    options.resumeCurrent = true;
    const plan = buildImportPlan(local, incoming, options);
    expect(plan.replacesCurrent).toBe(true);
    expect(plan.data.current?.commands).toHaveLength(1);
    expect(plan.data.current?.id).not.toBe('local');
  });
  it('accepts an individual result as a guest game and ignores its claimed result summary', () => {
    const input = JSON.parse(exportMatch(session));
    input.result.winner = 'Someone else';
    const incoming = inspectBackup(JSON.stringify(input));
    expect(incoming.data.archive).toHaveLength(1);
    expect(incoming.data.archive[0].session.setup.playerIds).toBeUndefined();
    expect(incoming.notes.join(' ')).toContain('guests');
  });
  it('rejects malformed, unsupported and invalid-score files', () => {
    for (const input of [
      '{invalid',
      JSON.stringify({ version: 999 }),
      JSON.stringify({ format: 'other', version: 1 }),
      backupText(full).replace('"total": 180', '"total": 179'),
    ])
      expect(() => inspectBackup(input)).toThrow();
    expect(() => inspectBackup(' '.repeat(maxBackupBytes + 1))).toThrow(
      /20 MB/,
    );
    expect(() =>
      normaliseSession({
        ...session,
        commands: [
          {
            type: 'visit',
            visit: { total: 0, darts: 1, double: false, hits: null },
          },
        ],
      }),
    ).toThrow(/dart details/);
  });
  it('reports capacity overflow instead of deleting existing results', () => {
    const incoming = inspectBackup(backupText(full));
    const local = {
      ...emptyData(),
      archive: Array.from({ length: 100 }, (_, i) => ({
        session: { ...session, id: `local-${i}` },
        completedAt: date,
      })),
    };
    const plan = buildImportPlan(
      local,
      incoming,
      defaultOptions(local, incoming),
    );
    expect(plan.errors.join(' ')).toContain('101 matches');
    expect(local.archive).toHaveLength(100);
  });
});
