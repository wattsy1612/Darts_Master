import { inputSourceLabels, metricsVersion } from './domain/metrics';
import type { dataCoverage } from './domain/metrics';

export default function ScoreEvidence({
  coverage,
  importedMatches = 0,
  ruleVariants,
}: {
  coverage: ReturnType<typeof dataCoverage>;
  importedMatches?: number;
  ruleVariants?: number;
}) {
  return (
    <details className="score-evidence">
      <summary>Score data and definitions</summary>
      <p>
        {coverage.visits} recorded visits · {coverage.darts} darts. Individual
        segments: {coverage.segmentedDarts} of {coverage.darts} darts across{' '}
        {coverage.segmentedVisits}{' '}
        {coverage.segmentedVisits === 1 ? 'visit' : 'visits'}. Totals only:{' '}
        {coverage.totalOnlyVisits}{' '}
        {coverage.totalOnlyVisits === 1 ? 'visit' : 'visits'}.
      </p>
      {coverage.visits === 0 ? (
        <p>No recorded darts in this sample.</p>
      ) : (
        <ul>
          {Object.entries(coverage.origins)
            .filter(([, count]) => count > 0)
            .map(([origin, count]) => (
              <li key={origin}>
                {inputSourceLabels[origin as keyof typeof inputSourceLabels]}:{' '}
                {count} {count === 1 ? 'visit' : 'visits'}
              </li>
            ))}
        </ul>
      )}
      {ruleVariants !== undefined && ruleVariants > 1 && (
        <p>
          This sample combines {ruleVariants} rule configurations. Compare
          like-for-like rules when assessing progress.
        </p>
      )}
      {importedMatches > 0 && (
        <p>
          {importedMatches}{' '}
          {importedMatches === 1 ? 'match is marked' : 'matches are marked'} as
          imported. Input labels are carried with the file and do not verify who
          entered a score.
        </p>
      )}
      <p>
        3-dart average = credited points ÷ recorded darts × 3, rounded once to
        one decimal. Busts credit zero points and still count the darts
        recorded. For double-in, only points scored after opening count.
      </p>
      <p>
        Best visit, 100–139, 140–179 and 180 counts exclude busts. Highest
        checkout is the credited finishing visit. Team member averages use only
        that member’s visits; wins and legs belong to their side.
      </p>
      <dl>
        <div>
          <dt>Checkout attempt rate</dt>
          <dd>Unavailable — intended targets and attempts are not recorded.</dd>
        </div>
        <div>
          <dt>Target accuracy / hit positions</dt>
          <dd>
            Unavailable — segment choices do not provide aim or physical
            coordinates.
          </dd>
        </div>
        <div>
          <dt>Competitive verification</dt>
          <dd>
            Unverified local record. Input labels and complete dart details do
            not establish ranking eligibility.
          </dd>
        </div>
      </dl>
      <p className="muted">
        Metric definition: {metricsVersion}. Origin not recorded means the
        original input method was not saved; available segment details are still
        counted above.
      </p>
    </details>
  );
}
