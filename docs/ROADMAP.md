# Product roadmap

The application is a local prototype with a larger platform vision. “Darts Master” is a working title.

## Planning documents

- [Full implementation plan](IMPLEMENTATION_PLAN.md): scope, baseline, release definitions, dependencies, technical architecture, feature workstreams and acceptance gates.
- [UI/UX and branding brief](DESIGN_BRIEF.md): journeys, screens, device layouts, interaction design, accessibility, design system, naming and brand assets.
- [Feature backlog](FEATURE_BACKLOG.md): feature IDs, dependencies, release intent and acceptance evidence for implementation issues/PRs.

## Available foundation — v0.9

Configurable X01 opening/finishing rules, starts and legs/sets, with compact scoring, focus mode, page URLs and an interactive dartboard or keypad; practice opponents; saved matches and export; browser-local player profiles and linked records. Versioned transactional saves, full backups/reviewed imports, exact-turn draft recovery and production offline reopen are implemented. These profiles are not registered accounts. There are no connected camera adapters, cloud accounts or online matches yet.

See the [delivery ledger](DELIVERY_STATUS.md) for current implementation and incomplete acceptance gates.

## Delivery sequence

1. Define and test the core experience, screen map and brand directions.
2. Improve the local product: playing layout, design system, rules, persistence, import and recovery.
3. Benchmark the arriving cameras and prove supported adapter/capture paths in parallel.
4. Build the hosted data/permission foundation and **full registration**.
5. Link selected local data to accounts; deliver invited online matches with an authoritative score and reconnect.
6. Add teams/clubs, communications and core tournaments/leagues.
7. Deliver tested private video, spectators, overlays, streaming and controlled replay; run media feasibility early.
8. Finish public brand/onboarding/support and pass release, accessibility, security, capacity and restore gates.
9. Expand providers, training, rankings, commercial options and independent detection/hardware only with supporting evidence.

## Confirmed later registration milestone

Complete sign-up, email verification, sign-in/out, password/recovery lifecycle for the selected identity method, sessions, account settings, scoped ownership and explicit linking of local profiles/results. Guest-name equality must not grant account access or silently claim history. Choose the identity provider/backend during the cloud-foundation phase; keep local play usable throughout.

## Planning rules

Planned features are not advertised as active. Compatibility requires confirmed interfaces/access and a real test. Dates and costs follow the relevant discovery work. Implementation proceeds in reviewable, tested slices with the existing app kept usable. The master plan and backlog are the source for future work; update them as decisions and evidence become available.
