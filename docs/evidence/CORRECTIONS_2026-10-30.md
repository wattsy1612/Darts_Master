# Historical correction evidence — 30 October 2026

Scope: IN-02 local historical visit editing, with atomic replay/recovery. Online authority remains unimplemented. The [policy](../CORRECTIONS.md) distinguishes existing draft/undo controls, the local editor and required hosted/provider acceptance gates.

## Authoritative paths

- `src/domain/correction.ts` creates a read-only preview, validates target/policy and simulated-visit boundaries, replays the candidate, checks retained actor/side/leg/set identity and computes before/after score/outcome consequences. It preserves the original object and never silently removes an invalid suffix.
- `src/data/repository.ts` revalidates the exact expected session and revision inside the queued transactional persistence boundary. Current/archive updates and the `before-correction` workspace snapshot commit together. Terminal archived edits preserve unrelated current play; reopened archived results require explicit current-game replacement.
- `VisitCorrection` exposes corrected total/dart count/opening/finishing declarations, follow-on policy, preview and separate acknowledgements. Preview is invalidated on input/policy changes; controls lock while saving. `MatchHistory` offers human visit actions and recovery controls; simulated turns are paused at review start.
- App integration confirms current-turn draft loss, invalidates only the affected redo branch, applies the committed workspace and provides recovery download. Direct undo is revision limited; the download stays available after later saves. The existing import recovery key is separate.

## Automated checks

- Domain cases exercise unchanged source/session objects, old schema preservation, pairs member/profile attribution, following score/bust changes, illegal leg continuation, explicit suffix removal, result reopening, removal of only edited segment detail, opening declarations and simulated/invalid-target rejection.
- Transactional cases cover current/archive consistency; no-op autosave preserving undo; reload/undo; terminal archive correction; acknowledged replacement and displaced-game recovery; archive reopen without a current game; stale review/source/other-tab rejection; subsequent-save undo refusal with downloadable backup; quota-failure rollback retaining the previous checkpoint; and no-op edit rejection.
- Five new development browser journeys cover preview/focus, apply and recovery after refresh; suffix acknowledgement plus dismissed/accepted draft discard; phone overflow and downloadable recovery after later play; storage failure retaining original workspace/review; and archived-result reopening with replacement acknowledgement and complete recovery.
- A production browser scenario disconnects the network, edits an earlier recorded visit, reloads offline and restores the original from its persisted correction checkpoint.

Initial browser fixture selectors were adjusted to use the app’s accessible button/label names and native focus flow. No assertion timeouts/retries were expanded. The phone-width correction screenshot `/tmp/darts-correction-phone.png` was inspected; this is not a physical-device or full accessibility sign-off.

Final local verification: typecheck, 213 unit tests and the production build pass; all 66 development browser tests and six production offline/update tests pass (285 total). A final targeted run verifies the five correction journeys after improving the storage-failure message; no retries or assertion timeouts were expanded. All broader registration, rooms, competition, media, hardware, branding and release gates remain open.
