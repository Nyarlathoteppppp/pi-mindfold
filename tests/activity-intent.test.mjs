import { test } from "node:test";
import assert from "node:assert/strict";
import { ActivityStore } from "../src/activity-store.js";
import { IntentDecorator, intentFor } from "../src/intent.js";

const message = (timestamp, content = []) => ({ role: "assistant", timestamp, content });

test("parallel completion cannot displace the latest started call", () => {
  const store = new ActivityStore();
  const group = store.begin();
  store.startTool({ toolCallId: "a", toolName: "read", args: {} });
  store.startTool({ toolCallId: "b", toolName: "grep", args: {} });
  store.result({ toolCallId: "a", result: { content: [] } });
  assert.deepEqual(group.activity, { kind: "tool", id: "b" });
  store.settle();
  assert.deepEqual(group.activity, { kind: "tool", id: "b" });
});

test("thinking replaces tools; text and settlement remove the placeholder", () => {
  const store = new ActivityStore();
  const group = store.begin();
  store.startTool({ toolCallId: "a", toolName: "read", args: {} });
  const next = message(20);
  store.assistant(next, true);
  assert.equal(group.activity.kind, "thinking");
  store.text(next);
  assert.equal(group.activity.kind, "thinking", "empty text_start must keep Thinking until content arrives");
  next.content.push({ type: "text", text: "正文开始" });
  store.text(next);
  assert.deepEqual(group.activity, { kind: "tool", id: "a" });
  store.assistant(next, true);
  store.settle();
  assert.equal(group.activity.kind, "tool");
  store.begin();
  store.assistant(message(30), true);
  store.settle();
  assert.equal(store.current.activity, undefined);
});

test("nested calls stay in the original request and preserve received results", () => {
  const store = new ActivityStore();
  const group = store.begin();
  store.startTool({ toolCallId: "parent", toolName: "codemode", args: {} });
  store.startTool({ toolCallId: "parent/1", parentToolCallId: "parent", toolName: "nu", args: { displaySummary: "检查工作目录" } });
  const result = { content: [{ type: "text", text: "unchanged\noutput" }] };
  store.result({ toolCallId: "parent/1", result });
  assert.equal(store.calls.get("parent/1").group, group);
  assert.equal(store.rootCall("parent/1").id, "parent");
  assert.equal(store.calls.get("parent/1").result, result);
  assert.equal(store.summary("parent/1"), "检查工作目录");
});

test("history replay groups tool loops and steering, then starts a new request", () => {
  const store = new ActivityStore();
  const entries = [
    { role: "user", content: "first" },
    { ...message(1, [{ type: "thinking", thinking: "original thinking" }, { type: "toolCall", id: "a", name: "read", arguments: {} }]), stopReason: "toolUse" },
    { role: "toolResult", toolCallId: "a", content: [{ type: "text", text: "full output" }] },
    { role: "user", content: "steering" },
    { ...message(2, [{ type: "text", text: "final" }]), stopReason: "stop" },
    { role: "user", content: "second" },
    { ...message(3, [{ type: "text", text: "second final" }]), stopReason: "stop" },
  ].map((m) => ({ type: "message", message: m }));
  store.restore(entries);
  assert.equal(store.groups.length, 2);
  assert.equal(store.messages.get("assistant:1"), store.messages.get("assistant:2"));
  assert.notEqual(store.messages.get("assistant:2"), store.messages.get("assistant:3"));
  assert.equal(entries[1].message.content[0].thinking, "original thinking");
  assert.equal(store.calls.get("a").result.content[0].text, "full output");
});

for (const name of ["read", "bash", "edit", "write", "grep", "find", "ls", "powershell", "nu", "nushell", "codemode", "web_search", "fetch_content", "mcp_custom_lookup"]) {
  test(`${name}: model intent is required; execution and preparation receive only original arguments`, async () => {
    const decorator = new IntentDecorator();
    const seen = [];
    const schema = { type: "object", properties: { target: { type: "string" } }, required: ["target"] };
    const tool = {
      name, parameters: schema, description: "test", label: name, exposure: "codemode",
      prepareArguments(args) { seen.push(args); return { ...args, target: args.target.trim() }; },
      async execute(_id, args) { seen.push(args); return { content: [], details: undefined }; },
    };
    const execute = tool.execute;
    decorator.decorate(tool);
    decorator.decorate(tool);
    assert.ok(tool.parameters.required.includes("displaySummary"));
    assert.match(tool.parameters.properties.displaySummary.description, /Simplified Chinese/);
    assert.equal(schema.properties.displaySummary, undefined);
    const prepared = tool.prepareArguments({ target: " x ", displaySummary: "检查目标配置" });
    assert.equal(prepared.displaySummary, "检查目标配置");
    await tool.execute("id", prepared);
    assert.deepEqual(seen, [{ target: " x " }, { target: "x" }]);
    assert.equal(tool.exposure, "codemode");
    const fallback = tool.prepareArguments({ target: "legacy" });
    assert.ok(fallback.displaySummary);
    decorator.restore();
    assert.equal(tool.execute, execute);
    assert.equal(tool.parameters, schema);
  });
}

test("nested outputs survive history replay without changing their start order", () => {
  const store = new ActivityStore();
  store.restore([
    { type: "message", message: { role: "user", content: "start" } },
    { type: "message", message: { ...message(1, [{ type: "toolCall", id: "root", name: "codemode", arguments: {} }]), stopReason: "toolUse" } },
    { type: "custom", customType: "compact-thinking.nested", data: { phase: "start", toolCallId: "root/1", parentToolCallId: "root", toolName: "read", args: { displaySummary: "读取第一个文件" } } },
    { type: "custom", customType: "compact-thinking.nested", data: { phase: "start", toolCallId: "root/2", parentToolCallId: "root", toolName: "read", args: {} } },
    { type: "custom", customType: "compact-thinking.nested", data: { phase: "end", toolCallId: "root/2", result: { content: [{ type: "text", text: "last child result" }] } } },
    { type: "custom", customType: "compact-thinking.nested", data: { phase: "end", toolCallId: "root/1", result: { content: [{ type: "text", text: "first child result" }] } } },
    { type: "message", message: { ...message(2, [{ type: "text", text: "done" }]), stopReason: "stop" } },
  ]);
  assert.equal(store.calls.get("root/1").result.content[0].text, "first child result");
  assert.deepEqual(store.current.calls, ["root", "root/1", "root/2"]);
  assert.deepEqual(store.current.activity, { kind: "tool", id: "root/2" });
});

test("message identity keeps same-millisecond requests separate and supports timestamp-free streaming", () => {
  const store = new ActivityStore();
  const first = store.begin();
  const one = { role: "assistant", timestamp: 9, content: [{ type: "thinking", thinking: "one" }] };
  store.assistant(one, true, true);
  store.settle();
  const second = store.begin();
  const two = { role: "assistant", timestamp: 9, content: [{ type: "thinking", thinking: "two" }] };
  assert.equal(store.assistant(two, true, true), second);
  assert.notEqual(first, second);
  const noTime = { role: "assistant", content: [{ type: "thinking", thinking: "stream" }] };
  assert.equal(store.assistant(noTime, true, true), second);
  assert.equal(second.activity.kind, "thinking");
});

test("a retry's later started tool supersedes an older pre-execution failure at settlement", () => {
  const store = new ActivityStore();
  const group = store.begin();
  store.assistant({ role: "assistant", timestamp: 10, stopReason: "error", content: [{ type: "toolCall", id: "failed", name: "write", arguments: {} }] });
  store.startTool({ toolCallId: "retry", toolName: "read", args: {} });
  store.settle();
  assert.deepEqual(group.activity, { kind: "tool", id: "retry" });
});

test("summary sanitization removes terminal controls and collapses whitespace", () => {
  assert.equal(intentFor({ displaySummary: "\u001b[31m检查\n 配置\u001b[0m" }, "read"), "检查 配置");
  assert.equal(intentFor({}, "read"), "读取文件");
});

test("a tool that already owns displaySummary keeps its execution semantics", () => {
  const decorator = new IntentDecorator();
  const tool = { name: "owned", parameters: { type: "object", properties: { displaySummary: { type: "string" } } }, execute() {} };
  const execute = tool.execute;
  decorator.decorate(tool);
  assert.equal(tool.execute, execute);
  assert.ok(decorator.skipped.has("owned"));
});
