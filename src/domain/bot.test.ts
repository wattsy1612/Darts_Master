import { describe, expect, it } from 'vitest';
import { botVisit } from './bot';
import { createMatch, nextLeg, recordVisit } from './match';
import type { Match, Setup } from './match';

function botTurn(bot: Setup['bot'] = 'regular', score = 501): Match {
  const match = createMatch({
    players: ['Player', 'Practice Bot'],
    start: 501,
    legsToWin: 1,
    bot,
    starter: 1,
  });
  return { ...match, scores: [501, score] };
}
describe('practice opponent', () => {
  it('repeats a throw for the same saved match position', () => {
    const match = botTurn();
    expect(botVisit(match, 'saved-id-1')).toEqual(
      botVisit(match, 'saved-id-1'),
    );
  });
  it.each(['rookie', 'regular', 'sharp'] as const)(
    'produces valid darts at %s difficulty across scores and seeds',
    (bot) => {
      for (const score of [
        2, 3, 21, 25, 40, 50, 61, 110, 121, 159, 170, 301, 501,
      ]) {
        for (let seed = 0; seed < 20; seed++) {
          const match = botTurn(bot, score);
          const visit = botVisit(match, `score-${score}-${seed}`);
          const next = recordVisit(match, visit);
          expect(visit.hits).toHaveLength(visit.darts);
          expect(next.visits).toHaveLength(1);
          expect(next.scores[1]).toBeGreaterThanOrEqual(0);
          expect(next.scores[1]).not.toBe(1);
        }
      }
    },
  );
  it('has measurably different scoring strength across difficulty levels', () => {
    function average(bot: Setup['bot']) {
      return (
        Array.from(
          { length: 200 },
          (_, i) => botVisit(botTurn(bot), `difficulty-${i}`).total,
        ).reduce((a, b) => a + b, 0) / 200
      );
    }
    const rookie = average('rookie'),
      regular = average('regular'),
      sharp = average('sharp');
    expect(regular).toBeGreaterThan(rookie + 15);
    expect(sharp).toBeGreaterThan(regular + 15);
  });
  it('does not throw for a human player or after a leg has finished', () => {
    expect(() => botVisit({ ...botTurn(), turn: 0 }, 'seed')).toThrow();
    expect(() => botVisit({ ...botTurn(), legWinner: 1 }, 'seed')).toThrow();
    expect(() =>
      botVisit(
        createMatch({ players: ['A', 'B'], start: 501, legsToWin: 1 }),
        'seed',
      ),
    ).toThrow();
  });
  it('respects a chosen starting player and alternates on the next leg', () => {
    let match = createMatch({
      players: ['A', 'B'],
      start: 301,
      legsToWin: 2,
      bot: 'regular',
      starter: 1,
    });
    expect(match.turn).toBe(1);
    match = recordVisit(match, { total: 180, darts: 3, double: false });
    match = recordVisit(match, { total: 0, darts: 3, double: false });
    match = recordVisit(match, { total: 121, darts: 3, double: true });
    expect(nextLeg(match).turn).toBe(0);
  });
  it('rejects unsupported opponents and starters from saved data', () => {
    const setup = { players: ['A', 'B'], start: 501, legsToWin: 1 } as Setup;
    expect(() =>
      createMatch({ ...setup, bot: 'unknown' } as unknown as Setup),
    ).toThrow();
    expect(() =>
      createMatch({ ...setup, starter: 2 } as unknown as Setup),
    ).toThrow();
  });
});

it('can finish and win a match using the same checkout rules', () => {
  const match = botTurn('sharp', 2);
  let winner: Match | null = null;
  for (let i = 0; i < 100; i++) {
    const next = recordVisit(match, botVisit(match, `checkout-${i}`));
    if (next.winner !== null) {
      winner = next;
      break;
    }
  }
  expect(winner?.winner).toBe(1);
  expect(winner?.visits.at(-1)?.checkout).toBe(true);
});
