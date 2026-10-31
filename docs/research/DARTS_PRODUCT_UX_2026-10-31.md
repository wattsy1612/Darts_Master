# Darts product UX research — 31 October 2026

Owner request: research Target OMNI, Scolia and **current** Autodarts; styling and user friendliness are important. The follow-up clarified that the product is universal across devices, with tablet use given proper attention. This does not select a tablet-only product or shrink the 83-item plan.

## Method and limits

Reviewed current official product pages, documentation, visual examples and release notes. Used isolated Chromium sessions at 1180×820 to inspect public entry flows. No account was created, terms accepted, board code guessed or live opponent contacted. Actual hardware detection, account-only play, native applications and real-device ergonomics were not tested.

- **Target OMNI / DartCounter:** OMNI is the scoring hardware; DartCounter is the relevant playing interface. Official release index listed v9.8.3 dated 29 October 2026. Live web entry showed a language panel, then login and a guest route; guest continuation required accepting terms/privacy/conduct, where inspection stopped. Do not equate web build version with the native release number. [Release index](https://dartcounter.net/release-notes), [live entry](https://app.dartcounter.net/).
- **Scolia:** live web entry displayed build 2.28.77. Guest access requested a board code, so inspection stopped there. The published tablet lobby visual is an illustration on the official site with a 2024 asset path, not proof of every current authenticated screen. [Live entry](https://game.scoliadarts.com/), [software page](https://scoliadarts.com/software/).
- **Autodarts:** inspected the current `.com` product and guide sites, rather than using older `.io` walkthroughs as the current interface. Live web entry required creating an account or logging in. The official guide supplies match/input screenshots and explicitly warns that they are approximate and arranged differently on native mobile/tablet apps. [Current product](https://autodarts.com/), [live entry](https://play.autodarts.com/), [guide caveat](https://docs.autodarts.com/).

Public screenshots captured locally for inspection: `/tmp/research-{autodarts,dartcounter,scolia}-tablet.png`, guest entry captures, and official published match/input/lobby visuals. These are observations/reference material, not licensed Darts Master assets. No competitor logos, photography, backgrounds, voices or screenshot assets are incorporated into the prototype or application.

## Observed patterns and product implications

| Product / evidence | What the evidence supports | Darts Master decision / hypothesis |
| --- | --- | --- |
| DartCounter official identity | Strong condensed headings, green/orange identity and direct darts language. The public scoreboard illustration emphasizes the paired player scores and score submission. | Use recognisable darts numerals and plain wording, but develop our own identity. A colour change alone will not fix cumbersome play. [Identity](https://dartcounter.net/press/dartcounter-steps-up-with-a-new-look-built-for-throwers), [scoreboard illustration](https://dartcounter.net/). |
| DartCounter OMNI guide | Detected darts are individually selectable for correction; setup is grouped under device management. | Treat each dart as an inspectable item. Keep board setup outside normal scoring while making connection/failure status discoverable. Provider authority remains a separate unverified implementation gate. [OMNI guide](https://dartcounter.net/darts-manual/omni-auto-scoring). |
| DartCounter latest release | v9.8.3 describes clearer throwing/waiting states for team games, active-player camera switching, lobby filter visibility and landscape space for the board. These are published fixes, not independently reproduced defects. | Include actual team member and waiting state, selected-filter visibility and landscape control reach in acceptance tests. Avoid inferring a side’s score tells the user which partner throws next. [v9.8.3](https://dartcounter.net/release-notes/release-notes-dartcounter-v9-8-3). |
| Scolia published tablet lobby | A compact row-based player list shares the screen with conversation. Visible identity, availability and darts statistics support choosing an opponent. | Use readable rows for lobbies/fixtures and appropriate density for larger screens. Keep chat secondary to match state during a turn. Tablet UI needs intentional composition. [Published visual and context](https://scoliadarts.com/software/). |
| Scolia FAQ | Per-dart correction opens from the incorrect score tile; individual player accounts support separate retained statistics. | Keep correction attached to the selected dart. Make identity links deliberate; guest names cannot claim statistics. Coordinate heatmaps require real coordinates and must not be invented from tapped segments. [FAQ](https://scoliadarts.com/faq/). |
| Current Autodarts first-game guide | The published match view places large player scores beside a central board and separates input selection, board controls, undo and turn advancement. The guide offers board, visit-total and individual-segment entry. | Establish a stable score–input–visit hierarchy. Keep an easy precision alternative to narrow board rings. Label the different consequences of removing a draft dart, undoing a recorded visit and advancing a turn. [First-game guide and screenshots](https://docs.autodarts.com/getting-started/first-game/). |
| Current Autodarts scoring setup | A scoring-source toggle is distinct from input presentation; selected online devices are visibly marked and unavailable devices are not automatically selected. | Clearly separate input presentation from the authoritative scoring source. Never show a manual input switch as proof that detection has stopped. Require deliberate handover and duplicate-event protection when adapters exist. [Autoscoring guide](https://docs.autodarts.com/getting-started/autoscoring/). |

These are design conclusions drawn from the cited evidence. They do not prove that one product is easier to use or that our implementation is superior.

## Comparable task matrix

**Observed** = exercised in the isolated live web entry; **documented** = official flow/notes, not a completed hands-on task; **visual** = published illustration only; **gated** = access/hardware/terms stopped the journey. No timing or ease-of-use ranking is inferred from documentation.

| Same task | Target OMNI / DartCounter | Scolia | Current Autodarts |
| --- | --- | --- | --- |
| Reach first guest match | Observed language/login/guest entry; gated by terms | Observed guest entry; gated by board code | Observed account entry; gated by authentication |
| Choose rules / input | Published scoring illustration; hands-on gated | Documented local games; hands-on gated | Documented settings and input choice |
| Correct one dart | Documented individual dart edit | Documented tile correction | Documented dart correction |
| Finish a leg / rematch | Hands-on gated | Hands-on gated | Documented finish; hands-on gated |
| Select / recover a board | Documented smart-device setup | Documented board-code entry | Documented source selection/status |
| Find an opponent / team | Latest official lobby/team notes; hands-on gated | Published tablet lobby visual; hands-on gated | Documented matchmaking/lobby; hands-on gated |
| Organise / join an event | Published event feature; hands-on gated | Documented private events; hands-on gated | Documented events; hands-on gated |

The evidence links are in the product rows above and the official [Autodarts multiplayer guide](https://docs.autodarts.com/category/multiplayer--tournaments/). An authenticated, equivalent-task audit on actual devices remains outstanding for UX-02; this public-source review is concrete progress, not completion of that gate.

## Friction found in our current app

The existing X01 workspace has useful compact/focus behavior, but setup still presents many rules before a first throw. The v0.18 Cricket preview is visibly a long sequence of panels: score, input, controls, visits, offline and data tools. Its phone screenshot fits horizontally, but that alone does not establish an easy playing experience. Recoverability is strong; its tools need a deliberate secondary location rather than dominating the playing journey.

Priorities:

1. **High — one playing composition:** integrate X01 and Cricket into the same navigation, source/status and action structure. Keep backup/admin details in Data & backups, reachable from play.
2. **High — glanceable game state:** active member, both sides’ confirmed scores/marks, current unrecorded darts and next action must remain clear through orientation changes.
3. **High — controls within reach:** do not make a scorer repeatedly scroll between current darts and confirmation. Test actual browser viewport, not just a full-page screenshot.
4. **High — clear correction language:** separate draft edit, last-visit undo and reviewed earlier correction; preserve recovery and consequences.
5. **Medium — simpler entry:** quick defaults first; players and advanced settings can expand without removing capabilities.
6. **Medium — type, contrast and surface consistency:** establish neutral surfaces, readable metadata and one action accent; avoid unrelated per-feature card layouts.

## Universal layout and visual direction

The proposed study uses dark charcoal or light neutral surfaces with a restrained teal accent, licensed bundled DM Sans/Barlow Condensed fonts and code-native dartboard geometry. This is an original provisional direction, not an approved final brand or a copy of a competitor palette.

| Context | Composition / input priorities | Acceptance evidence still needed |
| --- | --- | --- |
| Phone portrait | Both player summaries together; reachable visit/record area; large-button option; safe-area and keyboard behavior. | 320–430px widths, touch, browser UI/keyboard, zoom and long names. |
| Phone landscape / short windows | Reflow by both width and available height; do not hide confirmation behind the input. | 844×390 and shorter heights, browser controls and rotation mid-draft. |
| Tablet portrait | Paired scores above the central input; a compact visit strip below. | 768×1024 and 820×1180; touch separation and orientation continuity. |
| Tablet landscape | Scores flank the board/input; visit controls remain in the same workspace. | 1024×768 and 1180×820; confirm action visible without repeated scrolling. |
| Laptop / desktop | Efficient central workspace; keyboard and pointer entry; secondary detail optional. | 1366×768, resize, tab order and 200%/400% zoom. |
| Large board-side display / TV | Deliberate read-only score composition; scoring stays on its authorised controller. | 1920×1080, actual viewing distance, TV/browser/remote behavior and permission boundary. |

The intended minimum ordinary control target is 44 CSS px, with roughly 48–56px primary touch controls where room permits. This is our usability target; WCAG 2.2 AA’s target-size minimum is 24px with defined exceptions, not a blanket 44px mandate. Ordinary text needs 4.5:1 contrast, large text 3:1. Reflow must be checked at the equivalent of 320px width; a 390px screenshot is not proof of conformance. [W3C target size](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html).

## Concrete review artifact and next implementation

`docs/design/universal-match.html` is an isolated interactive X01 design study using the actual domain rules and sample commands. It does not access repository storage, accounts or hardware. It supports segment/board entry, draft removal, recording, undo, reset, light/dark and a larger score display. It is available from the running Vite development server at `/docs/design/universal-match.html`; it is not a built production destination.

Review the same sample in each device layout before migrating its composition into the app. Keep the shared scoring/recovery modules and give Cricket the same design-system shell. Continue file restore/history/profile work within this design direction; do not grow further disconnected form-heavy screens. Complete real-device observation and task tests with players, captains and organisers before calling UX-01–04 complete. Final brand/name, broad accessibility and hardware support remain open.

## Study verification

Chromium inspection passed at 320×740, 390×844, 844×390, 768×1024, 1024×768, 1180×820, 1366×768 and 1920×1080: no horizontal document overflow and the initial Record action inside each viewport. The initial portrait ordering problem and short-landscape control positioning were corrected and rechecked. Sample recording changed Alex’s confirmed 81 to 24; undo restored 81; large-button D20 entry produced 41. Light/dark and score-display controls were exercised, with no page errors. These are prototype checks, not evidence of complete production/device/accessibility support.

Own-design preview captures: [tablet](../design/previews/match-tablet.png), [phone](../design/previews/match-phone.png). The production build/typecheck passes; main application scoring/storage code is unchanged by this research increment.
