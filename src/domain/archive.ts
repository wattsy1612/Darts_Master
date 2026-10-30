import { parseGameRecord, replayGame, gameRegistry } from './games/registry';
import type { GameRecord } from './games/registry';
import { gameIdOf } from './games/identity';
import { terminal } from './games/lifecycle';
import { metricsVersion } from './metrics';
import { replay, isTerminal } from './match';
import type { Session } from './match';

export type ArchivedMatch<R extends GameRecord = Session> = {
  session: R;
  completedAt: string;
};
export const archiveKey = 'darts-master.archive.v1';
export const archiveLimit = 100;
export function matchId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}
export function readArchive(raw: string | null): ArchivedMatch[] {
  if (!raw) return [];
  const data = JSON.parse(raw);
  if (data?.version !== 1 || !Array.isArray(data.matches))
    throw new Error('Invalid match archive.');
  return data.matches.slice(0, archiveLimit).map((entry: ArchivedMatch) => {
    if (
      typeof entry?.session?.id !== 'string' ||
      !entry.session.id ||
      !Number.isFinite(Date.parse(entry.completedAt)) ||
      !isTerminal(replay(entry.session))
    )
      throw new Error('Invalid archived match.');
    return entry;
  });
}
export function updateArchive(
  archive: ArchivedMatch[],
  session: Session,
  now = new Date().toISOString(),
): ArchivedMatch[] {
  if (!session.id) throw new Error('A saved match needs an identifier.');
  const others = archive.filter((entry) => entry.session.id !== session.id);
  // Undoing the winning visit removes the stale result from the archive.
  if (!isTerminal(replay(session))) return others;
  const previous = archive.find((entry) => entry.session.id === session.id);
  return [
    { session, completedAt: previous?.completedAt ?? now },
    ...others,
  ].slice(0, archiveLimit);
}
export function exportMatch(session: Session): string {
  const match = replay(session);
  return JSON.stringify(
    {
      format: 'darts-master-match',
      version: 1,
      exportedAt: new Date().toISOString(),
      session,
      result: {
        metricsVersion,
        players: match.setup.players,
        ...(session.version >= 3
          ? { status: match.status, concededBy: match.concededBy }
          : {}),
        legs: match.legs,
        ...(match.setup.setsToWin ? { sets: match.sets } : {}),
        winner:
          match.winner === null ? null : match.setup.players[match.winner],
      },
    },
    null,
    2,
  );
}

export function isX01Archive(
  entry: ArchivedMatch<GameRecord>,
): entry is ArchivedMatch<Session> {
  return entry.session.game !== 'cricket';
}
export function readGameArchive(
  raw: string | null,
): ArchivedMatch<GameRecord>[] {
  if (!raw) return [];
  const data = JSON.parse(raw);
  if (data?.version !== 1 || !Array.isArray(data.matches))
    throw new Error('Invalid match archive.');
  return data.matches
    .slice(0, archiveLimit)
    .map((entry: ArchivedMatch<GameRecord>) => {
      if (
        typeof entry?.session?.id !== 'string' ||
        !entry.session.id ||
        typeof entry.completedAt !== 'string' ||
        !Number.isFinite(Date.parse(entry.completedAt))
      )
        throw new Error('Invalid archived match.');
      const session = parseGameRecord(entry.session);
      if (!terminal(replayGame(session)))
        throw new Error('Invalid archived match.');
      return { session, completedAt: entry.completedAt };
    });
}
export function updateGameArchive(
  archive: ArchivedMatch<GameRecord>[],
  session: GameRecord,
  now = new Date().toISOString(),
): ArchivedMatch<GameRecord>[] {
  if (!session.id) throw new Error('A saved match needs an identifier.');
  const previous = archive.find((entry) => entry.session.id === session.id);
  if (previous && gameIdOf(previous.session) !== gameIdOf(session))
    throw new Error('Another game type already uses this match identifier.');
  const others = archive.filter((entry) => entry.session.id !== session.id);
  if (!terminal(replayGame(session))) return others;
  return [
    { session, completedAt: previous?.completedAt ?? now },
    ...others,
  ].slice(0, archiveLimit);
}
export function exportGameMatch(session: GameRecord): string {
  if (session.game !== 'cricket') return exportMatch(session);
  const match = gameRegistry.cricket.replay(session);
  return JSON.stringify(
    {
      format: 'darts-master-match',
      version: 2,
      exportedAt: new Date().toISOString(),
      session,
      result: {
        game: 'cricket',
        metricsVersion: gameRegistry.cricket.stats(match).metricsVersion,
        points: match.points,
        marks: match.marks,
        players: match.setup.players,
        status: match.status,
        legs: match.legs,
        winner: match.winner === null ? null : match.sides[match.winner].name,
      },
    },
    null,
    2,
  );
}
