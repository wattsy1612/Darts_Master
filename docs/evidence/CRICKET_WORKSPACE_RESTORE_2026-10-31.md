# Cricket workspace, match centre and restore — 31 October 2026

Application v0.19. This increment applies the dated UX research to the local Cricket preview and connects its results to public reviewed import/export. SC-04 and the wider product plan remain incomplete; no final identity, physical-device support or production-readiness claim is made.

## Behavior inspected

- `CricketPlay.tsx` now separates Play, Match history and Data & backups using the existing hash routing. The playing component remains mounted across these views, retaining unrecorded darts and the exact-turn draft hook. Source/session replacement still uses the shared repository and command validation.
- `ui/MatchPageLinks.tsx` supplies shared navigation controls for X01's match menu and Cricket's pages. `styles/cricket.css` composes a compact marks/points panel, precise segment entry and a separate unrecorded visit/action strip. Confirmed points are distinct from the draft. Non-Cricket target numbers remain exact numbered darts rather than invented misses. Recovery warnings remain visible across pages.
- History and backup tools no longer stretch the normal Cricket playing page. An unsaved game still disables further match controls, offers retry and links to independent current-memory / last-saved backup choices. Destructive actions retain explicit confirmation.
- `GameHistory.tsx` selects X01 or Cricket reports. `CricketHistory.tsx` replays current/saved/imported records for status, legs, marks, points, actual visits and per-member metrics. Metrics do not blend X01 averages and Cricket marks; display names and stable actor attribution remain from the saved record. Export uses the versioned game-aware format. Reports are read-only; they do not introduce an unchecked history rewrite.
- `inspectBackup` now returns the actual `GameRecord` union and accepts supported Cricket/mixed format-2 files without an internal opt-in. Format-1 Cricket, unknown games/rules and malformed commands remain invalid. Existing size/roster/profile limits, explicit links, duplicate/conflict/copy planning, queued comparison and atomic pre-import recovery are retained. X01-only test consumers explicitly narrow to X01 at their assertions rather than falsely typing all files as X01.

## Verification

Three new browser journeys cover:

1. A real scored X01 game, mixed-file review with no initial mutation, selected Cricket resume and replacement acknowledgement, both games' histories, downloaded Cricket export contents, repeat-file dedup and exact pre-import workspace restoration after undo.
2. Standalone Cricket guest-profile conversion, readable imported history, and a failed mixed import leaving the complete prior workspace/revision unchanged.
3. A 1024×768 playing viewport with Record visible, no horizontal overflow, and a draft retained while visiting history/data and returning to score, without recording a command until explicit submission.

Existing Cricket journeys now navigate to the appropriate history/data page and expand the optional non-Cricket segment controls. They continue to assert actual saved commands, results, failed-write backups, explicit draft recovery and exact non-target darts. Legacy X01/browser checks are retained. The built-app offline Cricket journey now downloads its backup and reviews it through the cached import worker without changing the saved command history.

Final local checks: `npm run check` passes typecheck, 255 unit tests and production build; `npm run test:e2e` passes 81 browser tests; the production Playwright offline configuration passes eight tests against that build (344 tests total). No retry or timeout increase was used to get the final passing run. Development test fixes corrected fixture schema, navigation wait points and locators to match the actual existing X01 entry/review flow; the tablet Record placement failure was fixed in the layout.

Browser screenshots `/tmp/darts-v019-cricket-tablet.png` and `/tmp/darts-v019-cricket-phone.png` were inspected. The tablet test measures the actual Record control within the 768px viewport; phone checks assert horizontal fit and preserved scoring behavior. These are not evidence of a full accessibility audit, TV compatibility or real-player usability sign-off.

## Remaining acceptance

New pairs/team setup, cross-match Cricket profile summaries, earlier Cricket visit corrections and complete real-device/accessibility journeys remain open. The game registry's release-acceptance flag stays false while those gates are unfinished. Existing configured rosters, local play and public file restore are implemented capabilities; the complete product is not declared finished.

## v0.19.1 confirmation-order follow-up

One of the two v0.19 CI runs failed the built-app Cricket test after the immediate reload following an apparently accepted visit. The downloaded trace showed the previous saved turn plus its recoverable draft, confirming that the screen had advanced before the asynchronous transaction completed. This was a production UI ordering defect; the test was not weakened with an additional database wait.

Cricket now publishes the next session only after `saveMatch` resolves. On a write failure, it retains the validated attempted version for memory backup and locks further match controls. A new browser regression keeps the actual native write transaction alive with pending reads, verifies the previous player and Saving state remain visible, then releases the transaction and reloads immediately after the next player appears. This specifically checks the commit boundary; it does not claim all games share identical publication behavior.

Final v0.19.1 local verification passes typecheck/build, 255 unit tests, 82 browser tests and eight production offline/update tests (345 total). The previously failing offline journey also passes five consecutive CI-mode runs with `--retries=0`; the complete eight-test offline suite passes in CI mode with retries disabled. The added held-transaction regression checks the ordering directly, rather than relying on runner speed.
