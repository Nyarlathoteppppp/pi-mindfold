# Verification — 0.2.0

Validated against locally installed Pi 1.0.0 and Pi 1.3.0 with Node.js v24.16.0. The active managed installation is Pi 1.3.0; both versions pass all 64 tests without regressions. See `COMPATIBILITY.md` for upgrade evidence and actual installed-extension checks.

## Summary

- `npm test`: 64 passed, 0 failed.
- `npm run check`: all JavaScript and vendored TypeScript syntax checks passed.
- Packaged artifact: `artifacts/pi-compact-thinking-0.2.0.tgz`.

## What was added & verified in 0.2.0

- **Thinking activity intent**: In collapsed mode, `Thinking` automatically appends ` — <intent>` when the model outputs a brief public progress line (format: `活动意图：...`).
- **Privacy preservation**: Only explicit public text blocks are parsed; hidden thinking/reasoning blocks are never inspected or disclosed.
- **Phase transition**: A new assistant message or `thinking_start` event resets the intent back to clean `Thinking`; starting a tool call immediately transitions to the tool card with `displaySummary`.
- **Zero extra model calls**: Uses structured system prompt guidelines (`PUBLIC_ACTIVITY_GUIDELINE`) to instruct the model to prepend the single status line; no secondary LLM inference, proxy, or extra API keys required.
- **Native fullscreen & streaming**: Verified in `tests/fullscreen.test.mjs` and `tests/thinking-intent-sdk.test.mjs` that the label renders properly, mouse toggles work, input focus is preserved, and terminal line widths are strictly respected.

## Pre-existing verified features (from 0.1.1)

- Full Pi 1.0.0 and 1.3.0 compatibility across all regression suites.
- Built-in command conflict avoided via `/compact-thinking`.
- Lazy reattachment of historical tool components across `/reload` and `/resume`.
- `codemode` grammar constrained sampling and MCP `reachesTools` contract preserved.
- Lossless sidecar storage for oversized nested outputs (> 64 KB).
- Exact parallel/serial start order replay via `compact-thinking.tool-start`.

Original installation settings backup:
`C:/Users/yoggs/.pi/agent/settings.json.before-compact-thinking-20261016-235653.bak`
