export type Setup = {
  players: [string, string];
  start: number;
  legsToWin: number;
};
export type Visit = { total: number; darts: number; double: boolean };
export type RecordedVisit = Visit & {
  player: number;
  leg: number;
  bust: boolean;
  checkout: boolean;
};
export type Match = {
  setup: Setup;
  scores: [number, number];
  legs: [number, number];
  turn: number;
  leg: number;
  legWinner: number | null;
  winner: number | null;
  visits: RecordedVisit[];
};
export type Command = { type: 'visit'; visit: Visit } | { type: 'next-leg' };
export type Session = { version: 1; setup: Setup; commands: Command[] };

const values = [
  ...new Set([
    0,
    25,
    50,
    ...Array.from({ length: 20 }, (_, i) => [
      i + 1,
      (i + 1) * 2,
      (i + 1) * 3,
    ]).flat(),
  ]),
];
const doubles = [...Array.from({ length: 20 }, (_, i) => (i + 1) * 2), 50];

function possible(total: number, darts: number): boolean {
  if (darts === 0) return total === 0;
  return values.some(
    (value) => value <= total && possible(total - value, darts - 1),
  );
}

export function createMatch(setup: Setup): Match {
  if (
    !setup ||
    !Array.isArray(setup.players) ||
    setup.players.length !== 2 ||
    setup.players.some(
      (p) => typeof p !== 'string' || !p.trim() || p.length > 30,
    )
  ) {
    throw new Error('Enter two player names, up to 30 characters each.');
  }
  if (![301, 501, 701].includes(setup.start))
    throw new Error('Choose 301, 501 or 701.');
  if (
    !Number.isInteger(setup.legsToWin) ||
    setup.legsToWin < 1 ||
    setup.legsToWin > 11
  )
    throw new Error('Choose between 1 and 11 legs to win.');
  return {
    setup: {
      ...setup,
      players: setup.players.map((p) => p.trim()) as [string, string],
    },
    scores: [setup.start, setup.start],
    legs: [0, 0],
    turn: 0,
    leg: 1,
    legWinner: null,
    winner: null,
    visits: [],
  };
}

export function recordVisit(match: Match, visit: Visit): Match {
  if (match.legWinner !== null)
    throw new Error(
      'This leg is finished. Start the next leg or undo the last visit.',
    );
  if (
    !visit ||
    !Number.isInteger(visit.darts) ||
    visit.darts < 1 ||
    visit.darts > 3 ||
    !Number.isInteger(visit.total) ||
    visit.total < 0 ||
    visit.total > 180 ||
    typeof visit.double !== 'boolean'
  ) {
    throw new Error('Enter a score from 0 to 180 and 1–3 darts.');
  }
  if (!possible(visit.total, visit.darts))
    throw new Error(
      `That score is not possible with ${visit.darts} dart${visit.darts === 1 ? '' : 's'}.`,
    );
  const player = match.turn;
  const remaining = match.scores[player] - visit.total;
  const checkout = remaining === 0 && visit.double;
  if (visit.double && remaining !== 0)
    throw new Error('Only confirm a double for a finishing visit.');
  if (
    checkout &&
    !doubles.some((d) => possible(visit.total - d, visit.darts - 1))
  )
    throw new Error(
      'That finish cannot end on a double with the selected darts.',
    );
  const bust =
    remaining < 0 || remaining === 1 || (remaining === 0 && !checkout);
  const scores: [number, number] = [...match.scores];
  const legs: [number, number] = [...match.legs];
  if (!bust) scores[player] = remaining;
  if (checkout) legs[player]++;
  return {
    ...match,
    scores,
    legs,
    turn: checkout ? player : 1 - player,
    legWinner: checkout ? player : null,
    winner: checkout && legs[player] === match.setup.legsToWin ? player : null,
    visits: [
      ...match.visits,
      { ...visit, player, leg: match.leg, bust, checkout },
    ],
  };
}

export function nextLeg(match: Match): Match {
  if (match.winner !== null) throw new Error('The match is finished.');
  if (match.legWinner === null) throw new Error('Finish this leg first.');
  return {
    ...match,
    scores: [match.setup.start, match.setup.start],
    leg: match.leg + 1,
    turn: match.leg % 2,
    legWinner: null,
  };
}

export function replay(session: Session): Match {
  if (
    !session ||
    session.version !== 1 ||
    !Array.isArray(session.commands) ||
    session.commands.length > 10000
  )
    throw new Error('Saved match is invalid.');
  return session.commands.reduce((match, command) => {
    if (command?.type === 'visit') return recordVisit(match, command.visit);
    if (command?.type === 'next-leg') return nextLeg(match);
    throw new Error('Saved match contains an unknown action.');
  }, createMatch(session.setup));
}

export function playerStats(match: Match, player: number) {
  const visits = match.visits.filter((v) => v.player === player);
  const darts = visits.reduce((n, v) => n + v.darts, 0);
  const scored = visits.reduce((n, v) => n + (v.bust ? 0 : v.total), 0);
  return {
    average: darts ? ((scored / darts) * 3).toFixed(1) : '—',
    darts,
    best: visits.reduce((n, v) => Math.max(n, v.bust ? 0 : v.total), 0),
  };
}

type Segment = { label: string; value: number };
const finishes: Segment[] = [
  20, 16, 18, 12, 10, 8, 4, 2, 1, 3, 5, 6, 7, 9, 11, 13, 14, 15, 17, 19,
].map((n) => ({ label: `D${n}`, value: n * 2 }));
finishes.push({ label: 'Bull', value: 50 });
const setups: Segment[] = [
  ...Array.from({ length: 20 }, (_, i) => ({
    label: `T${20 - i}`,
    value: (20 - i) * 3,
  })),
  ...Array.from({ length: 20 }, (_, i) => ({
    label: `${20 - i}`,
    value: 20 - i,
  })),
  { label: '25', value: 25 },
  { label: 'Bull', value: 50 },
  ...finishes.filter((d) => d.value !== 50),
];
export function checkoutRoute(score: number): string[] | null {
  if (score < 2 || score > 170) return null;
  const direct = finishes.find((d) => d.value === score);
  if (direct) return [direct.label];
  for (const a of setups) {
    const end = finishes.find((d) => a.value + d.value === score);
    if (end) return [a.label, end.label];
  }
  for (const a of setups)
    for (const b of setups) {
      const end = finishes.find((d) => a.value + b.value + d.value === score);
      if (end) return [a.label, b.label, end.label];
    }
  return null;
}
