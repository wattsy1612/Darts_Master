export type DartHit = { number: number; multiplier: 1 | 2 | 3 };
export function dartValue(hit: DartHit): number {
  if (
    !hit ||
    !Number.isInteger(hit.number) ||
    ![1, 2, 3].includes(hit.multiplier) ||
    !(
      (hit.number >= 1 && hit.number <= 20) ||
      (hit.number === 25 && hit.multiplier <= 2) ||
      (hit.number === 0 && hit.multiplier === 1)
    )
  )
    throw new Error('Choose a valid dartboard segment.');
  return hit.number * hit.multiplier;
}
export function dartLabel(hit: DartHit): string {
  dartValue(hit);
  if (hit.number === 0) return 'Miss';
  if (hit.number === 25) return hit.multiplier === 2 ? 'Bull' : '25';
  return `${['', 'S', 'D', 'T'][hit.multiplier]}${hit.number}`;
}
export function evaluateDarts(start: number, hits: DartHit[]) {
  if (
    !Number.isInteger(start) ||
    start < 2 ||
    !Array.isArray(hits) ||
    hits.length > 3
  )
    throw new Error(
      'A visit needs a valid starting score and up to three darts.',
    );
  let total = 0;
  let status: 'scoring' | 'bust' | 'checkout' = 'scoring';
  for (const hit of hits) {
    if (status !== 'scoring')
      throw new Error(
        'The visit ended before this dart. Remove the extra dart.',
      );
    total += dartValue(hit);
    const remaining = start - total;
    if (
      remaining < 0 ||
      remaining === 1 ||
      (remaining === 0 && hit.multiplier !== 2)
    )
      status = 'bust';
    else if (remaining === 0) status = 'checkout';
  }
  return {
    total,
    darts: hits.length,
    double: status === 'checkout',
    remaining: status === 'bust' ? start : start - total,
    status,
  };
}
