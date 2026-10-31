# Local match lifecycle — 30 October 2026

v0.10 implements the local SC-03 lifecycle and extends its persistence/history/input contracts. Online permissions, timeout policies and result disputes remain separate work.

## States and transitions

Matches begin active. Only active matches accept visits or leg transitions. Pause retains scores, leg/set/opening state and the next thrower; resume returns to that same position. Pause is distinct from the existing simulated-opponent pause preference. Both scoring controls and automatic bot turns are blocked while the match is paused.

A scoring checkout that meets the configured target completes the match. An active or paused match can instead end by explicit concession or abandonment. Concession records which side conceded and awards the opponent the match outcome, without adding unplayed legs/sets, changing remaining scores or inserting fake darts. Abandonment retains all played data with no winner. Terminal states reject further scoring/lifecycle changes until corrected through undo.

Concessions count as match wins/losses in retained local profile records. Only actual played legs and visits contribute their respective totals. Abandoned matches are retained in history but excluded from profile match/win/loss and aggregate scoring records. Their own match summary still displays the actual visits. Result banners and exports identify the outcome rather than presenting an unfinished 0–0 score as a played victory.

All lifecycle actions are replayable commands. Undoing a terminal command removes its obsolete archive entry; redo restores it. Action history lists pause/resume/concession/abandonment without fabricating event timestamps. Finished history remains capped at 100 entries, now including abandoned games.

## Draft and rematch safety

If a draft is present, pausing or ending requires confirmation that the unsubmitted visit will be discarded. Cancelling leaves it intact; users can record it first. Resume starts a fresh empty visit for the retained turn. No old draft is silently restored after the lifecycle command changes the session identity.

Rematch is available only after a terminal outcome has saved. It uses a new match identifier and empty command history while retaining rules, formats and profile IDs. Its starter is explicit (default opposite the source match’s initial starter); current saved profile names are refreshed. Imported provenance is not copied onto a newly played rematch. The previous result remains archived. Save failures disable rematch and protect replacing even a zero-visit unsaved outcome.

## Compatibility and boundaries

New games use session v3, and a lifecycle action on an older saved game promotes its session to v3 while retaining its settings and earlier commands. Existing v1/v2 sessions remain replayable. Lifecycle commands in older versions, malformed conceding sides, unknown commands and unsupported future versions are rejected. Older releases cannot silently apply new outcomes with their prior rules. Workspace/backup envelope formats stay unchanged; terminal validation now includes abandonment as well as wins.

Local users can identify either side as conceding because this is a shared local scorer. This does not establish an online participant’s authority or consent. Those controls require the planned server referee and permission model.

## Evidence and remaining gates

Ten domain cases cover state transitions, paused scoring/bot/draft guards, both conceding sides, abandoned archive/import, profile semantics, terminal immutability, undo/redo, rematch identity and version/input rejection. Five browser journeys cover pending-bot pause/reload/resume, draft discard/cancel, concession/correction/rematch, abandoned export/import review and quota failure protection.

Fresh Chromium screenshots at 1366 and 390 CSS pixels show pause/end controls and outcomes without horizontal overflow. Phone-sized pause/abandon tests guard the compact layout’s outcome visibility. Local verification passes TypeScript/build, 124 unit tests, 46 development-browser tests and five production offline/update tests.

Physical Dell/phone/tablet usability, richer result search/filtering, retention controls, server enforcement and multiplayer/team lifecycle remain open. The full platform goal is not complete.
