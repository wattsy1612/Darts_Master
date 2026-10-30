# Darts Master — working title

The start of a universal darts platform: manual scoring now; supported automatic scoring integrations, online match rooms, teams, tournaments and streaming planned. The final product name is undecided.

## Product and delivery plan

See the [full implementation plan](docs/IMPLEMENTATION_PLAN.md), [UI/UX and brand brief](docs/DESIGN_BRIEF.md), [feature backlog](docs/FEATURE_BACKLOG.md) and [roadmap overview](docs/ROADMAP.md). These separate the planning baseline from the complete platform vision and define dependencies and release gates.

Track current goal progress in the [delivery ledger](docs/DELIVERY_STATUS.md).

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

- Two-player 301, 501 and 701, with a configurable number of legs to win.
- Saved browser-local player profiles, reusable at setup and renameable without losing result links.
- Player records with wins/losses, leg totals, weighted scoring averages, 180s, highest checkout and recent results.
- Separate player-versus-player and practice statistics, based on completed matches linked to a profile.
- Solo practice against Rookie, Regular or Sharp simulated opponents.
- Automatic opponent turns, pause/resume (remembered on refresh), and a choice of who throws first.
- Practice undo/redo corrects your visit and the opponent reply together.
- Interactive dartboard entry: tap singles, doubles, trebles and either bull.
- Three-dart previews, hit markers, miss/bounce-out entry and draft correction.
- Automatic early bust and double-out detection from the actual dart sequence.
- Larger number buttons for precision entry on phones, plus optional keypad/keyboard visit totals.
- Checkout suggestions recalculate for the score and darts left in a board-entered visit.
- Double-out rules, including bull finishes, busts and impossible-score validation.
- Checkout suggestions, three-dart averages, best visits and alternating leg starts.
- Undo and redo for scoring and starting the next leg, with clear score feedback.
- A visit log and automatic recovery of the current match after refreshing.
- Automatic archive of the latest 100 completed matches on this browser.
- Match summaries with scoring bands, 180s and highest checkout, plus JSON export.
- Protection against accidentally replacing an unfinished match.
- Compact playing layouts with reachable record controls on reference laptop and phone screens.
- Focus mode with Escape exit and remembered preference.
- Page URLs with refresh and browser back/forward navigation.
- Exact-turn draft recovery, isolated between tabs.
- Offline reopen and install metadata in production builds, with updates held until all app tabs close.

Board entry is the default for new installations; use the **Dartboard / Keypad** switch to choose and save your preferred input method. Board visits are recorded only after confirmation, so you can correct a misplaced tap first. Unsubmitted board darts and keypad details are saved separately for this tab. On refresh, a matching draft is offered for explicit restore or discard; it never records a visit by itself. Drafts expire after seven days and are excluded from full match backups. Closing a tab may remove its draft link, so record a visit before closing it.

Practice opponents generate individual darts with different hit/miss probabilities; difficulty names are not guaranteed averages or ratings. They follow the same bust and double-out rules as human players. Opponent throws pause while viewing history or editing setup. Saved match positions produce repeatable opponent throws, so refresh and correction do not reroll a score.

Saved players are local profiles, not registered accounts. Select a saved player before starting a game to link that result; guest matches are not automatically attached by matching names. Profile statistics use the latest 100 completed matches retained in this browser.

The current match, saved players and latest 100 completed matches stay in this browser’s IndexedDB database. Older local-storage saves migrate automatically while their original copies are preserved. Starting a new match replaces an unfinished game only after confirmation; completed results remain in history. Use Data & backups to download a full backup or review and import a backup or individual match export. Imports require explicit player links, skip duplicates and preserve a pre-import recovery copy. Undo is available until another change is saved. Import limits are 20 MB, 100 players and 100 archived results; oversized combinations are rejected without trimming existing data. Clearing browser data removes local results. There is no account or cloud sync yet. External fonts use system fallbacks if unavailable.

## Offline use and installation

Run `npm run build` and `npm run preview` to try the built app locally. Open the preview address online once and check **Data & backups → Ready for offline play** before disconnecting. Development mode (`npm run dev`) deliberately has no service worker, so edits remain immediate and reopening requires the dev server. Service workers require HTTPS or a browser-trusted localhost address; installation support depends on the browser. The manifest name and target icon are provisional.

The worker precaches only the public app shell and build assets, including the import-review worker. It does not cache APIs, external fonts, match data or media. Open tabs stay on one build until all app tabs close; there is no forced update during play. Browser storage eviction or clearing still removes local saves and offline files. Online features will require connectivity when implemented.

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
