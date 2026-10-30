export type MatchFormat = 'singles' | 'multiplayer' | 'pairs' | 'teams';
export type Participant = {
  id: string;
  name: string;
  profileId: string | null;
};
export type MatchSide = { id: string; name: string; members: Participant[] };
export type RosterSettings = {
  players: string[];
  playerIds?: (string | null)[];
  sides?: MatchSide[];
  format?: MatchFormat;
  starter?: number;
  startingSideId?: string;
  memberRotation?: 'reset-each-leg' | 'continue';
};
const validId = (id: unknown): id is string =>
  typeof id === 'string' && !!id.trim() && id.length <= 160;
const name = (value: unknown) => {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 30)
    throw new Error('Enter player and side names up to 30 characters.');
  return value.trim();
};
export function getSides(setup: RosterSettings): MatchSide[] {
  if (setup.sides === undefined) {
    if (
      setup.format !== undefined ||
      setup.memberRotation !== undefined ||
      setup.startingSideId !== undefined
    )
      throw new Error('A configured player format requires a roster.');
    if (!Array.isArray(setup.players) || setup.players.length !== 2)
      throw new Error(
        'Legacy matches need two players. Use a roster for other formats.',
      );
    return setup.players.map((n, i) => ({
      id: `side-${i + 1}`,
      name: name(n),
      members: [
        {
          id: `participant-${i + 1}-1`,
          name: name(n),
          profileId: setup.playerIds?.[i] ?? null,
        },
      ],
    }));
  }
  if (
    !Array.isArray(setup.sides) ||
    setup.sides.length < 2 ||
    setup.sides.length > 8
  )
    throw new Error('Choose between two and eight sides.');
  const format = setup.format;
  if (!['singles', 'multiplayer', 'pairs', 'teams'].includes(format!))
    throw new Error('Choose a supported match format.');
  if (format !== 'multiplayer' && setup.sides.length !== 2)
    throw new Error('Singles, pairs and teams use two sides.');
  if (format === 'multiplayer' && setup.sides.length < 3)
    throw new Error('Multiplayer needs three to eight players.');
  const sideIds = new Set<string>(),
    memberIds = new Set<string>(),
    profiles = new Set<string>();
  const sides = setup.sides.map((side) => {
    if (!side || !validId(side.id) || sideIds.has(side.id))
      throw new Error('Each side needs a unique identifier.');
    sideIds.add(side.id);
    if (
      !Array.isArray(side.members) ||
      side.members.length < 1 ||
      side.members.length > 4
    )
      throw new Error('A side needs one to four players.');
    if (
      (format === 'singles' || format === 'multiplayer') &&
      side.members.length !== 1
    )
      throw new Error('Singles and multiplayer use one player per side.');
    if (format === 'pairs' && side.members.length !== 2)
      throw new Error('Pairs need exactly two players per side.');
    if (format === 'teams' && side.members.length < 2)
      throw new Error('Teams need two to four players per side.');
    const members = side.members.map((member) => {
      if (!member || !validId(member.id) || memberIds.has(member.id))
        throw new Error('Each thrower needs a unique identifier.');
      memberIds.add(member.id);
      if (
        member.profileId !== null &&
        (typeof member.profileId !== 'string' || !member.profileId.trim())
      )
        throw new Error('Choose a valid saved player.');
      if (member.profileId && profiles.has(member.profileId))
        throw new Error('Choose a different player for each roster position.');
      if (member.profileId) profiles.add(member.profileId);
      return {
        id: member.id,
        name: name(member.name),
        profileId: member.profileId,
      };
    });
    const checkedName = name(side.name);
    if (members.length === 1 && checkedName !== members[0].name)
      throw new Error('A single-player side must use its player name.');
    return { id: side.id, name: checkedName, members };
  });
  if (
    !Array.isArray(setup.players) ||
    setup.players.length !== sides.length ||
    setup.players.some((n, i) => name(n) !== sides[i].name)
  )
    throw new Error('Side labels do not match the roster.');
  if (
    setup.playerIds !== undefined &&
    (sides.some((s) => s.members.length !== 1) ||
      setup.playerIds.length !== sides.length ||
      setup.playerIds.some((id, i) => id !== sides[i].members[0].profileId))
  )
    throw new Error('Player links do not match the roster.');
  if (
    setup.memberRotation !== undefined &&
    !['reset-each-leg', 'continue'].includes(setup.memberRotation)
  )
    throw new Error('Choose a valid member rotation.');
  if (setup.startingSideId !== undefined) {
    const index = sides.findIndex((s) => s.id === setup.startingSideId);
    if (index < 0 || (setup.starter !== undefined && setup.starter !== index))
      throw new Error('Starting side does not match the roster order.');
  }
  return sides;
}
export function rosterView<T extends RosterSettings>(
  setup: T,
  sides: MatchSide[],
  format: MatchFormat = setup.format ?? 'singles',
): T {
  const clean = sides.map((s) => ({
    ...s,
    members: s.members.map((m) => ({ ...m })),
  }));
  const chosen = clean.some((s) => s.id === setup.startingSideId)
    ? setup.startingSideId!
    : (clean[setup.starter ?? 0]?.id ?? clean[0].id);
  return {
    ...setup,
    format,
    startingSideId: chosen,
    starter: clean.findIndex((s) => s.id === chosen),
    players: clean.map((s) =>
      s.members.length === 1 ? s.members[0].name : s.name,
    ),
    playerIds: clean.every((s) => s.members.length === 1)
      ? clean.map((s) => s.members[0].profileId)
      : undefined,
    // A singleton side's display name follows its member, never a second identity.
    ...{
      sides: clean.map((s) => ({
        ...s,
        name: s.members.length === 1 ? s.members[0].name : s.name,
      })),
    },
  };
}
export function withRoster<T extends RosterSettings>(setup: T): T {
  return rosterView(setup, getSides(setup));
}
export function rosterFormat(setup: RosterSettings): MatchFormat {
  return setup.format ?? 'singles';
}
export function changeFormat<T extends RosterSettings>(
  setup: T,
  format: MatchFormat,
): T {
  const old = setup.sides ?? getSides(setup),
    count = format === 'multiplayer' ? Math.max(3, old.length) : 2,
    size = format === 'pairs' ? 2 : format === 'teams' ? 3 : 1;
  const sides = Array.from({ length: count }, (_, i) => {
    const previous = old[i];
    return {
      id: previous?.id ?? freshRosterId(),
      name:
        size === 1
          ? (previous?.members[0]?.name ?? `Player ${i + 1}`)
          : previous && previous.members.length > 1
            ? previous.name
            : `Side ${i + 1}`,
      members: Array.from(
        { length: size },
        (_, j) =>
          previous?.members[j] ?? {
            id: freshRosterId(),
            name: `Player ${i * size + j + 1}`,
            profileId: null,
          },
      ),
    };
  });
  return rosterView(setup, sides, format);
}
export function mapProfileLinks<T extends RosterSettings>(
  setup: T,
  map: (id: string | null) => string | null,
): T {
  if (!setup.sides)
    return {
      ...setup,
      ...(setup.playerIds ? { playerIds: setup.playerIds.map(map) } : {}),
    };
  return rosterView(
    setup,
    setup.sides.map((s) => ({
      ...s,
      members: s.members.map((m) => ({ ...m, profileId: map(m.profileId) })),
    })),
  );
}

export function freshRosterId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `roster-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}
