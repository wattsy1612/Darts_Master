# Game contract foundation — 30 October 2026

Scope: internal SC-04/EN-01 dependency work, v0.16. This does **not** mark the complete Cricket feature accepted. [Game contracts](../GAME_CONTRACTS.md) records primary rule references, selected variant, actual supported capabilities and remaining integration gates.

## Evidence

- The typed registry has X01 and Cricket adapters with explicit record/rules identities, create/normalise/replay/rematch/statistics methods and capabilities. Only X01 is returned as playable.
- X01 canonicalisation is now a domain module with the old workspace import API re-exported. Existing save schemas remain supported; new matches/rematches carry equivalent explicit game/rules identity. Unknown identities cannot fall back to X01. Established legacy hashes/content comparison and profile/correction paths remain covered by the existing suite.
- Shared turn/member and lifecycle functions replace the X01-private implementation. Their behaviour remains covered by existing X01 variants, 3–8-side withdrawal, pair/team rotation, bull-off, lifecycle, bot compatibility, correction and persistence tests.
- `cricket.test.ts` adds 21 cases: closure/excess/dead targets; split bull overflow; misses/non-target darts; tied-score win; closure while behind and exact catch-up dart; explicit zero-dart pass; pairs attribution; both member-rotation policies across legs; invalid segments/actors/settings; canonicalisation; pause/resume/concession; bull-off; unknown versions/continuations/import markers; and rematch identity/settings.
- `registry.test.ts` adds seven cases: legacy/explicit X01; distinct Cricket state; cross-game/unknown identity rejection; unavailable-mode import/play gates; explicit capabilities and separate statistics; known/unknown rules versions; and malformed records.
- Two browser scenarios verify new X01 identity survives score/reload and the import worker rejects other-game/future-rule payloads without changing a valid saved workspace. Existing browser and production offline tests exercise the refactored X01 path.

Final local verification: `npm run check` passes typecheck, all 241 unit tests and the production build; `npm run test:e2e` passes all 68 browser tests; `npm run test:offline` passes all six production offline/update tests (315 total). No Cricket playing UI, persistence/import integration, full profile aggregation, correction UI, installed-device acceptance or provider compatibility is claimed by these domain tests.
