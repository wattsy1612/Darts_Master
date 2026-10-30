import { checkedBotSettings } from './botSettings';
import { createMatch, replay } from './match';
import type { Command, Session, Setup } from './match';
import { gameIdOf } from './games/identity';
export function normaliseSession(value: unknown): Session {
  const input = value as Session;
  if (
    !input ||
    ![1, 2, 3, 4, 5].includes(input.version) ||
    !Array.isArray(input.commands) ||
    input.commands.length > 10000
  )
    throw new Error('Unsupported or invalid saved match.');
  if (gameIdOf(input) !== 'x01')
    throw new Error(
      'Cricket is not available in this scorer yet. No saved data was changed.',
    );
  const settings = input.setup;
  if (!settings) throw new Error('Match settings are missing.');
  const setup: Setup = {
    players: settings.players,
    start: settings.start,
    legsToWin: settings.legsToWin,
  };
  if (settings.bot !== undefined) setup.bot = settings.bot;
  if (settings.botModel !== undefined) setup.botModel = settings.botModel;
  if (settings.botSettings !== undefined)
    setup.botSettings = checkedBotSettings(settings.botSettings);
  if (settings.starter !== undefined) setup.starter = settings.starter;
  if (settings.playerIds !== undefined) setup.playerIds = settings.playerIds;
  if (settings.inRule !== undefined) setup.inRule = settings.inRule;
  if (settings.outRule !== undefined) setup.outRule = settings.outRule;
  if (settings.setsToWin !== undefined) setup.setsToWin = settings.setsToWin;
  if (settings.starterPolicy !== undefined)
    setup.starterPolicy = settings.starterPolicy;
  if (settings.startMethod !== undefined)
    setup.startMethod = settings.startMethod;
  if (settings.startingSideId !== undefined)
    setup.startingSideId = settings.startingSideId;
  if (settings.sides !== undefined) setup.sides = settings.sides;
  if (settings.format !== undefined) setup.format = settings.format;
  if (settings.memberRotation !== undefined)
    setup.memberRotation = settings.memberRotation;
  const checked = createMatch(setup).setup;
  const commands: Command[] = input.commands.map((command) => {
    if (command?.type === 'bull-throw')
      return { type: 'bull-throw', player: command.player, hit: command.hit };
    if (command?.type === 'bull-closest')
      return { type: 'bull-closest', winner: command.winner };
    if (command?.type === 'bull-rethrow') return { type: 'bull-rethrow' };
    if (command?.type === 'next-leg') return { type: 'next-leg' };
    if (
      command?.type === 'pause' ||
      command?.type === 'resume' ||
      command?.type === 'abandon'
    )
      return { type: command.type };
    if (command?.type === 'concede')
      return {
        type: 'concede',
        player: command.player,
        ...(command.sideId !== undefined ? { sideId: command.sideId } : {}),
      };
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
        ...(v.source !== undefined ? { source: v.source } : {}),
        ...(v.participantId !== undefined
          ? { participantId: v.participantId }
          : {}),
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
  if (input.game !== undefined) session.game = 'x01';
  if (input.rulesVersion !== undefined)
    session.rulesVersion = input.rulesVersion;
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
