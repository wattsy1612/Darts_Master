import { nextEligible } from '../participants';
import type { MatchSide } from '../participants';
export type MatchStatus =
  'active' | 'paused' | 'completed' | 'conceded' | 'abandoned';
export type LifecycleCommand =
  | { type: 'pause' | 'resume' | 'abandon' }
  | { type: 'concede'; player: number; sideId?: string };
export type LifecycleState = {
  status: MatchStatus;
  winner: number | null;
  turn: number;
  sides: MatchSide[];
  withdrawn: boolean[];
  concededBy: number | null;
};
export function terminal(state: Pick<LifecycleState, 'status'>) {
  return (
    state.status === 'completed' ||
    state.status === 'conceded' ||
    state.status === 'abandoned'
  );
}
export function applyLifecycle<T extends LifecycleState>(
  match: T,
  command: LifecycleCommand,
): T {
  if (terminal(match))
    throw new Error(
      'The match is finished. Undo its final action to correct it.',
    );
  if (command?.type === 'pause') {
    if (match.status !== 'active')
      throw new Error('The match is already paused.');
    return { ...match, status: 'paused' };
  }
  if (command?.type === 'resume') {
    if (match.status !== 'paused') throw new Error('The match is not paused.');
    return { ...match, status: 'active' };
  }
  if (command?.type === 'abandon')
    return { ...match, status: 'abandoned', winner: null };
  if (command?.type === 'concede') {
    if (
      !Number.isInteger(command.player) ||
      command.player < 0 ||
      command.player >= match.sides.length ||
      match.withdrawn[command.player]
    )
      throw new Error('Choose which active side is conceding.');
    if (
      command.sideId !== undefined &&
      command.sideId !== match.sides[command.player].id
    )
      throw new Error('The conceding side does not match.');
    const withdrawn = [...match.withdrawn];
    withdrawn[command.player] = true;
    const remaining = withdrawn.flatMap((gone, i) => (gone ? [] : [i]));
    const next = { ...match, withdrawn, concededBy: command.player };
    return {
      ...next,
      ...(remaining.length === 1
        ? { status: 'conceded' as const, winner: remaining[0] }
        : { turn: nextEligible(next, match.turn) }),
    };
  }
  throw new Error('Saved match contains an unknown action.');
}
