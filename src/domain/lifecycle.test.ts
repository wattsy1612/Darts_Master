import { requireX01Session } from './games/identity';
import { describe, expect, it } from 'vitest';
import {
  replay,
  recordVisit,
  nextLeg,
  lifecycle,
  isTerminal,
  rematch,
} from './match';
import type { Session, Command } from './match';
import { updateArchive, readArchive, exportMatch } from './archive';
import { playerSummary } from './players';
import { normaliseSession, emptyData } from '../data/workspace';
import { backupText, inspectBackup } from '../data/backup';
import { validateDraft, emptyDraft } from '../data/draft';
import { botVisit } from './bot';
const base: Session = {
  version: 3,
  id: 'lifecycle',
  setup: {
    players: ['A', 'B'],
    start: 301,
    legsToWin: 2,
    playerIds: ['a', 'b'],
  },
  commands: [],
};
const score: Command = {
  type: 'visit',
  visit: { total: 60, darts: 3, double: false },
};
const session = (...commands: Command[]): Session => ({ ...base, commands });
describe('replayable match lifecycle', () => {
  it('pauses and resumes the exact scores and thrower without recording fake darts', () => {
    const before = replay(session(score)),
      paused = replay(session(score, { type: 'pause' }));
    expect(paused).toMatchObject({
      status: 'paused',
      scores: before.scores,
      turn: before.turn,
      visits: before.visits,
    });
    expect(() =>
      recordVisit(paused, { total: 0, darts: 3, double: false }),
    ).toThrow(/Resume/);
    expect(() => nextLeg(paused)).toThrow(/Resume/);
    expect(() =>
      validateDraft(emptyDraft(), session(score, { type: 'pause' })),
    ).toThrow();
    expect(
      replay(session(score, { type: 'pause' }, { type: 'resume' })),
    ).toEqual(before);
    expect(() => lifecycle(before, { type: 'resume' })).toThrow(/not paused/);
    expect(() => lifecycle(paused, { type: 'pause' })).toThrow(
      /already paused/,
    );
  });
  it('stops a practice timer from applying a throw to a paused match', () => {
    const botSession: Session = {
      ...base,
      setup: {
        ...base.setup,
        bot: 'regular',
        playerIds: ['a', null],
        starter: 1,
      },
      commands: [{ type: 'pause' }],
    };
    expect(() => botVisit(replay(botSession), 'seed')).toThrow(/not due/);
    const active = replay({
      ...botSession,
      commands: [...botSession.commands, { type: 'resume' }],
    });
    expect(recordVisit(active, botVisit(active, 'seed')).visits).toHaveLength(
      1,
    );
  });
  it.each([0, 1] as const)(
    'records player %s conceding, with an outcome and no invented legs',
    (player) => {
      const ended = session(score, { type: 'concede', player });
      const result = replay(ended);
      expect(result).toMatchObject({
        status: 'conceded',
        concededBy: player,
        winner: 1 - player,
        legs: [0, 0],
        sets: [0, 0],
        scores: [241, 301],
      });
      expect(result.visits).toHaveLength(1);
      expect(isTerminal(result)).toBe(true);
      const archive = updateArchive([], ended, '2026-10-30T17:00:00Z');
      expect(playerSummary(archive, 'a', false)).toMatchObject({
        matches: 1,
        wins: player === 1 ? 1 : 0,
        legsWon: 0,
        legsLost: 0,
        darts: 3,
        average: '60.0',
      });
      expect(
        readArchive(JSON.stringify({ version: 1, matches: archive })),
      ).toEqual(archive);
      expect(JSON.parse(exportMatch(ended)).result).toMatchObject({
        status: 'conceded',
        concededBy: player,
      });
      expect(
        inspectBackup(backupText({ ...emptyData(), current: ended, archive }))
          .data.archive[0].session,
      ).toEqual(ended);
    },
  );
  it('retains abandoned matches with no winner and excludes them from records', () => {
    const ended = session(score, { type: 'pause' }, { type: 'abandon' });
    const result = replay(ended);
    expect(result).toMatchObject({
      status: 'abandoned',
      winner: null,
      legs: [0, 0],
      scores: [241, 301],
    });
    const archive = updateArchive([], ended);
    expect(archive).toHaveLength(1);
    expect(playerSummary(archive, 'a', false)).toMatchObject({
      matches: 0,
      wins: 0,
      losses: 0,
      darts: 0,
    });
    const imported = inspectBackup(exportMatch(ended));
    expect(imported.data.current).toBeNull();
    expect(imported.data.archive).toHaveLength(1);
    expect(
      replay(requireX01Session(imported.data.archive[0].session)).status,
    ).toBe('abandoned');
  });
  it.each([{ type: 'abandon' }, { type: 'concede', player: 0 }] as Command[])(
    'undo/redo removes and restores terminal outcome $type',
    (command) => {
      const ended = session(score, command),
        active = session(score),
        archive = updateArchive([], ended);
      expect(updateArchive(archive, active)).toEqual([]);
      expect(updateArchive([], ended)).toHaveLength(1);
      expect(replay(active)).toMatchObject({ status: 'active', winner: null });
      for (const next of [
        { type: 'pause' },
        { type: 'resume' },
        { type: 'abandon' },
        { type: 'concede', player: 1 },
        score,
        { type: 'next-leg' },
      ] as Command[])
        expect(() => replay(session(score, command, next))).toThrow();
    },
  );
  it('preserves a completed result and rejects later lifecycle changes', () => {
    const completed: Session = {
      ...base,
      setup: { ...base.setup, legsToWin: 1 },
      commands: [
        { type: 'visit', visit: { total: 180, darts: 3, double: false } },
        { type: 'visit', visit: { total: 0, darts: 3, double: false } },
        { type: 'visit', visit: { total: 121, darts: 3, double: true } },
      ],
    };
    expect(replay(completed).status).toBe('completed');
    expect(() =>
      replay({
        ...completed,
        commands: [...completed.commands, { type: 'concede', player: 0 }],
      }),
    ).toThrow(/finished/);
  });
  it('creates a fresh rematch with chosen starter, rules and profiles, preserving its source', () => {
    const ended: Session = {
      ...base,
      setup: {
        ...base.setup,
        inRule: 'double',
        setsToWin: 2,
        starterPolicy: 'alternate-sets',
      },
      commands: [{ type: 'abandon' }],
      imported: { sourceId: 'external', importedAt: '2026-10-30T17:00:00Z' },
    };
    const before = structuredClone(ended),
      next = rematch(ended, 'fresh', 1);
    expect(next).toMatchObject({
      version: 5,
      id: 'fresh',
      commands: [],
      setup: { ...ended.setup, starter: 1 },
    });
    expect(next.imported).toBeUndefined();
    expect(replay(next)).toMatchObject({
      status: 'active',
      turn: 1,
      scores: [301, 301],
      legs: [0, 0],
      sets: [0, 0],
    });
    expect(ended).toEqual(before);
    expect(() => rematch(base, 'fresh', 0)).toThrow(/Finish/);
    expect(() => rematch(ended, ended.id!, 0)).toThrow(/new match/);
  });
  it('requires v3 for lifecycle data and rejects malformed concessions or future versions', () => {
    for (const version of [1, 2] as const)
      expect(() =>
        normaliseSession({ ...base, version, commands: [{ type: 'pause' }] }),
      ).toThrow(/version 3/);
    expect(() =>
      normaliseSession({ ...base, commands: [{ type: 'concede', player: 2 }] }),
    ).toThrow(/conceding/);
    expect(() =>
      normaliseSession({ ...base, commands: [{ type: 'concede' }] }),
    ).toThrow();
    expect(() => normaliseSession({ ...base, version: 99 })).toThrow();
    expect(
      normaliseSession(
        session(
          { type: 'pause' },
          { type: 'resume' },
          { type: 'concede', player: 1 },
        ),
      ),
    ).toEqual(
      session(
        { type: 'pause' },
        { type: 'resume' },
        { type: 'concede', player: 1 },
      ),
    );
  });
});
