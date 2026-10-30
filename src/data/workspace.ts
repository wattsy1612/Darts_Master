import { readPlayers } from '../domain/players';
import type { Player } from '../domain/players';
import { matchId, readArchive, updateArchive } from '../domain/archive';
import type { ArchivedMatch } from '../domain/archive';
import type { Session } from '../domain/match';
import { normaliseSession } from '../domain/session';
export { normaliseSession } from '../domain/session';

export const databaseName = 'darts-master-local';
export const objectStoreName = 'workspace';
export const workspaceKey = 'current';
export const recoveryKey = 'before-import';
export const legacySessionKey = 'darts-master.match.v1';
export type WorkspaceData = {
  current: Session | null;
  archive: ArchivedMatch[];
  players: Player[];
  profileImports: { sourceId: string; createdAt: string; localId: string }[];
};
export type WorkspaceDocument = {
  version: 2;
  revision: number;
  data: WorkspaceData;
};
export type LegacyErrors = {
  current?: string;
  archive?: string;
  players?: string;
};
export const emptyData = (): WorkspaceData => ({
  current: null,
  archive: [],
  players: [],
  profileImports: [],
});

export function sessionContent(session: Session): string {
  const { playerIds: _, ...setup } = session.setup;
  return JSON.stringify(
    stableContent({
      setup: {
        ...setup,
        ...(setup.sides
          ? {
              sides: setup.sides.map((s) => ({
                ...s,
                members: s.members.map(({ profileId: _, ...member }) => member),
              })),
            }
          : {}),
      },
      commands: session.commands,
    }),
  );
}
function stableContent(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableContent);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([key, v]) => [key, stableContent(v)]),
    );
  return value;
}
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
  const archive = readArchive(
    JSON.stringify({ version: 1, matches: input.archive }),
  ).map((entry) => ({ ...entry, session: normaliseSession(entry.session) }));
  const ids = new Set<string>();
  for (const entry of archive) {
    if (ids.has(entry.session.id!))
      throw new Error('The backup contains duplicate match identifiers.');
    ids.add(entry.session.id!);
  }
  const current =
    input.current === null ? null : normaliseSession(input.current);
  if (current && !current.id)
    throw new Error('The current match needs an identifier.');
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
  const input = value as WorkspaceDocument;
  if (!input || input.version !== 2)
    throw new Error(
      'This saved workspace is unreadable or uses a newer version. No data has been overwritten.',
    );
  if (!Number.isSafeInteger(input.revision) || input.revision < 0)
    throw new Error('The saved workspace revision is invalid.');
  return {
    version: 2,
    revision: input.revision,
    data: validateData(input.data),
  };
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
