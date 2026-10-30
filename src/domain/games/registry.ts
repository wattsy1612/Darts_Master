import { createMatch, replay, rematch, participantStats } from '../match';
import type { Session, Setup, Match } from '../match';
import { normaliseSession } from '../session';
import {
  createCricket,
  replayCricket,
  normaliseCricketSession,
  cricketRulesVersion,
  cricketStats,
  rematchCricket,
} from './cricket';
import type { CricketSession, CricketSetup, CricketMatch } from './cricket';
import { gameIdOf, x01RulesVersion } from './identity';
import type { GameId } from './identity';
import type { MatchFormat } from '../participants';
import { visitStatistics } from '../metrics';

export type GameCapabilities = {
  formats: readonly MatchFormat[];
  minSides: number;
  maxSides: number;
  segmentEntry: boolean;
  totalEntry: boolean;
  passTurn: boolean;
  bots: boolean;
  legs: boolean;
  sets: boolean;
  bullOff: boolean;
  historicalTotalCorrection: boolean;
};
export interface GamePlugin<Settings, State, Record, Statistics> {
  id: GameId;
  label: string;
  rulesVersion: string;
  recordVersions: readonly number[];
  playable: boolean;
  capabilities: GameCapabilities;
  create: (settings: Settings) => State;
  replay: (record: Record) => State;
  normalise: (input: unknown) => Record;
  rematch: (record: Record, id: string, starter: number) => Record;
  stats: (state: State, participantId?: string) => Statistics;
}
/** Capabilities are positive support contracts, not inferred from available UI widgets. */
export const gameRegistry = {
  x01: {
    id: 'x01',
    label: 'X01',
    rulesVersion: x01RulesVersion,
    recordVersions: [1, 2, 3, 4, 5],
    playable: true,
    capabilities: {
      formats: ['singles', 'multiplayer', 'pairs', 'teams'],
      minSides: 2,
      maxSides: 8,
      segmentEntry: true,
      totalEntry: true,
      passTurn: false,
      bots: true,
      legs: true,
      sets: true,
      bullOff: true,
      historicalTotalCorrection: true,
    },
    rematch,
    create: createMatch,
    replay,
    normalise: normaliseSession,
    stats: (match: Match, participantId?: string) =>
      participantId === undefined
        ? visitStatistics(match.visits)
        : participantStats(match, participantId),
  } satisfies GamePlugin<
    Setup,
    Match,
    Session,
    ReturnType<typeof visitStatistics>
  >,
  cricket: {
    id: 'cricket',
    label: 'Standard Cricket',
    rulesVersion: cricketRulesVersion,
    recordVersions: [1],
    playable: false,
    capabilities: {
      formats: ['singles', 'pairs', 'teams'],
      minSides: 2,
      maxSides: 2,
      segmentEntry: true,
      totalEntry: false,
      passTurn: true,
      bots: false,
      legs: true,
      sets: false,
      bullOff: true,
      historicalTotalCorrection: false,
    },
    rematch: rematchCricket,
    create: createCricket,
    replay: replayCricket,
    normalise: normaliseCricketSession,
    stats: cricketStats,
  } satisfies GamePlugin<
    CricketSetup,
    CricketMatch,
    CricketSession,
    ReturnType<typeof cricketStats>
  >,
} as const;
export type GameRecord = Session | CricketSession;
export function parseGameRecord(value: unknown): GameRecord {
  return gameIdOf(value) === 'cricket'
    ? normaliseCricketSession(value)
    : normaliseSession(value);
}
export function replayGame(record: GameRecord) {
  return record.game === 'cricket' ? replayCricket(record) : replay(record);
}
export function playableGames() {
  return Object.values(gameRegistry).filter((game) => game.playable);
}
