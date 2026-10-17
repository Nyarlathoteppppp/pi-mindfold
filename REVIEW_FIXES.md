# Review fixes — 0.1.1

This document records the disposition of the Gemini 4 review in `artifacts/gemini4-review.md`.

The first targeted regression run reproduced 12 failing cases before the implementation changes. After fixes and additional boundary coverage, all 51 tests pass against the installed Pi 1.0.0 host.

| Finding | Disposition | Behavioral evidence |
|---|---|---|
| P1-1: builtin `/compact` collision | Fixed: use `/compact-thinking` | Loader test compares registered command names with the actual host builtin list; lifecycle test executes expand/prev/status via `session.prompt()` |
| P1-2: history created before `session_start` | Fixed: lazily reattach native views and populate missing sibling views from saved data | Real `session.reload({ beforeSessionStart })` test plus first-frame multi-tool history test |
| P1-3: codemode grammar/schema identity | Fixed: preserve schema and grammar; obtain model-written top-level intent from a leading Chinese JavaScript comment | Real host `resolveGrammarConstrainedSampling(..., true)` and `isCodemodeTool()` pass; codemode executes nested tools through the actual SDK |
| P1-4: unstarted/aborted calls hidden | Fixed: include declared calls in expanded history and retain terminal errors without claiming execution | Aborted/error/length and queued-call native rendering tests |
| P2-1: local collapse while Expanded | Fixed: dialogue control owns thinking visibility; suppress native tool local-collapse toggles while forwarding custom controls | Native fullscreen click on thinking, native result click, custom button dispatch |
| P2-2: duplicate/unbounded JSONL payload | Fixed: save display-only content/details; spill individual payloads above 64 KB into checksummed sidecars | Duplicate structuredContent excluded; large output restores losslessly; missing sidecar and unwritable directory cases covered |
| P2-3: thinking delta rebuilds | Fixed: outer host retains source without building invisible Markdown; visible cache keyed on effective display content | Repeated thinking-only updates reuse the same view while expanded history still shows the final reasoning text |
| P2-4: replay changes execution order | Fixed for new records: persist lightweight top-level and nested start receipts | Serial and parallel interleavings restore exact start order independent of completion order |
| Timestamp identity risk | Addressed: weak object identities, explicit message-start boundaries and generated keys for missing timestamps | Same-millisecond separate requests and timestamp-free streaming tests |
| Compaction stale UI references | Addressed: rebuild visible context entries and clear component maps on `session_compact` | Real session compaction entry + extension event clears old navigation |
| Multiple SDK sessions in one process | Deferred: this version targets a standard single active CLI session | Explicitly documented in README; concurrent SDK ownership remains unsupported |

An additional regression found during repair prevented an earlier pre-execution failure from overriding a later retry's tool at settlement. That case is now covered.

Large-result storage deliberately does not cap the number of tools: a silent 256-call cutoff would violate the requested lossless history. Instead it removes duplicate script-only payloads and bounds individual JSONL entries with sidecar references. If sidecar storage is unavailable, complete inline data is retained. New sidecar files live under the session directory's `.compact-thinking/` and must accompany session backups or moves.

Legacy sessions without start receipts do not contain enough evidence to reconstruct their precise parallel start order. They remain readable; exact start-order guarantees apply to newly recorded calls.

Validation artifacts:

- `artifacts/review-regression-red.txt`: initial reproduced failures.
- `artifacts/review-regression-green.txt`: final 51/51 pass output.
- `artifacts/review-syntax-green.txt`: syntax check.
- `artifacts/review-contract-sweep.json`: source scan, no remaining reserved command registration or nonexistent switch/fork event listeners.

No independent reviewer was launched for this repair. The parent reproduced findings and verified the fixes directly. External model service behavior and the user's live terminal were not visually tested; scripted responses and a native TUI with an in-memory terminal transport provide the integration evidence.
