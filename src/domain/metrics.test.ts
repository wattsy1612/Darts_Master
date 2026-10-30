import { describe, expect, it } from 'vitest';
import { createMatch, recordVisit, replay, playerStats } from './match';
import type { Session, Visit, Setup } from './match';
import { dataCoverage, metricsVersion } from './metrics';
import { rosterView, getSides } from './participants';
import { normaliseSession, emptyData, sessionContent } from '../data/workspace';
import {
  backupText,
  buildImportPlan,
  defaultOptions,
  inspectBackup,
} from '../data/backup';
import { exportMatch } from './archive';
import { playerSummary } from './players';

const settings: Setup = {
  players: ['Alice', 'Bob'],
  start: 101,
  legsToWin: 1,
  playerIds: ['alice', 'bob'],
};
function session(visits: Visit[] = []): Session {
  const setup = rosterView(settings, getSides(settings));
  return {
    version: 5,
    id: 'evidence',
    setup,
    commands: visits.map((visit, i) => ({
      type: 'visit',
      visit: { participantId: setup.sides![i % 2].members[0].id, ...visit },
    })),
  };
}
const total: Visit = {
  total: 60,
  darts: 3,
  double: false,
  source: 'manual-total',
};
const segments: Visit = {
  ...total,
  source: 'manual-segments',
  hits: [
    { number: 20, multiplier: 1 },
    { number: 20, multiplier: 1 },
    { number: 20, multiplier: 1 },
  ],
};

describe('versioned scoring evidence', () => {
  it('reports no sample instead of treating an empty history as complete or verified', () => {
    const coverage = dataCoverage([]);
    expect(coverage).toMatchObject({
      visits: 0,
      darts: 0,
      segmentedDarts: 0,
      capabilities: {
        scoreMetrics: false,
        completeSegmentHistory: false,
        checkoutAttemptRate: false,
        targetAccuracy: false,
        impactCoordinates: false,
        verifiedCompetitiveRecord: false,
      },
    });
    expect(playerStats(createMatch(settings), 0)).toMatchObject({
      metricsVersion,
      average: '—',
      scored: 0,
    });
  });
  it('separates sample coverage from input labels and never reconstructs missing dart segments', () => {
    const match = replay(session([segments, total]));
    expect(dataCoverage(match.visits)).toMatchObject({
      visits: 2,
      darts: 6,
      segmentedVisits: 1,
      segmentedDarts: 3,
      totalOnlyVisits: 1,
      totalOnlyDarts: 3,
      origins: {
        'manual-segments': 1,
        'manual-total': 1,
        simulated: 0,
        'legacy-unknown': 0,
      },
      capabilities: { scoreMetrics: true, completeSegmentHistory: false },
    });
    expect(match.visits[1].hits).toBeUndefined();
    expect(dataCoverage([match.visits[0]]).capabilities).toMatchObject({
      completeSegmentHistory: true,
      checkoutAttemptRate: false,
      targetAccuracy: false,
      impactCoordinates: false,
      verifiedCompetitiveRecord: false,
    });
  });
  it.each([1, 2, 3, 4] as const)(
    'projects v%s origin honestly and leaves original events untouched',
    (version) => {
      const old: Session = {
        version,
        setup: { ...settings, start: 301 },
        commands: [
          { type: 'visit', visit: { ...segments, source: undefined } },
        ],
      };
      const before = JSON.stringify(old);
      const match = replay(old);
      expect(match.visits[0].origin).toBe('legacy-unknown');
      expect(dataCoverage(match.visits)).toMatchObject({
        segmentedDarts: 3,
        origins: { 'legacy-unknown': 1 },
      });
      expect(JSON.stringify(old)).toBe(before);
    },
  );
  it('keeps early v5 events unknown while new labels survive canonicalisation', () => {
    const old = session([{ ...total, source: undefined }]);
    expect(replay(normaliseSession(old)).visits[0].origin).toBe(
      'legacy-unknown',
    );
    const fresh = session([segments]);
    expect(normaliseSession(fresh)).toEqual(fresh);
    expect(replay(fresh).visits[0].origin).toBe('manual-segments');
    expect(sessionContent(fresh)).not.toBe(
      sessionContent(session([{ ...segments, source: undefined }])),
    );
  });
  it.each([
    { ...total, source: 'camera' },
    { ...total, source: 'verified' },
    { ...total, source: null },
    { ...total, source: { source: 'manual-total' } },
    { ...total, source: 'manual-segments' },
    { ...segments, source: 'manual-total' },
    { ...segments, source: 'simulated' },
  ])('rejects invalid or contradictory source evidence: $source', (bad) => {
    const invalid = session([bad as Visit]);
    expect(() => replay(invalid)).toThrow(/source|details/);
    expect(() => normaliseSession(invalid)).toThrow(/source|details/);
    expect(() =>
      inspectBackup(
        JSON.stringify({
          format: 'darts-master-match',
          version: 1,
          session: invalid,
        }),
      ),
    ).toThrow();
  });
  it('does not let older schemas silently adopt input-source semantics', () => {
    const old: Session = {
      version: 4,
      setup: settings,
      commands: [{ type: 'visit', visit: total }],
    };
    expect(() => normaliseSession(old)).toThrow(/version 5/);
  });
  it('identifies legacy bot turns from the actual match role and rejects human-labelled bot scores', () => {
    const old: Session = {
      version: 1,
      setup: {
        ...settings,
        start: 301,
        bot: 'regular',
        playerIds: ['alice', null],
      },
      commands: [
        { type: 'visit', visit: { ...total, source: undefined } },
        { type: 'visit', visit: { ...segments, source: undefined } },
      ],
    };
    expect(replay(old).visits.map((v) => v.origin)).toEqual([
      'legacy-unknown',
      'simulated',
    ]);
    const fresh = session([total, { ...segments, source: 'simulated' }]);
    fresh.setup.bot = 'regular';
    fresh.setup = rosterView(
      fresh.setup,
      fresh.setup.sides!.map((s, i) => ({
        ...s,
        members: s.members.map((m) => ({
          ...m,
          profileId: i ? null : m.profileId,
        })),
      })),
    );
    expect(replay(fresh).visits[1].origin).toBe('simulated');
    const bad = structuredClone(fresh);
    if (bad.commands[1].type === 'visit')
      bad.commands[1].visit.source = 'manual-segments';
    expect(() => replay(bad)).toThrow(/thrower/);
  });
  it('uses credited points and recorded darts for bust, double-in and early finish samples', () => {
    let match = createMatch({ ...settings, inRule: 'double' });
    match = recordVisit(match, {
      total: 0,
      darts: 3,
      double: false,
      opens: false,
      source: 'manual-total',
    });
    match = recordVisit(match, {
      total: 0,
      darts: 3,
      double: false,
      opens: false,
    });
    match = recordVisit(match, {
      total: 100,
      darts: 3,
      double: false,
      opens: true,
      source: 'manual-total',
    }); // leave 1: bust, still closed
    match = recordVisit(match, {
      total: 0,
      darts: 3,
      double: false,
      opens: false,
    });
    expect(match.opened[0]).toBe(false);
    match = recordVisit(match, {
      total: 101,
      darts: 3,
      double: true,
      opens: true,
      source: 'manual-segments',
      hits: [
        { number: 20, multiplier: 2 },
        { number: 19, multiplier: 3 },
        { number: 2, multiplier: 2 },
      ],
    });
    expect(playerStats(match, 0)).toMatchObject({
      scored: 101,
      darts: 9,
      average: '33.7',
      best: 101,
      tons: 1,
      maximums: 0,
      highestCheckout: 101,
    });
  });
  it('weights by actual darts across decided results and counts rule/import samples once', () => {
    const a = session([
      { total: 101, darts: 3, double: true, source: 'manual-total' },
    ]);
    const b = session([
      { total: 60, darts: 3, double: false, source: 'manual-total' },
      { total: 0, darts: 3, double: false, source: 'manual-total' },
      { total: 41, darts: 2, double: false, source: 'manual-total' },
    ]);
    b.id = 'other';
    b.setup.outRule = 'straight';
    b.imported = { sourceId: 'external', importedAt: '2026-10-30T12:00:00Z' };
    const archive = [a, b, b].map((session) => ({
      session,
      completedAt: '2026-10-30T12:00:00Z',
    }));
    const stats = playerSummary(archive, 'alice', false);
    expect(stats).toMatchObject({
      metricsVersion,
      matches: 2,
      scored: 202,
      darts: 8,
      average: '75.8',
      ruleVariants: 2,
      importedMatches: 1,
      coverage: { visits: 3, darts: 8, totalOnlyVisits: 3 },
    });
    expect(stats.average).not.toBe(((101 + 60.6) / 2).toFixed(1));
  });
  it('derives evidence after replay and ignores forged verification or origin fields', () => {
    const forged = JSON.parse(JSON.stringify(session([segments])));
    forged.verified = true;
    forged.commands[0].visit.origin = 'verified-camera';
    forged.commands[0].visit.verified = true;
    forged.commands[0].visit.coordinates = { x: 0, y: 0 };
    const checked = normaliseSession(forged);
    const match = replay(checked);
    expect(match.visits[0].origin).toBe('manual-segments');
    expect(dataCoverage(match.visits).capabilities).toMatchObject({
      impactCoordinates: false,
      verifiedCompetitiveRecord: false,
    });
    const exported = JSON.parse(exportMatch(checked));
    expect(exported.result.metricsVersion).toBe(metricsVersion);
    expect(exported.session.verified).toBeUndefined();
    expect(exported.session.commands[0].visit.coordinates).toBeUndefined();
  });
  it('retains labels and coverage through backup review, import, export and normalisation without upgrading trust', () => {
    const recorded = session([segments, total]);
    const incoming = inspectBackup(
      backupText({ ...emptyData(), current: recorded }),
    );
    const plan = buildImportPlan(emptyData(), incoming, {
      ...defaultOptions(emptyData(), incoming),
      resumeCurrent: true,
    });
    expect(plan.errors).toEqual([]);
    const imported = plan.data.current!;
    expect(imported.imported).toBeDefined();
    const restored = normaliseSession(
      JSON.parse(exportMatch(imported)).session,
    );
    expect(dataCoverage(replay(restored).visits)).toEqual(
      dataCoverage(replay(recorded).visits),
    );
    expect(
      dataCoverage(replay(restored).visits).capabilities
        .verifiedCompetitiveRecord,
    ).toBe(false);
  });
});
