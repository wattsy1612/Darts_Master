# Shared game storage evidence — 30 October 2026

Scope: v0.17 internal Cricket persistence dependency. [Storage contract](../SHARED_GAME_STORAGE.md) records versions, upgrade/recovery, public readiness gates and remaining Cricket UI work. SC-04 and the overall goal remain in progress.

## Implementation inspected

- `workspace.ts` validates game-aware v3 and recoverable X01-only v2; `games/content.ts` preserves X01 hashes while distinguishing Cricket content. `archive.ts` adds canonical shared read/update/export operations without changing legacy X01 export shapes.
- `repository.ts` validates and snapshots v2, advances revision once, retags only exact valid-turn draft revision markers and commits together. Failures preserve raw storage and readable original data. Mixed-game save/import/correction recovery uses the existing queue and database comparison.
- `backup.ts` retains portable format 1 for X01-only data, adds format 2 for mixed games and gates public Cricket restore until its UI is ready. Member profile mapping, dedup/conflict/copy and pre-import recovery remain shared.
- App views narrow X01 explicitly, preserve the other game’s archive in complete backups and protect an existing Cricket current slot behind recovery. The Data screen offers the original pre-upgrade backup and, while edits are unsaved, a separate last-saved readable backup. In-memory backups reconcile their own current/archive state without mutating confirmed data.

## New verification

`gameWorkspace.test.ts` adds 13 cases:

1. Exactly-once v2 upgrade and exact original checkpoint.
2. Simultaneous opener serialisation.
3. Exact-turn/current-revision draft preservation with unchanged token/contents/expiry.
4. Workspace/checkpoint quota-failure rollback with readable memory recovery and retry.
5. Mid-upgrade draft-update failure rolls back workspace, checkpoint and draft together.
6. Future/malformed/unsafe-revision original preservation.
7. Both game types archive/reload canonically.
8. Undoing a Cricket result preserves X01 history.
9. Current/archive cross-game ID collision and missing-ID rejection without writes.
10. Mixed format-2 backup validation, explicit internal gate, atomic import and undo.
11. Standalone Cricket guest mapping without losing visit evidence.
12. Explicit full-backup profile linking, repeat-import dedup and game-qualified content.
13. Mixed correction checkpoint/undo and rejection of a disguised cross-game target.

Five browser journeys cover existing-game/draft upgrade and downloaded original; failed upgrade recovery without reset; protected stored Cricket current state and complete export; X01 play/backups retaining Cricket archive data; and failed score persistence exporting coherent in-memory and last-saved versions. The last journey also checks 390-pixel layout and the actual downloaded JSON contents.

A production offline scenario seeds a prior workspace, disconnects, reloads the cached app, validates the upgraded score/revision and downloads the original while offline. Existing scoring, profiles, corrections, imports, draft and update tests are retained; write-failure fixtures now recognise both workspace schema versions so they continue to exercise real writes.

Final local verification: `npm run check` passes typecheck, all 254 unit tests and the production build; `npm run test:e2e` passes all 73 browser tests; `npm run test:offline` passes all seven production offline/update tests (334 total). The phone backup-failure journey was also rerun independently with an overflow assertion and downloaded-file content checks. Phone screenshot `/tmp/darts-game-backup-phone.png` is browser-width evidence only, not a physical-device/usability sign-off. No Cricket playing screen, public restore readiness, hosted ownership or provider compatibility is claimed.
