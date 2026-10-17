import { test } from "node:test";
import assert from "node:assert/strict";
import { ActivityStore } from "../src/activity-store.js";

const entries = (messages) => messages.map((message) => ({ type: "message", message }));
const assistant = { role: "assistant", timestamp: 1, stopReason: "toolUse", content: [
  { type: "toolCall", id: "a", name: "codemode", arguments: {} },
  { type: "toolCall", id: "b", name: "read", arguments: {} },
] };
const start = (id, parent) => ({ type: "custom", customType: "compact-thinking.tool-start", data: { toolCallId: id, toolName: parent ? "read" : id === "a" ? "codemode" : "read", parentToolCallId: parent, ...(parent ? { args: { path: "nested.txt" } } : {}) } });

test("persisted start receipts restore parallel and serial interleaving exactly, regardless of completion order", () => {
  for (const order of [["a", "a/1", "b"], ["a", "b", "a/1"]]) {
    const store = new ActivityStore();
    store.restore([
      ...entries([{ role: "user", content: "request" }, assistant]),
      ...order.map((id) => start(id, id.includes("/") ? "a" : undefined)),
      { type: "custom", customType: "compact-thinking.nested", data: { phase: "end", toolCallId: "a/1", result: { content: [{ type: "text", text: "nested" }] } } },
      ...entries([{ role: "toolResult", toolCallId: "b", content: [] }, { role: "toolResult", toolCallId: "a", content: [] }, { role: "assistant", timestamp: 2, stopReason: "stop", content: [] }]),
    ]);
    assert.deepEqual(store.current.calls, order);
    assert.equal(store.current.lastTool, order.at(-1));
    assert.equal(store.calls.get("a/1").result.content[0].text, "nested");
  }
});
