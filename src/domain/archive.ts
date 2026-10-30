import { metricsVersion } from './metrics';
import { replay, isTerminal } from './match';
import type { Session } from './match';

export type ArchivedMatch = { session: Session; completedAt: string };
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
