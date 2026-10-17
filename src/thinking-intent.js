import { normalizeDisplaySummary } from "../vendor/pi-tool-explain/display-summary.js";

export const PUBLIC_ACTIVITY_GUIDELINE = 'When providing a brief public progress update for a work phase, start that assistant text with its own plain-text line "活动意图：简短中文目的". Use Simplified Chinese, at most 96 characters, and no secrets. This is a public activity description, not reasoning or a request to disclose hidden thought. Provide at most one such line per phase when you can; do not prepend it to a final-only answer or replace the requested answer with a status line. The UI can show Thinking until a public description arrives.';

export function assistantPublicText(message) {
  return (message?.content ?? []).filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text).join("\n");
}

/** Only explicit public text can supply an activity intent. Never read thinking. */
export function readPublicActivity(message, { offset = 0, complete = false } = {}) {
  const source = assistantPublicText(message);
  const text = source.slice(offset);
  if (!text.trim()) return { kind: "empty" };
  const trimmed = text.trimStart();
  const labels = ["活动意图：", "活动意图:"];
  if (!complete && labels.some((label) => label.startsWith(trimmed))) {
    return { kind: "pending", range: { start: offset, end: source.length } };
  }
  const match = /^\s*活动意图[：:][ \t]*([^\r\n]*)(?:\r?\n|$)/u.exec(text);
  if (!match) return { kind: "body" };
  // Wait for a line terminator or text_end before publishing an unfinished phrase.
  if (!complete && !match[0].endsWith("\n")) {
    return { kind: "pending", range: { start: offset, end: source.length } };
  }
  if (text.slice(match[0].length).trim()) return { kind: "body" };
  const range = { start: offset, end: offset + match[0].length };
  const intent = normalizeDisplaySummary(match[1]);
  if (!intent) return { kind: "pending", range };
  return { kind: "status", intent, range };
}

/** Remove only the active public status line from the compact projection.
 * The original message and expanded transcript retain it verbatim. */
export function compactAssistantContent(message, range) {
  let position = 0;
  let textBlocks = 0;
  return (message.content ?? []).filter((block) => block.type !== "thinking").map((block) => {
    if (block.type !== "text" || typeof block.text !== "string") return block;
    if (textBlocks++ > 0) position++; // assistantPublicText joins text blocks with a newline.
    const start = position;
    const end = start + block.text.length;
    position = end;
    if (!range || range.end <= start || range.start >= end) return block;
    const left = Math.max(0, range.start - start);
    const right = Math.min(block.text.length, range.end - start);
    return { ...block, text: block.text.slice(0, left) + block.text.slice(right) };
  });
}

export function addPublicActivityGuideline(event) {
  const options = event?.systemPromptOptions;
  if (!options) return;
  const guidelines = options.promptGuidelines ??= [];
  if (!guidelines.includes(PUBLIC_ACTIVITY_GUIDELINE)) guidelines.push(PUBLIC_ACTIVITY_GUIDELINE);
}
