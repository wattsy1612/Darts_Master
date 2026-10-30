export type X01Rules = {
  inRule?: 'straight' | 'double';
  outRule?: 'straight' | 'double';
};
export function rulesFor(setup: X01Rules) {
  return {
    inRule: setup.inRule ?? 'straight',
    outRule: setup.outRule ?? 'double',
  } as const;
}
export function ruleSummary(setup: X01Rules) {
  const rules = rulesFor(setup);
  return `${rules.inRule === 'double' ? 'Double' : 'Straight'} in · ${rules.outRule === 'double' ? 'Double' : 'Straight'} out`;
}
// Aggregate input records only a declared total and dart count. This table
// proves that at least one physical sequence satisfies both opening and finish.
// It never invents which segments the player actually hit.
const hits = [
  { value: 0, double: false },
  { value: 25, double: false },
  { value: 50, double: true },
  ...Array.from({ length: 20 }, (_, i) =>
    [1, 2, 3].map((m) => ({ value: (i + 1) * m, double: m === 2 })),
  ).flat(),
];
const totals = new Map<string, Set<number>>();
for (const needsOpening of [false, true]) {
  let states = new Set([`0:${needsOpening ? 0 : 1}:0`]);
  for (let count = 1; count <= 3; count++) {
    const next = new Set<string>();
    for (const state of states) {
      const [total, opened] = state.split(':').map(Number);
      for (const hit of hits) {
        const nowOpen = !!opened || hit.double;
        next.add(
          `${total + (nowOpen ? hit.value : 0)}:${nowOpen ? 1 : 0}:${hit.double ? 1 : 0}`,
        );
      }
    }
    for (const state of next) {
      const [total, opened, lastDouble] = state.split(':').map(Number);
      for (const finishDouble of [false, true]) {
        if (finishDouble && !lastDouble) continue;
        const key = `${needsOpening}:${count}:${!!opened}:${finishDouble}`;
        if (!totals.has(key)) totals.set(key, new Set());
        totals.get(key)!.add(total);
      }
    }
    states = next;
  }
}
export function possibleVisit(
  total: number,
  darts: number,
  needsOpening = false,
  opens = false,
  finishDouble = false,
) {
  if (!needsOpening && opens) return false;
  return (
    totals
      .get(`${needsOpening}:${darts}:${!needsOpening || opens}:${finishDouble}`)
      ?.has(total) ?? false
  );
}
