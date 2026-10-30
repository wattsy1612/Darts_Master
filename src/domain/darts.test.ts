import { describe, expect, it } from 'vitest';
import { dartLabel, dartValue, evaluateDarts } from './darts';
import type { DartHit } from './darts';
import { createMatch, recordVisit } from './match';
const s = (number: number): DartHit => ({ number, multiplier: 1 });
const d = (number: number): DartHit => ({ number, multiplier: 2 });
const t = (number: number): DartHit => ({ number, multiplier: 3 });
describe('individual dart scoring', () => {
  it('scores singles, doubles, trebles, bulls and misses', () => {
    expect([s(20), d(20), t(20), s(25), d(25), s(0)].map(dartValue)).toEqual([
      20, 40, 60, 25, 50, 0,
    ]);
    expect([s(20), d(20), t(20), s(25), d(25), s(0)].map(dartLabel)).toEqual([
      'S20',
      'D20',
      'T20',
      '25',
      'Bull',
      'Miss',
    ]);
  });
  it.each([s(-1), s(21), t(25), d(0), s(1.5)])(
    'rejects invalid target %j',
    (hit) => expect(() => dartValue(hit)).toThrow(),
  );
  it('previews a maximum and counts misses as thrown darts', () => {
    expect(evaluateDarts(501, [t(20), t(20), t(20)])).toMatchObject({
      total: 180,
      darts: 3,
      remaining: 321,
      status: 'scoring',
    });
    expect(evaluateDarts(501, [s(0), s(20), s(0)])).toMatchObject({
      total: 20,
      darts: 3,
      remaining: 481,
    });
  });
  it('finishes on a double or inner bull with the actual number of darts', () => {
    expect(evaluateDarts(40, [d(20)])).toMatchObject({
      status: 'checkout',
      double: true,
      darts: 1,
      remaining: 0,
    });
    expect(evaluateDarts(50, [d(25)])).toMatchObject({
      status: 'checkout',
      double: true,
      darts: 1,
    });
    expect(evaluateDarts(121, [t(20), t(11), d(14)])).toMatchObject({
      status: 'checkout',
      darts: 3,
    });
  });
  it('busts immediately for leaving one, going below zero or a single finish', () => {
    for (const [start, hits] of [
      [21, [s(20)]],
      [20, [t(20)]],
      [20, [s(20)]],
      [25, [s(25)]],
    ] as [number, DartHit[]][]) {
      expect(evaluateDarts(start, hits)).toMatchObject({
        status: 'bust',
        remaining: start,
        double: false,
        darts: 1,
      });
    }
  });
  it('refuses darts after a bust or finish, even if their combined total looks valid', () => {
    expect(() => evaluateDarts(40, [s(20), s(20), s(0)])).toThrow(
      /visit ended/,
    );
    expect(() => evaluateDarts(40, [d(20), s(0)])).toThrow(/visit ended/);
    expect(() => evaluateDarts(40, [t(20), s(0)])).toThrow(/visit ended/);
  });
  it('rejects a fourth dart and invalid starting scores', () => {
    expect(() => evaluateDarts(501, [s(0), s(0), s(0), s(0)])).toThrow();
    expect(() => evaluateDarts(1, [])).toThrow();
  });
  it('stores validated hit details through the shared visit engine', () => {
    const match = createMatch({
      players: ['A', 'B'],
      start: 501,
      legsToWin: 1,
    });
    const hits = [t(20), t(20), t(20)];
    const preview = evaluateDarts(501, hits);
    const next = recordVisit(match, {
      total: preview.total,
      darts: preview.darts,
      double: preview.double,
      hits,
    });
    expect(next.scores[0]).toBe(321);
    expect(next.visits[0].hits).toEqual(hits);
    expect(() =>
      recordVisit(match, { total: 100, darts: 3, double: false, hits }),
    ).toThrow(/do not match/);
  });
});
