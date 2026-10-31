import { isTerminal, replay } from './match';
import type { Session, Visit, Match } from './match';
export type CorrectionPolicy = 'keep-following' | 'discard-following';
export type CorrectionInput = Pick<
  Visit,
  'total' | 'darts' | 'double' | 'opens'
>;
export function previewCorrection(
  session: Session,
  commandIndex: number,
  input: CorrectionInput,
  policy: CorrectionPolicy,
) {
  if (
    !session.id ||
    !Number.isInteger(commandIndex) ||
    commandIndex < 0 ||
    commandIndex >= session.commands.length ||
    session.commands[commandIndex]?.type !== 'visit'
  )
    throw new Error('Choose a recorded visit to correct.');
  if (policy !== 'keep-following' && policy !== 'discard-following')
    throw new Error('Choose how to handle following actions.');
  const before = replay(session);
  const prefix = replay({
    ...session,
    commands: session.commands.slice(0, commandIndex),
  });
  if (prefix.setup.bot && prefix.turn === 1)
    throw new Error(
      'Simulated visits cannot be manually rewritten. Correct a human visit or undo the simulation from the scorer.',
    );
  const actor =
    prefix.sides[prefix.turn].members[prefix.memberCursor[prefix.turn]];
  const visit: Visit = {
    total: input.total,
    darts: input.darts,
    double: input.double,
    ...(input.opens !== undefined ? { opens: input.opens } : {}),
    ...(session.version === 5
      ? { participantId: actor.id, source: 'manual-total' }
      : {}),
  };
  const commands = [
    ...session.commands.slice(0, commandIndex),
    { type: 'visit' as const, visit },
    ...(policy === 'keep-following'
      ? session.commands.slice(commandIndex + 1)
      : []),
  ];
  const corrected: Session = { ...session, commands };
  let after;
  try {
    after = replay(corrected);
  } catch (error) {
    throw new Error(
      `${policy === 'keep-following' ? 'The following actions cannot be replayed with this edit. Review removing them, or adjust the corrected visit. ' : ''}${error instanceof Error ? error.message : 'Invalid correction.'}`,
    );
  }
  if (policy === 'keep-following') {
    for (let i = 0; i < after.visits.length; i++) {
      const old = before.visits[i],
        next = after.visits[i];
      if (
        !old ||
        old.participantId !== next.participantId ||
        old.sideId !== next.sideId ||
        old.leg !== next.leg ||
        old.set !== next.set
      )
        throw new Error(
          'This edit changes the thrower or leg of a following visit. Review removing following actions instead.',
        );
    }
  }
  function scoreEnds(match: Match) {
    let leg = -1,
      scores = match.sides.map(() => match.setup.start);
    return match.visits.map((v) => {
      if (v.leg !== leg) {
        leg = v.leg;
        scores = match.sides.map(() => match.setup.start);
      }
      if (!v.bust) scores[v.player] -= v.total;
      return scores[v.player];
    });
  }
  const oldEnds = scoreEnds(before),
    newEnds = scoreEnds(after);
  const visitIndex = session.commands
    .slice(0, commandIndex)
    .filter((c) => c.type === 'visit').length;
  return {
    session: corrected,
    before,
    after,
    visitIndex,
    removedActions: session.commands.length - commands.length,
    followingActions: session.commands.length - commandIndex - 1,
    changedFollowingVisits:
      policy === 'keep-following'
        ? after.visits.slice(visitIndex + 1).filter((v, i) => {
            const old = before.visits[visitIndex + 1 + i];
            return (
              newEnds[visitIndex + 1 + i] !== oldEnds[visitIndex + 1 + i] ||
              v.bust !== old.bust ||
              v.checkout !== old.checkout ||
              v.openingRequired !== old.openingRequired
            );
          }).length
        : 0,
    reopensResult: isTerminal(before) && !isTerminal(after),
    removedSegmentDetails: before.visits[visitIndex].hits !== undefined,
  };
}
