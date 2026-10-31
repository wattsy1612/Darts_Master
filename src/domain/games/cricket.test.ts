import { describe, expect, it } from 'vitest';
import { currentThrower, changeFormat } from '../participants';
import {
  createCricket,
  recordCricketVisit,
  passCricket,
  replayCricket,
  nextCricketLeg,
  cricketStats,
  normaliseCricketSession,
  cricketRulesVersion,
  rematchCricket,
} from './cricket';
import type {
  CricketMatch,
  CricketSetup,
  CricketSession,
  CricketCommand,
} from './cricket';
import type { DartHit } from '../darts';
const base: CricketSetup = {
  players: ['A', 'B'],
  variant: 'standard',
  bull: 'split',
  legsToWin: 1,
};
const hit = (number: number, multiplier: 1 | 2 | 3 = 1): DartHit => ({
  number,
  multiplier,
});
function visit(match: CricketMatch, hits: DartHit[]) {
  return recordCricketVisit(match, {
    participantId: currentThrower(match).id,
    source: 'manual-segments',
    hits,
  });
}
function pass(match: CricketMatch) {
  return passCricket(match, {
    type: 'pass',
    participantId: currentThrower(match).id,
    source: 'manual-pass',
  });
}
function session(commands: CricketCommand[] = []): CricketSession {
  return {
    game: 'cricket',
    version: 1,
    rulesVersion: cricketRulesVersion,
    id: 'cricket',
    setup: createCricket(base).setup,
    commands,
  };
}
function closeSide(match: CricketMatch, side = 0): CricketMatch {
  for (const number of [20, 19, 18, 17, 16, 15]) {
    if (match.turn !== side) match = pass(match);
    match = visit(match, [hit(number, 3)]);
  }
  if (match.turn !== side) match = pass(match);
  return visit(match, [hit(25, 2), hit(25)]);
}
describe('standard split-bull Cricket rules', () => {
  it('tracks target closure, live excess points and actual actor identity immutably', () => {
    const initial = createCricket(base),
      before = JSON.stringify(initial);
    let match = visit(initial, [hit(20, 2)]);
    match = pass(match);
    match = visit(match, [hit(20, 3)]);
    expect(match.marks[0][0]).toBe(3);
    expect(match.points).toEqual([40, 0]);
    expect(match.visits[2]).toMatchObject({
      marks: 3,
      points: 40,
      closedTargets: [20],
      participantId: 'participant-1-1',
      sideId: 'side-1',
      darts: 1,
    });
    expect(JSON.stringify(initial)).toBe(before);
  });
  it('does not award points or marks for targets dead on both sides', () => {
    let match = visit(createCricket(base), [hit(20, 3)]);
    match = visit(match, [hit(20, 3)]);
    match = visit(match, [hit(20, 3)]);
    expect(match.points).toEqual([0, 0]);
    expect(match.visits.at(-1)).toMatchObject({
      marks: 0,
      points: 0,
      darts: 1,
    });
  });
  it('counts outer bull as one mark and inner bull as two, including closure overflow', () => {
    let match = visit(createCricket(base), [hit(25, 2)]);
    match = pass(match);
    match = visit(match, [hit(25, 2)]);
    expect(match.marks[0][6]).toBe(3);
    expect(match.points[0]).toBe(25);
    expect(match.visits.at(-1)).toMatchObject({
      marks: 2,
      closedTargets: [25],
    });
  });
  it('records real misses and off-target numbers without fabricating marks', () => {
    const match = visit(createCricket(base), [hit(0), hit(14, 3), hit(1, 2)]);
    expect(match.marks.flat()).toEqual(Array(14).fill(0));
    expect(cricketStats(match)).toMatchObject({
      darts: 3,
      marks: 0,
      points: 0,
      marksPerThreeDarts: '0.00',
    });
  });
  it('wins on equal points after all targets close and rejects extra darts after the winner', () => {
    const match = closeSide(createCricket(base));
    expect(match.status).toBe('completed');
    expect(match.winner).toBe(0);
    expect(match.legs).toEqual([1, 0]);
    expect(
      cricketStats(match, currentThrower(createCricket(base)).id),
    ).toMatchObject({
      darts: 8,
      marks: 21,
      marksPerThreeDarts: '7.88',
      points: 0,
    });
    expect(() => visit(match, [hit(20)])).toThrow(/active/);
    expect(() => nextCricketLeg(match)).toThrow();
  });
  it('keeps a side behind on points playing after closure, then wins on the exact catch-up dart', () => {
    let match = createCricket({ ...base, starter: 1 });
    match = visit(match, [hit(20, 3)]);
    match = pass(match);
    match = visit(match, [hit(20)]);
    match = closeSide(match);
    expect(match.marks[0].every((m) => m === 3)).toBe(true);
    expect(match.winner).toBeNull();
    expect(match.points).toEqual([0, 20]);
    match = pass(match);
    const before = JSON.stringify(match);
    expect(() => visit(match, [hit(15), hit(15), hit(15)])).toThrow(
      /ended before/,
    );
    expect(JSON.stringify(match)).toBe(before);
    match = visit(match, [hit(15), hit(15)]);
    expect(match.winner).toBe(0);
    expect(match.points).toEqual([30, 20]);
  });
  it('records passes as zero darts and keeps them out of the average denominator', () => {
    const initial = createCricket(base),
      match = pass(initial);
    expect(match.turn).toBe(1);
    expect(match.visits[0]).toMatchObject({
      passed: true,
      darts: 0,
      marks: 0,
      source: 'manual-pass',
    });
    expect(cricketStats(match)).toMatchObject({
      darts: 0,
      passes: 1,
      marksPerThreeDarts: '—',
    });
    expect(() => visit(initial, [])).toThrow(/Pass/);
  });
  it('rotates pairs by actual member and shares marks/points without sharing individual metrics', () => {
    const setup = changeFormat(createCricket(base).setup, 'pairs');
    let match = createCricket(setup);
    const ids = [];
    for (let i = 0; i < 4; i++) {
      ids.push(currentThrower(match).id);
      match = visit(match, [hit(20, 3)]);
    }
    expect(new Set(ids).size).toBe(4);
    expect(match.visits.map((v) => v.participantId)).toEqual(ids);
    expect(match.marks.map((r) => r[0])).toEqual([3, 3]);
    expect(cricketStats(match, ids[0])).toMatchObject({ marks: 3, darts: 1 });
    expect(cricketStats(match, ids[2])).toMatchObject({ marks: 0, darts: 1 });
  });
  it.each(['reset-each-leg', 'continue'] as const)(
    'resets a leg and follows %s member rotation with alternating starters',
    (rotation) => {
      const setup = {
        ...changeFormat(
          createCricket({ ...base, legsToWin: 2 }).setup,
          'pairs',
        ),
        memberRotation: rotation,
      };
      const won = closeSide(createCricket(setup));
      const next = nextCricketLeg(won);
      expect(next.turn).toBe(1);
      expect(next.legs).toEqual([1, 0]);
      expect(next.points).toEqual([0, 0]);
      expect(next.marks.flat().every((m) => m === 0)).toBe(true);
      expect(next.memberCursor).toEqual(
        rotation === 'continue' ? won.memberCursor : [0, 0],
      );
      expect(next.visits).toEqual(won.visits);
    },
  );
  it.each([
    hit(25, 3),
    hit(0, 2),
    hit(21),
    { number: 20, multiplier: 4 } as unknown as DartHit,
  ])(
    'rejects illegal segments %# without altering the source state',
    (dart) => {
      const match = createCricket(base),
        before = JSON.stringify(match);
      expect(() => visit(match, [dart])).toThrow();
      expect(JSON.stringify(match)).toBe(before);
    },
  );
  it('requires explicit actors and segment provenance rather than interpreting totals', () => {
    const match = createCricket(base);
    expect(() =>
      recordCricketVisit(match, {
        participantId: 'other',
        source: 'manual-segments',
        hits: [hit(20)],
      }),
    ).toThrow(/thrower/);
    expect(() =>
      recordCricketVisit(match, {
        participantId: currentThrower(match).id,
        source: 'manual-total',
        total: 60,
      } as never),
    ).toThrow(/individual/);
    expect(() =>
      passCricket(match, {
        type: 'pass',
        participantId: 'other',
        source: 'manual-pass',
      }),
    ).toThrow(/passing/);
  });
  it('requires the explicit supported rule contract and roster bounds', () => {
    for (const patch of [
      { variant: 'cutthroat' },
      { bull: 'full' },
      { legsToWin: 0 },
      { legsToWin: 12 },
      { bot: 'regular' },
      { start: 501 },
      { roundLimit: 15 },
    ])
      expect(() =>
        createCricket({ ...base, ...patch } as CricketSetup),
      ).toThrow();
    expect(() =>
      createCricket(changeFormat(createCricket(base).setup, 'multiplayer')),
    ).toThrow(/two sides/);
  });
});

describe('Cricket replay, lifecycle and canonical records', () => {
  it('canonicalises segments and strips invented derived verification/coordinates', () => {
    const original = session([
      {
        type: 'visit',
        visit: {
          participantId: 'participant-1-1',
          source: 'manual-segments',
          hits: [hit(20, 3)],
        },
      },
    ]);
    const raw = JSON.parse(JSON.stringify(original));
    raw.verified = true;
    raw.commands[0].visit.hits[0].x = 0;
    const copy = normaliseCricketSession(raw);
    expect(copy).toEqual(original);
    expect(replayCricket(copy).points).toEqual([0, 0]);
    expect(cricketStats(replayCricket(copy)).verifiedCompetitiveRecord).toBe(
      false,
    );
  });
  it('preserves pause/resume, requires side identity for concession, and awards no unplayed legs', () => {
    const original = session([
      { type: 'pause' },
      { type: 'resume' },
      { type: 'concede', player: 0, sideId: 'side-1' },
    ]);
    expect(replayCricket(original)).toMatchObject({
      status: 'conceded',
      winner: 1,
      legs: [0, 0],
      visits: [],
    });
    expect(() =>
      replayCricket(
        session([
          { type: 'pause' },
          {
            type: 'visit',
            visit: {
              participantId: 'participant-1-1',
              source: 'manual-segments',
              hits: [hit(20)],
            },
          },
        ]),
      ),
    ).toThrow(/active/);
    expect(() =>
      replayCricket(session([{ type: 'concede', player: 0 }])),
    ).toThrow(/Identify/);
  });
  it('persists bull-off winners as starters without adding Cricket marks/darts', () => {
    const game = session([
      { type: 'bull-throw', player: 0, hit: 'outer' },
      { type: 'bull-throw', player: 1, hit: 'inner' },
    ]);
    game.setup.startMethod = 'bull-off';
    const match = replayCricket(game);
    expect(match.turn).toBe(1);
    expect(match.setup.startingSideId).toBe('side-2');
    expect(match.visits).toEqual([]);
    expect(match.marks.flat().every((m) => m === 0)).toBe(true);
    expect(() =>
      replayCricket({
        ...game,
        commands: [
          {
            type: 'visit',
            visit: {
              participantId: 'participant-1-1',
              source: 'manual-segments',
              hits: [hit(20)],
            },
          },
        ],
      }),
    ).toThrow(/bull-off/);
  });
  it('rejects newer/other game documents and illegal lifecycle continuations', () => {
    for (const patch of [
      { game: 'x01' },
      { version: 2 },
      { rulesVersion: 'other' },
      { id: '' },
      { commands: Array(10001).fill({ type: 'pause' }) },
    ])
      expect(() =>
        normaliseCricketSession({ ...session(), ...patch }),
      ).toThrow();
    expect(() =>
      replayCricket(session([{ type: 'abandon' }, { type: 'resume' }])),
    ).toThrow(/finished/);
    expect(() =>
      normaliseCricketSession({
        ...session(),
        imported: { sourceId: '', importedAt: 'bad' },
      }),
    ).toThrow(/import marker/);
  });
  it('creates a new rematch while retaining only the explicit roster and match rules', () => {
    const old = session([{ type: 'concede', player: 0, sideId: 'side-1' }]);
    old.imported = { sourceId: 'external', importedAt: '2026-10-30T12:00:00Z' };
    const next = rematchCricket(old, 'fresh', 1);
    expect(next).toMatchObject({
      id: 'fresh',
      game: 'cricket',
      commands: [],
      setup: { starter: 1, startingSideId: 'side-2' },
    });
    expect(next.imported).toBeUndefined();
    expect(next.setup.sides).toEqual(old.setup.sides);
    expect(() => rematchCricket(old, old.id, 0)).toThrow();
    expect(() => rematchCricket(session(), 'fresh', 0)).toThrow(/Finish/);
  });
});
