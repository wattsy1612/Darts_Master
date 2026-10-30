# Custom practice and calibration — 30 October 2026

Scope: TR-01, local application v0.14. This adds custom target probabilities and repeatable measurements to the existing simulated opponent. It is not an Elo/rating claim, a human accuracy model, cloud training service or complete TR-02/TR-03 training suite.

## Delivered behaviour

Practice setup offers Rookie, Regular, Sharp and Custom. Custom has independent treble, double/bull and single/outer-bull target-hit controls, from 0% to 100%. Native range controls support keyboard adjustment and 44-pixel control height. Responsive preset cards and control labels fit the inspected phone width. Settings are probabilities for the bot’s **chosen target**, not promises about match averages, checkout rate or human strength.

A missed target can hit another scoring segment. Custom single/outer-bull misses explicitly exclude the intended segment, so a 0% target setting cannot accidentally return that same target through the fallback miss branch. The preset miss model stays unchanged: preset probabilities are internal branch parameters, and their complete hit distributions should be measured rather than interpreted as literal target percentages.

Custom settings use schema version 1 (`treble`, `double`, `single` finite probabilities from 0 to 1), independent from optional practice model 1. New practice setup records `botModel: 1`; older sessions without it use the unchanged first model. Unsupported models/configuration versions, missing/invalid probabilities, or custom settings attached to a non-custom opponent are rejected. Versions 1–4 cannot adopt the new configuration fields. Existing v5 records without them remain valid.

Recorded visits remain authoritative on replay; settings are used only to generate the next simulated turn. Same model/settings/match position/seed produces the same throw, including after refresh, backup review/import and rematch. Settings are retained in match reports and rematches. Switching to a preset clears custom settings; switching to local play also clears the practice model. Profile practice summaries count opponent configurations separately from X01 rule configurations and disclose combined samples.

## Repeatable preset measurements

Run `npm run calibrate:bot` to print the JSON report. To save JSON without npm’s command banner, run `node scripts/measure-bot.mjs > report.json`. The script loads the app’s TypeScript domain through Vite in middleware mode, closes that loader, and does not launch or replace the playing server.

Sample definition `practice-v1-sample-v1`: 1,000 independent visits from score 501 and 1,000 from score 40, per preset. All positions start opened, straight-in/double-out, with three darts available. Scoring seeds are `calibration-scoring-0` through `-999`; finishing seeds use `calibration-finishing-0` through `-999`. Percentiles use the sorted totals at `floor((n-1)*p)`. The actual machine-readable fixture is [`practice-v1-calibration.json`](../../src/domain/fixtures/practice-v1-calibration.json).

| Preset  | Mean 501-position visit | P10 / median / P90 | First dart T20 | First dart D20 from 40 | Finish from 40 within visit | Bust from 40 |
| ------- | ----------------------- | ------------------ | -------------- | ---------------------- | --------------------------- | ------------ |
| Rookie  | 35.59                   | 3 / 26 / 81        | 93 / 1000      | 129 / 1000             | 316 / 1000                  | 132 / 1000   |
| Regular | 89.19                   | 41 / 85 / 140      | 338 / 1000     | 313 / 1000             | 668 / 1000                  | 61 / 1000    |
| Sharp   | 128.81                  | 81 / 140 / 180     | 601 / 1000     | 551 / 1000             | 910 / 1000                  | 17 / 1000    |

These are fixed seeded positions, not full-match averages or real-player benchmarks. Lower scores, opening rules, checkout choices, early busts/finishes and sample composition change observed match averages. No rating or advertised average was fitted to these numbers. Retuning the presets or aiming/miss model must introduce explicit compatibility/version policy rather than changing an older session’s next deterministic turn.

## Evidence and compatibility

- `botCustom.test.ts` checks malformed/unsupported settings; source schema/model boundaries; probability endpoints under all opening/finishing combinations; literal single/outer-bull endpoints; independent treble/double controls; actual legal visits; deterministic backup/import/rematch behaviour; profile configuration disclosure; and the saved calibration fixture.
- A temporary compatibility harness loaded the previously committed `bot.ts` alongside the new implementation. It compared all three presets at 13 scores (`2, 3, 21, 25, 40, 50, 61, 110, 121, 159, 170, 301, 501`) with 100 seeds each. All 3,900 output visits matched. The temporary source was removed; the permanent test retains the baseline SHA-256 `b7f891d83ac5dbc242a6dbf5c953bf1de57caa9dc6cb26a0b5ca8c0082a1d3cd` over those ordered, newline-delimited JSON visits.
- `botCustom.spec.ts` covers phone controls/overflow, persisted custom values/model, an all-targets-hit simulated opening visit, refresh, history display, rematch preservation, keyboard range input, switching presets and clearing practice configuration for local play. Initial test navigation assumptions were corrected to use the real “All visits”, “End match” and “+ New match” controls; no timeouts or assertions were relaxed.
- Phone setup screenshot `/tmp/darts-custom-opponent-phone.png` was inspected. This is browser-width evidence, not a physical phone/tablet, screen-reader or real-player usability session.

Final local checks: `npm run check` passes typecheck, all 192 unit tests and the production build; `npm run test:e2e` passes all 61 development browser tests; `npm run test:offline` passes all five production offline/update tests. Total: 258 automated tests. The calibration command was executed and the pure JSON output matches the saved fixture byte-for-byte. Physical usability and usefulness/challenge validation remain open, together with training games/routines, cloud accounts and the rest of the full platform goal.

The first simultaneous development/offline runs collided in their shared Playwright trace output directory, yielding `ENOENT` during trace cleanup (six development cases and one offline case). The offline configuration now uses `offline-test-results/`, independent of the development `test-results/`; both paths are ignored locally and included in CI failure artifacts. The final runs pass with assertions, retries and timeouts unchanged.
