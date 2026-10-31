import type { GameRecord } from './registry';
import type { Session } from '../match';
export const x01RulesVersion = 'x01-configured-v1' as const;
export type GameId = 'x01' | 'cricket';
/** Untagged historical documents are X01; explicit unknown games never fall back. */
export function gameIdOf(value: unknown): GameId {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Saved game is invalid.');
  const game = (value as { game?: unknown }).game;
  if (game === undefined || game === 'x01') return 'x01';
  if (game === 'cricket') return 'cricket';
  throw new Error('This saved game type is not supported.');
}

export function requireX01Session(record: GameRecord): Session {
  if (record.game === 'cricket')
    throw new Error('This operation requires an X01 session.');
  return record;
}
