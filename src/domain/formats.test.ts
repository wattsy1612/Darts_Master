import { describe, expect, it } from 'vitest';
import {
  createMatch,
  recordVisit,
  nextLeg,
  replay,
  checkoutRoute,
} from './match';
import type { Match, Session, Setup } from './match';
import { evaluateDarts } from './darts';
import type { DartHit } from './darts';
import { normaliseSession, emptyData } from '../data/workspace';
import { backupText, inspectBackup } from '../data/backup';
import { updateArchive } from './archive';
import { playerSummary } from './players';
const setup: Setup = { players: ['A', 'B'], start: 101, legsToWin: 1 };
const single = (number: number): DartHit => ({ number, multiplier: 1 });
const double = (number: number): DartHit => ({ number, multiplier: 2 });
const treble = (number: number): DartHit => ({ number, multiplier: 3 });
function detailed(match: Match, hits: DartHit[]) {
  const r = evaluateDarts(match.scores[match.turn], hits, {
    ...match.setup,
    opened: match.opened[match.turn],
  });
  return recordVisit(match, {
    total: r.total,
    darts: r.darts,
    double: r.double,
    hits,
    ...(!match.opened[match.turn] ? { opens: r.opens } : {}),
  });
}
function winLeg(match: Match, winner: number) {
  if (match.turn !== winner)
    match = recordVisit(match, { total: 0, darts: 3, double: false });
  return recordVisit(match, { total: 101, darts: 3, double: false });
}
describe('configurable X01', () => {
  it('keeps old session results unchanged and requires version 2 for new rules', () => {
    const old: Session = {
      version: 1,
      id: 'legacy',
      setup: { ...setup, start: 301 },
      commands: [
        { type: 'visit', visit: { total: 180, darts: 3, double: false } },
        { type: 'visit', visit: { total: 0, darts: 3, double: false } },
        { type: 'visit', visit: { total: 121, darts: 3, double: true } },
      ],
    };
    expect(replay(old)).toMatchObject({
      scores: [0, 301],
      legs: [1, 0],
      winner: 0,
      opened: [true, true],
    });
    expect(normaliseSession(old)).toEqual(old);
    expect(() =>
      replay({ ...old, setup: { ...old.setup, outRule: 'straight' } }),
    ).toThrow(/version 2/);
    expect(() =>
      replay({ ...old, setup: { ...old.setup, start: 101 } }),
    ).toThrow(/version 2/);
    expect(() => normaliseSession({ ...old, version: 99 })).toThrow();
  });
  it.each([101, 201, 401, 500, 1001])(
    'accepts configured starting score %s',
    (start) => {
      expect(createMatch({ ...setup, start }).scores).toEqual([start, start]);
    },
  );
  it.each([100, 1002, NaN, 101.5])(
    'rejects invalid starting score %s',
    (start) => expect(() => createMatch({ ...setup, start })).toThrow(),
  );
  it('counts only the opening double and subsequent darts and resets both sides next leg', () => {
    let match = createMatch({
      ...setup,
      inRule: 'double',
      outRule: 'straight',
      legsToWin: 2,
    });
    match = detailed(match, [treble(20), single(20), double(20)]);
    expect(match).toMatchObject({ scores: [61, 101], opened: [true, false] });
    expect(match.visits[0]).toMatchObject({ total: 40, darts: 3, opens: true });
    match = detailed(match, [single(25), treble(20), single(20)]);
    expect(match).toMatchObject({ scores: [61, 101], opened: [true, false] });
    expect(match.visits[1].total).toBe(0);
    match = detailed(match, [treble(20), single(1)]);
    expect(match.legWinner).toBe(0);
    expect(nextLeg(match)).toMatchObject({
      scores: [101, 101],
      opened: [false, false],
    });
  });
  it('allows bull to open and cancels an opening double on a bust', () => {
    const match = createMatch({ ...setup, inRule: 'double' });
    const bull = detailed(match, [double(25), single(20), single(20)]);
    expect(bull).toMatchObject({ scores: [11, 101], opened: [true, false] });
    const bust = detailed(match, [double(20), treble(20)]); // Leaves one: whole visit is void.
    expect(bust).toMatchObject({ scores: [101, 101], opened: [false, false] });
    expect(bust.visits[0]).toMatchObject({ bust: true, opens: true });
  });
  it('requires an explicit aggregate opening declaration without inventing hits', () => {
    const match = createMatch({ ...setup, inRule: 'double' });
    expect(() =>
      recordVisit(match, { total: 40, darts: 3, double: false }),
    ).toThrow(/whether you opened/);
    expect(() =>
      recordVisit(match, { total: 60, darts: 1, double: false, opens: true }),
    ).toThrow(/not possible/);
    expect(() =>
      recordVisit(match, { total: 40, darts: 1, double: false, opens: false }),
    ).toThrow(/not possible/);
    const scored = recordVisit(match, {
      total: 40,
      darts: 3,
      double: false,
      opens: true,
    });
    expect(scored.scores[0]).toBe(61);
    expect(scored.visits[0].hits).toBeUndefined();
  });
  it('enforces opening and finishing together, including one dart doing both', () => {
    const closed = {
      ...createMatch({ ...setup, inRule: 'double' }),
      scores: [40, 101] as [number, number],
    };
    expect(detailed(closed, [double(20)]).winner).toBe(0);
    const impossible = createMatch({ ...setup, inRule: 'double' });
    expect(() =>
      recordVisit(impossible, {
        total: 101,
        darts: 2,
        double: true,
        opens: true,
      }),
    ).toThrow(/cannot end/);
    expect(
      recordVisit(impossible, {
        total: 101,
        darts: 3,
        double: true,
        opens: true,
      }).winner,
    ).toBe(0);
  });
  it('allows one remaining and single or treble finishes only under straight out', () => {
    const straight = createMatch({ ...setup, outRule: 'straight' });
    const atOne = detailed(straight, [treble(20), double(20)]);
    expect(atOne.scores[0]).toBe(1);
    expect(atOne.visits[0].bust).toBe(false);
    const afterMiss = detailed(atOne, [single(0), single(0), single(0)]);
    expect(detailed(afterMiss, [single(1)]).winner).toBe(0);
    expect(
      detailed({ ...straight, scores: [60, 101] }, [treble(20)]).winner,
    ).toBe(0);
    const doubleOut = createMatch(setup);
    expect(detailed(doubleOut, [treble(20), double(20)]).visits[0].bust).toBe(
      true,
    );
  });
  it('calculates legal checkout routes for all opening/finishing combinations', () => {
    expect(checkoutRoute(1, 1, 'straight')).toEqual(['1']);
    expect(checkoutRoute(180, 3, 'straight')).toEqual(['T20', 'T20', 'T20']);
    expect(checkoutRoute(101, 2, 'double', true)).toBeNull();
    expect(checkoutRoute(40, 1, 'double', true)).toEqual(['D20']);
    for (const outRule of ['straight', 'double'] as const)
      for (const needsOpening of [false, true])
        for (let score = 1; score <= 180; score++) {
          const route = checkoutRoute(score, 3, outRule, needsOpening);
          if (!route) continue;
          const hits = route.map((label) =>
            label === 'Bull'
              ? double(25)
              : label.startsWith('D')
                ? double(Number(label.slice(1)))
                : label.startsWith('T')
                  ? treble(Number(label.slice(1)))
                  : single(Number(label)),
          );
          expect(
            evaluateDarts(score, hits, {
              inRule: needsOpening ? 'double' : 'straight',
              outRule,
              opened: !needsOpening,
            }).status,
          ).toBe('checkout');
        }
  });
  it('keeps aggregate and individual-dart input equivalent across all rule modes', () => {
    const segments = [
      single(0),
      single(1),
      single(20),
      treble(20),
      double(20),
      double(25),
      single(25),
    ];
    for (const inRule of ['straight', 'double'] as const)
      for (const outRule of ['straight', 'double'] as const)
        for (let seed = 0; seed < 343; seed++) {
          const match = createMatch({ ...setup, inRule, outRule });
          const hits: DartHit[] = [];
          for (let i = 0; i < 3; i++) {
            hits.push(segments[Math.floor(seed / 7 ** i) % 7]);
            if (
              evaluateDarts(101, hits, {
                inRule,
                outRule,
                opened: inRule === 'straight',
              }).status !== 'scoring'
            )
              break;
          }
          const result = detailed(match, hits),
            visit = result.visits[0];
          const aggregate = recordVisit(match, {
            total: visit.total,
            darts: visit.darts,
            double: visit.double,
            ...(inRule === 'double' ? { opens: visit.opens } : {}),
          });
          expect(aggregate.scores).toEqual(result.scores);
          expect(aggregate.opened).toEqual(result.opened);
          expect(aggregate.winner).toBe(result.winner);
        }
  });
});

describe('sets and saved results', () => {
  it('distinguishes set legs, total legs and sets, with reversible set transitions', () => {
    const settings = {
      ...setup,
      outRule: 'straight' as const,
      legsToWin: 2,
      setsToWin: 2,
      starterPolicy: 'alternate-sets' as const,
    };
    let match = createMatch(settings);
    match = winLeg(match, 0);
    match = nextLeg(match);
    match = winLeg(match, 0);
    expect(match).toMatchObject({
      legs: [2, 0],
      setLegs: [2, 0],
      sets: [1, 0],
      setWinner: 0,
      winner: null,
      set: 1,
    });
    const before = structuredClone(match),
      next = nextLeg(match);
    expect(next).toMatchObject({
      set: 2,
      setLegs: [0, 0],
      legs: [2, 0],
      sets: [1, 0],
      turn: 1,
      leg: 3,
    });
    expect(match).toEqual(before);
    expect(
      nextLeg({
        ...match,
        setup: { ...settings, starterPolicy: 'alternate-legs' },
      }).turn,
    ).toBe(0);
  });
  it('can award a match on sets despite the winner losing more total legs, and round trips backup/statistics', () => {
    const settings: Setup = {
      ...setup,
      outRule: 'straight',
      legsToWin: 3,
      setsToWin: 2,
      playerIds: ['a', 'b'],
    };
    const session: Session = {
      version: 2,
      id: 'set-result',
      setup: settings,
      commands: [],
    };
    for (const winner of [0, 0, 1, 1, 0, 1, 1, 1, 0, 0, 1, 1, 0]) {
      let match = replay(session);
      if (match.legWinner !== null) {
        session.commands.push({ type: 'next-leg' });
        match = replay(session);
      }
      if (match.turn !== winner)
        session.commands.push({
          type: 'visit',
          visit: { total: 0, darts: 3, double: false },
        });
      session.commands.push({
        type: 'visit',
        visit: { total: 101, darts: 3, double: false },
      });
    }
    const result = replay(session);
    expect(result).toMatchObject({
      winner: 0,
      sets: [2, 1],
      legs: [6, 7],
      set: 3,
    });
    expect(() => nextLeg(result)).toThrow(/finished/);
    expect(
      replay({ ...session, commands: session.commands.slice(0, -1) }),
    ).toMatchObject({ winner: null, sets: [1, 1] });
    const archive = updateArchive([], session);
    const imported = inspectBackup(
      backupText({ ...emptyData(), current: session, archive }),
    );
    expect(replay(imported.data.archive[0].session)).toEqual(result);
    expect(playerSummary(archive, 'a', false)).toMatchObject({
      wins: 1,
      legsWon: 6,
      legsLost: 7,
      recent: [{ score: '2–1 sets' }],
    });
  });
  it('rejects invalid or unsupported set and rule settings', () => {
    for (const patch of [
      { setsToWin: 0 },
      { setsToWin: 12 },
      { inRule: 'master' },
      { outRule: 'master' },
      { starterPolicy: 'random' },
      { starterPolicy: 'alternate-sets' },
    ])
      expect(() => createMatch({ ...setup, ...patch } as Setup)).toThrow();
  });
});
