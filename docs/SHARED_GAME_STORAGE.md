# Shared game storage and recoverable upgrade

Internal SC-04/SY-01/EN-01 work, application v0.19. Cricket now has a local playing preview using the same transactional storage, archive, profile links, backup and recovery machinery. Public format-2 Cricket/mixed restore and read-only match history now use this same boundary. Full profile/correction and device acceptance remain open.

## Version boundaries

| Artifact                                   | Reader / writer contract                                                      |
| ------------------------------------------ | ----------------------------------------------------------------------------- |
| IndexedDB database                         | Database version 1, existing workspace object store; no separate Cricket silo |
| Main workspace document                    | Read X01-only v2 recoverably; write game-aware v3                             |
| X01 sessions                               | Existing schema versions 1–5 and equivalent explicit game/rules tags          |
| Cricket sessions                           | Cricket schema 1 with explicit standard rules identity                        |
| X01-only portable backups/match exports    | Existing format 1, preserving existing readers and legacy source IDs          |
| Mixed-game backups / Cricket match exports | Format 2, retaining the game discriminator and distinct result fields         |

The typed `WorkspaceData`/`WorkspaceDocument` now carry discriminated `GameRecord` values. Existing X01-only views narrow records explicitly; no game-specific fields are cast into another game’s score model. Test fixtures can select a concrete record type when reading a known fixture. The current scorer’s total/draft/correction controls still require X01.

## Atomic v2 → v3 upgrade

`openLocalRepository` validates the existing document before changing it. Valid v2 data must contain only X01 records. One read/write transaction stores its exact original workspace under `before-game-workspace-migration`, advances the revision, and writes canonical v3. A second opener sees v3 and does not repeat or replace the checkpoint. Unknown schemas, invalid records, or unsafe revision increments preserve the original.

Matching tab-local drafts move only their revision marker: version 1, exact canonical current-game/command-prefix identity and the old workspace revision must all match. Their token, value and saved time stay unchanged; stale/different-turn drafts are not promoted. The normal explicit restore, validation, duplicate-tab and expiry policies remain in force.

If any workspace/checkpoint/draft write fails, the entire upgrade rolls back. Readable old games remain available in memory, writing stays disabled, and the UI offers readable/raw recovery. It does not reset the old database. Reload can retry after storage becomes available. A valid old workspace is not treated as empty just because the upgrade failed.

**Download pre-upgrade backup** in Data & backups exports the readable original through the existing reviewed format. There is no automatic downgrade that could erase games recorded later. Old import/correction checkpoints remain downloadable; the revision advance conservatively disables direct undo of an older checkpoint. Browser clearing/eviction can still remove local data and recovery copies.

## Game-aware operations

- One current-game slot and one latest-100-result archive cover both games. Shared bounds, queued writes, database revision comparison and recovery apply to either record type.
- Normal play can update/remove a game’s own result without dropping another game. Reusing a match ID across game types is rejected before current/archive replacement. Current/archive collisions with inconsistent content are rejected.
- Content comparison strips local profile ownership links as before, includes Cricket’s game/rules identity and preserves the established X01 legacy hash recipe. Repeated imports deduplicate equivalent results; conflicting IDs require skip/copy review.
- Full backup linking maps every side member’s explicit profile reference. Standalone exports import as guests. Names do not establish account ownership. Both games remain unverified local records.
- Mixed-game backup format 2 now validates publicly through the same parser/plan/transaction path. The former internal opt-in is removed; the parser returns the actual game union. Cricket-bearing files require format 2. Unknown rules/games remain invalid, and claimed result summaries never replace replayed commands.
- A current Cricket record opens its playing workspace directly. X01 cannot reinterpret it. The shared match centre explicitly switches game-specific reports; X01 profile statistics continue to filter X01 and say so. Complete backups retain both games.
- X01 historical corrections remain X01-only. Their full-workspace checkpoints include both games and restore without dropping the other game’s data.

## Saving failures and portable recovery

A failed score write can leave the in-memory game ahead of the persisted archive. The readable backup reconciles the archive with that in-memory game, so an undone finish is not exported alongside a conflicting stale result with the same ID. This does not change the database. **Download last saved readable backup** separately exports the last confirmed readable workspace while changes are unsaved. The operator can preserve both versions as valid, independent backup files rather than merging contradictory states or inventing new result identities.

The two files have distinct purposes: the normal/readable backup contains current in-memory play; the last-saved file contains the stored prior version. Import continues to require preview/selection/replacement acknowledgement, never automatically deleting existing results. Raw recovery remains available when parts of storage cannot be interpreted.

## Remaining acceptance

The shared store now powers the local Cricket playing preview, including exact-turn draft recovery, lifecycle, undo/redo and rematches. Two-player setup is available; imported/existing configured rosters can resume without losing actor attribution. New pairs/team setup, cross-match profile aggregation, earlier-visit correction and complete device/accessibility journeys remain acceptance work. Hosted sync, account ownership, provider authority and production readiness remain separate open gates.
