# Product roadmap

## Current foundation

Local X01 scoring with an interactive dartboard or keypad, practice opponents, saved matches, exports and browser-local player profiles. These profiles are not registered accounts.

## Full registration — later milestone

Registration is a confirmed future requirement. Build this as a complete account flow, rather than treating a saved name as an account:

- Account creation with email verification and clear validation.
- Sign-in, sign-out and secure sessions.
- Forgotten-password and password-reset flows.
- Duplicate-account and account-recovery handling.
- Account settings and user-controlled profile details.
- An explicit process to link or import browser-local profiles and results into an authenticated account. Do not silently claim guest history by matching display names.
- Durable account-owned data and access checks on the server.
- Account support for later team membership, match rooms, tournaments and streaming.

Choose the identity provider, backend and deployment approach during that milestone. Do not store passwords or authentication tokens in the local profile store. Existing local matches and profiles should remain usable while account support is developed.

## Subsequent capabilities

- Camera integration and adapters for scoring systems with supported interfaces.
- Online match rooms, team lobbies, clubs and leagues.
- Tournament management, spectators, streaming and replay.

Each milestone needs its own implementation and validation; planned items are not presented as active functionality.
