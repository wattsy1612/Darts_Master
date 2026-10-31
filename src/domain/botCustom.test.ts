import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { playerSummary } from './players';
import { describe, expect, it } from 'vitest';
import { botVisit } from './bot';
import { checkedBotSettings, defaultBotSettings } from './botSettings';
import type { BotSettings } from './botSettings';
import { createMatch, recordVisit, replay, rematch } from './match';
import type { Session, Setup } from './match';
import { rosterView, getSides } from './participants';
import { normaliseSession, emptyData } from '../data/workspace';
import {
  backupText,
  buildImportPlan,
  defaultOptions,
  inspectBackup,
} from '../data/backup';
import { measureBot } from './botCalibration';

const base: Setup = {
  players: ['A', 'Bot'],
  start: 501,
  legsToWin: 1,
  bot: 'custom',
  botModel: 1,
  botSettings: { ...defaultBotSettings },
  starter: 1,
};
function saved(settings = defaultBotSettings): Session {
  return {
    version: 5,
    id: 'custom-practice',
    setup: rosterView({ ...base, botSettings: settings }, getSides(base)),
    commands: [],
  };
}
describe('custom practice settings', () => {
  it.each([
    undefined,
    null,
    { version: 2, treble: 0.2, double: 0.2, single: 0.2 },
    { ...defaultBotSettings, treble: -0.1 },
    { ...defaultBotSettings, double: 1.1 },
    { ...defaultBotSettings, single: NaN },
    { ...defaultBotSettings, double: Infinity },
    { ...defaultBotSettings, single: '0.5' },
  ])('rejects unsupported or malformed settings %#', (invalid) => {
    expect(() =>
      createMatch({ ...base, botSettings: invalid as BotSettings }),
    ).toThrow(/accuracy/);
    expect(() =>
      normaliseSession({
        ...saved(),
        setup: { ...saved().setup, botSettings: invalid },
      }),
    ).toThrow();
  });
  it('requires custom mode and a supported model rather than silently ignoring settings', () => {
    expect(() => createMatch({ ...base, bot: 'regular' })).toThrow(
      /Custom settings/,
    );
    expect(() => createMatch({ ...base, bot: undefined })).toThrow();
    expect(() =>
      createMatch({ ...base, botModel: 2 } as unknown as Setup),
    ).toThrow(/model/);
    expect(() => replay({ ...saved(), version: 4 })).toThrow(/version 5/);
    expect(
      checkedBotSettings({ ...defaultBotSettings, extra: true } as BotSettings),
    ).toEqual(defaultBotSettings);
  });
  it('handles probability endpoints, exact finishing, unopened visits and legal misses', () => {
    for (const probability of [0, 1])
      for (const inRule of ['straight', 'double'] as const)
        for (const outRule of ['straight', 'double'] as const) {
          const match = createMatch({
            ...base,
            inRule,
            outRule,
            botSettings: {
              version: 1,
              treble: probability,
              double: probability,
              single: probability,
            },
          });
          for (let i = 0; i < 30; i++) {
            const visit = botVisit(match, `endpoint-${i}`);
            expect(() => recordVisit(match, visit)).not.toThrow();
            if (probability === 1 && inRule === 'straight')
              expect(visit.total).toBe(180);
          }
        }
    const match = createMatch({
      ...base,
      botSettings: { version: 1, treble: 1, double: 1, single: 1 },
    });
    const finish = botVisit({ ...match, scores: [501, 40] }, 'finish');
    expect(finish).toMatchObject({
      total: 40,
      darts: 1,
      double: true,
      hits: [{ number: 20, multiplier: 2 }],
    });
    expect(recordVisit({ ...match, scores: [501, 40] }, finish).winner).toBe(1);
  });
  it('makes single and outer-bull endpoints literal without preset fallback hits', () => {
    for (const score of [1, 25])
      for (const probability of [0, 1]) {
        const match = createMatch({
          ...base,
          outRule: 'straight',
          botSettings: {
            version: 1,
            treble: 1,
            double: 1,
            single: probability,
          },
        });
        for (let i = 0; i < 100; i++) {
          const visit = botVisit(
            { ...match, scores: [501, score] },
            `single-${i}`,
          );
          const first = visit.hits![0];
          expect(first.number === score && first.multiplier === 1).toBe(
            probability === 1,
          );
          expect(() =>
            recordVisit({ ...match, scores: [501, score] }, visit),
          ).not.toThrow();
        }
      }
  });
  it('keeps custom target controls independent across the fixed scoring/finishing sample', () => {
    const scoring = measureBot(
      { ...base, botSettings: { version: 1, treble: 1, double: 0, single: 1 } },
      200,
    );
    const finishing = measureBot(
      { ...base, botSettings: { version: 1, treble: 0, double: 1, single: 1 } },
      200,
    );
    expect(scoring.scoring.firstTrebleHits).toBe(200);
    expect(scoring.finishing.firstDoubleHits).toBe(0);
    expect(finishing.scoring.firstTrebleHits).toBe(0);
    expect(finishing.finishing.firstDoubleHits).toBe(200);
    expect(finishing.finishing.finishedVisits).toBe(200);
  });
  it('preserves deterministic throws and settings across backup review, import, normalisation and rematch', () => {
    const original = saved({
      version: 1,
      treble: 0.17,
      double: 0.86,
      single: 0.54,
    });
    const visit = botVisit(replay(original), 'saved-position');
    const incoming = inspectBackup(
      backupText({ ...emptyData(), current: original }),
    );
    const plan = buildImportPlan(emptyData(), incoming, {
      ...defaultOptions(emptyData(), incoming),
      resumeCurrent: true,
    });
    expect(plan.errors).toEqual([]);
    const restored = normaliseSession(plan.data.current);
    expect(restored.setup.botSettings).toEqual(original.setup.botSettings);
    expect(botVisit(replay(restored), 'saved-position')).toEqual(visit);
    original.commands = [
      { type: 'concede', player: 0, sideId: original.setup.sides![0].id },
    ];
    expect(rematch(original, 'again', 1).setup).toMatchObject({
      bot: 'custom',
      botModel: 1,
      botSettings: original.setup.botSettings,
    });
  });
});

describe('practice-v1 fixed-position calibration', () => {
  it('preserves 3900 preset throws compared against the previous committed generator', () => {
    const digest = createHash('sha256');
    for (const bot of ['rookie', 'regular', 'sharp'] as const)
      for (const score of [
        2, 3, 21, 25, 40, 50, 61, 110, 121, 159, 170, 301, 501,
      ])
        for (let seed = 0; seed < 100; seed++) {
          const match = {
            ...createMatch({
              players: ['A', 'Bot'],
              start: 501,
              legsToWin: 1,
              bot,
              starter: 1,
            }),
            scores: [501, score],
          };
          digest.update(
            JSON.stringify(botVisit(match, `compat-${score}-${seed}`)) + '\n',
          );
        }
    expect(digest.digest('hex')).toBe(
      'b7f891d83ac5dbc242a6dbf5c953bf1de57caa9dc6cb26a0b5ca8c0082a1d3cd',
    );
  });
  it('discloses combined practice configurations without mixing human and simulated darts', () => {
    const one = saved(),
      two = saved({ ...defaultBotSettings, double: 0.9 });
    two.id = 'practice-two';
    for (const item of [one, two]) {
      item.setup = rosterView(
        item.setup,
        item.setup.sides!.map((side, i) => ({
          ...side,
          members: side.members.map((m) => ({
            ...m,
            profileId: i === 0 ? 'human' : null,
          })),
        })),
      );
      item.commands = [
        { type: 'concede', player: 1, sideId: item.setup.sides![1].id },
      ];
    }
    const archive = [one, two].map((session) => ({
      session,
      completedAt: '2026-10-30T12:00:00Z',
    }));
    expect(playerSummary(archive, 'human', true)).toMatchObject({
      matches: 2,
      opponentVariants: 2,
      ruleVariants: 1,
      darts: 0,
    });
    expect(playerSummary(archive, 'human', false).matches).toBe(0);
  });

  it('measures repeatable scoring and finish distributions for the three existing presets', () => {
    const report = ['rookie', 'regular', 'sharp'].map((bot) => ({
      bot,
      ...measureBot(
        {
          players: ['A', 'Bot'],
          start: 501,
          legsToWin: 1,
          bot: bot as Setup['bot'],
        },
        1000,
      ),
    }));
    for (const r of report) {
      expect(r.scoring.darts).toBe(3000);
      expect(r.scoring.p10).toBeLessThanOrEqual(r.scoring.median);
      expect(r.scoring.median).toBeLessThanOrEqual(r.scoring.p90);
      expect(r.finishing.finishedVisits).toBeGreaterThan(
        r.finishing.firstDoubleHits,
      );
    }
    expect(report[1].scoring.average).toBeGreaterThan(
      report[0].scoring.average + 15,
    );
    expect(report[2].scoring.average).toBeGreaterThan(
      report[1].scoring.average + 15,
    );
    expect(report[1].finishing.finishedVisits).toBeGreaterThan(
      report[0].finishing.finishedVisits,
    );
    expect(report[2].finishing.finishedVisits).toBeGreaterThan(
      report[1].finishing.finishedVisits,
    );
    const expected = JSON.parse(
      readFileSync(
        new URL('./fixtures/practice-v1-calibration.json', import.meta.url),
        'utf8',
      ),
    );
    expect(report).toEqual(expected);
  });
});
