import { test, before } from "node:test";
import assert from "node:assert/strict";
import { AssistantMessageComponent, ToolExecutionComponent, createReadToolDefinition, initTheme } from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";
import compactThinking from "../index.js";
import { ActivityStore } from "../src/activity-store.js";
import { CompactController } from "../src/controller.js";

before(() => initTheme("dark", false));
const clean = (lines) => lines.join("\n").replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "").replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "");
const msg = (timestamp, text = "", thinking = "PRIVATE_REASONING", stopReason = "toolUse") => ({ role: "assistant", timestamp, stopReason, content: [
  { type: "thinking", thinking }, ...(text ? [{ type: "text", text }] : []),
] });
function fixture() {
  const store = new ActivityStore();
  const controller = new CompactController(store);
  const tui = { requestRender() {} };
  const theme = { fg: (_color, text) => text, italic: (text) => text };
  controller.attach({ mode: "tui", cwd: process.cwd(), ui: { theme, setWidget(_key, factory) { factory?.(tui, theme); } } });
  store.begin();
  function frame(message, complete = false) {
    store.assistant(message);
    store.text(message, { complete });
    const component = new AssistantMessageComponent(message);
    return { component, text: clean(component.render(80)) };
  }
  return { store, controller, tui, frame };
}

test("public status fills Thinking after the line completes and leaves reasoning private when collapsed", () => {
  const f = fixture();
  try {
    f.store.assistant(msg(1), true, true);
    assert.equal(f.frame(msg(1)).text.trim(), "Thinking");
    assert.equal(f.frame(msg(1, "活动意图：检查历史")).text.trim(), "Thinking");
    const final = msg(1, "活动意图：检查历史恢复逻辑\n");
    const { component, text } = f.frame(final);
    assert.equal(text.trim(), "Thinking — 检查历史恢复逻辑");
    assert.doesNotMatch(text, /PRIVATE_REASONING|活动意图/);
    f.store.current.expanded = true;
    const expanded = clean(component.render(80));
    assert.match(expanded, /PRIVATE_REASONING/);
    assert.match(expanded, /活动意图：检查历史恢复逻辑/);
    assert.equal(final.content[1].text, "活动意图：检查历史恢复逻辑\n");
  } finally { f.controller.dispose(); }
});

test("a completed standalone progress text block can supply intent without a newline", () => {
  const f = fixture();
  try {
    f.store.assistant(msg(2), true, true);
    assert.equal(f.frame(msg(2, "活动意图：检查入口注册"), true).text.trim(), "Thinking — 检查入口注册");
  } finally { f.controller.dispose(); }
});

test("ordinary answer text immediately ends Thinking and preserves the full Markdown answer", () => {
  const f = fixture();
  try {
    f.store.assistant(msg(3), true, true);
    const text = f.frame(msg(3, "# 正式回答\n\n第一段\n\n最后一段")).text;
    assert.doesNotMatch(text, /Thinking|PRIVATE_REASONING/);
    assert.match(text, /正式回答/);
    assert.match(text, /最后一段/);
  } finally { f.controller.dispose(); }
});

test("a body following the public status leaves the activity label and keeps source text intact", () => {
  const f = fixture();
  try {
    f.store.assistant(msg(4), true, true);
    f.frame(msg(4, "活动意图：检查配置\n"));
    const source = "活动意图：检查配置\n\n# 检查结果\n\n完整正文";
    const output = f.frame(msg(4, source)).text;
    assert.doesNotMatch(output, /Thinking/);
    assert.match(output, /完整正文/);
    assert.match(output, /活动意图：检查配置/);
  } finally { f.controller.dispose(); }
});

test("new assistant phase never reuses the previous message's progress intent", () => {
  const f = fixture();
  try {
    f.store.assistant(msg(5), true, true);
    f.frame(msg(5, "活动意图：检查旧配置\n"));
    const next = msg(6);
    f.store.assistant(next, true, true);
    assert.equal(f.frame(next).text.trim(), "Thinking");
  } finally { f.controller.dispose(); }
});

test("thinking deltas retain the current intent while an explicit thinking_start clears it", () => {
  const f = fixture();
  try {
    f.store.assistant(msg(7), true, true);
    f.frame(msg(7, "活动意图：检查当前配置\n"));
    const delta = msg(7, "活动意图：检查当前配置\n", "NEXT_PRIVATE_DELTA");
    f.store.assistant(delta, true);
    const component = new AssistantMessageComponent(delta);
    assert.equal(clean(component.render(80)).trim(), "Thinking — 检查当前配置");
    f.store.startThinking(delta);
    assert.doesNotMatch(clean(component.render(80)).split("\n")[0], /检查当前配置/);
    const updated = msg(7, "活动意图：检查当前配置\n活动意图：验证新阶段\n", "NEXT_PRIVATE_DELTA");
    assert.match(f.frame(updated).text, /Thinking — 验证新阶段/);
  } finally { f.controller.dispose(); }
});

test("tool startup replaces Thinking intent and late results cannot restore the old label", () => {
  const f = fixture();
  try {
    f.store.assistant(msg(8), true, true);
    const message = msg(8, "活动意图：检查测试结果\n");
    const component = f.frame(message).component;
    const args = { path: "fixture.txt", displaySummary: "读取工具测试文件" };
    f.store.startTool({ toolCallId: "new-tool", toolName: "read", args });
    const tool = new ToolExecutionComponent("read", "new-tool", args, {}, createReadToolDefinition(process.cwd()), f.tui, process.cwd());
    assert.doesNotMatch(clean(component.render(80)), /Thinking/);
    assert.match(clean(tool.render(80)), /↳ 读取工具测试文件/);
    f.store.result({ toolCallId: "new-tool", result: { content: [] } });
    assert.equal(f.store.current.activity.kind, "tool");
  } finally { f.controller.dispose(); }
});

test("thinking text, quoted examples and unmarked prose are never treated as a public intent", () => {
  const f = fixture();
  try {
    const message = msg(9, "", "活动意图：SECRET_FROM_THINKING");
    f.store.assistant(message, true, true);
    assert.equal(f.frame(message).text.trim(), "Thinking");
    for (const text of ["> 活动意图：引用示例", "```text\n活动意图：代码示例\n```", "我先检查入口文件"]) {
      f.store.assistant(msg(10), true, true);
      assert.doesNotMatch(f.frame(msg(10, text), true).text, /Thinking —/);
    }
  } finally { f.controller.dispose(); }
});

test("intent display strips terminal controls and fits narrow terminal widths", () => {
  const f = fixture();
  try {
    f.store.assistant(msg(11), true, true);
    const { component, text } = f.frame(msg(11, `活动意图：\u001b[31m${"检查中文配置".repeat(30)}\u001b[0m\n`));
    assert.match(text, /Thinking — 检查中文配置/);
    assert.doesNotMatch(f.store.current.activity.intent, /\u001b/);
    assert.ok(f.store.current.activity.intent.length <= 96);
    for (const width of [0, 1, 8, 20, 80]) {
      for (const line of component.render(width)) assert.ok(visibleWidth(line) <= width);
    }
  } finally { f.controller.dispose(); }
});

test("replayed progress-only messages do not leave a stale Thinking label after settlement", () => {
  const f = fixture();
  try {
    const message = msg(12, "活动意图：历史状态\n", "SAVED_REASONING", "stop");
    f.store.restore([{ type: "message", message: { role: "user", content: "request" } }, { type: "message", message }]);
    assert.doesNotMatch(clean(new AssistantMessageComponent(message).render(80)), /Thinking/);
  } finally { f.controller.dispose(); }
});

test("extension adds a deduplicated public-status guideline without replacing structured prompt sections", async () => {
  const handlers = new Map();
  compactThinking({ on(name, handler) { handlers.set(name, handler); }, registerCommand() {}, registerShortcut() {} });
  try {
    const event = { systemPromptOptions: { promptGuidelines: ["Original guideline"], sections: { original: "Retained section" } } };
    await handlers.get("before_agent_start")(event);
    await handlers.get("before_agent_start")(event);
    assert.ok(event.systemPromptOptions.promptGuidelines.some((line) => line.includes("活动意图：")));
    assert.equal(new Set(event.systemPromptOptions.promptGuidelines).size, event.systemPromptOptions.promptGuidelines.length);
    assert.deepEqual(event.systemPromptOptions.sections, { original: "Retained section" });
  } finally { await handlers.get("session_shutdown")(); }
});
