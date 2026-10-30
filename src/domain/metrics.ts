import type { RecordedVisit } from './match';

/** Definitions change only with an explicit new version; never with input device. */
export const metricsVersion = 'x01-recorded-v1' as const;
export const inputSources = [
  'manual-segments',
  'manual-total',
  'simulated',
] as const;
export type InputSource = (typeof inputSources)[number];
export type InputOrigin = InputSource | 'legacy-unknown';
export const inputSourceLabels: Record<InputOrigin, string> = {
  'manual-segments': 'Manual segments',
  'manual-total': 'Manual total',
  simulated: 'Simulated',
  'legacy-unknown': 'Origin not recorded',
};

export function dataCoverage(visits: RecordedVisit[]) {
  const origins: Record<InputOrigin, number> = {
    'manual-segments': 0,
    'manual-total': 0,
    simulated: 0,
    'legacy-unknown': 0,
  };
  let darts = 0,
    segmentedVisits = 0,
    segmentedDarts = 0;
  for (const visit of visits) {
    darts += visit.darts;
    origins[visit.origin]++;
    if (visit.hits) {
      segmentedVisits++;
      segmentedDarts += visit.darts;
    }
  }
  return {
    visits: visits.length,
    darts,
    segmentedVisits,
    segmentedDarts,
    totalOnlyVisits: visits.length - segmentedVisits,
    totalOnlyDarts: darts - segmentedDarts,
    origins,
    capabilities: {
      scoreMetrics: visits.length > 0,
      completeSegmentHistory:
        visits.length > 0 && segmentedVisits === visits.length,
      // Segments describe results, not intended targets or physical coordinates.
      checkoutAttemptRate: false,
      targetAccuracy: false,
      impactCoordinates: false,
      verifiedCompetitiveRecord: false,
    },
  };
}

export function visitStatistics(visits: RecordedVisit[]) {
  const darts = visits.reduce((n, v) => n + v.darts, 0);
  const scored = visits.reduce((n, v) => n + (v.bust ? 0 : v.total), 0);
  return {
    metricsVersion,
    average: darts ? ((scored / darts) * 3).toFixed(1) : '—',
    scored,
    darts,
    best: visits.reduce((n, v) => Math.max(n, v.bust ? 0 : v.total), 0),
    tons: visits.filter((v) => !v.bust && v.total >= 100 && v.total < 140)
      .length,
    ton40s: visits.filter((v) => !v.bust && v.total >= 140 && v.total < 180)
      .length,
    maximums: visits.filter((v) => !v.bust && v.total === 180).length,
    highestCheckout: visits.reduce(
      (n, v) => Math.max(n, v.checkout ? v.total : 0),
      0,
    ),
    coverage: dataCoverage(visits),
  };
}
