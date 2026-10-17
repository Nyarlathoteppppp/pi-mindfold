import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const INLINE_PAYLOAD_BYTES = 64 * 1024;

function digest(text) { return createHash("sha256").update(text).digest("hex"); }

/** Store display data only. Large payloads go to a content-addressed sidecar,
 * retaining full output without repeating structuredContent in session JSONL. */
export function saveDisplayPayload(data, directory) {
  const json = JSON.stringify(data);
  if (!directory || Buffer.byteLength(json) <= INLINE_PAYLOAD_BYTES) return data;
  const hash = digest(json);
  const storage = join(directory, ".compact-thinking");
  try {
    mkdirSync(storage, { recursive: true });
    const path = join(storage, `${hash}.json`);
    const temporary = `${path}.${process.pid}.tmp`;
    writeFileSync(temporary, json, "utf8");
    renameSync(temporary, path);
    return { phase: data.phase, toolCallId: data.toolCallId, parentToolCallId: data.parentToolCallId, toolName: data.toolName,
      displayPayload: { path, sha256: hash } };
  } catch {
    // Display persistence must not break a tool. Keep the full inline data when
    // a sidecar directory is read-only or unavailable.
    return data;
  }
}

export function loadDisplayPayload(data) {
  if (!data?.displayPayload) return data;
  try {
    const json = readFileSync(data.displayPayload.path, "utf8");
    if (digest(json) !== data.displayPayload.sha256) throw new Error("display payload checksum mismatch");
    return JSON.parse(json);
  } catch {
    return { ...data, missingDisplayPayload: true,
      args: { displaySummary: "原始显示数据不可用" },
      result: { content: [{ type: "text", text: "Saved display data is missing or damaged. Restore the session's .compact-thinking sidecar directory." }] }, isError: true };
  }
}

export function toolStartReceipt(event) {
  return {
    toolCallId: event.toolCallId, toolName: event.toolName,
    ...(event.parentToolCallId ? { parentToolCallId: event.parentToolCallId, args: event.args } : {}),
  };
}

export function nestedResultReceipt(event) {
  return {
    phase: "end", toolCallId: event.toolCallId, parentToolCallId: event.parentToolCallId,
    toolName: event.toolName, isError: event.isError === true,
    result: event.result ? { content: event.result.content, details: event.result.details } : undefined,
  };
}
