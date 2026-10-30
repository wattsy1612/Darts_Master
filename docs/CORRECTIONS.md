# Score correction policy

Local implementation v0.15; online policy below is a design contract, not a delivered service.

## Local authority and entry types

The person operating this browser may correct human-entered scores. A browser-local player/profile link does not establish account ownership or referee authority. All current local, practice and imported records remain unverified. The scoring engine validates the same rules before and after correction.

| Situation                        | Action and consequence                                                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| Misplaced dart before recording  | Remove/change that draft dart; no accepted score changes                                   |
| Last accepted action             | Scorer undo/redo; practice groups a human/bot pair as already defined                      |
| Earlier human visit              | Match history → Correct → edit total/darts/opening/finish declarations → preview → apply   |
| Earlier simulated visit          | Manual rewriting is unavailable; correct a human visit or undo simulation from the scorer  |
| Lifecycle or bull-off action     | Existing scorer undo/redo; the historical visit editor does not rewrite those action types |
| Online/provider/tournament score | No connected implementation yet; do not treat a local edit as an authorised remote result  |

The historical editor records a visit total. It removes the edited visit’s individual segment detail and assigns manual-total source on schema v5; older schema 1–4 sessions retain their original shape/unknown input origin. Other retained visit details, sources, side/member/profile IDs and import markers are preserved. It does not invent replacement darts or target coordinates.

## Review and replay

A review captures the full selected session and workspace revision. It is read-only until applied. Edits to any field or the following-action policy invalidate the preview. Simulated turns pause while reviewing. A review cannot silently follow a moving match or adopt a newer target session.

- **Keep and replay following actions:** replay all commands. Reject illegal continuations, including invalid leg transitions or a changed thrower/side/leg/set assignment. Recompute scores, openings, busts, checkouts, played legs/sets, lifecycle and winner. Show changed following-visit counts, both sides’ before/after scores/legs/sets and result state.
- **Remove all following actions:** explicitly show and acknowledge the number removed, including subsequent scores, leg changes, pauses and end actions. Preserve only the prefix and corrected visit; never silently truncate a suffix to make an edit pass.
- Reopened results leave the finished archive and become the current game until decided again. If another current game exists, replacement requires a separate acknowledgement. The displaced game is retained in the recovery workspace. Terminal archive edits leave an unrelated current game/draft alone.
- Affecting the current turn requires separate confirmation before discarding an unsubmitted or recoverable visit draft. Cancelling that confirmation leaves recorded data and review intact. Current-match correction clears the old redo branch, since it no longer belongs to the edited history.
- Unchanged edits are rejected instead of claiming a correction/recovery save. Source or detail changes remain meaningful even when the numeric score is the same.

## Persistence and recovery

The repository re-normalises and replays the proposed edit. Inside a revision-checked IndexedDB transaction it compares the exact original session, updates current/archive together, and stores the previous complete workspace at `before-correction`. A stale revision, changed source session, invalid result, storage failure or missing replacement acknowledgement aborts the entire operation. Failed writes do not overwrite the prior checkpoint or original workspace. Save failure is visible; export unsaved play if any, then reload and review again when storage is available.

Only the latest pre-correction workspace is retained. It is separate from the pre-import checkpoint. Undo restores that complete workspace only while its applied revision is still current; any subsequent saved change disables direct undo. A no-op autosave does not consume the recovery window. Download remains available after direct undo is disabled. The backup uses the existing reviewed import format, enabling selective recovery rather than overwriting subsequent work.

Recovery survives page reload and built-app offline reopen. Browser eviction/clearing can remove it. General workspace exports contain the selected main workspace, not a history of recovery checkpoints; use **Download pre-correction backup** for this snapshot. Full snapshots need storage capacity; failed quota writes roll back rather than trimming records. Undo does not recreate discarded tab-local draft edits; any still-retained exact-turn draft recovery remains subject to explicit restore.

This is mutable local history plus one recoverable checkpoint, not a permanent signed correction audit. Exported corrected sessions remain unverified and do not gain competition/ranking eligibility.

## Required online/provider authority before release

RM-02/RM-04, AC-04 and adapter work must implement these boundaries before online corrections are offered:

1. The server derives the actor and permission scope: player, delegated scorer, board controller or event referee. A display name/profile ID from a request cannot grant authority.
2. A correction request identifies match, exact revision, target command, proposed edit, reason and idempotency key. Repeated delivery returns the same accepted/rejected result; stale requests require a fresh review.
3. The room/event policy determines proposal, opponent acknowledgement and referee overrides. Pending/disputed/accepted/rejected states are visible to participants; no client silently rewrites another player’s recorded turn.
4. The authoritative referee validates and replays the complete continuation. Suffix removal, changed actor/leg assignment, result reopening and downstream competition effects require an explicit permitted resolution, not automatic deletion.
5. Retain an append-only audit with original/proposed/accepted values, requesting/approving identity, time, reason, revision and consequences. Define retention/access before release. Local recovery snapshots are not a substitute.
6. Recompute affected summaries, standings/advancement, overlays and replay markers under explicit event rules. Downstream events already played cannot be silently reassigned; surface the dispute for the scoped organiser/referee.
7. Adapter detections retain provider event identity, source/detail/confidence where supplied, and controller handover/reconnect rules. Manual overrides are distinguishable from original detections; unsupported measurements stay unavailable.
8. Test two-account/scoped-role adversarial cases, duplicate/reordered requests, interrupted confirmation, conflict/reconnect and corrected-result agreement across real devices before marking the online acceptance gate complete.

No server roles, correction request API, permanent audit, provider override or competition propagation is implemented by the local editor.
