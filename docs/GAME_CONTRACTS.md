# Game registry and Cricket domain contract

Application v0.19, internal SC-04/EN-01 work. **Cricket has a local playing preview, not completed release acceptance.** The accepted-game registry remains gated while new roster setup, full profile/correction integration and device/accessibility journeys are unfinished. Existing local X01 remains available.

## Registry boundary

`src/domain/games/registry.ts` declares typed game adapters: create, canonicalise, replay, rematch, statistics, rules identity, supported record versions and positive input/format capabilities. `GameRecord` discriminates X01 and Cricket; clients cannot use a score total to infer Cricket target marks. This is a compile-time domain extension point, not remote third-party code loading. Capabilities describe engine operations; they never grant caller authority.

Historical untagged schema 1–5 documents remain X01. New X01 games/rematches identify `game: x01` and `rulesVersion: x01-configured-v1`; optional omission preserves old saves without rewriting them. Explicit unknown games or X01 rule versions are rejected. Legacy unidentified-export hashing and profile-neutral content comparison still use the established setup/command content, so adding the equivalent explicit identity does not silently change a legacy source ID.

X01 canonicalisation now lives in `src/domain/session.ts`, independent of browser storage. `workspace.ts` re-exports that API to preserve callers. Shared turn-order/member selection moved to `participants.ts`; shared pause/resume/concession/abandon semantics live in `games/lifecycle.ts`. X01 retains its old exported helpers and scoring rules. Those shared helpers do not merge game-specific scores or statistics.

The domain parser and shared v3 workspace can validate and persist Cricket records. Public format-2 file restore and a game-aware read-only match centre now support Cricket and mixed archives; see [shared storage](SHARED_GAME_STORAGE.md). It cannot accidentally accept a Cricket-tagged payload as X01 even if the remaining fields resemble a valid old match. `playableGames()` exposes only X01 at this stage. SC-04 remains in progress.

## Rules review and deliberate variant

The [NDA rules guide](https://ndadarts.com/nda-rules/) describes closing 15–20 and bull with three marks, split-bull values, closure plus equal-or-higher points to win, optional passes and useful marks divided by actual darts for Cricket statistics. The [DARTSLIVE SEA PRO rulebook](https://dl.cdn.dartslive.com/com/wp-content/uploads/2024/08/20141156/DL-SEA-Pro-Tournament-Official-Rulebook-FINAL.pdf), sections 7–8, adds tournament-specific round/starting/tie procedures. Sources were checked on 30 October 2026. The initially discovered general game-guide PDF could not be fetched; this contract relies on the accessible primary references above.

The implemented contract is **`cricket-standard-v1`**, unlimited-round local standard scoring with split bull. It is not a claim of NDA event eligibility, a complete DARTSLIVE tournament implementation or provider integration. This choice must be visible in the eventual game setup; round limits, point caps, cutthroat/no-score variants, handicaps, mixed-game sets and provider tournament policies require explicit separate versions/capabilities.

## Implemented engine

- Two sides: singles, pairs or teams of two to four members. Roster IDs/profile links use the shared validated model. Three-or-more-side Cricket is not enabled by this version.
- Targets are 20, 19, 18, 17, 16, 15 and bull. Single/double/treble give one/two/three marks; outer/inner bull give one/two. Other valid segments count as darts with no useful marks.
- Each side’s closure state caps at three. Excess marks add their target value to the throwing side’s points while the opposing side has not closed that target. One dart can both close and score. Once both sides close it, further hits add no points/useful marks.
- A side wins a leg only after all its targets close and its points are at least the opponent’s. Closing while behind does not end play. A visit stops at the exact winning dart; extra darts are rejected rather than dropped.
- One to three actual segment hits form a visit. A separate actor-identified `pass` command records zero darts and advances turn/member order. An empty/missing hit list is not silently treated as a pass. Total-only input, bots and simulated provenance are unsupported.
- Each visit derives the actual side/member/profile/name from turn state. Per-visit evidence records useful marks, added points, newly closed targets, actual dart count and winner/pass status. Source must match manual segments or an explicit manual pass.
- Legs-to-win supports 1–11; next-leg resets marks/points, retains played legs/history, alternates the starter and obeys reset/continue member rotation. Sets are not supported. Shared two-side bull-off sets the initial starter without entering Cricket statistics.
- Pause/resume preserve exact play; concession/abandonment use the shared lifecycle. Concession awards no unplayed legs. Rematches require a fresh identifier and preserve only the explicit roster/rules; they start a new command history with a chosen starter.
- Canonicalisation validates game/schema/rules identity, bounds, actors, command order and segments; it strips untrusted derived/coordinate fields. Replay accumulates visits without quadratic copying of its growing event history. There is no browser, account or hardware dependency in the engine.

## Statistics

`cricket-recorded-v1` sums useful closing/scoring marks and actual recorded darts; marks per three darts is `3 × marks / darts`, rounded once to two decimals. Misses and dead-target darts remain in the denominator. Explicit passes add zero darts. Zero darts shows an em dash. Actor filtering uses stable participant IDs; side marks/points are shared outcomes, not copied partner metrics.

These are recorded local statistics, not a rating or verified competition record. X01 averages and Cricket marks remain different metric contracts; coordinates and verification stay unavailable. Cricket history now shows match and individual member metrics separately from X01. Cross-match profile aggregation remains pending.

## Remaining SC-04 acceptance work

1. Shared game-aware storage, recoverable migration and public format-2 import/export/recovery are implemented, with read-only Cricket results and mixed-game browsing.
2. Local preview now delivers a game choice, two-player setup, target scoreboard, exact segment/pass entry, bull-off and explicit per-visit draft recovery. New pairs/team setup still needs connecting; existing configured rosters can resume.
3. Local results, undo/redo, next legs and rematches now use the shared persistence boundary. Add cross-match profile aggregation, earlier-visit correction consequences and broader data coverage without contaminating X01 records.
4. Public restore/history browser and offline journeys now have coverage; broader accessibility and physical-device journeys remain required before release acceptance.

The preview uses the shared workspace and draft stores. Its `playable` registry flag remains false: that flag records completed integration acceptance, rather than mere visibility of an experimental local screen.
