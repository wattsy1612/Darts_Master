# Darts Master — working title

The start of a universal darts platform: manual scoring now; supported automatic scoring integrations, online match rooms, teams, tournaments and streaming planned. The final product name is undecided.

## Product and delivery plan

See the [full implementation plan](docs/IMPLEMENTATION_PLAN.md), [UI/UX and brand brief](docs/DESIGN_BRIEF.md), [feature backlog](docs/FEATURE_BACKLOG.md) and [roadmap overview](docs/ROADMAP.md). These separate the planning baseline from the complete platform vision and define dependencies and release gates.

Track current goal progress in the [delivery ledger](docs/DELIVERY_STATUS.md).

Practice opponents include Rookie, Regular, Sharp and Custom. Custom independently adjusts treble, double/bull and single/outer-bull target probabilities, with settings preserved in saved matches and rematches. These are simulation controls, not guaranteed averages or ratings. Run `npm run calibrate:bot` for the repeatable preset report; see [practice evidence](docs/evidence/BOT_PRACTICE_2026-10-30.md).

Match history also supports reviewed earlier-visit corrections, including replay or acknowledged removal of following actions, draft/replacement safeguards and a recoverable pre-correction workspace. See the [correction policy](docs/CORRECTIONS.md) for local limits, recovery and required future online authority.

The [game contract foundation](docs/GAME_CONTRACTS.md) separates X01 and Cricket rules/records. Cricket has a tested domain engine and shared storage/backup support, but is **not a playable app mode** until its playing/history/profile/correction screens and public restore journeys are integrated.

## Run the app

Use **Ubuntu / WSL**, not Windows PowerShell, for project commands. Node 24 LTS is required; the exact development version is recorded in `.nvmrc`.

```bash
cd "/mnt/c/Users/watts/Documents/ChatGPT/Darts Master"
npm ci
npm run dev
```

On the Dell, you can also double-click **Start Darts.cmd** in the project folder. It starts Ubuntu in the correct directory and checks for dependencies. Keep the terminal open while using the app.

Open **http://localhost:5173** in a browser on the Dell. When working from another computer, forward port 5173 over your SSH connection. The development server is not a production deployment.

## Available now

- X01 singles, three-to-eight-player games, pairs and two local teams of two-to-four members each.
- 301/501/701/1001 presets and custom whole-number starts from 101 to 1001.
- Straight/double opening and finishing rules, with shared board/keypad validation.
- Legs or sets, separate set/leg totals, and selectable leg/set starter rotation.
- Saved local bull-off workflow with rethrows, human closer-dart decisions and correction.
- Saved browser-local player profiles, reusable at setup and renameable without losing result links.
- Player records with wins/losses, leg totals, weighted scoring averages, 180s, highest checkout and recent results.
- Separate player-versus-player and practice statistics, based on decided matches linked to a profile.
- Solo practice against Rookie, Regular or Sharp simulated opponents.
- Automatic opponent turns, pause/resume (remembered on refresh), and a choice of who throws first.
- Practice undo/redo corrects your visit and the opponent reply together.
- Interactive dartboard entry: tap singles, doubles, trebles and either bull.
- Three-dart previews, hit markers, miss/bounce-out entry and draft correction.
- Automatic opening, early bust and finish detection from the actual dart sequence.
- Larger number buttons for precision entry on phones, plus optional keypad/keyboard visit totals.
- Checkout suggestions recalculate for the score and darts left in a board-entered visit.
- Rule-aware finishes, bull opening/checkout, busts and impossible-score validation.
- Checkout suggestions, three-dart averages, best visits and alternating leg starts.
- Undo and redo for scores, leg transitions and match lifecycle actions.
- Saved full-match pause/resume, explicit concession or abandonment, and rematch with selected first thrower.
- A visit log and automatic recovery of the current match after refreshing.
- Automatic archive of the latest 100 finished matches on this browser.
- Match summaries with scoring bands, 180s and highest checkout, plus JSON export.
- Protection against accidentally replacing an unfinished match.
- Compact playing layouts with reachable record controls on reference laptop and phone screens.
- Focus mode with Escape exit and remembered preference.
- Page URLs with refresh and browser back/forward navigation.
- Exact-turn draft recovery, isolated between tabs.
- Offline reopen and install metadata in production builds, with updates held until all app tabs close.

Board entry is the default for new installations; use the **Dartboard / Keypad** switch to choose and save your preferred input method. Board visits are recorded only after confirmation, so you can correct a misplaced tap first. Unsubmitted board darts and keypad details are saved separately for this tab. On refresh, a matching draft is offered for explicit restore or discard; it never records a visit by itself. Drafts expire after seven days and are excluded from full match backups. Closing a tab may remove its draft link, so record a visit before closing it.

Double-in keypad visits require an explicit opening declaration and include only points scored from the opening double onwards; count every dart thrown. Board entry calculates this automatically. A bust cancels the entire visit, including an opening double. Straight out allows one remaining and a finish on any segment. Sets use first-to targets without win-by-two/tie-break rules. Older v1 games retain their original straight-in/double-out legs rules; v2 rule and v3 lifecycle sessions remain readable, and v4 bull-off sessions remain readable, and new games use v5 session data with explicit sides and thrower IDs. Older app versions reject unsupported session versions.

Practice opponents follow the chosen match rules and generate individual darts with different hit/miss probabilities; difficulty names are not guaranteed averages or ratings. They follow the same opening, bust and finishing rules as human players. Opponent throws pause while viewing history or editing setup. Saved match positions produce repeatable opponent throws, so refresh and correction do not reroll a score.

Saved players are local profiles, not registered accounts. Select a saved player before starting a game to link that result; guest matches are not automatically attached by matching names. Profile statistics use decided matches within the latest 100 finished entries retained in this browser.

Local statistics use [versioned metric definitions](docs/METRICS.md). Match/profile records disclose recorded visits and darts, segment coverage, input origins and imported samples. Checkout attempts, target accuracy and physical hit positions are unavailable; local/practice/imported records are unverified.

Existing X01 workspaces upgrade recoverably to shared game storage. Data & backups offers a pre-upgrade backup; when changes cannot be saved, the readable current-game and last-saved workspace can be exported separately. See the [shared storage contract](docs/SHARED_GAME_STORAGE.md).

The current match, saved players and latest 100 finished matches stay in this browser’s IndexedDB database. Older local-storage saves migrate automatically while their original copies are preserved. Starting a new match replaces an unfinished game only after confirmation; finished results remain in history. Use Data & backups to download a full backup or review and import a backup or individual match export. Imports require explicit player links, skip duplicates and preserve a pre-import recovery copy. Undo is available until another change is saved. Import limits are 20 MB, 100 players and 100 archived results; oversized combinations are rejected without trimming existing data. Clearing browser data removes local results. There is no account or cloud sync yet. The bundled fonts retain their upstream SIL Open Font Licences; system fallbacks remain available. See [font sources](docs/FONTS.md).

## Local players, pairs and teams

Use **Player format** to choose singles, three-to-eight-player multiplayer, pairs or two teams with two-to-four members each. Arrange sides and members before starting. Sides take visits in the listed order; members rotate independently within each side, including misses and busts. Teams share one score and opening-double state. Choose whether member order resets each leg or continues from the preceding leg. The selected starting side remains selected when its position changes.

Each recorded visit identifies its actual thrower. History shows side totals and individual records separately. On the Players page, choose the record format: singles, multiplayer, pairs/teams or all formats. Side match/leg outcomes are shared; points, darts, 180s and checkouts belong only to the member who threw them.

In multiplayer, withdrawing skips that player while the others continue; the last remaining side wins by concession without unplayed legs being awarded. These are local match rosters, not registered club/team memberships or online lobbies.

## Throwing for the bull

For two local sides, choose **Throw for the bull** at setup and select who throws for it first. The app records each valid dart in order, reverses the order after matching bulls or a rethrow, and asks for a human closer-dart decision when both darts are outside the bull. Bounce-outs are rethrown until a dart stays in the scoring surface. If a dart is dislodged, both players rethrow in reverse order.

Bull-off events save with the match and survive refresh or full-match pause. Match scoring is blocked until the bull-off is decided; its winner becomes the initial starter for the configured leg/set rotation. These darts never count toward scoring averages. History and backups retain the bull-off record. A rematch with an explicitly chosen starter starts fresh without reusing the old bull-off; use New match to throw for the bull again. The first listed member represents a shared side. Practice and multiplayer use a chosen starter; practice has no physical opponent dart to compare, and multiway bull-off is not implemented.

## Match controls and outcomes

Pause/resume saves match state and stops both players and automatic opponent throws until resumed. If an unsubmitted visit exists, the app asks before discarding it to pause or end the match; record it first to keep it. Pause/resume, concession and abandonment appear in the action history and can be undone/redone.

A concession awards a match win/loss without awarding unplayed legs, sets or darts. Abandonment retains the game in history with no winner and is excluded from profile win/loss records. Only actual played visits contribute statistics. A rematch is available after the previous result has saved: choose its first thrower, then start a fresh match with the same rules and linked players. The old result remains in history.

These are local scorer controls. Future online referee/permission and dispute rules are separate work.

## Offline use and installation

Run `npm run build` and `npm run preview` to try the built app locally. Open the preview address online once and check **Data & backups → Ready for offline play** before disconnecting. Development mode (`npm run dev`) deliberately has no service worker, so edits remain immediate and reopening requires the dev server. Service workers require HTTPS or a browser-trusted localhost address; installation support depends on the browser. The manifest name and target icon are provisional.

The worker precaches only the public app shell and build assets, including the import-review worker. It includes the bundled fonts and their licences; it does not cache APIs, external resources, match data or media. Open tabs stay on one build until all app tabs close; there is no forced update during play. Browser storage eviction or clearing still removes local saves and offline files. Online features will require connectivity when implemented.

## Checks and development tools

```bash
./scripts/check-dev.sh        # Check the machine's development tools
npm run check                # TypeScript, scoring tests and production build
npx playwright install chromium
npm run test:e2e             # Browser tests; starts its own test server
npm run test:offline         # Builds app and tests real offline/update behaviour
npm run test:watch            # Scoring tests during development
npm run format               # Format source and configuration
npm run build
npm run preview              # Serve the production build locally
```

On a new Linux machine, browser tests may also require `npx playwright install-deps chromium` with administrator privileges. These libraries and Chromium are installed on the Dell. GitHub Actions runs the application checks and browser tests on pushes to `main`, `codex/**` branches and pull requests.

Installed development tools on the Dell:

- VS Code on Windows with WSL support.
- Node 24 LTS and bundled npm, installed from the official Linux archive with SHA-256 verification under `~/.local/lib/`; commands are linked in `~/.local/bin/`.
- Git and GitHub CLI, authenticated for the project.
- Python 3.14 with virtual environment support for future camera tooling.
- GCC, G++ and Make for dependencies with native components.

In VS Code, use **WSL: Open Folder in WSL** and choose `/mnt/c/Users/watts/Documents/ChatGPT/Darts Master`. Recommended editor extensions are recorded in `.vscode/extensions.json`. Keep secrets in ignored `.env` files; use placeholders in a committed `.env.example` if needed.

## Interface development

The provisional UI tokens are in `src/styles/tokens.css`, with compact workspace styles in `src/styles/workspace.css`. Shared action and feedback components are in `src/ui/`. The development-only component gallery is at `http://localhost:5173/#/design-system`; it is not a production destination. Full design, accessibility and physical-device acceptance remain tracked in the delivery ledger.

## Code layout

- `src/DartboardEntry.tsx`: interactive SVG board, per-dart preview and touch-friendly precision controls.
- `src/domain/darts.ts`: segment validation and sequential dart evaluation.
- `src/domain/bot.ts`: seeded practice throws, aim selection and difficulty settings.
- `src/domain/players.ts`: profile validation, stable identity and weighted result aggregation.
- `src/PlayerProfiles.tsx`: saved-player selection, creation, rename and records.
- `src/usePlayers.ts`: profile persistence and storage-failure handling.
- `src/domain/match.ts`: pure scoring rules and replayable match commands. It has no React, browser or camera dependency.
- `src/domain/match.test.ts`: scoring rules, finishes, statistics and replay tests.
- `src/App.tsx`: local match setup, scorer, persistence and navigation.
- `src/domain/archive.ts`: archive validation, correction handling and JSON export.
- `src/MatchHistory.tsx`: saved results, match summaries and visit logs.
- `src/style.css`: responsive interface and provisional visual identity.
- `tests/e2e/`: browser coverage for complete scoring flows, recovery and mobile layout.
- `.github/workflows/ci.yml`: automated checks.

Future input adapters will translate supported detection events into domain commands. No external scoring service is connected yet; each integration will depend on its available interfaces. Full registration (sign-up, email verification, sign-in, password reset and linking local profiles to an account) is a confirmed later milestone. See [the product roadmap](docs/ROADMAP.md). Online rooms, cloud profile sync, teams, tournaments, video and custom detection are future milestones. WSL uses polling for edits in this Windows-mounted folder so changes appear reliably during development.
