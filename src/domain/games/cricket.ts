import { dartValue } from '../darts';
import type { DartHit } from '../darts';
import { createBullOff, recordBull } from '../bullOff';
import type { BullCommand, BullOff } from '../bullOff';
import {
  currentThrower,
  getSides,
  nextEligible,
  rosterView,
} from '../participants';
import type { RosterSettings, MatchSide } from '../participants';
import { applyLifecycle, terminal } from './lifecycle';
import type { LifecycleCommand, LifecycleState } from './lifecycle';

export const cricketRulesVersion = 'cricket-standard-v1' as const;
export const cricketTargets = [20, 19, 18, 17, 16, 15, 25] as const;
export type CricketSetup = RosterSettings & {
  variant: 'standard';
  bull: 'split';
  legsToWin: number;
  startMethod?: 'manual' | 'bull-off';
};
export type CricketVisit = {
  participantId: string;
  source: 'manual-segments';
  hits: DartHit[];
};
export type CricketPass = {
  type: 'pass';
  participantId: string;
  source: 'manual-pass';
};
export type CricketCommand =
  | { type: 'visit'; visit: CricketVisit }
  | CricketPass
  | { type: 'next-leg' }
  | LifecycleCommand
  | BullCommand;
export type CricketSession = {
  game: 'cricket';
  version: 1;
  rulesVersion: typeof cricketRulesVersion;
  id: string;
  setup: CricketSetup;
  commands: CricketCommand[];
  imported?: { sourceId: string; importedAt: string };
};
export type CricketRecordedVisit = {
  player: number;
  sideId: string;
  participantId: string;
  profileId: string | null;
  throwerName: string;
  leg: number;
  hits: DartHit[];
  darts: number;
  marks: number;
  points: number;
  closedTargets: number[];
  legWon: boolean;
  passed: boolean;
  source: 'manual-segments' | 'manual-pass';
};
export type CricketMatch = LifecycleState & {
  setup: CricketSetup;
  sides: MatchSide[];
  memberCursor: number[];
  marks: number[][];
  points: number[];
  legs: number[];
  leg: number;
  legWinner: number | null;
  legStarter: number;
  bullOff: BullOff | null;
  visits: CricketRecordedVisit[];
};
const setupKeys = new Set([
  'players',
  'playerIds',
  'sides',
  'format',
  'starter',
  'startingSideId',
  'memberRotation',
  'variant',
  'bull',
  'legsToWin',
  'startMethod',
]);
export function createCricket(settings: CricketSetup): CricketMatch {
  if (!settings || Object.keys(settings).some((k) => !setupKeys.has(k)))
    throw new Error(
      'Unsupported Cricket setting. Use the standard split-bull rules contract.',
    );
  if (settings.variant !== 'standard' || settings.bull !== 'split')
    throw new Error('Cricket v1 requires standard scoring and split bull.');
  if (
    !Number.isInteger(settings.legsToWin) ||
    settings.legsToWin < 1 ||
    settings.legsToWin > 11
  )
    throw new Error('Choose between 1 and 11 legs to win.');
  const sides = getSides(settings);
  if (sides.length !== 2)
    throw new Error('Cricket v1 supports two sides: singles, pairs or teams.');
  if (
    settings.starter !== undefined &&
    (!Number.isInteger(settings.starter) ||
      settings.starter < 0 ||
      settings.starter >= 2)
  )
    throw new Error('Choose which side throws first.');
  if (
    settings.startMethod !== undefined &&
    settings.startMethod !== 'manual' &&
    settings.startMethod !== 'bull-off'
  )
    throw new Error('Choose a valid starting method.');
  const setup = rosterView(settings, sides),
    turn = setup.starter ?? 0;
  return {
    setup,
    sides,
    memberCursor: [0, 0],
    withdrawn: [false, false],
    marks: sides.map(() => cricketTargets.map(() => 0)),
    points: [0, 0],
    legs: [0, 0],
    leg: 1,
    legWinner: null,
    legStarter: turn,
    turn,
    bullOff:
      setup.startMethod === 'bull-off' ? createBullOff(turn as 0 | 1) : null,
    status: 'active',
    winner: null,
    concededBy: null,
    visits: [],
  };
}
function playable(match: CricketMatch) {
  if (match.status !== 'active')
    throw new Error('An active Cricket match is required.');
  if (match.bullOff && match.bullOff.winner === null)
    throw new Error('Finish the bull-off before recording Cricket darts.');
  if (match.legWinner !== null)
    throw new Error(
      'This Cricket leg is finished. Start the next leg or undo its winning visit.',
    );
}
function eligibleWinner(
  match: CricketMatch,
  marks: number[][],
  points: number[],
  player: number,
) {
  return (
    marks[player].every((m) => m === 3) &&
    points.every(
      (value, i) =>
        i === player || match.withdrawn[i] || points[player] >= value,
    )
  );
}
function finishVisit(
  match: CricketMatch,
  hits: DartHit[],
  marks: number[][],
  points: number[],
  usefulMarks: number,
  addedPoints: number,
  closedTargets: number[],
  won: boolean,
  passed: boolean,
): CricketMatch {
  const player = match.turn,
    actor = currentThrower(match),
    legs = [...match.legs],
    memberCursor = [...match.memberCursor];
  if (won) legs[player]++;
  memberCursor[player] =
    (memberCursor[player] + 1) % match.sides[player].members.length;
  const winner = won && legs[player] === match.setup.legsToWin ? player : null;
  return {
    ...match,
    marks,
    points,
    legs,
    memberCursor,
    legWinner: won ? player : null,
    winner,
    status: winner === null ? 'active' : 'completed',
    turn: won ? player : nextEligible(match, (player + 1) % match.sides.length),
    visits: [
      ...match.visits,
      {
        player,
        sideId: match.sides[player].id,
        participantId: actor.id,
        profileId: actor.profileId,
        throwerName: actor.name,
        leg: match.leg,
        hits,
        darts: hits.length,
        marks: usefulMarks,
        points: addedPoints,
        closedTargets,
        legWon: won,
        passed,
        source: passed ? 'manual-pass' : 'manual-segments',
      },
    ],
  };
}
export function recordCricketVisit(
  match: CricketMatch,
  visit: CricketVisit,
): CricketMatch {
  playable(match);
  if (!visit || visit.participantId !== currentThrower(match).id)
    throw new Error('Identify the actual Cricket thrower.');
  if (
    visit.source !== 'manual-segments' ||
    !Array.isArray(visit.hits) ||
    visit.hits.length < 1 ||
    visit.hits.length > 3
  )
    throw new Error(
      'Cricket needs one to three individual dart segments; use Pass for no darts.',
    );
  const hits = visit.hits.map((hit) => {
    dartValue(hit);
    return { number: hit.number, multiplier: hit.multiplier };
  });
  const marks = match.marks.map((row) => [...row]),
    points = [...match.points],
    player = match.turn,
    closedTargets: number[] = [];
  let useful = 0,
    addedPoints = 0,
    won = false;
  for (const hit of hits) {
    if (won)
      throw new Error(
        'The Cricket leg ended before this dart. Remove the extra dart.',
      );
    const target = cricketTargets.indexOf(
      hit.number as (typeof cricketTargets)[number],
    );
    if (target >= 0) {
      const closing = Math.min(3 - marks[player][target], hit.multiplier),
        excess = hit.multiplier - closing;
      const wasClosed = marks[player][target] === 3;
      marks[player][target] += closing;
      if (!wasClosed && marks[player][target] === 3)
        closedTargets.push(hit.number);
      const live = marks.some(
        (row, i) => i !== player && !match.withdrawn[i] && row[target] < 3,
      );
      useful += closing + (live ? excess : 0);
      const scored = live ? excess * hit.number : 0;
      points[player] += scored;
      addedPoints += scored;
    }
    won = eligibleWinner(match, marks, points, player);
  }
  return finishVisit(
    match,
    hits,
    marks,
    points,
    useful,
    addedPoints,
    closedTargets,
    won,
    false,
  );
}
export function passCricket(
  match: CricketMatch,
  command: CricketPass,
): CricketMatch {
  playable(match);
  if (
    command.participantId !== currentThrower(match).id ||
    command.source !== 'manual-pass'
  )
    throw new Error('Identify the player explicitly passing this turn.');
  return finishVisit(
    match,
    [],
    match.marks.map((r) => [...r]),
    [...match.points],
    0,
    0,
    [],
    false,
    true,
  );
}
export function nextCricketLeg(match: CricketMatch): CricketMatch {
  if (terminal(match) || match.status !== 'active' || match.legWinner === null)
    throw new Error('Finish an active Cricket leg before starting another.');
  const turn = nextEligible(match, (match.legStarter + 1) % match.sides.length);
  return {
    ...match,
    marks: match.sides.map(() => cricketTargets.map(() => 0)),
    points: [0, 0],
    leg: match.leg + 1,
    legWinner: null,
    legStarter: turn,
    turn,
    memberCursor:
      match.setup.memberRotation === 'continue'
        ? [...match.memberCursor]
        : match.sides.map(() => 0),
  };
}
export function replayCricket(session: CricketSession): CricketMatch {
  if (
    !session ||
    session.game !== 'cricket' ||
    session.version !== 1 ||
    session.rulesVersion !== cricketRulesVersion ||
    typeof session.id !== 'string' ||
    !session.id.trim() ||
    session.id.length > 160 ||
    !session.setup?.sides ||
    !Array.isArray(session.commands) ||
    session.commands.length > 10000
  )
    throw new Error('Unsupported or invalid Cricket session.');
  let match = createCricket(session.setup);
  const visits: CricketRecordedVisit[] = [];
  for (const command of session.commands) {
    if (command?.type === 'visit' || command?.type === 'pass') {
      const next =
        command.type === 'visit'
          ? recordCricketVisit({ ...match, visits: [] }, command.visit)
          : passCricket({ ...match, visits: [] }, command);
      visits.push(next.visits[0]);
      match = { ...next, visits };
    } else if (command?.type === 'next-leg') match = nextCricketLeg(match);
    else if (
      command?.type === 'bull-throw' ||
      command?.type === 'bull-closest' ||
      command?.type === 'bull-rethrow'
    ) {
      if (match.status !== 'active' || !match.bullOff)
        throw new Error('An active Cricket bull-off is required.');
      const bullOff = recordBull(match.bullOff, command);
      match = {
        ...match,
        bullOff,
        ...(bullOff.winner === null
          ? {}
          : {
              turn: bullOff.winner,
              legStarter: bullOff.winner,
              setup: {
                ...match.setup,
                starter: bullOff.winner,
                startingSideId: match.sides[bullOff.winner].id,
              },
            }),
      };
    } else if (
      command?.type === 'pause' ||
      command?.type === 'resume' ||
      command?.type === 'abandon' ||
      command?.type === 'concede'
    ) {
      if (
        command.type === 'concede' &&
        command.sideId !== match.sides[command.player]?.id
      )
        throw new Error('Identify the conceding Cricket side.');
      match = applyLifecycle(match, command);
    } else throw new Error('Cricket session contains an unknown action.');
  }
  return match;
}
export function cricketStats(match: CricketMatch, participantId?: string) {
  const visits = match.visits.filter(
      (v) => participantId === undefined || v.participantId === participantId,
    ),
    darts = visits.reduce((n, v) => n + v.darts, 0),
    marks = visits.reduce((n, v) => n + v.marks, 0);
  return {
    metricsVersion: 'cricket-recorded-v1' as const,
    darts,
    marks,
    points: visits.reduce((n, v) => n + v.points, 0),
    passes: visits.filter((v) => v.passed).length,
    marksPerThreeDarts: darts ? ((marks / darts) * 3).toFixed(2) : '—',
    impactCoordinates: false,
    verifiedCompetitiveRecord: false,
  };
}

/** Canonical domain record, without browser storage or UI dependencies. */
export function normaliseCricketSession(value: unknown): CricketSession {
  const input = value as CricketSession;
  replayCricket(input);
  const commands: CricketCommand[] = input.commands.map((command) => {
    if (command.type === 'visit')
      return {
        type: 'visit',
        visit: {
          participantId: command.visit.participantId,
          source: command.visit.source,
          hits: command.visit.hits.map((h) => ({
            number: h.number,
            multiplier: h.multiplier,
          })),
        },
      };
    if (command.type === 'pass')
      return {
        type: 'pass',
        participantId: command.participantId,
        source: command.source,
      };
    if (command.type === 'concede')
      return {
        type: 'concede',
        player: command.player,
        sideId: command.sideId,
      };
    if (command.type === 'bull-throw')
      return { type: 'bull-throw', player: command.player, hit: command.hit };
    if (command.type === 'bull-closest')
      return { type: 'bull-closest', winner: command.winner };
    if (command.type === 'bull-rethrow') return { type: 'bull-rethrow' };
    if (command.type === 'next-leg') return { type: 'next-leg' };
    return { type: command.type };
  });
  const output: CricketSession = {
    game: 'cricket',
    version: 1,
    rulesVersion: cricketRulesVersion,
    id: input.id,
    setup: createCricket(input.setup).setup,
    commands,
  };
  if (input.imported) {
    if (
      typeof input.imported.sourceId !== 'string' ||
      !input.imported.sourceId.trim() ||
      input.imported.sourceId.length > 160 ||
      typeof input.imported.importedAt !== 'string' ||
      !Number.isFinite(Date.parse(input.imported.importedAt))
    )
      throw new Error('Invalid Cricket import marker.');
    output.imported = {
      sourceId: input.imported.sourceId,
      importedAt: input.imported.importedAt,
    };
  }
  return output;
}

export function rematchCricket(
  session: CricketSession,
  id: string,
  starter: number,
): CricketSession {
  const match = replayCricket(session);
  if (!terminal(match))
    throw new Error('Finish or abandon this Cricket match before a rematch.');
  if (
    id === session.id ||
    typeof id !== 'string' ||
    !id.trim() ||
    id.length > 160
  )
    throw new Error('A Cricket rematch needs a new identifier.');
  if (
    !Number.isInteger(starter) ||
    starter < 0 ||
    starter >= match.sides.length
  )
    throw new Error('Choose who starts the Cricket rematch.');
  const setup = createCricket({
    ...match.setup,
    starter,
    startingSideId: match.sides[starter].id,
    startMethod: 'manual',
  }).setup;
  return {
    game: 'cricket',
    version: 1,
    rulesVersion: cricketRulesVersion,
    id,
    setup,
    commands: [],
  };
}
