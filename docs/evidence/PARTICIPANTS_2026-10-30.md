# Participants, sides and turn order — 30 October 2026

v0.12 implements the local SC-02 model and UI, with corresponding input/history/profile/import changes. Registered teams, membership permissions and online events are separate workstreams.

## Model and supported formats

A side owns the score, leg/set totals and shared double-in state. Its members are distinct match participants with stable match-scoped IDs, names and optional explicit saved-profile links. An ordered side list defines visit order; each side maintains an independent member cursor. A member throws a complete visit before rotating, including after a miss or bust. Names do not establish identity, and one saved profile cannot occupy two roster positions.

Supported local formats are two-player singles; three-to-eight-player multiplayer; two pairs; and two teams of two-to-four members per side. Team sizes may differ. Setup supports member/side ordering, side names, saved-player selection and an explicit reset-each-leg or continue-between-legs member policy. Double-in is shared by the whole side; per-member opening rules are not implied.

The starting side has a stable ID. Reordering changes its position without changing the selected side. Leg/set rotation advances among eligible sides. Multiplayer withdrawal skips a side and preserves its played scores/legs while the others continue; the last remaining side wins by concession. With two sides, concession still awards the opponent the outcome without inventing legs or scores.

Bull-off supports two sides, with the first listed member as representative. It sets the actual initial starter and remains separate from scoring visits. Practice supports two-player singles; multiway bull-off and simulated team opponents are not advertised.

## Events, projection and compatibility

v5 sessions store validated sides/members and explicit starting-side identity. Visit commands identify the actual participant; withdrawal commands identify the side. Replay rejects mismatched actors or side/index claims before attributing points. Derived visits retain side ID, member ID, recorded name and profile link. Per-side score arrays are state vectors, not person identities. Legacy player-name/profile-index fields are validated presentation mirrors of the roster, not an alternative authority.

v1–v4 sessions remain unchanged on disk. Replay projects their original positions and explicit profile IDs into deterministic match-scoped sides/members; it does not infer ownership from guest names. New matches/rematches use v5. Unsupported older schemas carrying roster fields or visit actors are rejected. Rematch retains roster identities/order with a new match ID and empty commands; existing unavailable profile references keep their recorded name/reference instead of being guessed or silently reassigned.

Full backup/import maps every member’s profile link independently while retaining match actor IDs. Standalone exports import as guests. Duplicate comparisons omit profile ownership links and use stable object-key ordering while preserving meaningful array order. Pre-roster unidentified-export IDs retain the original algorithm; a frozen v0.11 identifier fixture guards compatibility. Invalid mappings that link multiple members to one saved profile fail in preview before writes.

## Statistics and UI

The playing screen names the actual thrower separately from their side. History shows side outcomes and individual scoring records. Saved-player records can filter singles, multiplayer, pairs/teams or all formats. Members share their side’s match/leg outcome, but only their actual visits contribute points, darts, 180s and checkouts. A partner does not receive another member’s checkout or scoring average. Abandoned matches remain excluded from decided profile records.

## Verification

Twenty-three participant cases cover old-save projection, pair and unequal-team rotation, misses/busts, leg resets/continuity, three/four/eight-player order, withdrawals and starter rotation, event-identity validation, roster/profile bounds, individual metrics, transactional persistence, import mapping/deduplication, bull-off representatives, rematch, preserved starting identity, old export IDs and legacy profile references. Existing rule/lifecycle/data tests remain enabled.

Six browser journeys cover pair scoring/refresh/undo/redo, actual-member profile metrics and import review, phone multiplayer withdrawal, unequal team/order controls, eight-player bounds/reordering and rematch of an unavailable legacy profile. Fresh Chromium checks at 1366 and 390 CSS pixels use long side/member names on playing and history screens without horizontal body overflow.

The same increment bundles the existing DM Sans/Barlow Condensed fonts with upstream licences and pinned provenance; see [font sources](../FONTS.md). A full browser run observed four load-event reload timeouts whose cause was not reproduced in isolated checks. Bundling removes the known external font dependency without weakening reload assertions. Production checks verify local font caching and offline font loads.

Local verification: TypeScript/build, 156 unit tests, 56 development-browser tests and five production offline/update tests pass.

## Remaining gates

Physical club/phone/tablet sessions, broader team/opening/substitution policies, participant account ownership, server authority and team/club/event membership remain open. Profiles are browser-local identities; local roster IDs do not authenticate a person or establish a verified ranking. This does not complete the full product plan.
