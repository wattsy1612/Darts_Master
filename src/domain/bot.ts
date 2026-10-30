import { checkoutRoute } from './match';
import type { Match, Visit } from './match';
import { evaluateDarts } from './darts';
import type { DartHit } from './darts';

export const difficulties = {
  rookie: {
    name: 'Rookie',
    description: 'Relaxed scoring, with plenty of missed trebles and doubles.',
    treble: 0.1,
    double: 0.12,
    single: 0.65,
  },
  regular: {
    name: 'Regular',
    description: 'More consistent scoring and a useful finishing challenge.',
    treble: 0.35,
    double: 0.3,
    single: 0.82,
  },
  sharp: {
    name: 'Sharp',
    description: 'Accurate scoring and stronger finishing.',
    treble: 0.6,
    double: 0.55,
    single: 0.95,
  },
};
const order = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
];
function randomFor(seed: string) {
  let state = 2166136261;
  for (const char of seed)
    state = Math.imul(state ^ char.charCodeAt(0), 16777619);
  return () => {
    state += 0x6d2b79f5;
    let x = state;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
function aimFor(
  remaining: number,
  darts: number,
  outRule: 'straight' | 'double' = 'double',
  needsOpening = false,
): DartHit {
  const route = checkoutRoute(remaining, darts, outRule, needsOpening);
  if (route) {
    const first = route[0];
    if (first === 'Bull') return { number: 25, multiplier: 2 };
    if (first === '25') return { number: 25, multiplier: 1 };
    const prefix = first[0];
    return {
      number: Number(first.replace(/^[TD]/, '')),
      multiplier: prefix === 'T' ? 3 : prefix === 'D' ? 2 : 1,
    };
  }
  if (needsOpening) return { number: 20, multiplier: 2 };
  if (remaining === 61) return { number: 19, multiplier: 1 };
  if (remaining > 60) return { number: 20, multiplier: 3 };
  if (remaining > 40) return { number: 20, multiplier: 1 };
  return remaining % 2 === 0
    ? { number: remaining / 2, multiplier: 2 }
    : { number: 1, multiplier: 1 };
}
export function botVisit(match: Match, seed: string): Visit {
  if (
    !match.setup.bot ||
    match.turn !== 1 ||
    match.legWinner !== null ||
    match.status !== 'active'
  )
    throw new Error('The practice opponent is not due to throw.');
  const skill = difficulties[match.setup.bot];
  const random = randomFor(seed);
  const hits: DartHit[] = [];
  const rules = { ...match.setup, opened: match.opened[1] };
  for (let dart = 0; dart < 3; dart++) {
    const before = evaluateDarts(match.scores[1], hits, rules);
    const target = aimFor(
      before.remaining,
      3 - dart,
      match.setup.outRule ?? 'double',
      !before.opened,
    );
    const accuracy =
      target.multiplier === 3
        ? skill.treble
        : target.multiplier === 2
          ? skill.double
          : skill.single;
    let hit = target;
    if (random() > accuracy) {
      const miss = random();
      if (target.number === 25)
        hit = { number: miss < 0.7 ? 25 : 0, multiplier: 1 };
      else if (target.multiplier === 2)
        hit =
          miss < 0.5
            ? { number: target.number, multiplier: 1 }
            : miss < 0.85
              ? { number: 0, multiplier: 1 }
              : {
                  number: order[(order.indexOf(target.number) + 1) % 20],
                  multiplier: 2,
                };
      else if (
        miss <
        (match.setup.bot === 'rookie'
          ? 0.25
          : match.setup.bot === 'regular'
            ? 0.6
            : 0.75)
      )
        hit = { number: target.number, multiplier: 1 };
      else
        hit = {
          number:
            order[(order.indexOf(target.number) + (miss < 0.82 ? 1 : 19)) % 20],
          multiplier: 1,
        };
    }
    hits.push(hit);
    if (evaluateDarts(match.scores[1], hits, rules).status !== 'scoring') break;
  }
  const result = evaluateDarts(match.scores[1], hits, rules);
  return {
    total: result.total,
    darts: result.darts,
    double: result.double,
    ...(!match.opened[1] ? { opens: result.opens } : {}),
    hits,
  };
}
