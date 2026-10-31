# Cricket playing preview evidence — 31 October 2026

Scope: application v0.18, progress on SC-04 and shared draft recovery. The complete product goal remains active. This is a local integration preview; public Cricket file restore, new pairs/team setup, full history/profile aggregation, earlier-visit correction and physical-device/accessibility acceptance are still required.

## Implemented behavior

- `CricketPlay.tsx` opens an existing Cricket current record without rewriting it. Existing singles/pairs/team rosters retain their domain participant IDs and member rotation. New setup currently creates two guest players with 1–11 legs and an optional shared bull-off.
- The target table shows both sides' marks, points and legs. Exact segment entry includes all Cricket targets, split bull, actual numbered 1–14 darts and misses. Explicit pass has zero darts. Invalid darts after the winning dart are rejected without changing saved history.
- Commands use the shared engine and transactional repository. Pause/resume, confirmed concession/abandonment, next leg, undo/redo, results and fresh-ID rematches preserve the shared archive. Switching back to X01 requires a saved terminal Cricket game. An unfinished X01 game cannot be replaced through the preview entry.
- `data/draft.ts` and `useVisitDraft.ts` now accept the game union. Cricket validates segment-only drafts with its own lifecycle checks; X01-only score/opening/finishing fields remain invalid. Exact-prefix identity, revision matching, seven-day expiry and tab-token safeguards are unchanged. Reload requires an explicit restore/discard decision; recovery never records a visit itself.
- A failed match write retains the screen version, disables further match controls and provides retry plus separate screen-version and last-saved backups. Current/archive reconciliation uses the existing shared game projection, without mutating the database during export.
- The screen labels its preview status and the unfinished public file restore integration. The registry's accepted-game `playable` gate remains false. Existing game-aware format-2 downloads preserve Cricket records; the public file reviewer still rejects them before mutation.

## Verification

Five added browser journeys exercise a complete finish (including rejection of an extra winning dart), result reload/undo/redo, archive removal/recreation, rematch and X01 return; bull-off, exact non-target darts, passes, pause/reload/resume and phone overflow; failed writes and actual downloaded JSON; explicit exact-turn draft restoration; and scoring versus closed/dead targets. The former stored-Cricket recovery fixture now verifies direct resume without changing its saved revision or complete backup.

A shared draft unit case verifies Cricket round-trip, cross-game mismatch, invalid X01 fields/segments, paused-turn rejection and stale duplicated-tab writes. A production service-worker journey disconnects, reopens Cricket, explicitly restores its draft, records it, reloads again and checks the persisted command.

The 390-pixel screenshot `/tmp/darts-cricket-phone.png` was inspected and the browser asserts no horizontal overflow. This does not constitute physical-device, assistive-technology or usability sign-off.

Final local verification: `npm run check` passes typecheck, all 255 unit tests and the production build. `npm run test:e2e` passes all 78 browser tests. The built-app offline suite passes all eight tests (341 total). The clean browser run follows source edits that interrupted two evaluations during the first run; no retry, timeout or assertion weakening was used to hide those interruptions. The public-import assertion now matches the accurate file-restore message and still verifies no mutation. The original broad release gates remain open.
