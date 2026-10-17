import { test, before } from "node:test";
import assert from "node:assert/strict";
import { AssistantMessageComponent, ToolExecutionComponent, createReadToolDefinition, initTheme } from "@earendil-works/pi-coding-agent";
import { Text, visibleWidth } from "@earendil-works/pi-tui";
import { ActivityStore } from "../src/activity-store.js";
import { CompactController } from "../src/controller.js";

before(() => initTheme("dark", false));
const clean = (lines) => lines.join("\n").replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "").replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "");
const assistant = (timestamp, content, stopReason = "toolUse") => ({ role: "assistant", timestamp, content, stopReason });
const theme = { fg: (_color, text) => text, italic: (text) => text };

function harness() {
  const store = new ActivityStore();
  const controller = new CompactController(store);
  const tui = { requestRender() {}, mode: "fullscreen" };
  let widget;
  const ctx = { mode: "tui", cwd: process.cwd(), ui: { theme, setWidget(_key, factory) { if (factory) widget = factory(tui, theme); } } };
  controller.attach(ctx);
  store.begin();
  function tool(id, name = "read", parentToolCallId) {
    const args = { path: `${id}.txt`, displaySummary: `检查 ${id} 的配置` };
    const call = store.startTool({ toolCallId: id, toolName: name, args, parentToolCallId });
    const definition = createReadToolDefinition(process.cwd());
    if (parentToolCallId) {
      controller.definitions.set(name, { definition });
      controller.startNested(call);
      return controller.nested.get(id);
    }
    const component = new ToolExecutionComponent(name, id, args, {}, definition, tui, ctx.cwd);
    component.markExecutionStarted();
    component.setArgsComplete();
    return component;
  }
  return { store, controller, tui, ctx, tool, get widget() { return widget; } };
}

test("collapsed native components show only the latest tool and its Chinese intent", () => {
  const h = harness();
  try {
    const a = h.tool("first");
    const b = h.tool("latest");
    a.updateResult({ content: [{ type: "text", text: "old output" }], isError: false });
    assert.equal(clean(a.render(80)), "");
    const text = clean(b.render(80));
    assert.match(text, /latest.txt/);
    assert.match(text, /↳ 检查 latest 的配置/);
    assert.doesNotMatch(text, /first.txt/);
  } finally { h.controller.dispose(); }
});

test("any length of thinking collapses to one Thinking line and expands without altering source", () => {
  const h = harness();
  try {
    const thinking = Array.from({ length: 100 }, (_, i) => `思考原文 ${i}`).join("\n");
    const message = assistant(1, [{ type: "thinking", thinking }]);
    h.store.assistant(message, true);
    const component = new AssistantMessageComponent(message);
    assert.equal(clean(component.render(80)).trim(), "Thinking");
    h.store.current.expanded = true;
    const expanded = clean(component.render(80));
    assert.match(expanded, /思考原文 0/);
    assert.match(expanded, /思考原文 99/);
    h.store.current.expanded = false;
    assert.equal(clean(component.render(80)).trim(), "Thinking");
    assert.equal(message.content[0].thinking, thinking);
  } finally { h.controller.dispose(); }
});

test("expanded native results restore every received line; final Markdown stays visible", () => {
  const h = harness();
  try {
    const a = h.tool("first");
    const output = Array.from({ length: 120 }, (_, i) => `RESULT_${i}`).join("\n");
    a.updateResult({ content: [{ type: "text", text: output }], isError: false });
    const message = assistant(2, [{ type: "thinking", thinking: "hidden final thinking" }, { type: "text", text: "# 完整正文\n\n第一段\n\n最后一段" }], "stop");
    h.store.assistant(message, true);
    h.store.text(message);
    h.store.settle();
    const component = new AssistantMessageComponent(message);
    const body = clean(component.render(80));
    assert.match(body, /完整正文/);
    assert.match(body, /最后一段/);
    assert.doesNotMatch(body, /hidden final thinking|Thinking/);
    assert.doesNotMatch(clean(a.render(80)), /RESULT_119/);
    h.controller.toggle(true);
    const expanded = clean(a.render(80));
    assert.match(expanded, /RESULT_0/);
    assert.match(expanded, /RESULT_119/);
    assert.equal(a.result.content[0].text, output);
    assert.match(clean(component.render(80)), /hidden final thinking/);
  } finally { h.controller.dispose(); }
});

test("nested tools replace their root visually and recover full results on expansion", () => {
  const h = harness();
  try {
    const root = h.tool("root", "codemode");
    const first = h.tool("root/1", "read", "root");
    const latest = h.tool("root/2", "read", "root");
    latest.updateResult({ content: [{ type: "text", text: "nested latest output" }], isError: false });
    first.updateResult({ content: [{ type: "text", text: "nested older output" }], isError: true });
    assert.match(clean(root.render(80)), /root\/2.txt/);
    assert.doesNotMatch(clean(root.render(80)), /root\/1.txt/);
    h.store.current.expanded = true;
    const expanded = clean(root.render(80));
    assert.match(expanded, /nested older output/);
    assert.match(expanded, /nested latest output/);
  } finally { h.controller.dispose(); }
});

test("parallel roots and nested calls expand in actual start order within their assistant batch", () => {
  const h = harness();
  try {
    h.store.assistant(assistant(42, [
      { type: "toolCall", id: "a", name: "codemode", arguments: {} },
      { type: "toolCall", id: "b", name: "read", arguments: {} },
    ]));
    const a = h.tool("a", "codemode");
    const b = h.tool("b");
    h.tool("a/1", "read", "a");
    h.store.current.expanded = true;
    const expanded = clean([...a.render(80), ...b.render(80)]);
    assert.ok(expanded.indexOf("b.txt") < expanded.indexOf("a/1.txt"));
    assert.equal(expanded.match(/b.txt/g)?.length, 1);
  } finally { h.controller.dispose(); }
});

test("widget clicks toggle only the selected dialogue without requesting focus", () => {
  const h = harness();
  try {
    assert.match(clean(h.widget.render(80)), /\[Collapse\]/);
    const result = h.widget.handleMouse({ type: "click", button: "left", x: 2, y: 0, width: 80, height: 1 });
    assert.equal(result.handled, true);
    assert.equal(result.focus, undefined);
    assert.match(clean(h.widget.render(80)), /\[Expanded\]/);
    const first = h.store.current;
    h.store.begin();
    assert.equal(h.store.current.expanded, false);
    h.controller.select(-1);
    assert.equal(h.store.selected, first);
    h.controller.toggle(false);
    assert.equal(first.expanded, false);
  } finally { h.controller.dispose(); }
});

test("narrow terminals and resize keep all rendered lines within width", () => {
  const h = harness();
  try {
    const message = assistant(3, [{ type: "thinking", thinking: "很长的思考" }, { type: "text", text: "中文 Markdown **正文**" }], "stop");
    h.store.assistant(message, true);
    const component = new AssistantMessageComponent(message);
    for (const expanded of [false, true]) {
      h.store.current.expanded = expanded;
      for (const width of [1, 8, 20, 80]) {
        for (const line of [...component.render(width), ...h.widget.render(width)]) assert.ok(visibleWidth(line) <= width);
      }
    }
  } finally { h.controller.dispose(); }
});

test("history tools created before session_start acquire intent and remain visible when expanded", () => {
  const args = { path: "historical.txt", displaySummary: "检查历史工具输出" };
  const tui = { requestRender() {} };
  const tool = new ToolExecutionComponent("read", "historical", args, {}, createReadToolDefinition(process.cwd()), tui, process.cwd());
  tool.updateResult({ content: [{ type: "text", text: "HISTORICAL_RESULT" }], isError: false });
  const h = harness();
  try {
    h.store.startTool({ toolCallId: "historical", toolName: "read", args });
    assert.match(clean(tool.render(80)), /↳ 检查历史工具输出/);
    h.store.current.expanded = true;
    assert.match(clean(tool.render(80)), /HISTORICAL_RESULT/);
  } finally { h.controller.dispose(); }
});

test("multiple historical siblings created before attach are all visible on the first expanded frame", () => {
  const tui = { requestRender() {} };
  const definition = createReadToolDefinition(process.cwd());
  const tools = ["history-a", "history-b"].map((id) => {
    const tool = new ToolExecutionComponent("read", id, { path: `${id}.txt` }, {}, definition, tui, process.cwd());
    tool.updateResult({ content: [{ type: "text", text: `OUTPUT_${id}` }], isError: false });
    return tool;
  });
  const h = harness();
  try {
    h.controller.definitions.set("read", { definition });
    const message = assistant(80, ["history-a", "history-b"].map((id) => ({ type: "toolCall", id, name: "read", arguments: { path: `${id}.txt` } })));
    h.store.assistant(message);
    for (const id of ["history-a", "history-b"]) {
      h.store.startTool({ toolCallId: id });
      h.store.result({ toolCallId: id, result: { content: [{ type: "text", text: `OUTPUT_${id}` }] } });
    }
    h.store.current.expanded = true;
    const output = clean(tools.flatMap((tool) => tool.render(80)));
    assert.match(output, /OUTPUT_history-a/);
    assert.match(output, /OUTPUT_history-b/);
    assert.equal(output.match(/OUTPUT_history-b/g)?.length, 1);
  } finally { h.controller.dispose(); }
});

test("custom tool controls remain clickable while native local collapse is disabled", () => {
  const h = harness();
  let clicks = 0;
  try {
    h.store.startTool({ toolCallId: "interactive", toolName: "interactive", args: {} });
    const tool = new ToolExecutionComponent("interactive", "interactive", {}, {}, {
      renderCall: () => ({ render: () => ["CUSTOM_BUTTON"], invalidate() {}, handleMouse(event) { if (event.type === "click") { clicks++; return { handled: true }; } } }),
      renderResult: () => new Text("result", 0, 0),
    }, h.tui, process.cwd());
    tool.updateResult({ content: [], isError: false });
    h.store.current.expanded = true;
    const lines = tool.render(80);
    const y = lines.findIndex((line) => clean([line]).includes("CUSTOM_BUTTON"));
    tool.handleMouse({ type: "click", button: "left", x: 3, y, width: 80, height: lines.length });
    assert.equal(clicks, 1);
    assert.equal(tool.expanded, true);
  } finally { h.controller.dispose(); }
});

for (const reason of ["aborted", "error", "length"]) {
  test(`a tool whose arguments terminate with ${reason} remains visible without execution_start`, () => {
    const h = harness();
    try {
      const message = assistant(81, [{ type: "toolCall", id: "pending", name: "read", arguments: { path: "partial.txt" } }], reason);
      h.store.assistant(message);
      const tool = new ToolExecutionComponent("read", "pending", { path: "partial.txt" }, {}, createReadToolDefinition(process.cwd()), h.tui, process.cwd());
      tool.updateResult({ content: [{ type: "text", text: "Operation aborted or failed" }], isError: true });
      h.store.settle();
      for (const expanded of [false, true]) {
        h.store.current.expanded = expanded;
        assert.match(clean(tool.render(80)), /Operation aborted or failed/);
      }
    } finally { h.controller.dispose(); }
  });
}

test("expanded tools show streaming and queued arguments before execution_start", () => {
  const h = harness();
  try {
    const message = assistant(82, [{ type: "toolCall", id: "queued", name: "read", arguments: { path: "queued.txt" } }]);
    h.store.assistant(message);
    const tool = new ToolExecutionComponent("read", "queued", { path: "queued.txt" }, {}, createReadToolDefinition(process.cwd()), h.tui, process.cwd());
    h.store.current.expanded = true;
    assert.match(clean(tool.render(80)), /queued.txt/);
  } finally { h.controller.dispose(); }
});

test("clicking expanded thinking never locally folds the thinking text", () => {
  const h = harness();
  try {
    const message = assistant(83, [{ type: "thinking", thinking: "THINKING_STAYS_EXPANDED" }]);
    h.store.assistant(message, true);
    h.store.current.expanded = true;
    const component = new AssistantMessageComponent(message);
    const lines = component.render(80);
    const y = lines.findIndex((line) => clean([line]).includes("THINKING_STAYS_EXPANDED"));
    component.handleMouse({ type: "click", button: "left", x: 3, y, width: 80, height: lines.length });
    assert.match(clean(component.render(80)), /THINKING_STAYS_EXPANDED/);
  } finally { h.controller.dispose(); }
});

test("clicking expanded native results does not rebuild them through a local collapse", () => {
  const h = harness();
  try {
    const tool = h.tool("click-result");
    tool.updateResult({ content: [{ type: "text", text: "CLICK_RESULT" }], isError: false });
    h.store.current.expanded = true;
    const lines = tool.render(80);
    const call = tool.callRendererComponent;
    const y = lines.findIndex((line) => clean([line]).includes("CLICK_RESULT"));
    tool.handleMouse({ type: "click", button: "left", x: 3, y, width: 80, height: lines.length });
    assert.equal(tool.expanded, true);
    assert.equal(tool.callRendererComponent, call);
  } finally { h.controller.dispose(); }
});

test("thinking-only streaming reuses the visible view and leaves source reasoning intact", () => {
  const h = harness();
  try {
    const message = assistant(84, [{ type: "thinking", thinking: "part 0" }]);
    h.store.assistant(message, true);
    const component = new AssistantMessageComponent(message);
    component.updateContent(message, true);
    component.render(80);
    const visible = component.__compactView;
    const outerChildren = component.contentContainer.children.slice();
    for (let i = 1; i <= 20; i++) {
      const next = { ...message, content: [{ type: "thinking", thinking: `part ${i}` }] };
      h.store.assistant(next, true);
      component.updateContent(next, true);
      assert.equal(clean(component.render(80)).trim(), "Thinking");
      assert.equal(component.__compactView, visible);
      assert.deepEqual(component.contentContainer.children, outerChildren);
    }
    h.store.current.expanded = true;
    assert.match(clean(component.render(80)), /part 20/);
    assert.equal(component.lastMessage.content[0].thinking, "part 20");
  } finally { h.controller.dispose(); }
});

test("shutdown and reload restore native prototype methods", () => {
  const render = AssistantMessageComponent.prototype.render;
  const toolRender = ToolExecutionComponent.prototype.render;
  const h = harness();
  assert.notEqual(AssistantMessageComponent.prototype.render, render);
  h.controller.dispose();
  assert.equal(AssistantMessageComponent.prototype.render, render);
  assert.equal(ToolExecutionComponent.prototype.render, toolRender);
  const next = harness();
  next.controller.dispose();
  assert.equal(AssistantMessageComponent.prototype.render, render);
});
