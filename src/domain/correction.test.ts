import { describe, expect, it } from 'vitest';
import { previewCorrection } from './correction';
import type { Session, Visit } from './match';
import { rosterView, getSides, changeFormat } from './participants';
const total = (total: number, darts = 3, double = false): Visit => ({
  total,
  darts,
  double,
});
function saved(visits: Visit[], version: Session['version'] = 1): Session {
  const setup = {
    players: ['A', 'B'],
    start: 301,
    legsToWin: 1,
    playerIds: ['a', 'b'],
  };
  return {
    version,
    id: 'game',
    setup: version === 5 ? rosterView(setup, getSides(setup)) : setup,
    commands: visits.map((visit, i) => ({
      type: 'visit',
      visit: {
        ...visit,
        ...(version === 5
          ? { participantId: `participant-${(i % 2) + 1}-1` }
          : {}),
      },
    })),
  };
}
describe('reviewed local corrections', () => {
  it.each([1, 2, 3, 4] as const)(
    'preserves the v%s command schema without inventing old input origins',
    (version) => {
      const old = saved([total(60), total(60)], version);
      const result = previewCorrection(old, 0, total(100), 'keep-following');
      expect(result.session.version).toBe(version);
      expect(result.after.visits[0].origin).toBe('legacy-unknown');
      expect(result.session.commands[1]).toEqual(old.commands[1]);
    },
  );
  it('preserves actual pairs actors and profile ownership through a historical correction', () => {
    const session = saved([], 5);
    session.setup = changeFormat(session.setup, 'pairs');
    const ids = [
      session.setup.sides![0].members[0].id,
      session.setup.sides![1].members[0].id,
      session.setup.sides![0].members[1].id,
    ];
    session.commands = ids.map((participantId) => ({
      type: 'visit',
      visit: { ...total(60), participantId },
    }));
    const result = previewCorrection(session, 0, total(100), 'keep-following');
    expect(result.after.visits.map((v) => v.participantId)).toEqual(ids);
    expect(result.after.visits.map((v) => v.profileId)).toEqual(
      result.before.visits.map((v) => v.profileId),
    );
    expect(result.after.visits[2].throwerName).toBe(
      result.before.visits[2].throwerName,
    );
  });

  it('replays following totals, shows their changed score and leaves the source immutable', () => {
    const session = saved([total(60), total(60), total(60)]),
      before = JSON.stringify(session);
    const preview = previewCorrection(session, 0, total(100), 'keep-following');
    expect(preview.before.scores).toEqual([181, 241]);
    expect(preview.after.scores).toEqual([141, 241]);
    expect(preview.changedFollowingVisits).toBe(1);
    expect(preview.removedActions).toBe(0);
    expect(JSON.stringify(session)).toBe(before);
  });
  it('recomputes busts and profile-linked visits rather than preserving derived results', () => {
    const session = saved([total(60), total(60), total(180)], 5);
    const result = previewCorrection(session, 0, total(140), 'keep-following');
    expect(result.after.visits[2]).toMatchObject({
      bust: true,
      profileId: 'a',
      participantId: 'participant-1-1',
    });
    expect(result.after.scores).toEqual([161, 241]);
    expect(result.changedFollowingVisits).toBe(1);
  });
  it('protects a recorded leg transition unless following actions are explicitly removed', () => {
    const session = saved([total(180), total(0), total(121, 3, true)]);
    session.setup.legsToWin = 2;
    session.commands.push(
      { type: 'next-leg' },
      { type: 'visit', visit: total(60) },
    );
    expect(() =>
      previewCorrection(session, 2, total(120), 'keep-following'),
    ).toThrow(/following actions/);
    const result = previewCorrection(
      session,
      2,
      total(120),
      'discard-following',
    );
    expect(result.removedActions).toBe(2);
    expect(result.after.leg).toBe(1);
    expect(result.after.scores[0]).toBe(121); // bust: leaves one
    expect(result.after.legs).toEqual([0, 0]);
  });
  it('reopens a decided result without fabricating a winner or unplayed legs', () => {
    const result = previewCorrection(
      saved([total(180), total(0), total(121, 3, true)]),
      2,
      total(100),
      'keep-following',
    );
    expect(result.reopensResult).toBe(true);
    expect(result.after.status).toBe('active');
    expect(result.after.winner).toBeNull();
    expect(result.after.legs).toEqual([0, 0]);
  });
  it('clears only the edited segment evidence and labels new-schema correction as manual total', () => {
    const session = saved(
      [
        {
          ...total(60),
          hits: [
            { number: 20, multiplier: 1 },
            { number: 20, multiplier: 1 },
            { number: 20, multiplier: 1 },
          ],
        },
        total(26),
      ],
      5,
    );
    const result = previewCorrection(session, 0, total(100), 'keep-following');
    expect(result.removedSegmentDetails).toBe(true);
    expect(result.after.visits[0]).toMatchObject({
      source: 'manual-total',
      origin: 'manual-total',
    });
    expect(result.after.visits[0].hits).toBeUndefined();
    expect(result.session.commands[1]).toEqual(session.commands[1]);
  });
  it('rejects simulated-visit editing and unknown policies/indices', () => {
    const session = saved([total(60), total(60)]);
    session.setup.bot = 'regular';
    session.setup.playerIds = ['a', null];
    expect(() =>
      previewCorrection(session, 1, total(100), 'keep-following'),
    ).toThrow(/Simulated/);
    for (const index of [-1, 0.5, 99])
      expect(() =>
        previewCorrection(session, index, total(100), 'keep-following'),
      ).toThrow(/Choose/);
    expect(() =>
      previewCorrection(session, 0, total(100), 'invent' as never),
    ).toThrow(/following actions/);
  });
  it('requires legal opening/finishing declarations instead of inventing darts', () => {
    const session = saved([{ ...total(40), opens: true }], 5);
    session.setup.inRule = 'double';
    expect(() =>
      previewCorrection(session, 0, total(40), 'keep-following'),
    ).toThrow(/opening|opened/);
    expect(
      previewCorrection(
        session,
        0,
        { ...total(40), opens: true },
        'keep-following',
      ).after.opened[0],
    ).toBe(true);
    expect(() =>
      previewCorrection(
        session,
        0,
        { ...total(181), opens: true },
        'keep-following',
      ),
    ).toThrow();
  });
});
