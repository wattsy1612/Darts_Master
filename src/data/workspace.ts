import { parseGameRecord, replayGame } from '../domain/games/registry';
import type { GameRecord } from '../domain/games/registry';
import { terminal } from '../domain/games/lifecycle';
import { gameContent } from '../domain/games/content';
import { readPlayers } from '../domain/players';
import type { Player } from '../domain/players';
import {
  matchId,
  readArchive,
  updateArchive,
  readGameArchive,
} from '../domain/archive';
import type { ArchivedMatch } from '../domain/archive';
import type { Session } from '../domain/match';
import { normaliseSession } from '../domain/session';
export { normaliseSession } from '../domain/session';

export const databaseName = 'darts-master-local';
export const objectStoreName = 'workspace';
export const workspaceKey = 'current';
export const recoveryKey = 'before-import';
export const legacySessionKey = 'darts-master.match.v1';
export type WorkspaceData<R extends GameRecord = GameRecord> = {
  current: R | null;
  archive: ArchivedMatch<R>[];
  players: Player[];
  profileImports: { sourceId: string; createdAt: string; localId: string }[];
};
export type WorkspaceDocument<R extends GameRecord = GameRecord> = {
  version: 3;
  revision: number;
  data: WorkspaceData<R>;
};
export type LegacyErrors = {
  current?: string;
  archive?: string;
  players?: string;
};
export const emptyData = <
  R extends GameRecord = Session,
>(): WorkspaceData<R> => ({
  current: null,
  archive: [],
  players: [],
  profileImports: [],
});

export const sessionContent = gameContent;
export function validateData(value: unknown): WorkspaceData {
  const input = value as WorkspaceData;
  if (
    !input ||
    !Array.isArray(input.players) ||
    !Array.isArray(input.archive) ||
    input.archive.length > 100
  )
    throw new Error('The saved workspace is invalid or exceeds its limits.');
  const players = readPlayers(
    JSON.stringify({ version: 1, players: input.players }),
  );
  const archive = readGameArchive(
    JSON.stringify({ version: 1, matches: input.archive }),
  );
  const ids = new Set<string>();
  for (const entry of archive) {
    if (ids.has(entry.session.id!))
      throw new Error('The backup contains duplicate match identifiers.');
    ids.add(entry.session.id!);
  }
  const current =
    input.current === null ? null : parseGameRecord(input.current);
  if (current && !current.id)
    throw new Error('The current match needs an identifier.');
  const same = current
    ? archive.find((entry) => entry.session.id === current.id)
    : undefined;
  if (
    current &&
    same &&
    (!terminal(replayGame(current)) ||
      gameContent(current) !== gameContent(same.session))
  )
    throw new Error(
      'The current match conflicts with a saved result in this backup. No data was changed.',
    );
  const profileImports = input.profileImports ?? [];
  if (
    !Array.isArray(profileImports) ||
    profileImports.length > 1000 ||
    profileImports.some(
      (p) =>
        !p ||
        typeof p.sourceId !== 'string' ||
        typeof p.localId !== 'string' ||
        typeof p.createdAt !== 'string',
    )
  )
    throw new Error('The saved profile import links are invalid.');
  return {
    current,
    archive,
    players,
    profileImports: profileImports.map((p) => ({ ...p })),
  };
}
export function validateDocument(value: unknown): WorkspaceDocument {
  const input = value as {
    version: number;
    revision: number;
    data: WorkspaceData;
  };
  if (!input || ![2, 3].includes(input.version))
    throw new Error(
      'This saved workspace is unreadable or uses a newer version. No data has been overwritten.',
    );
  if (!Number.isSafeInteger(input.revision) || input.revision < 0)
    throw new Error('The saved workspace revision is invalid.');
  const data = validateData(input.data);
  if (
    input.version === 2 &&
    (data.current?.game === 'cricket' ||
      data.archive.some((e) => e.session.game === 'cricket'))
  )
    throw new Error('Workspace version 2 cannot contain non-X01 games.');
  return { version: 3, revision: input.revision, data };
}
export function readLegacy(storage: Pick<Storage, 'getItem'>) {
  const data = emptyData(),
    errors: LegacyErrors = {},
    raw: Record<string, string | null> = {};
  const keys = {
    current: legacySessionKey,
    archive: 'darts-master.archive.v1',
    players: 'darts-master.players.v1',
  } as const;
  for (const part of Object.keys(keys) as (keyof typeof keys)[]) {
    try {
      const text = storage.getItem(keys[part]);
      raw[keys[part]] = text;
      if (!text) continue;
      if (part === 'current') {
        data.current = normaliseSession(JSON.parse(text));
        data.current.id ??= matchId();
      }
      if (part === 'archive') data.archive = readArchive(text);
      if (part === 'players') data.players = readPlayers(text);
    } catch {
      errors[part] =
        part === 'players'
          ? 'Saved players could not be loaded. Their data is preserved until you choose to reset it.'
          : part === 'archive'
            ? 'Your match archive could not be loaded. Existing archive data will be kept until you choose to reset it.'
            : 'Your saved match could not be loaded. You can export a recovery copy before resetting it.';
    }
  }
  if (!Object.keys(errors).length && data.current)
    data.archive = updateArchive(data.archive, data.current);
  return { data, errors, raw, hasData: Object.values(raw).some(Boolean) };
}
