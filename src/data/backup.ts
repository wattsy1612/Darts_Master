import { matchId } from '../domain/archive';
import { readPlayers } from '../domain/players';
import { replay, isTerminal } from '../domain/match';
import type { Session } from '../domain/match';
import type { ArchivedMatch } from '../domain/archive';
import type { WorkspaceData } from './workspace';
import { normaliseSession, sessionContent, validateData } from './workspace';

export const maxBackupBytes = 20 * 1024 * 1024;
export type IncomingBackup = {
  createdAt: string;
  data: WorkspaceData;
  notes: string[];
};
export type ImportOptions = {
  profileLinks: Record<string, string>;
  matches: Record<string, 'import' | 'skip' | 'copy'>;
  resumeCurrent: boolean;
};
export type ImportPlan = {
  data: WorkspaceData;
  addedMatches: number;
  addedPlayers: number;
  duplicates: number;
  notes: string[];
  errors: string[];
  replacesCurrent: boolean;
};
function legacyId(session: Session): string {
  let hash = 2166136261;
  for (const c of sessionContent(session))
    hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
  return `legacy-${(hash >>> 0).toString(16)}`;
}
function sessionWithId(input: unknown): Session {
  const session = normaliseSession(input);
  session.id ??= legacyId(session);
  return session;
}
export function backupText(data: WorkspaceData, notes: string[] = []): string {
  const checked = validateData(data);
  return JSON.stringify(
    {
      format: 'darts-master-backup',
      version: 1,
      createdAt: new Date().toISOString(),
      notes,
      workspace: {
        current: checked.current,
        archive: checked.archive,
        players: checked.players,
      },
    },
    null,
    2,
  );
}
export function inspectBackup(text: string): IncomingBackup {
  if (new TextEncoder().encode(text).byteLength > maxBackupBytes)
    throw new Error('Choose a backup smaller than 20 MB.');
  let input: Record<string, unknown>;
  try {
    input = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON. No saved data was changed.');
  }
  if (!input || typeof input !== 'object' || input.version !== 1)
    throw new Error(
      'This file uses an unsupported backup version. No saved data was changed.',
    );
  const now = new Date().toISOString();
  if (input.format === 'darts-master-match') {
    const current = sessionWithId(input.session);
    // A stand-alone match file does not establish ownership of saved profiles.
    current.setup = { ...current.setup, playerIds: undefined };
    const completed = isTerminal(replay(current));
    return {
      createdAt: now,
      data: {
        current: completed ? null : current,
        archive: completed ? [{ session: current, completedAt: now }] : [],
        players: [],
        profileImports: [],
      },
      notes: [
        'Individual match export: players are imported as guests. The original completion date is not available.',
      ],
    };
  }
  if (input.format !== 'darts-master-backup')
    throw new Error('Choose a Darts Master backup or match export.');
  const source = input.workspace as WorkspaceData;
  if (
    !source ||
    !Array.isArray(source.players) ||
    !Array.isArray(source.archive) ||
    source.archive.length > 100
  )
    throw new Error('This backup has an invalid player or match list.');
  const current =
    source.current === null ? null : sessionWithId(source.current);
  const archive = source.archive.map((entry) => {
    if (!entry || typeof entry !== 'object')
      throw new Error('This backup contains an invalid saved result.');
    return { ...entry, session: sessionWithId(entry.session) };
  });
  const data = validateData({
    current,
    archive,
    players: readPlayers(
      JSON.stringify({ version: 1, players: source.players }),
    ),
    profileImports: [],
  });
  if (current) {
    const same = data.archive.find((entry) => entry.session.id === current.id);
    if (
      same &&
      (!isTerminal(replay(current)) ||
        sessionContent(same.session) !== sessionContent(current))
    )
      throw new Error(
        'The current match conflicts with a saved result in this backup. No data was changed.',
      );
  }
  if (
    current &&
    isTerminal(replay(current)) &&
    !archive.some((entry) => entry.session.id === current.id)
  )
    data.archive.unshift({ session: current, completedAt: now });

  return {
    createdAt:
      typeof input.createdAt === 'string' &&
      Number.isFinite(Date.parse(input.createdAt))
        ? input.createdAt
        : now,
    data,
    notes: Array.isArray(input.notes)
      ? input.notes
          .filter((note): note is string => typeof note === 'string')
          .slice(0, 20)
          .map((note) => note.slice(0, 500))
      : [],
  };
}
export function defaultOptions(
  local: WorkspaceData,
  incoming: IncomingBackup,
): ImportOptions {
  const profileLinks: Record<string, string> = Object.create(null);
  for (const profile of incoming.data.players) {
    const linked = local.profileImports.find(
      (link) =>
        link.sourceId === profile.id && link.createdAt === profile.createdAt,
    );
    const existing = linked
      ? local.players.find((p) => p.id === linked.localId)
      : local.players.find(
          (p) => p.id === profile.id && p.createdAt === profile.createdAt,
        );
    profileLinks[profile.id] = existing?.id ?? 'new';
  }
  const matches: ImportOptions['matches'] = Object.create(null);
  for (const entry of incoming.data.archive)
    matches[entry.session.id!] = local.archive.some(
      (old) =>
        old.session.id === entry.session.id &&
        sessionContent(old.session) !== sessionContent(entry.session),
    )
      ? 'skip'
      : 'import';
  return { profileLinks, matches, resumeCurrent: false };
}
function uniqueName(name: string, used: Set<string>) {
  if (!used.has(name.toLowerCase())) return name;
  for (let i = 1; i <= 100; i++) {
    const suffix = i === 1 ? ' (imported)' : ` (imported ${i})`;
    const candidate = name.slice(0, 30 - suffix.length) + suffix;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
  throw new Error(
    'Too many players have the same name. Choose a profile link instead.',
  );
}
export function buildImportPlan(
  local: WorkspaceData,
  incoming: IncomingBackup,
  options: ImportOptions,
): ImportPlan {
  const data: WorkspaceData = structuredClone(local),
    notes = [...incoming.notes],
    errors: string[] = [];
  let addedMatches = 0,
    addedPlayers = 0,
    duplicates = 0;
  const map = new Map<string, string | null>();
  const names = new Set(data.players.map((p) => p.name.toLowerCase()));
  for (const profile of incoming.data.players) {
    const link = options.profileLinks[profile.id] ?? 'new';
    if (link === 'skip') {
      map.set(profile.id, null);
      continue;
    }
    if (link !== 'new') {
      const existing = data.players.find((p) => p.id === link);
      if (!existing) {
        errors.push(`Choose an available player for ${profile.name}.`);
        continue;
      }
      map.set(profile.id, existing.id);
      if (existing.name !== profile.name)
        notes.push(
          `${profile.name} links to ${existing.name}; the saved player name is kept.`,
        );
    } else {
      const id = data.players.some((p) => p.id === profile.id)
        ? matchId()
        : profile.id;
      const name = uniqueName(profile.name, names);
      names.add(name.toLowerCase());
      if (name !== profile.name)
        notes.push(
          `${profile.name} is imported separately as ${name}; names alone do not link identities.`,
        );
      data.players.push({ ...profile, id, name });
      map.set(profile.id, id);
      addedPlayers++;
    }
    data.profileImports = data.profileImports.filter(
      (old) =>
        !(old.sourceId === profile.id && old.createdAt === profile.createdAt),
    );
    data.profileImports.push({
      sourceId: profile.id,
      createdAt: profile.createdAt,
      localId: map.get(profile.id)!,
    });
  }
  function linkedSession(session: Session): Session {
    const ids = session.setup.playerIds?.map((id) =>
      id ? (map.get(id) ?? null) : null,
    ) as [string | null, string | null] | undefined;
    return {
      ...structuredClone(session),
      setup: {
        ...structuredClone(session.setup),
        ...(ids ? { playerIds: ids } : {}),
      },
      imported: { sourceId: session.id!, importedAt: new Date().toISOString() },
    };
  }
  for (const entry of incoming.data.archive) {
    const mode = options.matches[entry.session.id!] ?? 'skip';
    if (mode === 'skip') continue;
    const content = sessionContent(entry.session);
    if (
      data.archive.some(
        (old) =>
          (old.session.id === entry.session.id ||
            old.session.imported?.sourceId === entry.session.id) &&
          sessionContent(old.session) === content,
      )
    ) {
      duplicates++;
      continue;
    }
    const collision = data.archive.find(
      (old) => old.session.id === entry.session.id,
    );
    if (collision && mode !== 'copy') {
      errors.push(
        `A different result already uses match ID ${entry.session.id}. Skip it or import a separate copy.`,
      );
      continue;
    }
    const session = linkedSession(entry.session);
    if (collision) session.id = matchId();
    data.archive.unshift({ ...entry, session });
    addedMatches++;
  }
  let replacesCurrent = false;
  if (
    options.resumeCurrent &&
    incoming.data.current &&
    !isTerminal(replay(incoming.data.current))
  ) {
    const candidate = incoming.data.current;
    if (
      data.current &&
      sessionContent(data.current) === sessionContent(candidate) &&
      data.current.id === candidate.id
    ) {
      notes.push('The current match already matches this backup.');
    } else {
      replacesCurrent = !!data.current?.commands.length;
      data.current = { ...linkedSession(candidate), id: matchId() };
      if (replacesCurrent)
        notes.push(
          'Restoring this match replaces the game currently open on this device.',
        );
    }
  }
  if (data.players.length > 100)
    errors.push(
      `This would create ${data.players.length} players. Link or skip profiles to stay within 100.`,
    );
  if (data.archive.length > 100)
    errors.push(
      `This would save ${data.archive.length} matches. Select fewer to stay within 100; import never silently removes existing results.`,
    );
  if (data.profileImports.length > 1000)
    errors.push(
      'Too many saved import links. Export your data before requesting a storage migration.',
    );
  return {
    data,
    addedMatches,
    addedPlayers,
    duplicates,
    notes,
    errors,
    replacesCurrent,
  };
}
