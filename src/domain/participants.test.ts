import { describe, expect, it } from 'vitest';
import {
  getSides,
  rosterView,
  mapProfileLinks,
  changeFormat,
} from './participants';
import type { MatchFormat, MatchSide } from './participants';
import {
  createMatch,
  currentThrower,
  nextLeg,
  recordVisit,
  replay,
  rematch,
  bullNames,
} from './match';
import type { Setup, Session, Command } from './match';
import { normaliseSession, emptyData, sessionContent } from '../data/workspace';
import {
  backupText,
  inspectBackup,
  buildImportPlan,
  defaultOptions,
} from '../data/backup';
import { exportMatch, updateArchive } from './archive';
import { playerSummary } from './players';
import { openLocalRepository } from '../data/repository';
import { IDBFactory } from 'fake-indexeddb';
function settings(format: MatchFormat = 'pairs', sizes = [2, 2]): Setup {
  const sides: MatchSide[] = sizes.map((size, i) => ({
    id: `side-${i}`,
    name: `Team ${i + 1}`,
    members: Array.from({ length: size }, (_, j) => ({
      id: `member-${i}-${j}`,
      name: `${String.fromCharCode(65 + i)}${j + 1}`,
      profileId: `profile-${i}-${j}`,
    })),
  }));
  return rosterView(
    { players: [], start: 101, legsToWin: 1, outRule: 'straight' },
    sides,
    format,
  );
}
function visit(session: Session, total: number, darts = 3): Session {
  const member = currentThrower(replay(session));
  return {
    ...session,
    commands: [
      ...session.commands,
      {
        type: 'visit',
        visit: { total, darts, double: false, participantId: member.id },
      },
    ],
  };
}
const newSession = (setup = settings()): Session => ({
  version: 5,
  id: 'roster-match',
  setup,
  commands: [],
});
const win = () => visit(visit(visit(newSession(), 60), 0), 41);
describe('explicit participants and sides', () => {
  it.each([1, 2, 3, 4] as const)(
    'projects v%s two-player saves deterministically without changing stored data',
    (version) => {
      const legacy: Session = {
        version,
        id: 'legacy',
        setup: {
          players: ['Alice', 'Bob'],
          playerIds: ['a', 'b'],
          start: 301,
          legsToWin: 1,
        },
        commands: [
          { type: 'visit', visit: { total: 60, darts: 3, double: false } },
        ],
      };
      const copy = structuredClone(legacy),
        a = replay(legacy),
        b = replay(legacy);
      expect(a).toEqual(b);
      expect(legacy).toEqual(copy);
      expect(normaliseSession(legacy)).toEqual(legacy);
      expect(a.sides[0]).toMatchObject({
        id: 'side-1',
        members: [{ id: 'participant-1-1', name: 'Alice', profileId: 'a' }],
      });
      expect(a.visits[0]).toMatchObject({
        sideId: 'side-1',
        participantId: 'participant-1-1',
        profileId: 'a',
        throwerName: 'Alice',
      });
    },
  );
  it('rotates pairs by visits, including misses and busts, while sharing one side score', () => {
    let match = createMatch(settings());
    const names: string[] = [];
    for (const total of [60, 0, 60, 0, 20, 0]) {
      const member = currentThrower(match);
      names.push(member.name);
      match = recordVisit(match, {
        total,
        darts: 3,
        double: false,
        participantId: member.id,
      });
    }
    expect(names).toEqual(['A1', 'B1', 'A2', 'B2', 'A1', 'B1']);
    expect(match.visits[2].bust).toBe(true);
    expect(match.scores).toEqual([21, 101]);
    expect(match.visits.map((v) => v.participantId)).toEqual([
      'member-0-0',
      'member-1-0',
      'member-0-1',
      'member-1-1',
      'member-0-0',
      'member-1-0',
    ]);
  });
  it('supports unequal teams with independent member cursors and stable reordered identities', () => {
    const setup = settings('teams', [3, 2]);
    [setup.sides![0].members[0], setup.sides![0].members[2]] = [
      setup.sides![0].members[2],
      setup.sides![0].members[0],
    ];
    let match = createMatch(setup);
    const names = [];
    for (let i = 0; i < 10; i++) {
      names.push(currentThrower(match).name);
      match = recordVisit(match, { total: 0, darts: 3, double: false });
    }
    expect(names).toEqual([
      'A3',
      'B1',
      'A2',
      'B2',
      'A1',
      'B1',
      'A3',
      'B2',
      'A2',
      'B1',
    ]);
    expect(match.visits[0].profileId).toBe('profile-0-2');
  });
  it('resets member order each leg or continues it explicitly, including after checkout', () => {
    const ended = win(),
      match = replay(ended);
    expect(match).toMatchObject({
      winner: 0,
      legs: [1, 0],
      memberCursor: [0, 1],
    });
    const longer = { ...ended, setup: { ...ended.setup, legsToWin: 2 } };
    const before = replay(longer);
    const reset = nextLeg(before);
    expect(reset.turn).toBe(1);
    expect(currentThrower(reset).name).toBe('B1');
    const continued = nextLeg({
      ...before,
      setup: { ...before.setup, memberRotation: 'continue' },
    });
    expect(currentThrower(continued).name).toBe('B2');
    expect(before.memberCursor).toEqual([0, 1]);
  });
  it.each([3, 4, 8])(
    'rotates %s local players with separate scores and an explicit starter',
    (count) => {
      let match = createMatch({
        ...settings('multiplayer', Array(count).fill(1)),
        starter: count - 1,
        startingSideId: `side-${count - 1}`,
      });
      const order = [];
      for (let i = 0; i < count + 1; i++) {
        order.push(match.turn);
        match = recordVisit(match, { total: 0, darts: 3, double: false });
      }
      expect(order).toEqual([
        count - 1,
        ...Array.from({ length: count }, (_, i) => i),
      ]);
      expect(match.scores).toEqual(Array(count).fill(101));
    },
  );
  it('skips withdrawn players, preserves their played legs and rotates future starters among active sides', () => {
    let session = newSession({
      ...settings('multiplayer', [1, 1, 1]),
      legsToWin: 3,
    });
    session = {
      ...session,
      commands: [{ type: 'concede', player: 1, sideId: 'side-1' }],
    };
    let match = replay(session);
    expect(match).toMatchObject({
      withdrawn: [false, true, false],
      status: 'active',
      turn: 0,
      winner: null,
    });
    session = visit(session, 101);
    match = replay(session);
    expect(match.legs).toEqual([1, 0, 0]);
    match = nextLeg(match);
    expect(match.turn).toBe(2);
    match = recordVisit(match, { total: 101, darts: 3, double: false });
    expect(nextLeg(match).turn).toBe(0);
    session = {
      ...newSession(settings('multiplayer', [1, 1, 1])),
      commands: [
        { type: 'concede', player: 0, sideId: 'side-0' },
        { type: 'concede', player: 1, sideId: 'side-1' },
      ],
    };
    expect(replay(session)).toMatchObject({
      status: 'conceded',
      winner: 2,
      legs: [0, 0, 0],
      scores: [101, 101, 101],
    });
  });
  it('validates the actual thrower and withdrawing side before replay can attribute a result', () => {
    const base = newSession();
    expect(() =>
      replay({
        ...base,
        commands: [
          { type: 'visit', visit: { total: 60, darts: 3, double: false } },
        ],
      }),
    ).toThrow(/Identify the thrower/);
    expect(() =>
      replay({
        ...base,
        commands: [
          {
            type: 'visit',
            visit: {
              total: 60,
              darts: 3,
              double: false,
              participantId: 'member-0-1',
            },
          },
        ],
      }),
    ).toThrow(/different thrower/);
    expect(() =>
      replay({
        ...base,
        commands: [{ type: 'concede', player: 0, sideId: 'side-1' }],
      }),
    ).toThrow(/Identify the side/);
    expect(() => normaliseSession({ ...base, version: 4 })).toThrow(
      /version 5/,
    );
  });
  it('rejects duplicate member, side or profile identities and mismatched label mirrors', () => {
    for (const edit of [
      (s: Setup) => {
        s.sides![1].id = s.sides![0].id;
      },
      (s: Setup) => {
        s.sides![1].members[0].id = s.sides![0].members[0].id;
      },
      (s: Setup) => {
        s.sides![1].members[0].profileId = s.sides![0].members[0].profileId;
      },
      (s: Setup) => {
        s.players[0] = 'wrong';
      },
    ]) {
      const setup = settings();
      edit(setup);
      expect(() => createMatch(setup)).toThrow();
    }
    expect(() => createMatch({ ...settings('teams', [1, 2]) })).toThrow(
      /two to four/,
    );
    expect(() => createMatch({ ...settings('pairs', [3, 2]) })).toThrow(
      /exactly two/,
    );
    expect(() =>
      createMatch({ ...settings('multiplayer', Array(9).fill(1)) }),
    ).toThrow(/two and eight/);
  });
  it('keeps shared outcomes separate from each member’s actual darts and checkout', () => {
    const archive = updateArchive([], win());
    const first = playerSummary(archive, 'profile-0-0', false, 'team'),
      second = playerSummary(archive, 'profile-0-1', false, 'team');
    expect(first).toMatchObject({
      matches: 1,
      wins: 1,
      legsWon: 1,
      darts: 3,
      average: '60.0',
      highestCheckout: 0,
    });
    expect(second).toMatchObject({
      matches: 1,
      wins: 1,
      legsWon: 1,
      darts: 3,
      average: '41.0',
      highestCheckout: 41,
    });
    expect(playerSummary(archive, 'profile-1-1', false, 'team')).toMatchObject({
      matches: 1,
      losses: 1,
      darts: 0,
      average: '—',
    });
    expect(playerSummary(archive, 'profile-0-0', false)).toMatchObject({
      matches: 0,
    });
  });
  it('maps profile links across every roster member without changing command actors or duplicate identity', () => {
    const session = win(),
      profiles = session.setup.sides!.flatMap((s) =>
        s.members.map((m) => ({
          id: m.profileId!,
          name: m.name,
          createdAt: '2026-10-30T00:00:00Z',
        })),
      );
    const incoming = inspectBackup(
      backupText({
        ...emptyData(),
        archive: updateArchive([], session),
        players: profiles,
      }),
    );
    const local = {
      ...emptyData(),
      players: [
        { id: 'local-a', name: 'Renamed A', createdAt: '2026-10-29T00:00:00Z' },
      ],
    };
    const options = defaultOptions(local, incoming);
    options.profileLinks['profile-0-0'] = 'local-a';
    const plan = buildImportPlan(local, incoming, options);
    expect(plan.errors).toEqual([]);
    const linked = plan.data.archive[0].session;
    expect(linked.setup.sides![0].members[0].profileId).toBe('local-a');
    expect(linked.commands).toEqual(session.commands);
    expect(sessionContent(linked)).toBe(sessionContent(session));
    expect(
      buildImportPlan(plan.data, incoming, defaultOptions(plan.data, incoming))
        .duplicates,
    ).toBe(1);
    const single = inspectBackup(exportMatch(session)).data.archive[0].session;
    expect(
      single.setup.sides!.every((s) =>
        s.members.every((m) => m.profileId === null),
      ),
    ).toBe(true);
    expect(replay(single).visits.map((v) => v.participantId)).toEqual(
      replay(session).visits.map((v) => v.participantId),
    );
  });
  it('rejects an import preview that links two members to the same saved identity', () => {
    const session = win(),
      profiles = session.setup.sides!.flatMap((s) =>
        s.members.map((m) => ({
          id: m.profileId!,
          name: m.name,
          createdAt: '2026-10-30T00:00:00Z',
        })),
      );
    const incoming = inspectBackup(
      backupText({
        ...emptyData(),
        archive: updateArchive([], session),
        players: profiles,
      }),
    );
    const local = {
        ...emptyData(),
        players: [
          { id: 'same', name: 'Same', createdAt: '2026-10-29T00:00:00Z' },
        ],
      },
      options = defaultOptions(local, incoming);
    options.profileLinks['profile-0-0'] = 'same';
    options.profileLinks['profile-0-1'] = 'same';
    expect(
      buildImportPlan(local, incoming, options).errors.join(' '),
    ).toContain('different player');
  });
  it('saves and restores roster results transactionally without rewriting an older source', async () => {
    const repo = await openLocalRepository({
      factory: new IDBFactory(),
      storage: { getItem: () => null },
    });
    const session = win();
    await repo.saveMatch(session);
    expect(repo.document.data.archive).toHaveLength(1);
    expect(normaliseSession(repo.document.data.current)).toEqual(session);
    const next = rematch(session, 'rematch', 1);
    expect(next.version).toBe(5);
    expect(next.setup.sides).toEqual(session.setup.sides);
    expect(next.commands).toEqual([]);
    await repo.saveMatch(next);
    expect(repo.document.data.archive[0].session.id).toBe(session.id);
    expect(replay(next).memberCursor).toEqual([0, 0]);
  });
  it('uses the first listed team representative for a two-side bull-off without counting it as a visit', () => {
    const session = newSession({ ...settings(), startMethod: 'bull-off' });
    session.commands = [
      { type: 'bull-throw', player: 0, hit: 'outer' },
      { type: 'bull-throw', player: 1, hit: 'inner' },
    ];
    const match = replay(session);
    expect(bullNames(match)).toEqual(['A1 · Team 1', 'B1 · Team 2']);
    expect(currentThrower(match).name).toBe('B1');
    expect(match.visits).toEqual([]);
    expect(() =>
      createMatch({
        ...settings('multiplayer', [1, 1, 1]),
        startMethod: 'bull-off',
      }),
    ).toThrow(/two sides/);
    expect(() => createMatch({ ...settings(), bot: 'regular' })).toThrow(
      /two-player singles/,
    );
  });
  it('preserves IDs through format creation and profile remapping, with explicit guest links', () => {
    const setup = settings();
    const mapped = mapProfileLinks(setup, () => null);
    expect(mapped.sides![0].members[0].id).toBe(setup.sides![0].members[0].id);
    expect(
      mapped
        .sides!.flatMap((s) => s.members)
        .every((m) => m.profileId === null),
    ).toBe(true);
    const singles = changeFormat(setup, 'singles');
    expect(singles.sides![0].members[0].id).toBe(setup.sides![0].members[0].id);
    expect(getSides(singles)).toHaveLength(2);
  });
  it('preserves the chosen starting side when the roster is reordered', () => {
    const initial = settings('multiplayer', [1, 1, 1]);
    const chosen = rosterView(
      { ...initial, starter: 2, startingSideId: 'side-2' },
      initial.sides!,
    );
    const reordered = rosterView(chosen, [
      chosen.sides![2],
      chosen.sides![0],
      chosen.sides![1],
    ]);
    expect(reordered.starter).toBe(0);
    expect(reordered.startingSideId).toBe('side-2');
    expect(currentThrower(createMatch(reordered)).id).toBe('member-2-0');
    expect(() => createMatch({ ...reordered, starter: 1 })).toThrow(
      /Starting side/,
    );
  });
  it('retains the identifier generated by pre-roster imports of an unidentified legacy export', () => {
    // Frozen v0.11 fixture identifier: normalisation must not change an old import's source ID.
    const incoming = inspectBackup(
      JSON.stringify({
        format: 'darts-master-match',
        version: 1,
        session: {
          version: 1,
          setup: { players: ['A', 'B'], start: 301, legsToWin: 1 },
          commands: [],
        },
      }),
    );
    expect(incoming.data.current?.id).toBe('legacy-f3170864');
  });
  it('preserves valid legacy profile identifiers when creating a roster rematch', () => {
    const legacy: Session = {
      version: 4,
      id: 'long-profile',
      setup: {
        players: ['A', 'B'],
        playerIds: ['a'.repeat(300), 'b'],
        start: 301,
        legsToWin: 1,
      },
      commands: [{ type: 'concede', player: 0 }],
    };
    const next = rematch(legacy, 'new-profile', 1);
    expect(normaliseSession(next).setup.sides![0].members[0].profileId).toBe(
      'a'.repeat(300),
    );
  });
  it('opens double-in once for the whole side while attributing the next visit to its partner', () => {
    let match = createMatch({ ...settings(), inRule: 'double' });
    match = recordVisit(match, {
      total: 40,
      darts: 1,
      double: false,
      hits: [{ number: 20, multiplier: 2 }],
      participantId: currentThrower(match).id,
    });
    match = recordVisit(match, {
      total: 0,
      darts: 3,
      double: false,
      opens: false,
      participantId: currentThrower(match).id,
    });
    expect(currentThrower(match).name).toBe('A2');
    match = recordVisit(match, {
      total: 60,
      darts: 3,
      double: false,
      participantId: currentThrower(match).id,
    });
    expect(match.opened).toEqual([true, false]);
    expect(match.scores).toEqual([1, 101]);
    expect(match.visits[2]).toMatchObject({
      throwerName: 'A2',
      profileId: 'profile-0-1',
      total: 60,
      openingRequired: false,
    });
  });
});
