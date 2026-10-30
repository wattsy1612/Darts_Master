import { botVisit } from './bot';
import { createMatch, recordVisit } from './match';
import type { Match, Setup } from './match';

export const calibrationVersion = 'practice-v1-sample-v1';
/** Fixed positions isolate scoring and finishing. These are not human skill ratings. */
export function measureBot(setup: Setup, samples = 1000) {
  if (!Number.isInteger(samples) || samples < 1 || samples > 10000)
    throw new Error('Use between 1 and 10000 calibration samples.');
  const base = createMatch({
    ...setup,
    starter: 1,
    startingSideId: setup.sides?.[1].id,
  });
  if (!base.setup.bot)
    throw new Error('Calibration requires a practice opponent.');
  function position(score: number): Match {
    return { ...base, scores: [setup.start, score], opened: [true, true] };
  }
  const totals: number[] = [];
  let firstTrebleHits = 0,
    firstDoubleHits = 0,
    finishVisits = 0,
    credited = 0,
    darts = 0,
    busts = 0;
  for (let i = 0; i < samples; i++) {
    const scoring = position(501);
    const visit = botVisit(scoring, `calibration-scoring-${i}`);
    const scored = recordVisit(scoring, visit).visits[0];
    totals.push(visit.total);
    credited += scored.bust ? 0 : scored.total;
    darts += visit.darts;
    if (visit.hits![0].number === 20 && visit.hits![0].multiplier === 3)
      firstTrebleHits++;
    const finishing = position(40);
    const finish = botVisit(finishing, `calibration-finishing-${i}`);
    const result = recordVisit(finishing, finish).visits[0];
    if (finish.hits![0].number === 20 && finish.hits![0].multiplier === 2)
      firstDoubleHits++;
    if (result.checkout) finishVisits++;
    if (result.bust) busts++;
  }
  totals.sort((a, b) => a - b);
  return {
    version: calibrationVersion,
    samples,
    scoring: {
      meanVisit: Number((credited / samples).toFixed(2)),
      average: Number(((credited / darts) * 3).toFixed(2)),
      darts,
      p10: totals[Math.floor((samples - 1) * 0.1)],
      median: totals[Math.floor((samples - 1) * 0.5)],
      p90: totals[Math.floor((samples - 1) * 0.9)],
      firstTrebleHits,
    },
    finishing: {
      score: 40,
      firstDoubleHits,
      finishedVisits: finishVisits,
      busts,
    },
  };
}
