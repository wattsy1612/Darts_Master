# Darts application — working title

A universal darts platform planned for manual and automatic scoring, interactive match rooms, team lobbies, tournaments, player statistics, and streaming. The final name is undecided.

## Development environment

Development runs in Ubuntu 26.04 under WSL2 on the Windows Dell. Run project commands in WSL so that Node, Python, dependencies, and tests use the same environment.

- Node.js 24 LTS and its bundled npm. The official Linux binary is installed under `~/.local/lib/`, with commands in `~/.local/bin/`. The download is checked against the official SHA-256 manifest. `.nvmrc` records the version; a version manager is not required on this machine.
- Git for version control.
- Python 3.14 with virtual environment support, for future camera tooling.
- GCC, G++, and Make for dependencies that compile native code.
- GitHub CLI (`gh`); publishing requires an authenticated GitHub account.
- VS Code on Windows, with the WSL extension for editing and running inside Ubuntu.

From this directory in WSL:

```bash
./scripts/check-dev.sh
```

To open this folder from VS Code on Windows, use **WSL: Open Folder in WSL** and select:

```text
/mnt/c/Users/watts/Documents/ChatGPT/Darts Master
```

Keep secrets in ignored `.env` files. Commit only placeholder values in `.env.example`.

## First application milestone

Build and test the match engine and a usable local scorer while cameras are on order. Start with 501, player setup, double-out, bust handling, and undo. Separate score input from match rules so future supported camera integrations can submit the same scoring events.

Online rooms, teams, tournaments, streaming, and external detection integrations are planned work; none are implemented yet. Integrations depend on each provider's available interfaces. No application server exists yet.
