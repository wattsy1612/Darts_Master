# Universal match study

Open `/docs/design/universal-match.html` on the running Vite development server, for example `http://localhost:5173/docs/design/universal-match.html`.

This is a reviewable, isolated design artifact. It imports the existing X01 domain to keep sample visits honest; it does not use IndexedDB, local/session storage, authentication, media devices or online matches. Reload resets the fixture. It is intentionally outside the built app’s routes and is not installed/cached as a production feature.

Try board or Large buttons; remove/record a dart; undo; switch light/dark; and inspect the larger score display. Resize while a draft exists. The three-leg fixture starts partway through a leg; reset after a finish rather than treating this as a second complete scoring application.

The [dated research](../research/DARTS_PRODUCT_UX_2026-10-31.md) records official sources, inspected access boundaries, task comparisons and open gates. [Tablet preview](previews/match-tablet.png) and [phone preview](previews/match-phone.png) show the same sample state. Neither theme is a final brand decision. Production adoption should use shared components and retain the existing recovery/ownership safeguards.
