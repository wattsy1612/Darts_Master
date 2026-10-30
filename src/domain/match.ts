import { checkedBotSettings } from './botSettings';
import type { BotSettings } from './botSettings';
import { inputSources, visitStatistics } from './metrics';
import type { InputSource, InputOrigin } from './metrics';
import { getSides, rosterView } from './participants';
import type { MatchSide, RosterSettings } from './participants';
import { createBullOff, recordBull } from './bullOff';
import type { BullOff, BullCommand } from './bullOff';
import { possibleVisit, rulesFor } from './x01';
import type { X01Rules } from './x01';
import { evaluateDarts } from './darts';
import type { DartHit } from './darts';
export type Setup = X01Rules &
  RosterSettings & {
    start: number;
    legsToWin: number;
    setsToWin?: number;
    startMethod?: 'manual' | 'bull-off';
    starterPolicy?: 'alternate-legs' | 'alternate-sets';
    bot?: 'rookie' | 'regular' | 'sharp' | 'custom';
    botSettings?: BotSettings;
    botModel?: 1;
    starter?: number;
  };
export type Visit = {
  total: number;
  darts: number;
  double: boolean;
  hits?: DartHit[];
  opens?: boolean;
  participantId?: string;
  source?: InputSource;
};
export type RecordedVisit = Visit & {
  origin: InputOrigin;
  player: number;
  sideId: string;
  participantId: string;
  profileId: string | null;
  throwerName: string;
  leg: number;
  set: number;
  openingRequired: boolean;
  bust: boolean;
  checkout: boolean;
};
export type Match = {
  setup: Setup;
  sides: MatchSide[];
  memberCursor: number[];
  withdrawn: boolean[];
  scores: number[];
  legs: number[];
  setLegs: number[];
  sets: number[];
  set: number;
  setWinner: number | null;
  opened: boolean[];
  turn: number;
  legStarter: number;
  setStarter: number;
  leg: number;
  legWinner: number | null;
  winner: number | null;
  bullOff: BullOff | null;
  status: 'active' | 'paused' | 'completed' | 'conceded' | 'abandoned';
  concededBy: number | null;
  visits: RecordedVisit[];
};
export type Command =
  | BullCommand
  | { type: 'visit'; visit: Visit }
  | { type: 'next-leg' }
  | { type: 'pause' | 'resume' | 'abandon' }
  | { type: 'concede'; player: number; sideId?: string };
export type Session = {
  version: 1 | 2 | 3 | 4 | 5;
  id?: string;
  imported?: { sourceId: string; importedAt: string };
  setup: Setup;
  commands: Command[];
};

export function createMatch(setup: Setup): Match {
  if (!setup) throw new Error('Choose match settings.');
  const sides = getSides(setup);
  const count = sides.length;
  const starter =
    setup.startingSideId !== undefined
      ? sides.findIndex((s) => s.id === setup.startingSideId)
      : (setup.starter ?? 0);
  if (setup.bot && (count !== 2 || sides.some((s) => s.members.length !== 1)))
    throw new Error('Practice opponents support two-player singles.');
  if (setup.startMethod === 'bull-off' && count !== 2)
    throw new Error(
      'Bull-off currently supports two sides. Choose a starter for multiplayer.',
    );
  if (!Number.isInteger(setup.start) || setup.start < 101 || setup.start > 1001)
    throw new Error('Choose a starting score between 101 and 1001.');
  if (
    (setup.inRule !== undefined &&
      !['straight', 'double'].includes(setup.inRule)) ||
    (setup.outRule !== undefined &&
      !['straight', 'double'].includes(setup.outRule))
  )
    throw new Error('Choose straight or double in/out.');
  if (
    setup.setsToWin !== undefined &&
    (!Number.isInteger(setup.setsToWin) ||
      setup.setsToWin < 1 ||
      setup.setsToWin > 11)
  )
    throw new Error('Choose between 1 and 11 sets to win.');
  if (
    setup.starterPolicy !== undefined &&
    !['alternate-legs', 'alternate-sets'].includes(setup.starterPolicy)
  )
    throw new Error('Choose a valid starting-player policy.');
  if (
    setup.startMethod !== undefined &&
    !['manual', 'bull-off'].includes(setup.startMethod)
  )
    throw new Error('Choose a valid starting method.');
  if (setup.startMethod === 'bull-off' && setup.bot)
    throw new Error(
      'Bull-off requires two local players; choose a starter for practice.',
    );
  if (setup.starterPolicy === 'alternate-sets' && !setup.setsToWin)
    throw new Error('Alternating set starters requires a sets match.');
  if (
    !Number.isInteger(setup.legsToWin) ||
    setup.legsToWin < 1 ||
    setup.legsToWin > 11
  )
    throw new Error('Choose between 1 and 11 legs to win.');
  if (
    setup.bot !== undefined &&
    !['rookie', 'regular', 'sharp', 'custom'].includes(setup.bot)
  )
    throw new Error('Choose a valid practice difficulty.');
  if (setup.botModel !== undefined && (setup.botModel !== 1 || !setup.bot))
    throw new Error(
      'Choose a supported practice model for a practice opponent.',
    );
  if (setup.bot === 'custom') checkedBotSettings(setup.botSettings!);
  else if (setup.botSettings !== undefined)
    throw new Error('Custom settings require a custom practice opponent.');
  if (
    setup.starter !== undefined &&
    (!Number.isInteger(setup.starter) ||
      setup.starter < 0 ||
      setup.starter >= count)
  )
    throw new Error('Choose who throws first.');
  if (!setup.sides && setup.playerIds !== undefined) {
    if (
      !Array.isArray(setup.playerIds) ||
      setup.playerIds.length !== 2 ||
      setup.playerIds.some(
        (id) => id !== null && (typeof id !== 'string' || !id.trim()),
      )
    )
      throw new Error('Choose valid saved players.');
    if (setup.playerIds[0] && setup.playerIds[0] === setup.playerIds[1])
      throw new Error('Choose a different player for each side.');
  }
  if (setup.bot && sides[1].members[0].profileId)
    throw new Error('A practice opponent cannot use a player profile.');
  return {
    setup: setup.sides
      ? rosterView(setup, sides)
      : { ...setup, players: setup.players.map((p) => p.trim()) },
    sides,
    memberCursor: sides.map(() => 0),
    withdrawn: sides.map(() => false),
    scores: sides.map(() => setup.start),
    legs: sides.map(() => 0),
    setLegs: sides.map(() => 0),
    sets: sides.map(() => 0),
    set: 1,
    setWinner: null,
    opened: sides.map(() => rulesFor(setup).inRule === 'straight'),
    turn: starter,
    legStarter: starter,
    setStarter: starter,
    leg: 1,
    legWinner: null,
    winner: null,
    status: 'active',
    bullOff:
      setup.startMethod === 'bull-off' ? createBullOff(starter as 0 | 1) : null,
    concededBy: null,
    visits: [],
  };
}

export function recordVisit(match: Match, visit: Visit): Match {
  if (bullPending(match))
    throw new Error('Finish the bull-off before recording match darts.');
  if (match.status !== 'active')
    throw new Error('Resume an active match before recording darts.');
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
  const rules = rulesFor(match.setup);
  const player = match.turn;
  const thrower = currentThrower(match);
  if (visit.participantId !== undefined && visit.participantId !== thrower.id)
    throw new Error('This visit belongs to a different thrower.');
  const simulated = !!match.setup.bot && player === 1;
  if (visit.source !== undefined) {
    if (!inputSources.includes(visit.source))
      throw new Error('Unknown visit input source.');
    if ((visit.source === 'simulated') !== simulated)
      throw new Error('The visit input source does not match the thrower.');
    if (visit.source === 'manual-segments' && visit.hits === undefined)
      throw new Error('Manual segment entry requires individual dart details.');
    if (visit.source === 'manual-total' && visit.hits !== undefined)
      throw new Error(
        'Manual total entry cannot claim individual dart details.',
      );
  }
  const origin: InputOrigin = simulated
    ? 'simulated'
    : (visit.source ?? 'legacy-unknown');
  const needsOpening = !match.opened[player];
  let opens = visit.opens ?? false;
  if (visit.opens !== undefined && typeof visit.opens !== 'boolean')
    throw new Error('Confirm whether the visit opened on a double.');
  if (visit.hits !== undefined) {
    const checked = evaluateDarts(match.scores[player], visit.hits, {
      ...rules,
      opened: match.opened[player],
    });
    if (
      checked.total !== visit.total ||
      checked.darts !== visit.darts ||
      checked.double !== visit.double ||
      (visit.opens !== undefined && visit.opens !== checked.opens)
    )
      throw new Error('Dart details do not match the visit score.');
    opens = checked.opens;
  } else if (needsOpening && visit.opens === undefined) {
    throw new Error(
      'Confirm whether you opened on a double, or enter individual darts.',
    );
  }
  const remaining = match.scores[player] - visit.total;
  const checkout =
    remaining === 0 &&
    (!needsOpening || opens) &&
    (rules.outRule === 'straight' || visit.double);
  if (visit.double && remaining !== 0)
    throw new Error('Only confirm a double for a finishing visit.');
  if (
    !possibleVisit(visit.total, visit.darts, needsOpening, opens, visit.double)
  )
    throw new Error(
      visit.double
        ? 'That finish cannot end on a double with the selected darts and opening rule.'
        : `That score is not possible with ${visit.darts} dart${visit.darts === 1 ? '' : 's'} and the opening rule.`,
    );
  const bust =
    remaining < 0 ||
    (rules.outRule === 'double' && remaining === 1) ||
    (remaining === 0 && !checkout);
  const scores: number[] = [...match.scores];
  const legs: number[] = [...match.legs];
  if (!bust) scores[player] = remaining;
  const setLegs: number[] = [...match.setLegs];
  const sets: number[] = [...match.sets];
  const opened: boolean[] = [...match.opened];
  if (!bust && opens) opened[player] = true;
  if (checkout) {
    legs[player]++;
    setLegs[player]++;
  }
  const setWinner =
    checkout &&
    match.setup.setsToWin &&
    setLegs[player] === match.setup.legsToWin
      ? player
      : null;
  if (setWinner !== null) sets[player]++;
  const winner =
    checkout &&
    (match.setup.setsToWin
      ? sets[player] === match.setup.setsToWin
      : legs[player] === match.setup.legsToWin)
      ? player
      : null;
  const memberCursor = [...match.memberCursor];
  memberCursor[player] =
    (memberCursor[player] + 1) % match.sides[player].members.length;
  return {
    ...match,
    memberCursor,
    scores,
    legs,
    setLegs,
    sets,
    opened,
    setWinner,
    turn: checkout
      ? player
      : nextEligible(match, (player + 1) % match.sides.length),
    legWinner: checkout ? player : null,
    winner,
    status: winner !== null ? 'completed' : 'active',
    visits: [
      ...match.visits,
      {
        ...visit,
        origin,
        ...(needsOpening ? { opens } : {}),
        player,
        sideId: match.sides[player].id,
        participantId: thrower.id,
        profileId: thrower.profileId,
        throwerName: thrower.name,
        leg: match.leg,
        set: match.set,
        openingRequired: needsOpening,
        bust,
        checkout,
      },
    ],
  };
}

export function nextLeg(match: Match): Match {
  if (bullPending(match))
    throw new Error('Finish the bull-off before starting a leg.');
  if (isTerminal(match)) throw new Error('The match is finished.');
  if (match.status !== 'active')
    throw new Error('Resume the match before starting the next leg.');
  if (match.legWinner === null) throw new Error('Finish this leg first.');
  const nextSet = match.setWinner !== null;
  const set = match.set + (nextSet ? 1 : 0);
  const setLegs: number[] = nextSet
    ? match.sides.map(() => 0)
    : [...match.setLegs];
  const setStarter =
    nextSet && match.setup.starterPolicy === 'alternate-sets'
      ? nextEligible(match, (match.setStarter + 1) % match.sides.length)
      : match.setStarter;
  const turn =
    nextSet && match.setup.starterPolicy === 'alternate-sets'
      ? setStarter
      : nextEligible(match, (match.legStarter + 1) % match.sides.length);
  return {
    ...match,
    set,
    legStarter: turn,
    setStarter,
    setLegs,
    setWinner: null,
    opened: match.sides.map(() => rulesFor(match.setup).inRule === 'straight'),
    memberCursor:
      match.setup.memberRotation === 'continue'
        ? [...match.memberCursor]
        : match.sides.map(() => 0),
    scores: match.sides.map(() => match.setup.start),
    leg: match.leg + 1,
    turn: nextEligible(match, turn),
    legWinner: null,
  };
}

export function replay(session: Session): Match {
  if (
    !session ||
    ![1, 2, 3, 4, 5].includes(session.version) ||
    !Array.isArray(session.commands) ||
    session.commands.length > 10000
  )
    throw new Error('Saved match is invalid.');
  if (
    session.version === 1 &&
    (![301, 501, 701].includes(session.setup?.start) ||
      session.setup?.inRule !== undefined ||
      session.setup?.outRule !== undefined ||
      session.setup?.setsToWin !== undefined ||
      session.setup?.starterPolicy !== undefined ||
      session.commands.some(
        (c) => c?.type === 'visit' && c.visit?.opens !== undefined,
      ))
  )
    throw new Error('New rule settings require saved-match version 2.');
  if (
    session.version < 3 &&
    session.commands.some((c) => c?.type !== 'visit' && c?.type !== 'next-leg')
  )
    throw new Error('Match lifecycle actions require saved-match version 3.');
  if (
    session.version < 4 &&
    (session.setup?.startMethod !== undefined ||
      session.commands.some((c) => c?.type?.startsWith('bull-')))
  )
    throw new Error(
      'Bull-off settings and actions require saved-match version 4.',
    );
  if (
    session.version < 5 &&
    (session.setup.sides !== undefined ||
      session.setup.format !== undefined ||
      session.setup.memberRotation !== undefined ||
      session.setup.startingSideId !== undefined ||
      session.commands.some(
        (c) =>
          (c?.type === 'visit' && c.visit?.participantId !== undefined) ||
          (c?.type === 'concede' && c.sideId !== undefined),
      ))
  )
    throw new Error('Participant rosters require saved-match version 5.');
  if (
    session.version < 5 &&
    session.commands.some(
      (c) => c?.type === 'visit' && c.visit?.source !== undefined,
    )
  )
    throw new Error('Visit input sources require saved-match version 5.');
  if (
    session.version < 5 &&
    (session.setup.bot === 'custom' ||
      session.setup.botSettings !== undefined ||
      session.setup.botModel !== undefined)
  )
    throw new Error('Custom practice settings require saved-match version 5.');
  if (session.version === 5 && !session.setup.sides)
    throw new Error('A v5 match requires a participant roster.');
  let match = createMatch(session.setup);
  const visits: RecordedVisit[] = [];
  for (const command of session.commands) {
    if (command?.type === 'visit') {
      if (
        session.version === 5 &&
        typeof command.visit?.participantId !== 'string'
      )
        throw new Error('Identify the thrower for this visit.');
      const next = recordVisit({ ...match, visits: [] }, command.visit);
      visits.push(next.visits[0]);
      match = { ...next, visits };
    } else if (command?.type === 'next-leg') match = nextLeg(match);
    else if (
      command?.type === 'bull-throw' ||
      command?.type === 'bull-closest' ||
      command?.type === 'bull-rethrow'
    ) {
      if (match.status !== 'active' || !match.bullOff)
        throw new Error(
          'An active bull-off is required before recording its darts.',
        );
      const bullOff = recordBull(match.bullOff, command);
      match = {
        ...match,
        bullOff,
        ...(bullOff.winner !== null
          ? {
              turn: bullOff.winner,
              legStarter: bullOff.winner,
              setStarter: bullOff.winner,
              setup: {
                ...match.setup,
                starter: bullOff.winner,
                ...(match.setup.sides
                  ? { startingSideId: match.sides[bullOff.winner].id }
                  : {}),
              },
            }
          : {}),
      };
    } else {
      if (
        session.version === 5 &&
        command?.type === 'concede' &&
        command.sideId !== match.sides[command.player]?.id
      )
        throw new Error('Identify the side conceding.');
      match = lifecycle(match, command);
    }
  }
  return match;
}

export function playerStats(match: Match, player: number) {
  return visitStatistics(match.visits.filter((v) => v.player === player));
}
export function participantStats(match: Match, participantId: string) {
  return visitStatistics(
    match.visits.filter((v) => v.participantId === participantId),
  );
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
export function checkoutRoute(
  score: number,
  dartsLeft = 3,
  outRule: 'straight' | 'double' = 'double',
  needsOpening = false,
): string[] | null {
  if (
    !Number.isInteger(score) ||
    score < (outRule === 'double' ? 2 : 1) ||
    score > 180 ||
    !Number.isInteger(dartsLeft) ||
    dartsLeft < 1 ||
    dartsLeft > 3
  )
    return null;
  const ends = outRule === 'double' ? finishes : setups;
  const starts = needsOpening ? finishes : setups;
  const direct = ends.find(
    (d) =>
      d.value === score &&
      (!needsOpening ||
        finishes.includes(d) ||
        d.label === 'Bull' ||
        d.label.startsWith('D')),
  );
  if (direct) return [direct.label];
  if (dartsLeft < 2) return null;
  for (const a of starts) {
    const end = ends.find((d) => a.value + d.value === score);
    if (end) return [a.label, end.label];
  }
  if (dartsLeft < 3) return null;
  for (const a of starts)
    for (const b of setups) {
      const end = ends.find((d) => a.value + b.value + d.value === score);
      if (end) return [a.label, b.label, end.label];
    }
  return null;
}

export function formatSummary(setup: Setup) {
  return setup.setsToWin
    ? `First to ${setup.setsToWin} ${setup.setsToWin === 1 ? 'set' : 'sets'} · First to ${setup.legsToWin} ${setup.legsToWin === 1 ? 'leg' : 'legs'} per set`
    : `First to ${setup.legsToWin} ${setup.legsToWin === 1 ? 'leg' : 'legs'}`;
}

export function isTerminal(match: Match) {
  return (
    match.status === 'completed' ||
    match.status === 'conceded' ||
    match.status === 'abandoned'
  );
}
export function lifecycle(match: Match, command: Command): Match {
  if (isTerminal(match))
    throw new Error(
      'The match is finished. Undo its final action to correct it.',
    );
  if (command?.type === 'pause') {
    if (match.status !== 'active')
      throw new Error('The match is already paused.');
    return { ...match, status: 'paused' };
  }
  if (command?.type === 'resume') {
    if (match.status !== 'paused') throw new Error('The match is not paused.');
    return { ...match, status: 'active' };
  }
  if (command?.type === 'abandon')
    return { ...match, status: 'abandoned', winner: null };
  if (command?.type === 'concede') {
    if (
      !Number.isInteger(command.player) ||
      command.player < 0 ||
      command.player >= match.sides.length ||
      match.withdrawn[command.player]
    )
      throw new Error('Choose which active side is conceding.');
    if (
      command.sideId !== undefined &&
      command.sideId !== match.sides[command.player].id
    )
      throw new Error('The conceding side does not match.');
    const withdrawn = [...match.withdrawn];
    withdrawn[command.player] = true;
    const remaining = withdrawn.flatMap((gone, i) => (gone ? [] : [i]));
    const next = { ...match, withdrawn, concededBy: command.player };
    return {
      ...next,
      ...(remaining.length === 1
        ? { status: 'conceded' as const, winner: remaining[0] }
        : { turn: nextEligible(next, match.turn) }),
    };
  }
  throw new Error('Saved match contains an unknown action.');
}
export function rematch(
  session: Session,
  id: string,
  starter: number,
): Session {
  if (!isTerminal(replay(session)))
    throw new Error('Finish or abandon this match before starting a rematch.');
  if (
    typeof id !== 'string' ||
    !id.trim() ||
    id === session.id ||
    id.length > 160
  )
    throw new Error('A rematch needs a new match identifier.');
  if (
    !Number.isInteger(starter) ||
    starter < 0 ||
    starter >= getSides(session.setup).length
  )
    throw new Error('Choose who starts the rematch.');
  return {
    version: 5,
    id,
    setup: createMatch(
      rosterView(
        {
          ...session.setup,
          startMethod: undefined,
          players: [...session.setup.players],
          ...(session.setup.playerIds
            ? { playerIds: [...session.setup.playerIds] }
            : {}),
          starter,
          startingSideId: getSides(session.setup)[starter].id,
        },
        getSides(session.setup),
      ),
    ).setup,
    commands: [],
  };
}

export function bullPending(match: Match) {
  return !!match.bullOff && match.bullOff.winner === null;
}

export function currentThrower(match: Match) {
  return match.sides[match.turn].members[match.memberCursor[match.turn]];
}
export function nextEligible(
  match: Pick<Match, 'withdrawn' | 'sides'>,
  start: number,
) {
  for (let offset = 0; offset < match.sides.length; offset++) {
    const side = (start + offset) % match.sides.length;
    if (!match.withdrawn[side]) return side;
  }
  throw new Error('No active side remains.');
}
export function bullNames(match: Match): [string, string] {
  return match.sides.map((s) =>
    s.members.length === 1 ? s.name : `${s.members[0].name} · ${s.name}`,
  ) as [string, string];
}
