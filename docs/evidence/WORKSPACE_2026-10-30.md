# Compact workspace — first implementation evidence

Date: 30 October 2026. Scope: initial implementation toward UX-03, UX-05–09 and EN-01. This is not acceptance of the full workstreams.

## Problem and measured change

Measurements use fresh local X01 matches in headless Chromium on the development build. Bounds are CSS pixels relative to the viewport. The previous record button required scrolling on both reference sizes.

| Reference viewport | Previous record button bounds | Initial compact record button bounds | Fully in viewport      |
| ------------------ | ----------------------------- | ------------------------------------ | ---------------------- |
| 1366 × 768         | y 1081.4, height 44           | y 555.6, height 44                   | Before: no; after: yes |
| 390 × 844          | y 1335.4, height 44           | y 784, height 48                     | Before: no; after: yes |

Automated browser cases now check the record action before and after a three-dart visit, record that visit, and check for horizontal overflow at both sizes. Starting or returning to the playing workspace resets scroll to the top, rather than retaining the long setup form’s scroll position.

## Implemented slice

- Compact match header, reduced secondary chrome, and side-by-side board/visit controls on reference desktop layouts.
- Persistent board confirmation bar on small screens; keypad recording also stays reachable.
- Mobile match navigation menu with access to player records, history and the roadmap.
- Focus mode, preference recovery and Escape to exit without discarding draft darts.
- Hash-based URLs for play/history/players/roadmap with refresh and browser back/forward behaviour.
- Provisional semantic tokens, shared action/feedback primitives and a development-only component gallery at `/#/design-system`.
- The gallery content is removed from the production JavaScript build; the development-only route falls back to play in production.

## Verification

The production build and TypeScript checks pass. All 67 domain tests and 27 Chromium browser tests pass, including the existing scoring/profile/practice/storage scenarios and new workspace/navigation cases. The production bundle was checked for removal of the gallery content.

## Still required

- Actual Dell, phone and tablet touch/keyboard sessions, including representative long matches.
- Screen-reader, contrast, 200% zoom and reduced-motion audit; a fixed action bar must be tested with the software keyboard and device safe areas.
- TV/display layout validation and short-height/landscape phone handling.
- The rest of the component catalogue, state patterns and route/module refactor.
- User validation of the first audience and brand direction.

The current palette is a provisional implementation token set, not final branding. Automated geometry checks are not a usability study or a claim of accessibility conformance.
