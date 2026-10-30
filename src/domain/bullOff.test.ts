import { describe, expect, it } from 'vitest';
import { createBullOff, recordBull, bullThrower } from './bullOff';
import type { BullCommand } from './bullOff';
import {
  createMatch,
  replay,
  recordVisit,
  nextLeg,
  rematch,
  bullPending,
  playerStats,
} from './match';
import type { Session, Command } from './match';
import { normaliseSession, emptyData } from '../data/workspace';
import { inspectBackup, backupText } from '../data/backup';
import { emptyDraft, validateDraft } from '../data/draft';
const base: Session = {
  version: 4,
  id: 'bull-session',
  setup: {
    players: ['A', 'B'],
    start: 301,
    legsToWin: 2,
    startMethod: 'bull-off',
    starter: 0,
  },
  commands: [],
};
const start = (commands: Command[]) => replay({ ...base, commands });
const first: BullCommand = { type: 'bull-throw', player: 0, hit: 'outer' },
  second: BullCommand = { type: 'bull-throw', player: 1, hit: 'inner' };
describe('bull-off and starter ownership', () => {
  it('records physical darts in order and decides unequal bull rings', () => {
    const a = createBullOff(0),
      b = recordBull(a, first),
      c = recordBull(b, second);
    expect(bullThrower(a)).toBe(0);
    expect(bullThrower(b)).toBe(1);
    expect(bullThrower(c)).toBeNull();
    expect(c).toMatchObject({
      winner: 1,
      rounds: [
        { first: 0, hits: ['outer', 'inner'], reason: 'rings', winner: 1 },
      ],
    });
    expect(a.rounds[0].hits).toEqual([null, null]);
    expect(() =>
      recordBull(a, { type: 'bull-throw', player: 1, hit: 'inner' }),
    ).toThrow(/order/);
    expect(() => recordBull(c, { type: 'bull-rethrow' })).toThrow(/decided/);
  });
  it.each(['inner', 'outer'] as const)(
    'reverses order after matching %s bulls, and repeats ties',
    (hit) => {
      let state = createBullOff(1);
      for (let round = 0; round < 3; round++) {
        const first = bullThrower(state)!;
        state = recordBull(state, { type: 'bull-throw', player: first, hit });
        state = recordBull(state, {
          type: 'bull-throw',
          player: (1 - first) as 0 | 1,
          hit,
        });
        expect(state.winner).toBeNull();
        expect(state.rounds).toHaveLength(round + 2);
        expect(bullThrower(state)).toBe(1 - first);
      }
    },
  );
  it('asks for real closest-dart confirmation outside the bull instead of inventing distance', () => {
    let state = createBullOff(0);
    state = recordBull(state, {
      type: 'bull-throw',
      player: 0,
      hit: 'outside',
    });
    state = recordBull(state, {
      type: 'bull-throw',
      player: 1,
      hit: 'outside',
    });
    expect(bullThrower(state)).toBeNull();
    expect(state.winner).toBeNull();
    const tie = recordBull(state, { type: 'bull-closest', winner: 'tie' });
    expect(bullThrower(tie)).toBe(1);
    const winner = recordBull(state, { type: 'bull-closest', winner: 0 });
    expect(winner.winner).toBe(0);
    expect(winner.rounds[0].reason).toBe('closest');
    expect(winner.rounds[0]).not.toHaveProperty('coordinates');
  });
  it('allows a dislodged-dart rethrow without pretending the second dart was scored', () => {
    const state = recordBull(createBullOff(0), {
      type: 'bull-throw',
      player: 0,
      hit: 'inner',
    });
    const retry = recordBull(state, { type: 'bull-rethrow' });
    expect(retry.rounds).toHaveLength(2);
    expect(retry.rounds[0]).toMatchObject({
      hits: ['inner', null],
      reason: 'dislodged',
    });
    expect(bullThrower(retry)).toBe(1);
    expect(() =>
      recordBull(createBullOff(0), { type: 'bull-rethrow' }),
    ).toThrow(/first dart/);
  });
  it('blocks scoring/drafts until decided, then starts with the winner and alternates from them', () => {
    const waiting = start([first]);
    expect(bullPending(waiting)).toBe(true);
    expect(() =>
      recordVisit(waiting, { total: 0, darts: 3, double: false }),
    ).toThrow(/bull-off/);
    expect(() =>
      validateDraft(emptyDraft(), { ...base, commands: [first] }),
    ).toThrow();
    const commands: Command[] = [
      first,
      second,
      { type: 'visit', visit: { total: 180, darts: 3, double: false } },
      { type: 'visit', visit: { total: 0, darts: 3, double: false } },
      { type: 'visit', visit: { total: 121, darts: 3, double: true } },
    ];
    const match = start(commands);
    expect(match).toMatchObject({
      turn: 1,
      legWinner: 1,
      setup: { starter: 1 },
    });
    expect(match.visits).toHaveLength(3);
    expect(nextLeg(match).turn).toBe(0);
    expect(playerStats(start([first, second]), 1)).toMatchObject({
      darts: 0,
      average: '—',
      best: 0,
    });
  });
  it('replays pause/resume, correction and setup history without losing the prior throw', () => {
    const session = { ...base, commands: [first, { type: 'pause' as const }] };
    expect(() => start([...session.commands, second])).toThrow(
      /active bull-off/,
    );
    const ended = {
      ...base,
      commands: [
        first,
        { type: 'pause' as const },
        { type: 'resume' as const },
        second,
      ],
    };
    expect(replay(ended).bullOff?.winner).toBe(1);
    expect(start([first]).bullOff?.winner).toBeNull();
    expect(normaliseSession(ended)).toEqual(ended);
    expect(
      inspectBackup(backupText({ ...emptyData(), current: ended })).data
        .current,
    ).toEqual(ended);
  });
  it('does not reuse a prior bull-off in a rematch with a chosen starter', () => {
    const session: Session = {
      ...base,
      commands: [first, second, { type: 'concede', player: 0 }],
    };
    const next = rematch(session, 'next-bull', 0);
    expect(next.setup.startMethod).toBeUndefined();
    expect(replay(next).bullOff).toBeNull();
    expect(replay(next).turn).toBe(0);
    expect(replay(session).bullOff?.winner).toBe(1);
  });
  it('rejects unsupported modes, invalid decisions and pre-v4 bull-off data', () => {
    expect(() => createMatch({ ...base.setup, bot: 'regular' })).toThrow(
      /two local players/,
    );
    expect(() =>
      createMatch({ ...base.setup, startMethod: 'random' } as never),
    ).toThrow();
    expect(() =>
      recordBull(createBullOff(0), { type: 'bull-closest', winner: 0 }),
    ).toThrow(/outside/);
    expect(() =>
      start([{ type: 'bull-throw', player: 0, hit: 'treble' } as never]),
    ).toThrow(/valid bull-off/);
    expect(() =>
      start([{ type: 'bull-closest', winner: 5 } as never]),
    ).toThrow();
    for (const version of [1, 2, 3])
      expect(() =>
        normaliseSession({ ...base, version, commands: [first] }),
      ).toThrow();
    expect(() =>
      replay({
        ...base,
        setup: { ...base.setup, startMethod: undefined },
        commands: [first],
      }),
    ).toThrow(/active bull-off/);
  });
});
