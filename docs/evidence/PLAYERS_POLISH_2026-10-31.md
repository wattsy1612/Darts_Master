# Players and shell visual polish — 31 October 2026

Application v0.20 responds to the owner's feedback that the styling still needed improvement. This updates the real Players route and shared navigation shell; it is not another separate mockup. The wider product/brand/accessibility gates remain open.

## Changes

- Neutral slate surfaces, mint actions, a compact dark sidebar and consistent native SVG navigation icons replace the muddy greens and mixed text symbols. The existing licensed fonts remain bundled; there are no new external assets or dependencies.
- Players has a clear page title, a deliberate add-player section, one mode/format filter bar, a count and device scope, a darts-specific empty state and stronger profile cards.
- Once profiles exist, the introductory section becomes smaller. Identity comes first on each card, followed by the prominent recorded average and supporting statistics, win/loss record, definitions and recent results. Stable profile IDs determine the avatar colour. Zero recorded darts display an em dash for average; the underlying metrics and identity rules are unchanged.
- Non-playing pages at narrow widths use labelled bottom navigation, with space below the document to keep its final controls reachable. Saved-state information remains visible. Active-match/focus geometry retains its existing layout rules.

## Evidence and limits

An isolated browser session created sample profiles and played a complete local 301 match through the actual UI, producing a 150.5 average and a linked result. Screens were inspected with populated and empty records at 1366×900, 768×1024, 390×844 and 320×740; those checks found no horizontal overflow. The saved-profile phone form alignment was corrected during inspection. Local screenshots are `/tmp/players-v020-{desktop,tablet,phone,small-phone}.png`.

Typecheck, 255 unit tests and production build pass. The initial full browser run passed 81 cases and found one assertion still expecting the deliberately replaced Players title. That route/back-forward assertion now requires the new level-one Players heading; the 14 relevant player/metrics/workspace tests pass, including long names, rename/link preservation, definition disclosure, record reachability, focus and navigation. Eight production offline/update checks also passed during the pass. The PR workflow runs all browser/offline checks against the final committed source.

No new tests were added just to mirror CSS. These screenshots are browser-layout evidence, not physical-device usability sign-off or a complete accessibility audit. The palette/title remain provisional; name availability and final brand approval are not claimed.
