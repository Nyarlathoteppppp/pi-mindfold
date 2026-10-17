# Pi compatibility

The managed Pi CLI was upgraded from **1.0.0** to **1.3.0** with the official `pi update --self` command. The official npm registry's `latest` tag returned `1.3.0` at the time of verification. `pi --version` and the managed `install/current-version` pointer both confirm `1.3.0`.

## Results

| Check | Pi 1.0.0 | Pi 1.3.0 |
|---|---|---|
| Full regression suite | 51 passed, 0 failed | 51 passed, 0 failed |
| Actual extension loader | Passed | Passed |
| Real SDK tools and nested codemode | Passed | Passed |
| Native fullscreen mouse, focus, viewport and resize | Passed | Passed |
| Real extension reload and history restoration | Passed | Passed |
| Grammar constrained sampling | Passed | Passed |
| MCP codemode host contract | Original schema identity / `isCodemodeTool` | `reachesTools` preserved and behavior checked |

No plugin runtime code changes were needed for Pi 1.3.0. The initial run found two test failures: the tests called `isCodemodeTool`, an internal helper that newer Pi removed. Tests now assert schema identity plus the actual host-specific MCP contract: the original predicate on Pi 1.0, or functional `reachesTools` declarations on modern Pi. Grammar validation still invokes the actual host sampling resolver.

The test bootstrap now follows the active managed installation instead of defaulting to the old 1.0.0 directory. `COMPACT_PI_ROOT` remains an explicit override for testing other installed releases.

## Installed configuration smoke check

`node --import ./tests/host-imports.mjs ./scripts/compat-smoke.mjs` verifies configured extensions and actual tool registration without external model calls or remote MCP connections. SDK loaders explicitly receive the native codemode and tool-search factories, as required by the official SDK example; SDK resource discovery alone does not include the CLI's builtin factories.

The successful run confirmed:

- Pi host: `1.3.0`, loaded from `install/releases/1.3.0`.
- Pi TUI: `1.3.0`.
- 14 loaded extensions, 0 extension loading errors.
- `/compact-thinking` registered, no extension `/compact` collision.
- 25 registered tools; read/edit/write/grep/find/ls/nushell/nu all retain intent fields.
- Native codemode retains the sole required `code` input and its `reachesTools` function.

A real CLI invocation using the installed configuration also completed with exit code 0:

```text
pi --offline --no-session --print "/compact-thinking status"
```

It reported two unmatched model patterns from existing user settings (`hangzhale/gpt-4o` and `logitstoken/gemini-4-argon`); these did not block startup or plugin tests. User settings were not changed by the upgrade.

## Evidence

- `artifacts/pi-upgrade.stdout.txt`: successful official upgrade log.
- `artifacts/pi-version-before-upgrade.txt`: original `1.0.0` pointer.
- `artifacts/pi-1.3.0-tests.txt`: initial 49/51 result identifying stale test helper imports.
- `artifacts/pi-1.3.0-tests-green.txt`: final 51/51 result on Pi 1.3.0.
- `artifacts/pi-1.0.0-tests-compat.txt`: 51/51 result on the retained Pi 1.0.0 release.
- `artifacts/pi-1.3.0-installed-extensions.json`: actual module paths, host versions and tool registration checks.
- `artifacts/pi-1.3.0-cli-smoke.stderr.txt`: CLI startup warnings.

## Limits and rollback

These checks use real installed Pi modules, native TUI layout/mouse handling with an in-memory terminal, and scripted model responses. The user's live terminal and external provider responses have not been visually or end-to-end tested. Remote MCP connections were not exercised; MCP declaration preservation was checked directly.

The old release remains at `C:/Users/yoggs/.pi/agent/install/releases/1.0.0`. The active version pointer is `C:/Users/yoggs/.pi/agent/install/current-version`; no rollback was applied.

Exit and restart Pi to load the upgraded host. `/reload` replaces extensions within the running process and does not upgrade that process's host modules.
