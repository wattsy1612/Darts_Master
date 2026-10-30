import { readPlayers } from '../domain/players';
import type { Player } from '../domain/players';
import { matchId, readArchive, updateArchive } from '../domain/archive';
import type { ArchivedMatch } from '../domain/archive';
import { createMatch, replay } from '../domain/match';
import type { Command, Session, Setup } from '../domain/match';

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

export function normaliseSession(value: unknown): Session {
  const input = value as Session;
  if (
    !input ||
    ![1, 2].includes(input.version) ||
    !Array.isArray(input.commands) ||
    input.commands.length > 10000
  )
    throw new Error('Unsupported or invalid saved match.');
  const settings = input.setup;
  if (!settings) throw new Error('Match settings are missing.');
  const setup: Setup = {
    players: settings.players,
    start: settings.start,
    legsToWin: settings.legsToWin,
  };
  if (settings.bot !== undefined) setup.bot = settings.bot;
  if (settings.starter !== undefined) setup.starter = settings.starter;
  if (settings.playerIds !== undefined) setup.playerIds = settings.playerIds;
  if (settings.inRule !== undefined) setup.inRule = settings.inRule;
  if (settings.outRule !== undefined) setup.outRule = settings.outRule;
  if (settings.setsToWin !== undefined) setup.setsToWin = settings.setsToWin;
  if (settings.starterPolicy !== undefined)
    setup.starterPolicy = settings.starterPolicy;
  const checked = createMatch(setup).setup;
  const commands: Command[] = input.commands.map((command) => {
    if (command?.type === 'next-leg') return { type: 'next-leg' };
    if (command?.type !== 'visit' || !command.visit)
      throw new Error('The match contains an unknown action.');
    const v = command.visit;
    if (
      v.hits !== undefined &&
      (!Array.isArray(v.hits) ||
        v.hits.some((hit) => !hit || typeof hit !== 'object'))
    )
      throw new Error('The dart details in this match are invalid.');
    return {
      type: 'visit',
      visit: {
        total: v.total,
        darts: v.darts,
        double: v.double,
        ...(v.opens !== undefined ? { opens: v.opens } : {}),
        ...(v.hits !== undefined
          ? {
              hits: v.hits.map((h) => ({
                number: h.number,
                multiplier: h.multiplier,
              })),
            }
          : {}),
      },
    };
  });
  if (
    input.id !== undefined &&
    (typeof input.id !== 'string' || !input.id.trim() || input.id.length > 160)
  )
    throw new Error('The match identifier is invalid.');
  const session: Session = {
    version: input.version,
    id: input.id,
    setup: checked,
    commands,
  };
  if (input.imported) {
    if (
      typeof input.imported.sourceId !== 'string' ||
      !Number.isFinite(Date.parse(input.imported.importedAt))
    )
      throw new Error('The imported match information is invalid.');
    session.imported = {
      sourceId: input.imported.sourceId,
      importedAt: input.imported.importedAt,
    };
  }
  replay(session);
  return session;
}
export function sessionContent(session: Session): string {
  const { playerIds: _, ...setup } = session.setup;
  return JSON.stringify({ setup, commands: session.commands });
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
