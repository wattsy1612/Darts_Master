import { describe, expect, it } from 'vitest';
import {
  checkoutRoute,
  createMatch,
  nextLeg,
  playerStats,
  recordVisit,
  replay,
} from './match';
import type { Match, Session } from './match';
const setup = {
  players: ['Alice', 'Bob'] as [string, string],
  start: 301,
  legsToWin: 2,
};
function visit(match: Match, total: number, double = false, darts = 3) {
  return recordVisit(match, { total, double, darts });
}
function readyToFinish() {
  return visit(visit(createMatch(setup), 180), 0);
}

describe('match rules', () => {
  it('scores visits and alternates players, including misses', () => {
    const match = visit(visit(createMatch(setup), 60), 0);
    expect(match.scores).toEqual([241, 301]);
    expect(match.turn).toBe(0);
    expect(match.visits).toHaveLength(2);
  });
  it.each([
    [-1, 3],
    [181, 3],
    [179, 3],
    [59, 1],
    [121, 2],
    [1.5, 3],
    [60, 0],
    [60, 4],
  ])('rejects impossible visit %s with %s darts', (total, darts) => {
    expect(() => visit(createMatch(setup), total, false, darts)).toThrow();
  });
  it('counts bull as 50 and validates a two-dart total', () => {
    expect(visit(createMatch(setup), 50, false, 1).scores[0]).toBe(251);
    expect(visit(createMatch(setup), 110, false, 2).scores[0]).toBe(191);
  });
  it('returns the entire visit on a bust, leaving one or going below zero', () => {
    const at21 = visit(readyToFinish(), 100);
    const playersTurn = visit(at21, 0);
    const leavingOne = visit(playersTurn, 20);
    expect(leavingOne.scores[0]).toBe(21);
    expect(leavingOne.visits.at(-1)?.bust).toBe(true);
    expect(visit(playersTurn, 60).scores[0]).toBe(21);
  });
  it('requires a double finish and awards a leg only once', () => {
    const match = readyToFinish();
    expect(visit(match, 121).scores[0]).toBe(121);
    expect(visit(match, 121).visits.at(-1)?.bust).toBe(true);
    const won = visit(match, 121, true);
    expect(won.scores[0]).toBe(0);
    expect(won.legs).toEqual([1, 0]);
    expect(won.legWinner).toBe(0);
    expect(() => visit(won, 0)).toThrow();
  });
  it('rejects a total that cannot finish on a double', () => {
    const at159 = visit(visit(createMatch(setup), 142), 0);
    expect(() => visit(at159, 159, true)).toThrow(/cannot end on a double/);
    expect(() => visit(createMatch(setup), 60, true)).toThrow(
      /finishing visit/,
    );
  });
  it('allows the inner bull as the finishing double', () => {
    const at50 = visit(visit(visit(visit(createMatch(setup), 180), 0), 71), 0);
    expect(visit(at50, 50, true, 1).legWinner).toBe(0);
  });
  it('alternates the starting player across legs and stops after the match is won', () => {
    let match = nextLeg(visit(readyToFinish(), 121, true));
    expect(match.turn).toBe(1);
    expect(match.scores).toEqual([301, 301]);
    expect(match.leg).toBe(2);
    match = visit(visit(visit(visit(match, 0), 180), 0), 121, true);
    expect(match.winner).toBe(0);
    expect(match.legs).toEqual([2, 0]);
    expect(() => nextLeg(match)).toThrow(/finished/);
    expect(() => nextLeg(createMatch(setup))).toThrow(/Finish this leg/);
  });
  it('keeps previous states immutable for undo', () => {
    const before = readyToFinish();
    const after = visit(before, 121, true);
    expect(before.scores[0]).toBe(121);
    expect(before.legs[0]).toBe(0);
    expect(after.legs[0]).toBe(1);
  });
  it('includes darts but no points from busts in averages', () => {
    const at21 = visit(readyToFinish(), 100);
    const bust = visit(visit(at21, 0), 20);
    expect(playerStats(bust, 0)).toEqual({
      average: '93.3',
      darts: 9,
      best: 180,
    });
  });
  it('replays saved commands and supports undoing a checkout', () => {
    const session: Session = {
      version: 1,
      setup,
      commands: [
        { type: 'visit', visit: { total: 180, darts: 3, double: false } },
        { type: 'visit', visit: { total: 0, darts: 3, double: false } },
        { type: 'visit', visit: { total: 121, darts: 3, double: true } },
      ],
    };
    expect(replay(session).legWinner).toBe(0);
    expect(
      replay({ ...session, commands: session.commands.slice(0, -1) }).scores[0],
    ).toBe(121);
    expect(() =>
      replay({ ...session, version: 2 } as unknown as Session),
    ).toThrow();
    expect(() =>
      replay({
        ...session,
        commands: [{ type: 'invalid' }],
      } as unknown as Session),
    ).toThrow();
  });
  it('validates names and match settings', () => {
    expect(() => createMatch({ ...setup, players: ['', 'Bob'] })).toThrow();
    expect(() => createMatch({ ...setup, start: 500 })).toThrow();
    expect(() => createMatch({ ...setup, legsToWin: 0 })).toThrow();
    expect(
      createMatch({ ...setup, players: [' Alice ', 'Bob'] }).setup.players[0],
    ).toBe('Alice');
  });
});

describe('checkout routes', () => {
  it('finds familiar finishes', () => {
    expect(checkoutRoute(170)).toEqual(['T20', 'T20', 'Bull']);
    expect(checkoutRoute(40)).toEqual(['D20']);
    expect(checkoutRoute(50)).toEqual(['Bull']);
  });
  it.each([1, 169, 168, 166, 165, 163, 162, 159, 171, 501])(
    'does not suggest a finish for %s',
    (score) => expect(checkoutRoute(score)).toBeNull(),
  );
});
