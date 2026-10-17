# Third-party code

This package vendors selected files from:

- Repository: https://github.com/Nyarlathoteppppp/pi-tool-explain
- Package: `@zhcsyncer/pi-tool-display-intent`, version `0.10.1`
- Commit: `e493cab16aae8e395d78c72ee58ce52fd2d45ec7`
- License: MIT

Files copied without modifications:

| Local file | Upstream file | Purpose |
|---|---|---|
| `vendor/pi-tool-explain/display-summary.js` | `src/display-summary.js` | Model-written intent schema, sanitization, argument preparation and execution isolation |
| `vendor/pi-tool-explain/aggregate-viewport.ts` | `src/aggregate-viewport.ts` | Native fullscreen viewport anchoring |
| `vendor/pi-tool-explain/LICENSE` | `LICENSE` | Copyright and license notice, including attribution for pi-tool-display-summary |
| `vendor/pi-tool-explain/UPSTREAM_LICENSE` | `UPSTREAM_LICENSE` | Original pi-tool-display license |

The upstream project credits MasuRii's `pi-tool-display` 0.5.0 and Mert Deveci's `pi-tool-display-summary` 0.1.0. The full original notices are preserved in the vendored license files.

The extension entry point, request activity state, tool registry adapter, compact rendering adapter, controller and tests in this package are separate integration code. The original plugin's configuration panel, alternate output styles, diff viewers and Run ledger interface are not loaded.
