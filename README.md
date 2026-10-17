# pi-mindfold

[简体中文](./README.zh-CN.md)

> A sleek, intent-aware interaction plugin for [Pi Coding Agent](https://github.com/earendil-works/pi) (Pi 1.0.0 – 1.3.0+).  
> Collapses lengthy reasoning streams and stacked tool outputs into a **single active focus**, displays model-written intent in real-time, and provides one-click lossless expansion for full execution history.

[![npm version](https://img.shields.io/badge/version-0.2.0-blue.svg)](package.json)
[![Pi Compatibility](https://img.shields.io/badge/pi-1.0.0%20--%201.3.0-success.svg)](COMPATIBILITY.md)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## The Problem

When using coding agents with deep reasoning models:
1. **Endless Thinking Scrolls**: Reasoning chains can span dozens or hundreds of lines, repeatedly pushing conversational context off-screen.
2. **Tool Output Stacking**: Sequential calls to `ls`, `read`, `grep`, and `edit` stack raw execution blocks vertically, burying the final assistant reply.
3. **Black-box Tool Execution**: Native collapsed tool displays show only raw commands and truncated output, providing no immediate clarity on *why* a tool is being invoked.

---

## Key Features

- **Single Active Focus (Default Collapsed Mode)**
  - **Thinking Phase**: Hidden thoughts are collapsed into a clean italic label:
    - Initial state: `Thinking`
    - When the model emits a public progress line: `Thinking — Verifying reload recovery logic` (updated dynamically).
  - **Tool Phase**: Immediately replaces the thinking placeholder with the active tool card and its human-readable intent:
    ```text
    read src/index.ts
      ↳ Inspect module exports and route declarations
    ```
  - **Parallel Concurrency**: Tracks execution order by actual start time. Late-finishing sibling calls never revert or scramble the current active display.
  - **Clean Finalization**: Automatically removes the `Thinking` placeholder upon reply completion. If tools were run, the last tool card and its intent remain pinned without cluttering the chat; otherwise, no empty placeholder is left behind.
  - **Pristine Markdown Output**: Assistant markdown text always remains visible in the main chat viewport.

- **One-Click Lossless Expansion (`[Expanded]` Mode)**
  - A responsive toggle button is pinned directly above the input editor:
    ```text
    [Collapse]  ‹ 2/2 ›  Ctrl+Alt+T
    > 
    ```
  - Clicking the button or pressing `Ctrl+Alt+T` restores the complete chronological timeline: all raw reasoning blocks, every tool invocation, full tool outputs, and child `codemode` executions.
  - **Viewport & Focus Preservation**: In Pi's fullscreen TUI, toggling expansion anchors your scroll position to the current dialogue header without stealing text input focus.

- **Zero-Extra-Inference Intent Engine**
  - Adapts the `displaySummary` convention from [pi-tool-explain](https://github.com/Nyarlathoteppppp/pi-tool-explain). The current model writes intent directly inside its normal tool call payload.
  - **No secondary model calls, no separate API keys, and no added latency.**
  - Strips intent fields before forwarding parameters to actual tool implementations, preserving clean argument semantics.
  - Preserves native OpenAI Grammar Constrained Sampling and host tool-reachability contracts for `codemode`, extracting top-level intent from leading `// 意图：...` source comments.
  - **Multilingual Support**: Supports both English and localized prompts (e.g., Simplified Chinese). See [README.zh-CN.md](./README.zh-CN.md) for Chinese documentation.

- **Session Persistence & Large-Payload Sidecar**
  - Session `/reload`, `/resume`, and `/fork` seamlessly restore intents and nested tool hierarchies.
  - Outputs exceeding 64 KB are automatically saved to a content-addressed `.mindfold/` sidecar folder with SHA-256 integrity verification, keeping `.jsonl` session files lightweight and fast.

---

## Visual Comparison

### Collapsed Mode (Default)

```text
read src/index.ts
  ↳ Inspect module exports and route declarations

Here is the implementation overview for the route configuration...

────────────────────────────────────────────────────────────
[Collapse]  ‹ 2/2 ›                              Ctrl+Alt+T
> 
```

### Expanded Mode (After toggle)

```text
Thinking:
First inspecting package.json to identify entry points, then reading src/index.ts...

read package.json
  ↳ Check entry point and project dependencies
  { "name": "project", "main": "src/index.ts", ... }

codemode
  ↳ Concurrently inspect entry module and scan routes directory
  ├─ read src/index.ts
  │    ↳ Inspect module exports and route declarations
  │    export function initRoutes() { ... }
  └─ nushell ls src/routes
       ↳ List route modules in directory
       name | type | size ...

Here is the implementation overview for the route configuration...

────────────────────────────────────────────────────────────
[Expanded]  ‹ 2/2 ›                              Ctrl+Alt+T
> 
```

---

## Installation

### From GitHub Repository

In your terminal or Pi shell:

```bash
pi install git:github.com/yoggsaron010-lang/pi-mindfold
```

Then reload Pi:

```text
/reload
```

*(Or restart Pi if you recently upgraded the host Pi binary).*

### Local Installation

Clone this repository and install from the local directory:

```bash
git clone https://github.com/yoggsaron010-lang/pi-mindfold.git
cd pi-mindfold
pi install .
```

To remove:

```bash
pi remove git:github.com/yoggsaron010-lang/pi-mindfold
# or: pi remove C:/path/to/pi-mindfold
```

---

## Controls & Usage

| Trigger | Action |
|---|---|
| Click `[Collapse]` / `[Expanded]` | Toggle collapsed/expanded state for the selected dialogue |
| `Ctrl+Alt+T` | Keyboard shortcut to toggle state (works in both fullscreen and regular modes) |
| Click `‹` / `›` | Navigate to previous / next dialogue turns |
| `/mindfold` or `/mindfold toggle` | Slash command to toggle current turn |
| `/mindfold expand` | Expand current turn history |
| `/mindfold collapse` | Collapse current turn to active item |
| `/mindfold prev` / `/mindfold next` | Switch selected dialogue turn |
| `/mindfold status` | Inspect decorated tools, turn count, and schemas retaining original parameters |

> **Note on Command Names**: Pi provides a built-in `/compact` command for manual context summarization. This plugin registers as `/mindfold` (with `/compact-thinking` retained as an alias) to avoid collisions.

---

## Supported Tools

The intent engine automatically intercepts and decorates tools defining standard object parameter schemas:

- **Built-in Tools**: `read`, `bash`, `powershell`, `edit`, `write`, `grep`, `find`, `ls`
- **Shell & Scripting**: `nushell` / `nu`, `codemode` (supports leading intent comments and nested child tools)
- **Web & Search**: `web_search`, `google_search`, `fetch_content`, `get_search_content`, `source_check`
- **Task & Media**: `todo`, `generate_image`, `image_generate`
- **Custom & MCP Tools**: All registered MCP servers and SDK-defined tools

Tools that already define their own `displaySummary` or use non-object parameter schemas retain their exact original contracts.

---

## Compatibility & Verification

Tested and validated on Windows and POSIX environments against official Pi distributions:

| Host Version | Automated Suite | Interactive TUI | Notes |
|---|---|---|---|
| **Pi 1.3.0** | **64 passed, 0 failed** | Fullscreen mouse + focus verified | Active official release; supports `reachesTools` |
| **Pi 1.0.0** | **64 passed, 0 failed** | Fullscreen mouse + focus verified | Backward compatible |

Run the verification test suite locally:

```bash
npm test
npm run check
```

Detailed test evidence and lifecycle benchmarks are documented in [COMPATIBILITY.md](./COMPATIBILITY.md) and [VERIFICATION.md](./VERIFICATION.md).

---

## Third-Party Attributions & License

This project adapts and vendors core display-summary and viewport-anchoring primitives from:
- [Nyarlathoteppppp/pi-tool-explain](https://github.com/Nyarlathoteppppp/pi-tool-explain) (MIT License)
- Upstream contributors: [MasuRii](https://github.com/MasuRii) (`pi-tool-display`) and [Mert Deveci](https://github.com/mertdeveci5) (`pi-tool-display-summary`).

All vendored licenses and attribution notices are strictly preserved under `vendor/pi-tool-explain/` and [THIRD_PARTY.md](./THIRD_PARTY.md).

This project is licensed under the [MIT License](./LICENSE).
