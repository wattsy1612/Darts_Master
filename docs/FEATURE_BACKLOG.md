# Feature delivery backlog

This backlog turns the [master plan](IMPLEMENTATION_PLAN.md) and [design brief](DESIGN_BRIEF.md) into bounded work. It is a planning baseline, not a list of already delivered features. Existing behaviour should be reused and strengthened where noted.

**Status:** `Existing` means present in v0.5 and still subject to production hardening; `Planned` means not yet accepted as delivered; `Spike` requires evidence before a release commitment; `Conditional` needs a product/business decision. Release labels are internal implementation/validation stages, not permission for a reduced public launch. The owner requires the first polished public release to serve home/remote players, clubs/venues, teams and organisers together. No calendar dates or cost commitments are implied.

## Product, design and brand

| ID    | Deliverable                                  | Status / first release                | Depends on       | Acceptance evidence                                                      |
| ----- | -------------------------------------------- | ------------------------------------- | ---------------- | ------------------------------------------------------------------------ |
| UX-01 | Audience/jobs and task matrix                | Planned / definition                  | Owner/user input | First release users and top tasks documented                             |
| UX-02 | Dated competitor task audit                  | Planned / definition                  | UX-01            | Same task comparison with evidence and gaps                              |
| UX-03 | Screen map and annotated core journeys       | Planned / definition                  | UX-01            | Guest, practice, correction, recovery and future account paths specified |
| UX-04 | Device prototypes and usability sessions     | Planned / definition                  | UX-03            | Findings and changes from real Dell/phone/tablet tasks                   |
| UX-05 | Semantic tokens and component foundations    | Planned / local alpha                 | UX-04            | Tokens and component gallery implemented                                 |
| UX-06 | Compact match workspace and focus mode       | Planned / local alpha                 | UX-04–05         | Score, draft, record and correction reachable on reference screens       |
| UX-07 | Loading/error/offline/empty/unsaved patterns | Planned / local alpha                 | UX-05            | Applicable states exercised with meaningful recovery                     |
| UX-08 | Accessibility and input audit                | Planned / every release               | Core journeys    | Keyboard, focus, screen reader, touch, contrast and zoom evidence        |
| UX-09 | Phone/tablet/TV layout matrix                | Planned / staged                      | UX-04–06         | Actual device/orientation tests; TV control roles defined                |
| BR-01 | Positioning, voice and naming criteria       | Planned / definition                  | UX-01            | Written identity criteria matching full product scope                    |
| BR-02 | Name shortlist and screening                 | Planned / before public brand         | BR-01            | Dated app/business/domain/handle/trademark screen; selected name         |
| BR-03 | Three visual directions on real screens      | Planned / local alpha                 | UX-04, BR-01     | Comparable match/profile/room/overlay prototypes                         |
| BR-04 | Selected identity and UI token alignment     | Planned / before broad screen rollout | BR-03            | Owner/user review of concrete screens and adopted tokens                 |
| BR-05 | Logo/icon/asset/licence package              | Planned / public v1                   | BR-02, BR-04     | Source assets, variants, usage guide and rights record                   |
| BR-06 | Public app/landing/email/help consistency    | Planned / public v1                   | BR-05, OP-04     | No placeholder name/assets or unsupported capability claims              |

## Local game, data and training

| ID    | Deliverable                                         | Status / first release                                 | Depends on                       | Acceptance evidence                                                      |
| ----- | --------------------------------------------------- | ------------------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------ |
| SC-01 | X01 rules/sets configuration                        | Planned; core subset existing / local alpha            | Rules definition                 | Tested start/in/out/leg/set/starter fixtures                             |
| SC-02 | Participant/side/throw-order model                  | Planned / before pairs/online teams                    | SC-01, EN-01                     | Current saves migrate; singles/pairs/teams rotate correctly              |
| SC-03 | Concession, pause, abandon and rematch              | Planned; partial existing / local alpha                | Match lifecycle                  | Explicit result states and replay/correction tests                       |
| SC-04 | Game plugin registry plus Cricket                   | Planned / local alpha follow-on                        | SC-02                            | Complete rules, settings, UI and fixtures for first extra game           |
| SC-05 | Additional party and training games                 | Planned / expansion                                    | SC-04, demand                    | Every published mode has tested supported formats                        |
| IN-01 | Visual/precision/keypad entry                       | Existing / harden in local alpha                       | UX-06                            | Equivalent legal results and accessible interaction                      |
| IN-02 | Unified correction/review policy                    | Planned; last-action subset existing / staged          | SC-02, UX-06                     | Local and online authority/consequences specified and tested             |
| IN-03 | Provenance and metric capability flags              | Planned / before cloud/rankings                        | EN-01                            | Unsupported dart/coordinate metrics are unavailable, not fabricated      |
| IN-04 | Optional caller/voice/accessory input               | Spike / expansion                                      | IN-01, privacy/device tests      | Recognition/support limits and confirmation behaviour demonstrated       |
| TR-01 | Bot calibration/custom settings                     | Planned; three levels existing / local alpha follow-on | Metric definitions               | Measured score/finish distributions and repeatable fixtures              |
| TR-02 | Doubles/checkouts/clock practice                    | Planned / local alpha follow-on                        | SC-04                            | Complete session and scoring/results flow                                |
| TR-03 | Routines, goals and progress                        | Planned / expansion                                    | TR-02, PL-03                     | Useful trend/history tied to actual training records                     |
| PL-01 | Stable local profile selection/rename               | Existing / harden in local alpha                       | SY-01                            | No lost identity links or guest-name auto-claim                          |
| PL-02 | Versioned statistics definitions                    | Planned; basic stats existing / local alpha            | IN-03; accepted rule definitions | Weighted aggregates and sample/provenance reconciled                     |
| PL-03 | Match/leg search, trends and comparisons            | Planned / cloud/beta                                   | PL-02, SY-05                     | Filters/replay reconcile with retained events                            |
| PL-04 | Account profile, avatar and privacy                 | Planned / private online beta                          | AC-01–05                         | Ownership, public handle and private contact data separated              |
| SY-01 | Persistence boundary and versioned local migrations | Planned / local alpha                                  | EN-01                            | Current localStorage data migrates recoverably                           |
| SY-02 | Import/export with validation and preview           | Planned; export existing / local alpha                 | SY-01                            | Malformed, duplicate, huge and newer-version import paths safe           |
| SY-03 | Draft recovery and offline/installable behaviour    | Planned / local alpha                                  | SY-01, UX-07                     | No stale draft is restored into another turn; interrupted updates tested |
| SY-04 | Data retention/backup/restore controls              | Planned / local alpha                                  | SY-01–02                         | Restore reproduces results; limits visible                               |
| SY-05 | Cross-device sync and retry/conflict handling       | Planned / private online beta                          | AC-05, EN-03                     | Idempotent upload and explicit conflict behaviour                        |

## Identity, hardware and rooms

| ID    | Deliverable                                | Status / first release                       | Depends on                  | Acceptance evidence                                                |
| ----- | ------------------------------------------ | -------------------------------------------- | --------------------------- | ------------------------------------------------------------------ |
| AC-01 | Identity-provider and ownership decision   | Planned / cloud foundation                   | UX-03, budget               | Decision record, account/profile/household role model              |
| AC-02 | Sign-up, verification and sign-in          | Planned / private online beta                | AC-01, EN-02–03             | Verified, pending, duplicate, expired and retry paths work         |
| AC-03 | Recovery, sessions and account settings    | Planned / private online beta                | AC-02                       | Reset/expiry/revocation/email change/re-auth tests                 |
| AC-04 | Access controls and account abuse handling | Planned / private online beta                | AC-01–03                    | Two-account and scoped-role adversarial tests pass                 |
| AC-05 | Explicit local profile/result linking      | Planned / private online beta                | AC-02–04, SY-02             | Preview, ownership, conflicts, dedup and interrupted retry covered |
| HW-01 | Three/four-camera hardware benchmark       | Spike / connected alpha                      | Hardware arrival            | CPU/USB/frame/stability report for real devices                    |
| HW-02 | Capture-owner/runtime decision             | Spike / connected alpha                      | HW-01                       | Browser/native/provider ownership and Windows/WSL path proven      |
| HW-03 | Provider access and capability matrix      | Spike / each adapter                         | Official interface evidence | Access/terms and tested system/version scope recorded              |
| HW-04 | Mock adapter and event fixtures            | Planned / connected alpha                    | EN-01, HW-03                | Duplicate/late/reordered/takeout/reconnect conformance             |
| HW-05 | Board pairing, calibration and diagnostics | Planned / connected alpha                    | HW-02, AC-04 where hosted   | Actual setup/test/error recovery on hardware                       |
| HW-06 | First supported scoring adapter            | Planned after access spike / connected alpha | HW-03–05                    | Real games pass source/controller/correction tests                 |
| HW-07 | Disconnect recovery/manual handover        | Planned / connected alpha                    | HW-06, IN-02                | No duplicate scoring or hidden capture contention                  |
| RM-01 | Room/invite/role/readiness lifecycle       | Planned / private online beta                | AC-04, SC-02                | Host/player/scorer/spectator boundaries and expired invites tested |
| RM-02 | Authoritative match referee/realtime       | Planned / private online beta                | EN-03, RM-01                | Commands require expected revision and idempotency; clients agree  |
| RM-03 | Reconnect/timeouts/abandoned-match policy  | Planned / private online beta                | RM-02                       | Different-network interruption scenarios pass                      |
| RM-04 | Correction/dispute/result agreement        | Planned / private online beta                | IN-02, RM-02                | Who can change what and downstream replay are explicit             |
| RM-05 | Public lobbies/search/matchmaking          | Planned / public v1                          | RM-01–04, TM-04, OP-02      | Presence, filters, abuse controls and no-match states work         |

## Teams, events, media and expansion

| ID    | Deliverable                                   | Status / first release             | Depends on                        | Acceptance evidence                                                   |
| ----- | --------------------------------------------- | ---------------------------------- | --------------------------------- | --------------------------------------------------------------------- |
| TM-01 | Teams/clubs, membership and roles             | Planned / club beta                | AC-04                             | Invite/remove/transfer and private data boundaries tested             |
| TM-02 | Availability, line-ups and substitutions      | Planned / club beta                | TM-01, SC-02                      | Captain runs real session with missing/substitute player              |
| TM-03 | Team lobby, ready state and board assignment  | Planned / club beta                | TM-02, RM-01, HW-05               | Offline board/captain departure paths exercised                       |
| TM-04 | Communication, block/report and moderation    | Planned / before public rooms/chat | AC-04, OP-02                      | Abuse reporting/action/retention paths work                           |
| TM-05 | Invitations/fixtures/notification preferences | Planned / club beta                | TM-01, EN-04                      | No duplicate reminders; opt-out/quiet settings respected              |
| TO-01 | Knockout organiser-to-final lifecycle         | Planned / club beta                | RM-02–04                          | Entrants, draw, byes, boards, no-shows, disputes and final replay     |
| TO-02 | Groups/round robin and scheduling             | Planned / public v1                | TO-01                             | Tie-breaks, rest/board constraints and corrected results reproducible |
| TO-03 | Team events and league seasons                | Planned / expanded club release    | TM-02–03, TO-02                   | Fixtures, line-ups, reschedules, approvals and standings reconcile    |
| TO-04 | Referee/organiser tools and exports           | Planned / event release            | TO-01, AC-04                      | Scoped audited overrides and share/read-only views                    |
| VD-01 | Network/media/cost feasibility spike          | Spike / early cloud work           | Capture decision, test deployment | Different-network/relay/camera-contention measurements                |
| VD-02 | Private camera/mic setup and match video      | Planned / club beta                | VD-01, RM-01, AC-04               | Denied permission, mute, reconnect and scoring isolation              |
| VD-03 | Protected OBS/browser overlay                 | Planned / private/club beta        | RM-02, media access model         | Read-only authorised overlay and token/revocation policy              |
| VD-04 | Spectators and controlled streaming           | Planned / public v1                | VD-02–03, TM-04, cost gate        | Audience/limits/moderation/permission and network tests               |
| VD-05 | Recording consent, storage and retention      | Planned / replay release           | VD-04, privacy/cost decisions     | Visible recording, access, expiry and deletion exercised              |
| VD-06 | Event clips and richer replay                 | Planned / expansion                | VD-05, reliable event timestamps  | Match markers align to available media; missing video handled         |
| EX-01 | Additional scoring adapters and modes         | Planned / evidence-led             | HW-03–07 / SC-04                  | Per-provider/per-mode compatibility published                         |
| EX-02 | Rankings, ladders and community challenges    | Planned / expansion                | Provenance, RM-05, TO-02          | Eligibility and trusted-event policy prevent bot/import contamination |
| EX-03 | Pricing, billing and entitlements             | Conditional / commercial release   | Owner decision, measured costs    | Complete billing/cancel/failure/support lifecycle                     |
| EX-04 | Independent detection/compact appliance       | Spike / separate programme         | Data rights, HW benchmarks        | Accuracy/resource/support case before product commitment              |

## Engineering and operations

| ID    | Deliverable                                  | Status / first release                        | Depends on                             | Acceptance evidence                                                    |
| ----- | -------------------------------------------- | --------------------------------------------- | -------------------------------------- | ---------------------------------------------------------------------- |
| EN-01 | Module/routes/domain contract refactor       | Planned; tested core existing / local alpha   | UX-03; current domain boundaries       | Working app maintained; shared rules usable independently              |
| EN-02 | Hosting/identity/database/media decisions    | Planned / cloud foundation                    | Spikes and budget                      | Written options, trade-offs, cost and failure model                    |
| EN-03 | Staging API, database and migrations         | Planned / cloud foundation                    | EN-02                                  | Scoped endpoints, repeatable deploy, backup/restore and migration test |
| EN-04 | Reliable jobs, email and notifications       | Planned / cloud/beta                          | EN-02–03                               | Idempotent delivery, retries and failure visibility                    |
| EN-05 | CI expansion, telemetry and feature flags    | Planned; local CI existing / staged           | Each new runtime                       | Critical flow checks and observable rollback path                      |
| OP-01 | Performance/device/accessibility gates       | Planned / every release                       | UX-08–09, measurements                 | Recorded reference-device results and resolved blockers                |
| OP-02 | Security/permissions/moderation readiness    | Planned / online/public beta                  | AC-04, policy decisions                | Threat/abuse cases and incident action paths verified                  |
| OP-03 | Restore, rollback and service incident drill | Planned / hosted beta                         | EN-03–05                               | Demonstrated recovery with ownership/runbook                           |
| OP-04 | Onboarding/help/compatibility/support        | Planned / public v1                           | UX journeys, tested capabilities       | A user can understand limits and recover from common failures          |
| OP-05 | Privacy/age/media/retention decisions        | Planned / before public account/media release | Product decisions/review               | User-facing settings and lifecycle match the chosen policy             |
| OP-06 | Capacity/cost/release rollout                | Planned / public v1                           | Runtime measurements and release gates | Agreed launch load, service limits, flags and rollback evidence        |

## First delivery queue

1. UX-01–04: task audit, screen map and compact match prototype.
2. UX-05–07 + EN-01: reusable UI/routing foundation and playing-screen slice.
3. SY-01–04 + PL-02: storage/import/recovery and metric reliability.
4. SC-01–04: rules/participant boundaries and first additional game.
5. HW-01–04 in parallel when the physical cameras are available.
6. BR-01/03/04 alongside the UI work; BR-02 when an actual name shortlist is ready.
7. EN-02–05 → AC-01–05 → RM-01–04 for the first complete registered remote match.

For each promoted item, create a bounded issue/PR with: feature ID, user journey, scope/exclusions, dependency evidence, design reference, data/permission changes, test cases, migration/rollback considerations and definition of done. Update the acceptance status from reviewed evidence, not from a screen being present.
