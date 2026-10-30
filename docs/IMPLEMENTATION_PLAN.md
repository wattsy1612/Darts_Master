# Darts Master — full product implementation plan

**Planning baseline:** 30 October 2026, application v0.5.0. Product name remains undecided. This is the plan for the complete platform, not a statement that planned features already exist.

Use this alongside the [UI/UX and brand brief](DESIGN_BRIEF.md), [delivery backlog](FEATURE_BACKLOG.md) and [roadmap overview](ROADMAP.md). Feature IDs in the backlog are the implementation tracking references.

## 1. Product direction

Build a darts platform that works for a player practising alone, friends at one board, remote opponents, teams, clubs and tournament organisers. Manual scoring must remain a complete way to play. Automatic scoring systems connect through independently tested adapters where their interfaces and permissions allow it. Video supports playing and watching without becoming a dependency of scoring.

The intended differentiators are a clear playing experience, reliable scoring, compatibility across supported inputs, social competition and useful player development. “Better than other apps” is a goal to validate through player testing and measured comparisons, not a claim the prototype can make today.

### Confirmed scope

- Interactive manual scoring, automatic scoring integrations and eventual independent detection research.
- A complete registration process later in the sequence: sign-up, verification, sign-in, recovery and account settings.
- Player identities, statistics and progress across devices after cloud support is built.
- Interactive match rooms, team lobbies, clubs, leagues and tournaments.
- Streaming, spectator experiences, oche camera and replay.
- A deliberate UI/UX, brand identity and launch experience.
- Git-based delivery, automated verification and a dependable local setup.

### Working assumptions requiring validation

- Start with an English-language, UK-focused web product, designed for later localisation.
- Windows on the Dell is the first hardware test host; browser clients cover desktop, phone and tablet. TV is initially a display/spectator client.
- Manual local play remains usable without registration. Accounts are required for cloud-owned data and public online activity.
- Public commercial release is a possible destination. Pricing, subscriptions, age policy, launch territories and the business entity remain undecided.
- The core application owns its match rules and statistics rather than inheriting them from one detection supplier.

These assumptions guide discovery; they do not authorise spending, signing commercial agreements or making provider commitments.

## 2. Current implementation and gaps

| Area                                 | Present in v0.5                                                                   | Remaining work                                                                                        |
| ------------------------------------ | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| X01                                  | Two-player 301/501/701, double out, legs, starting player, busts, checkout routes | Rule variants, sets, more participants, doubles/team formats, match-policy configuration              |
| Manual input                         | Interactive SVG board, larger precision controls, keypad, individual dart details | Scoring-screen usability pass, voice/accessory input research, richer correction workflow             |
| Practice                             | Three simulated opponent levels, automatic turns, pause, repeatable throws        | Training games, routines, difficulty calibration, progress plans                                      |
| Player profiles                      | Browser-local saved names and IDs, selection, rename, records                     | Accounts, ownership, cloud sync, richer profile preferences, trends                                   |
| Results                              | Current-match recovery, latest 100 completed matches, JSON export                 | Validated import, durable database, retention controls, search, audit and sync                        |
| UI                                   | Responsive provisional visual direction                                           | Formal design system, routing, accessibility audit, device-specific playing layouts                   |
| Infrastructure                       | React/TypeScript/Vite, domain tests, Chromium tests, CI, Windows launcher         | Hosted backend, production deployment, observability, release/rollback and support tooling            |
| Cameras / integrations               | No connected adapter                                                              | Hardware benchmark, supported interface discovery, pairing, detection lifecycle and conformance tests |
| Online / teams / tournaments / video | Not implemented                                                                   | All corresponding services, permissions, interfaces and failure recovery                              |

At the baseline, 67 domain tests and 21 browser tests pass. The application remains a development build; passing these tests is not evidence of production readiness. The active implementation is on `codex/app-foundation` in PR #1, not yet merged to `main`.

Current limitations to preserve in planning: unrecorded draft darts are not recovered after refresh; browser data can be removed; guest names do not establish identity; retained profile records cover only linked completed matches in the current archive; there is no server-owned referee or cloud account.

## 3. People and permissions

| Role                           | Main needs                                                           | Permission boundary                                                  |
| ------------------------------ | -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Guest / household player       | Immediate local play, temporary names, easy corrections              | No implicit account ownership or public identity                     |
| Registered player              | Private profile, records, remote games, training                     | Own profile and permitted match actions                              |
| Scorer / board controller      | Run the board and enter or correct scores                            | Explicit delegation for a board or match; not general account access |
| Team captain                   | Invite members, manage line-up, ready team, submit permitted results | Team-scoped authority                                                |
| Club / venue administrator     | Manage boards, members, sessions and club competitions               | Club-scoped authority                                                |
| Tournament organiser / referee | Configure events, seed, assign boards, resolve disputes              | Event-scoped powers with an audit trail                              |
| Spectator / commentator        | Follow an authorised match or stream                                 | Read-only access; separate media permissions                         |
| Moderator / support            | Handle reports, abuse and support investigations                     | Narrow, logged tools; no routine access to private media             |
| Platform administrator         | Operations, service configuration and incidents                      | Privileged, protected, audited access                                |

An account, a player profile, a team and a physical board are separate entities. Decide explicitly whether an account can manage several household profiles and how a guest profile can later be claimed. Display-name equality must never grant access to another profile or its results.

## 4. Release definitions

| Release                         | What a user can do                                                                                                                                             | Exit condition                                                                  |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Local alpha                     | Play, practise, keep and restore results with a coherent interface                                                                                             | Local reliability, backup/import and core UX gates pass                         |
| Connected alpha                 | Pair a tested board input and complete games with corrections                                                                                                  | Hardware and adapter conformance pass; manual fallback remains available        |
| Private online beta             | Register, migrate chosen local data and play an invited opponent                                                                                               | Account, authoritative scoring, permissions and reconnect gates pass            |
| Club beta                       | Run team sessions, an initial tournament and private video matches                                                                                             | Organiser/referee workflows, moderation and media recovery pass                 |
| Public v1                       | Use the branded product for local and supported automatic scoring, invited/public rooms, teams, core tournaments, profiles and supported live video/spectating | Public-release checklist passes; compatibility and service limits are published |
| Expanded platform               | Additional games/providers, advanced leagues/rankings, richer training/replays and optional commercial features                                                | Each expansion passes its own evidence and cost gate                            |
| Detection / appliance programme | Evaluate independent scoring and compact hardware                                                                                                              | Separately validated accuracy, rights, hardware and support case                |

No calendar launch date is committed here. Dates depend on validated scope, provider access, actual hardware tests, available development capacity and feedback. Estimate each milestone after its first technical spike and screen prototype.

## 5. Delivery phases and dependencies

| Phase                                 | Work                                                                                                                                 | Dependencies                                                 | Completion gate                                                                                     |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| A — product and experience definition | User journeys, competitor task audit, feature priorities, screen map, brand directions, technical risk register                      | Current baseline                                             | Agreed local-alpha journeys and measurable acceptance criteria                                      |
| B — coherent local product            | UI system, routes, component boundaries, compact match layouts, correction UX, storage/import, scoring variants and initial training | A                                                            | A new player can complete the local journeys without assistance or lost results                     |
| C — hardware and adapter feasibility  | Three-camera benchmark, oche-camera resource test, provider access checks, mock adapter and first real adapter                       | Hardware arrival; can run alongside A/B                      | Documented supported capture/integration path and passing adapter fixtures                          |
| D — cloud and full registration       | Hosting, database, managed identity selection, registration/recovery, permissions, local-data linking and sync                       | A/B data contracts; identity/deployment decision             | Two accounts on separate devices have isolated data and correct recovery/migration                  |
| E — online match rooms                | Invitations, presence, ready check, server referee, live scoring, reconnect, corrections and result agreement                        | D and stable domain contracts                                | Two real devices complete and recover a match with no duplicate or unauthorised scores              |
| F — teams, clubs and communication    | Membership, captains, line-ups, team lobbies, notifications, chat/reporting                                                          | D/E                                                          | Club test session passes normal, substitute, disconnect and moderation scenarios                    |
| G — tournaments and leagues           | Knockout first, then groups/round robin, fixtures, boards, standings, disputes                                                       | E/F; solo events can precede teams                           | An organiser runs an event end to end with reproducible standings                                   |
| H — video, streaming and replay       | Early media spike, private video, spectator/OBS views, streaming, recording and retention                                            | Spike can start during C/D; release depends on E permissions | Media works across different networks, fails independently of scoring, and meets cost/consent gates |
| I — beta and public release           | Final brand, onboarding/help, performance/accessibility/security review, support, operations, capacity and launch                    | Relevant B–H gates                                           | Release evidence, rollback procedure, ownership and support readiness are recorded                  |
| J — expansion                         | More providers/games, deeper training, rankings, commercial options, independent detection                                           | Public feedback and evidence for each proposal               | Explicit scope, acceptance and operational cost before implementation                               |

Media feasibility must be explored before promising a streaming experience; it is not left uninvestigated until every team and tournament screen is built. The first provider/hardware spike also happens early so unsupported interfaces do not dictate late redesigns.

## 6. Complete feature workstreams

### 6.1 Match rules and game catalogue — SC

**Local alpha / core:** configurable X01 start values, straight/double in and out, clear rule descriptions, legs and sets, selectable/alternating starters, bull-off workflow, match pause/resume, rematch, concessions and abandoned-match status. Separate rule configuration from presentation and score input.

**Follow-on games:** Cricket with scoring and no-score variants, Around the Clock, Bob’s 27, 121/checkout challenges, target practice, count-up and warm-up routines. Add Killer, Shanghai, team variants and other party/training games only with a written rules fixture and tested scoring plugin. A catalogue entry must show supported local, practice, team and online modes.

**Multiplayer formats:** more than two local players, pairs/doubles, teams and rotating throw order. Distinguish a match participant from the individual throwing a dart. Do not stretch the current two-element arrays into every future format; introduce a participant/side model with a compatibility migration.

**Gate:** fixtures cover every supported rule, bust, finish, throw order, set/leg transition, concession and correction. A match replays to the same result on the client and server.

### 6.2 Score input and correction — IN

- Keep dartboard, precision controls and visit-total keypad available; input choice must not change rules.
- Provide a visible draft versus committed score, actual dart count, current thrower and next action.
- Add explicit no-score/bust handling, confirmation policy, keyboard shortcuts and optional score calling.
- Design corrections for last dart, last visit and an earlier entry. Show the affected score and downstream consequences before committing a historical correction.
- For online play, use permissioned correction requests and approvals/referee authority instead of silently undoing another person’s turn.
- Add event provenance: manual totals, manual individual darts, detected darts, imported results and simulated opponents are distinct.
- Research voice entry and supported accessories later; ambiguous recognition requires confirmation. Never silently turn speech into a ranked result.

**Gate:** one misplaced tap can be corrected without arithmetic; retry/duplicate input cannot record twice; local and online correction policies are explicit and tested.

### 6.3 Practice and player development — TR

- Calibrate simulated opponents through recorded distributions and playtesting; add custom targets or average bands only when measured.
- Save preferred difficulty, routines, goals and recent training sessions.
- Support per-dart drills, checkout routes, doubles practice, pressure scenarios, timed routines and daily/custom challenges.
- Separate practice records from competitive results, including bot games and imported historical data.
- Show progress trends, personal bests and a useful next practice task with a clear explanation.
- Add achievements/streaks only if they help the game and can be disabled; avoid intrusive interruptions during play.

**Gate:** repeatable simulations and meaningful training fixtures pass; progress calculations state their sample and limits rather than inventing precise improvement claims.

### 6.4 Profiles, records and analytics — PL

- Extend local profiles with preferences, avatar, handedness if useful, favourite double, privacy and accessibility settings.
- Define ownership, public handle and display name separately from login/contact details.
- Build match search/filtering, per-leg breakdowns, first-nine averages, scoring bands, checkout attempts/rate, doubles performance, opponent comparisons and trends.
- Publish metric definitions. Do not calculate checkout percentage without recorded attempts, or exact landing heatmaps from visit totals alone.
- Label data completeness: visit-total only, dart-level score, coordinate-level detection and independently verified competition data.
- Provide user data export, validated import, retention controls and cloud recovery once accounts exist.

**Gate:** weighted aggregates reconcile with match events; unsupported metrics show unavailable rather than guessed values; rename/merge/import cannot double-count a match.

### 6.5 Registration, identity and ownership — AC

This is a confirmed later implementation phase, before public online participation and cloud-owned history.

**Full journey:** account creation; input validation; email verification and resend/expiry handling; sign-in and sign-out; forgotten-password/reset flows; expired/reused link handling; session expiry/re-authentication; account recovery; verified email changes; account settings; account export/deletion and session revocation. Choose password, passwordless or provider-assisted paths during identity-provider selection, with accessible recovery for the chosen method.

**Optional paths:** social login, passkeys and additional authentication protection. Add them only with defined account-linking and recovery behaviour. Prevent accidental second accounts and unsafe automatic merges.

**Local-to-account linking:** show the local profiles and matches available, let the authenticated user select what they own, preview conflicts, import with stable source identifiers, deduplicate transactionally and retain a recoverable local copy. Record provenance and migration outcome. A matching display name is not proof of ownership.

**Access model:** server checks on all profile, room, team, event, device and media operations; protected sessions; account and invitation abuse limits; support workflows and audit for privileged actions. Use established identity libraries/services rather than a bespoke password system.

**Gate:** two accounts cannot read/write each other’s private data; verification/recovery/session tests pass; duplicate migration and interrupted import are safe; deletion and recovery behaviour is documented and exercised.

### 6.6 Local persistence, offline use and cloud sync — SY

- Introduce a versioned persistence layer and evaluate IndexedDB for local matches/drafts/queues; keep migrations from v1 localStorage data recoverable.
- Add validated JSON import with preview, size limits, schema/version checks, deduplication and a clear destination. Imported results retain provenance.
- Recover drafts only when they still match the current match revision and thrower; do not restore stale darts into a later turn.
- Installable web-app behaviour and offline local scoring should be tested, including unavailable storage, interrupted updates and low-space handling.
- After accounts exist, sync immutable match events/results and profile changes through an outbox with retries, idempotency and conflict handling.
- Offline local games can be uploaded later. An online competitive match must not silently continue as an independent, divergent official match while disconnected.

**Gate:** refresh, restart, quota failure, migration and reconnect preserve the agreed score; restore/import tests reproduce the original result; sync retries never duplicate data.

### 6.7 Cameras, boards and scoring adapters — HW

The ambition is broad compatibility. The release promise is a published matrix of tested systems, versions and capabilities.

**First hardware work:** verify the Dell’s exact CPU/USB controllers and usable capture paths; enumerate all three scoring cameras; measure simultaneous frame delivery, CPU, memory, dropped frames, stability and USB contention. Repeat with the fourth oche camera and any recording/encoding enabled. Camera names, supported formats and benchmark conditions go into a hardware report.

**Capture ownership:** WSL development access does not establish Windows camera access. Compare browser capture, a Windows-native local agent and any provider-owned capture service. Do not open the same camera concurrently in conflicting applications. Choose the capture owner before implementing calibration or preview.

**Board workflow:** device discovery, pairing, board identity, camera assignment, focus/exposure controls where supported, lighting/mounting instructions, calibration, health check, test throws, confidence/correction review, takeout/clear-board detection, connection loss and manual fallback. Add guided diagnostics and exportable logs without credentials.

**Adapter contract:** capability discovery; source event IDs; device/board/match identity; ordered dart observations; optional coordinates/confidence; takeout lifecycle; status/error events; reconnect; deduplication; and version negotiation. Match policy chooses one active scoring controller, with an explicit handover to manual control. An observation is not automatically an accepted score.

| Input/provider                          | Planning position                                                 | Evidence needed before support is advertised                                                                                        |
| --------------------------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Manual board / keypad                   | Working baseline; continue testing                                | Full rule and correction conformance                                                                                                |
| Mock/replay adapter                     | Build first for repeatable input testing                          | Duplicate, late, missing, reordered and takeout fixtures                                                                            |
| Initial Autodarts setup                 | First investigation candidate from the existing project direction | Current permitted integration interface, credentials/rights, event lifecycle and successful hardware test; no API access is assumed |
| Scolia                                  | Potential later adapter                                           | Business API access, terms, supported hardware/account scope and conformance; advertised API is not confirmed access for this app   |
| Other camera / electronic-board systems | Discovery queue                                                   | Obtain vendor-specific interfaces and permission; define partial capabilities honestly                                              |
| Independent detection                   | Separate research programme                                       | Dataset rights, calibration, accuracy benchmarks, occlusion/takeout tests and maintainable hardware requirements                    |

**Gate:** recorded and real events score once, board removal never adds a visit, recovery does not duplicate darts, and provider failure leaves a usable manual path. Publish the compatibility matrix and known limits.

Scolia publicly describes event access through a business API, including throw and takeout events; access and product terms still need confirmation. [Scolia API](https://scoliadarts.com/api/). Autodarts’ official guides are a starting point for current product behaviour, not proof of permission for a third-party integration. [Autodarts guides](https://docs.autodarts.com/).

### 6.8 Online match rooms and matchmaking — RM

- Private rooms, invite links/codes, room expiry and clear host/player/scorer/spectator roles.
- Rule negotiation, board selection, connection checks, ready states and a visible start agreement.
- Server-authoritative scoring with ordered commands, expected revision and idempotency keys.
- Live score, whose turn, dart/visit status, corrections, result agreement, rematch and concession.
- Presence, reconnect grace periods, timeouts, host departure and abandoned-match policy.
- Public lobbies/search and matchmaking after account controls and moderation are ready; filter by game, region/latency, scoring method and skill preferences where supported.
- Fair-play labels distinguish practice, casual, manual, supported automatic and tournament/refereed contexts. Automatic scoring is not by itself proof of honest play.

**Gate:** two devices on different networks recover from packet loss/reconnect with one authoritative result; a spectator or opponent cannot submit another side’s score.

### 6.9 Teams, clubs, venues and communication — TM

- Create/join a team or club; invite codes/links, membership requests, roles, ownership transfer and removal.
- Team home, roster, availability, captain controls, line-up/rotation, substitutes and match-night preparation.
- Team lobbies with ready states, board assignment, scheduled sessions and permitted shared scoring.
- Direct/team/event communication, notifications and mute preferences. Introduce text chat with report/block, rate limits, moderation and retention behaviour rather than an unmoderated public inbox.
- Venue board management and scorer/referee delegation; distinguish a board that is offline from a member who is absent.
- Email/in-app invitations, fixture changes and reminders with preference controls and quiet notifications.

**Gate:** a captain can organise a real team session; role removal takes effect immediately; private membership/content cannot be accessed through guessed identifiers.

### 6.10 Tournaments and leagues — TO

**First tournament:** organiser setup, entry/eligibility, check-in, seeded/random draw, knockout bracket, byes, board assignment, start/readiness, result submission, organiser correction, referee decisions, withdrawals/no-shows, final standings and shareable spectator view.

**Next:** round robin/groups into knockouts, points/tie-break definitions, multi-board scheduling, rest windows, teams/pairs, event announcements and participant notifications.

**Leagues:** club/season configuration, divisions, home/away fixtures, rescheduling, line-ups, result approval, points/legs tables, tie-breaks, disciplinary adjustments with an audit, season history and exports. Add Swiss/double elimination or regional ladders after demand and rule fixtures are established.

**Gate:** replaying the event’s accepted results rebuilds its bracket/table exactly; byes, no-shows, disputes and late corrections do not strand downstream fixtures.

### 6.11 Video, streaming, spectators and replay — VD

Keep scoring video/capture, player/oche video and public broadcasting as separate capabilities and permissions.

- Pre-call camera/microphone preview, device selection, consent, mute, camera off, reconnect and audio feedback controls.
- Private match video, board/player view switching and a separate read-only spectator experience.
- WebRTC signalling and relay capability for remote peer connections; evaluate a managed media service versus self-hosted infrastructure with a measured cost/load spike.
- OBS/browser-source overlays with clear live state, player names, scores, team/event context and controlled access.
- Public/private/unlisted stream policy, spectator limits and moderation/rights controls.
- Recording and replay only with an explicit recording state, retention choice, permissions and storage cost plan. Start with bounded clips/event markers; investigate multi-angle and synchronised replay later.
- Missing video must not stop legal scoring. Lower bandwidth/video quality before sacrificing score updates.

Browser media capture requires a secure context and user permission; localhost behaviour does not validate a public or LAN deployment. [MDN getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia). Include TURN relay planning rather than assuming every pair of users can connect directly. [WebRTC TURN guidance](https://webrtc.org/getting-started/turn-server).

**Gate:** test separate networks and constrained connections, permission denial, device contention, mute, backgrounding and reconnect; scoring continues during media failure; media cost and retention bounds are known before public streaming.

### 6.12 Rankings, community, commercial features and detection research — EX

- Build rankings only after trusted event provenance and competition policies exist; exclude bots and clearly label imported/manual categories.
- Consider ladders, seasons, achievements, coaching plans, community challenges and public profiles through observed demand.
- Decide free/paid boundaries, venue plans or subscriptions after the core value and service costs are measured. If enabled, add entitlements, trials, billing portal, cancellations, failed-payment recovery, invoices and support flows; do not implement a checkout page without the lifecycle behind it.
- Complete brand assets, landing pages, support/help, onboarding, changelog, compatibility pages and a feedback route for launch.
- Evaluate compact standalone hardware only after software/capture requirements are measured. Independent scoring is a research stream, not a promised replacement date for a provider’s engine.

**Gate:** each expansion has an owner, evidence of user value, acceptance tests and an operational/cost case. These are planned options until prioritised.

## 7. Technical architecture

### Proposed structure

```text
Browser / installable web client / TV display
  ├─ UI system, routes and accessible device-specific views
  ├─ Shared rules, replay, input preview and metric definitions
  └─ Local persistence, recovery and sync outbox
             │ authenticated application API / realtime connection
Hosted application backend
  ├─ Identity integration, accounts and scoped permissions
  ├─ Match referee, rooms, membership and event scheduling
  ├─ Profiles, analytics projections and notifications
  ├─ Relational database, migrations and audit records
  └─ Jobs / queues / object storage when required
             │ controlled media signalling and permissions
Media service / relay / recording storage

Board host / local device agent
  ├─ Device pairing and capture ownership
  ├─ Provider adapters or native camera service
  └─ Normalised observations → referee; not direct score overwrites
```

Keep the current TypeScript rules reusable on client and server. Use a modular application backend and relational data store first; do not create a fleet of independent services without a measured need. Media and device capture have distinct runtime/resource requirements and may be separate deployable components.

Select the identity, database/hosting, realtime and media providers through short decision records that compare capability, cost, portability, data location, development experience and failure handling. This plan proposes boundaries, not an unresearched vendor commitment.

### Core data model

Account / identity; player profile; account-profile ownership/claim; board; device/agent; adapter connection; match; participant/side; leg/set; ordered score event; correction decision; source observation; result; practice session; room and membership; team/club and role; invitation; tournament; entrant; bracket/fixture; league/season/table; notification; report/moderation action; media session; recording/clip; subscription/entitlement if commercialised.

Every mutable record needs an ownership rule, version/conflict policy and retention decision. Results reference stable IDs while preserving the historical display names used in the match.

### Event and sync contract

- Command ID, match ID, actor and authorised role, expected match revision and source identity.
- Server sequence/version and accepted/rejected outcome; clients do not supply authority by sending a timestamp.
- Provider/device event ID and observation identity for deduplication.
- Dart score and optional coordinates/confidence; never fabricate missing detail.
- Correction references and audit; result projections derived from accepted events.
- Reconnect resumes from a known sequence, then compares state before allowing more input.
- Schema migrations and replay fixtures maintain compatibility with current saved sessions.

Before restructuring the engine, prove the contract with a small end-to-end example. Preserve the existing tested rules while introducing participant/event abstractions behind compatibility adapters.

## 8. UI/UX and branding delivery

The [design brief](DESIGN_BRIEF.md) contains the screen inventory, journeys, component system, visual/interaction requirements and brand work. It is an implementation workstream, not a final coat of styling.

The next UI priority is a compact, readable match workspace: the active player, board, draft, remaining score and record/correction controls need to fit the device’s playing context. On a phone, reduce decorative chrome and repeated headings; on a board-side tablet, maximise touch reliability; on a TV, prioritise legible read-only scores. Keep scoring controls reachable without repeated page scrolling.

Brand naming can remain open during development. Final name availability checks, identity assets, domains and public copy must be resolved before public launch. Current colours and typography are provisional and should not be treated as approved branding.

## 9. Quality, operations and release gates

### Verification matrix

| Layer                  | Required evidence                                                                                                           |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Rules / metrics        | Versioned fixtures, replay compatibility, generative/invariant checks where useful, independently reviewed rule definitions |
| UI                     | Keyboard/screen-reader tasks, touch targets, colour/contrast, reduced motion, viewport/zoom and empty/error/loading states  |
| Persistence / sync     | Quota, corrupted data, refresh, interrupted migration, duplicate import, retry and cross-device conflict tests              |
| Identity / permissions | Verification/recovery lifecycle, session expiry, role boundaries, ownership and account linking tests                       |
| Realtime               | Duplicate/reordered/late commands, reconnect, host departure, simultaneous correction and spectator isolation               |
| Hardware               | Actual three/four-camera reports, long-session stability, disconnected devices, recalibration and provider replay fixtures  |
| Media                  | Separate networks, relay fallback, denied permission, bandwidth limits, camera contention and scoring isolation             |
| Competition            | Bracket/table reproducibility, no-shows, byes, substitutions, disputes and corrected results                                |
| Operations             | Database restore, migration rollback/forward recovery, incident drill, alerts, release rollback and documented support      |

Target WCAG 2.2 AA and verify the complete journeys; the current prototype is not claimed to conform. Use the W3C standard as the acceptance reference. [WCAG 2.2](https://www.w3.org/TR/WCAG22/). Review applicable account/server controls against an agreed OWASP ASVS baseline during backend delivery. [OWASP ASVS](https://asvs.owasp.org/).

### Initial measurement targets — proposals, not demonstrated results

- No duplicated accepted scores or divergent official results in retry/reconnect test suites.
- Score-entry interaction p95 below 100 ms on the Dell and selected reference phone, excluding provider/network latency.
- Realtime score propagation p95 below 500 ms on reference networks in the initial deployment region; measure relay/media separately.
- No horizontal overflow for primary flows at 360 CSS pixels; 200% text zoom retains essential actions.
- Typical guest match setup in under one minute during usability testing; correction of a misplaced dart without help or arithmetic.
- Establish a capacity test for 10 concurrent private matches before private beta, then agree the public launch load and availability target from measured costs and usage.
- Camera latency, detection confidence and recording budgets are set after hardware measurement, not guessed from the PC specification.

### Production readiness

HTTPS hosting and secrets management; development/staging/production separation; migration discipline; feature flags; error and performance telemetry; minimal sensitive logging; database/object backups with tested restore; service and media cost dashboards; rate limiting; permissions review; accessibility review; supported-browser/device matrix; user-facing status/support; release notes and an actual rollback path.

Privacy, public profiles, chat, recordings, account deletion, retention and participant age/consent policies need product decisions and appropriate review before public release. The plan is not a claim of legal compliance. Recording and public sharing defaults must be explicit to the people affected.

## 10. Recommended implementation batches

Each batch becomes a focused issue or PR with its feature IDs, user journey, acceptance evidence and migration notes. Refactor through working slices rather than rebuilding the whole prototype at once.

1. **Experience baseline:** observe real scoring on the Dell and phone; capture the five most disruptive problems; agree the core screen map and compact match prototype. UX-01–04.
2. **UI foundation:** routes, reusable components/tokens, match workspace and resilient loading/error patterns. UX-05–09, EN-01.
3. **Data reliability:** persistence boundary, local backup/import, recoverable migrations/drafts and metric definitions. SY-01–04, PL-02.
4. **Rule catalogue:** participant model, X01 variants/sets and one additional game with a complete fixture suite. SC-01–04.
5. **Hardware spike:** benchmark the arriving cameras and fourth-camera resource use; prove mock/provider observation flow. HW-01–04.
6. **Brand prototype:** compare visual directions with actual match screens, voice and naming criteria; keep final name checks open until a shortlist exists. BR-01–04.
7. **Cloud skeleton:** decide infrastructure, provision staging, database migrations, permission skeleton and telemetry. EN-02–05.
8. **Registration:** implement the full selected identity journey, recovery and account settings. AC-01–04.
9. **Local-data linking:** preview/claim/import selected local profiles and results; then cross-device sync. AC-05, SY-05.
10. **Private online match:** one game, two invited players, server referee, correction policy and reconnect. RM-01–04.
11. **First supported adapter:** authenticated board pairing, calibration workflow, corrections, health and manual handover on actual hardware. HW-05–07.
12. **Media proof:** two-party video across separate networks and a protected overlay; measure relay cost before expanding. VD-01–03.
13. **Teams and club sessions:** roles, invitations, line-ups, ready room and notifications with moderation foundations. TM-01–05.
14. **Competition:** run a complete knockout event, then groups/leagues and team fixtures. TO-01–04.
15. **Public discovery and media:** moderated public lobbies, appropriate matchmaking, spectators/streaming, recording/replay controls. RM-05, VD-04–06.
16. **Public launch preparation:** final brand clearance/assets, onboarding/help, support, accessibility/security/capacity/restore gates and controlled rollout. BR-05–06, OP-01–06.
17. **Evidence-led expansion:** additional providers/games/training, rankings, commercial options and separate detection/appliance research. EX-01–04.

Some work can overlap, especially design and hardware discovery, but dependencies do not disappear because screens can be mocked quickly.

## 11. Decisions and risk register

| Decision / risk                                                   | Needed by                                 | How it is resolved                                                                                        |
| ----------------------------------------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Primary users: home players, online community or venue/club first | A                                         | Interview/test with the intended users and prioritise the first release journeys                          |
| Final name and identity                                           | Before public launch                      | Real darts-led naming shortlist, availability screens and visual testing; no invented availability claims |
| Paid/free boundaries and budget                                   | Before provider commitments/public launch | Measure expected identity, database, relay and recording costs; decide commercial scope                   |
| Account/profile/household ownership and guest claiming            | D                                         | Explicit data and permission model with migration prototype                                               |
| Supported provider access and commercial terms                    | C / adapter release                       | Current official interface evidence, permissions and a real integration test                              |
| Native capture vs browser/provider capture                        | C                                         | Windows/WSL and camera ownership benchmark, not assumptions                                               |
| Authoritative corrections and disputed results                    | E                                         | Match policy prototypes and event replay tests                                                            |
| Team/organiser/referee roles                                      | F/G                                       | Permission matrix and actual match-night/event trial                                                      |
| Video cost, network reliability and camera contention             | Early H spike                             | Different-network tests and bounded relay/recording measurements                                          |
| Statistics completeness and trust                                 | Before public stats/rankings              | Provenance-aware metrics; distinguish unavailable detail from zero                                        |
| Privacy, age, public chat and recording defaults                  | Before public online/media release        | Product policy decisions and appropriate review                                                           |
| Long-term storage and data portability                            | B/D                                       | Versioned backup/import, sync, retention choices and restore test                                         |
| Scope expanding faster than reliability                           | Every milestone                           | Freeze a release slice, keep later work in backlog and require exit evidence                              |

## 12. How this plan stays current

Update status only from shipped code and test evidence. Maintain a compatibility matrix and decision records as spikes conclude. Link issues/PRs to backlog IDs. Record each release’s implemented features, limitations, migration and verification. Review the next milestone after a real playtest rather than treating the entire backlog as simultaneous work.

The next implementation step is the experience baseline and compact playing-screen design, followed by the persistence/reliability slice. Full registration remains a later phase; there is no need to bolt an incomplete login screen onto the current local prototype.
