export type Side = 0 | 1;
export type BullHit = 'inner' | 'outer' | 'outside';
export type BullCommand =
  | { type: 'bull-throw'; player: Side; hit: BullHit }
  | { type: 'bull-closest'; winner: Side | 'tie' }
  | { type: 'bull-rethrow' };
export type BullRound = {
  first: Side;
  hits: [BullHit | null, BullHit | null];
  reason?: 'rings' | 'closest' | 'tie' | 'dislodged';
  winner?: Side | null;
};
export type BullOff = { rounds: BullRound[]; winner: Side | null };
export const bullHitLabel = (hit: BullHit | null) =>
  hit === 'inner'
    ? 'Inner bull'
    : hit === 'outer'
      ? 'Outer bull'
      : hit === 'outside'
        ? 'Outside bull'
        : 'Not thrown';
export function createBullOff(first: Side): BullOff {
  return { rounds: [{ first, hits: [null, null] }], winner: null };
}
export function bullThrower(state: BullOff): Side | null {
  if (state.winner !== null) return null;
  const round = state.rounds.at(-1)!;
  if (round.hits[round.first] === null) return round.first;
  if (round.hits[(1 - round.first) as Side] === null)
    return (1 - round.first) as Side;
  return null;
}
export function recordBull(state: BullOff, command: BullCommand): BullOff {
  if (state.winner !== null)
    throw new Error(
      'The bull-off is decided. Undo its last action to correct it.',
    );
  const previous = state.rounds.at(-1)!;
  const round: BullRound = { ...previous, hits: [...previous.hits] };
  const rounds = [...state.rounds.slice(0, -1), round];
  function tied(reason: 'tie' | 'dislodged') {
    round.reason = reason;
    round.winner = null;
    rounds.push({ first: (1 - round.first) as Side, hits: [null, null] });
    return { rounds, winner: null };
  }
  if (command.type === 'bull-rethrow') {
    if (round.hits.every((h) => h === null))
      throw new Error(
        'Record the first dart before reporting a dislodged dart.',
      );
    return tied('dislodged');
  }
  if (command.type === 'bull-closest') {
    if (round.hits.some((h) => h !== 'outside'))
      throw new Error(
        'Closest-dart confirmation is only used when both darts are outside the bull.',
      );
    if (command.winner === 'tie') return tied('tie');
    if (command.winner !== 0 && command.winner !== 1)
      throw new Error('Choose the closer dart or a rethrow.');
    round.reason = 'closest';
    round.winner = command.winner;
    return { rounds, winner: command.winner };
  }
  if (
    command.type !== 'bull-throw' ||
    !['inner', 'outer', 'outside'].includes(command.hit)
  )
    throw new Error('Choose a valid bull-off dart.');
  if (command.player !== bullThrower(state))
    throw new Error('Record the bull-off darts in the displayed throw order.');
  round.hits[command.player] = command.hit;
  if (round.hits.some((h) => h === null)) return { rounds, winner: null };
  if (round.hits[0] === round.hits[1]) {
    if (round.hits[0] === 'outside') return { rounds, winner: null };
    return tied('tie');
  }
  const rank = { inner: 2, outer: 1, outside: 0 };
  const winner: Side = rank[round.hits[0]!] > rank[round.hits[1]!] ? 0 : 1;
  round.reason = 'rings';
  round.winner = winner;
  return { rounds, winner };
}
