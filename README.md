# Darts Master — working title

The start of a universal darts platform: manual scoring now; supported automatic scoring integrations, online match rooms, teams, tournaments and streaming planned. The final product name is undecided.

## Run the app

Use **Ubuntu / WSL**, not Windows PowerShell, for project commands. Node 24 LTS is required; the exact development version is recorded in `.nvmrc`.

```bash
npm ci
npm run dev
```

On the Dell, open **http://localhost:5173** in a browser. When working from another computer, forward port 5173 over your SSH connection. The development server is not a production deployment.

## Available now

- Two-player 301, 501 and 701, with a configurable number of legs to win.
- Manual visit entry with keypad and keyboard support; 1–3 darts per visit.
- Double-out rules, including bull finishes, busts and impossible-score validation.
- Checkout suggestions, three-dart averages, best visits and alternating leg starts.
- Undo for both scoring and starting the next leg.
- A visit log and automatic recovery of the current match after refreshing.
- Responsive layouts for desktop and phone screens.

The current match stays in this browser's local storage. **Starting a new match replaces it.** There is no account, permanent archive or cloud sync yet. Match history means the current match's visit log. External fonts use system fallbacks if unavailable.

## Checks and development tools

```bash
./scripts/check-dev.sh        # Check the machine's development tools
npm run check                # TypeScript, scoring tests and production build
npx playwright install chromium
npm run test:e2e             # Browser tests; starts its own test server
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

## Code layout

- `src/domain/match.ts`: pure scoring rules and replayable match commands. It has no React, browser or camera dependency.
- `src/domain/match.test.ts`: scoring rules, finishes, statistics and replay tests.
- `src/App.tsx`: local match setup, scorer, persistence and navigation.
- `src/style.css`: responsive interface and provisional visual identity.
- `tests/e2e/`: browser coverage for complete scoring flows, recovery and mobile layout.
- `.github/workflows/ci.yml`: automated checks.

Future input adapters will translate supported detection events into domain commands. No external scoring service is connected yet; each integration will depend on its available interfaces. Online rooms, permanent player profiles, teams, tournaments, video and custom detection are future milestones.
