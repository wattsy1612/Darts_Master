# Bundled typography

The provisional UI uses DM Sans (variable font) and Barlow Condensed at weights 500, 600, 700 and 800. Their unmodified font files come from the official [Google Fonts repository](https://github.com/google/fonts) at commit `6c1dbe27dcf7d817d4b62cec033ba77fa8e2a5ec`.

[SOURCES.json](../src/assets/fonts/SOURCES.json) records each upstream URL, byte count and SHA-256. Both font families retain their supplied copyright notices and SIL Open Font License 1.1 text, distributed at [DM Sans licence](../public/fonts/DM-Sans-OFL.txt) and [Barlow Condensed licence](../public/fonts/Barlow-Condensed-OFL.txt). The font binaries are not modified or renamed as typefaces.

CSS references local build assets. Production precaches the fonts and licence files with the app shell; there is no runtime Google Fonts request. System font fallbacks remain if a font cannot load. This keeps the existing typography while reducing external load dependencies and allowing the same fonts offline. The final product identity is still undecided.

The production browser suite checks that the font assets and licences are cached, loads both families while disconnected, and rejects external requests from the current public shell. This does not extend that caching policy to future external services, APIs or media.
