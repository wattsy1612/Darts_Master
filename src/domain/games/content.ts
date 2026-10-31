import type { GameRecord } from './registry';
/** Profile links do not establish identity equality; game identity always does. */
export function gameContent(session: GameRecord): string {
  const { playerIds: _, ...setup } = session.setup;
  return JSON.stringify(
    stableContent({
      ...(session.game === 'cricket'
        ? { game: session.game, rulesVersion: session.rulesVersion }
        : {}),
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
        .map(([k, v]) => [k, stableContent(v)]),
    );
  return value;
}
