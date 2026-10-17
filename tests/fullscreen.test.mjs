import { test } from "node:test";
import assert from "node:assert/strict";
import { AssistantMessageComponent, ToolExecutionComponent, createReadToolDefinition, initTheme } from "@earendil-works/pi-coding-agent";
import { Container, Input, ScrollView, Spacer, Text, TuiAltScreen, VStack, stripTerminalSequences } from "@earendil-works/pi-tui";
import { ActivityStore } from "../src/activity-store.js";
import { CompactController } from "../src/controller.js";

class Terminal {
  columns = 90; rows = 24; kittyProtocolActive = false;
  start(input, resize) { this.input = input; this.resize = resize; }
  stop() { this.input = this.resize = undefined; }
  async drainInput() {}
  write() {} moveBy() {} hideCursor() {} showCursor() {} clearLine() {} clearFromCursor() {} clearScreen() {} setTitle() {} setProgress() {}
  click(x, y) { this.input?.(`\x1b[<0;${x + 1};${y + 1}M`); this.input?.(`\x1b[<0;${x + 1};${y + 1}m`); }
}

test("native fullscreen renders public Thinking intent, expands original history and preserves typing focus", () => {
  initTheme("dark", false);
  const terminal = new Terminal();
  const tui = new TuiAltScreen(terminal, false, undefined, { mouse: true, copyOnSelect: false });
  const store = new ActivityStore();
  const controller = new CompactController(store);
  const document = new Container(), widgets = new Container(), editor = new Input();
  const theme = { fg: (_color, text) => text, italic: (text) => text };
  controller.attach({ mode: "tui", cwd: process.cwd(), ui: { theme, setWidget(_key, factory) { widgets.clear(); if (factory) widgets.addChild(factory(tui, theme)); } } });
  store.begin();
  const initial = { role: "assistant", timestamp: 50, stopReason: "toolUse", content: [{ type: "thinking", thinking: "ORIGINAL_VISIBLE_REASONING" }] };
  store.assistant(initial, true, true);
  const component = new AssistantMessageComponent(initial);
  document.addChild(component);
  const scroll = new ScrollView(document, { primary: true, follow: "end" });
  tui.setLayoutRoot(new VStack([
    { component: scroll, basis: 0, grow: 1, minSize: 1 },
    { component: widgets, shrink: 0 },
    { component: editor, basis: 1, shrink: 0 },
  ]));
  tui.setFocus(editor);
  const paint = () => { tui.renderNow(); tui.renderNow(); };
  const screen = () => tui.getScreenLines().map(stripTerminalSequences).join("\n");
  try {
    tui.start(); paint();
    assert.match(screen(), /Thinking/);
    assert.doesNotMatch(screen(), /ORIGINAL_VISIBLE_REASONING/);
    const progress = { ...initial, content: [...initial.content, { type: "text", text: "活动意图：检查当前恢复状态\n" }] };
    store.assistant(progress); store.text(progress);
    component.updateContent(progress, true); paint();
    assert.match(screen(), /Thinking — 检查当前恢复状态/);
    assert.doesNotMatch(screen(), /活动意图：/);
    terminal.click(2, terminal.rows - 2); paint();
    assert.match(screen(), /ORIGINAL_VISIBLE_REASONING/);
    assert.match(screen(), /活动意图：检查当前恢复状态/);
    assert.equal(tui.getFocusedComponent(), editor);
    terminal.click(3, terminal.rows - 2); paint();
    assert.match(screen(), /Thinking — 检查当前恢复状态/);
    terminal.input("中");
    assert.equal(editor.getValue(), "中");
    const final = { ...progress, stopReason: "stop", content: [initial.content[0], { type: "text", text: "活动意图：检查当前恢复状态\n\n# 最终正文\n\n内容完整保留" }] };
    store.assistant(final); store.text(final, { complete: true, finished: true }); store.settle();
    component.updateContent(final, false); paint();
    assert.doesNotMatch(screen(), /Thinking/);
    assert.match(screen(), /内容完整保留/);
    assert.equal(tui.getFocusedComponent(), editor);
  } finally { controller.dispose(); tui.stop({ preserveScreen: true }); }
});

test("native fullscreen mouse toggle anchors the request and keeps editor focus", () => {
  initTheme("dark", false);
  const terminal = new Terminal();
  const tui = new TuiAltScreen(terminal, false, undefined, { mouse: true, copyOnSelect: false });
  const store = new ActivityStore();
  const controller = new CompactController(store);
  const document = new Container();
  const widgets = new Container();
  const editor = new Input();
  const theme = { fg: (_color, text) => text, italic: (text) => text };
  controller.attach({ mode: "tui", cwd: process.cwd(), ui: { theme, setWidget(_key, factory) { widgets.clear(); if (factory) widgets.addChild(factory(tui, theme)); } } });
  const group = store.begin();
  const message = { role: "assistant", timestamp: 1, stopReason: "toolUse", content: [
    { type: "thinking", thinking: Array.from({ length: 30 }, (_, i) => `THINKING_${i}`).join("\n") },
    { type: "toolCall", id: "fixture", name: "read", arguments: { path: "fixture.txt", displaySummary: "读取完整测试文件" } },
  ] };
  store.assistant(message);
  const args = message.content[1].arguments;
  store.startTool({ toolCallId: "fixture", toolName: "read", args });
  const component = new ToolExecutionComponent("read", "fixture", args, {}, createReadToolDefinition(process.cwd()), tui, process.cwd());
  component.markExecutionStarted();
  component.updateResult({ content: [{ type: "text", text: Array.from({ length: 100 }, (_, i) => `OUTPUT_${i}`).join("\n") }], isError: false });
  const final = { role: "assistant", timestamp: 2, stopReason: "stop", content: [{ type: "text", text: "FINAL_MARKDOWN" }] };
  store.assistant(final); store.settle();
  document.addChild(new Spacer(40));
  document.addChild(new AssistantMessageComponent(message));
  document.addChild(component);
  document.addChild(new AssistantMessageComponent(final));
  const scroll = new ScrollView(document, { primary: true, follow: "end", scrollbar: "always" });
  tui.setLayoutRoot(new VStack([
    { component: new Text("APPLICATION", 0, 0), basis: 1, shrink: 0 },
    { component: scroll, basis: 0, grow: 1, minSize: 1 },
    { component: widgets, shrink: 0 },
    { component: editor, basis: 1, shrink: 0 },
  ]));
  tui.setFocus(editor);
  const paint = () => { tui.renderNow(); tui.renderNow(); };
  const screen = () => tui.getScreenLines().map(stripTerminalSequences);
  try {
    tui.start(); paint();
    assert.ok(screen().some((line) => line.includes("FINAL_MARKDOWN")));
    assert.ok(screen()[terminal.rows - 2].includes("[Collapse]"), "control must be immediately above editor");
    const beforeTop = scroll.scrollTop;
    terminal.click(2, terminal.rows - 2); paint();
    assert.equal(group.expanded, true);
    assert.equal(scroll.isFollowingEnd, false);
    assert.equal(scroll.scrollTop, beforeTop);
    assert.equal(tui.getFocusedComponent(), editor);
    assert.ok(screen().some((line) => line.includes("THINKING_0")));
    const thinkingRow = screen().findIndex((line) => line.includes("THINKING_0"));
    terminal.click(3, thinkingRow); paint();
    assert.ok(screen().some((line) => line.includes("THINKING_0")));
    assert.equal(group.expanded, true);
    assert.equal(tui.getFocusedComponent(), editor);
    terminal.input("中");
    assert.equal(editor.getValue(), "中");
    scroll.scrollBy(45); paint();
    terminal.click(3, terminal.rows - 2); paint();
    assert.equal(group.expanded, false, screen().join("\n"));
    assert.ok(screen().some((line) => line.includes("fixture.txt")));
    assert.equal(tui.getFocusedComponent(), editor);
    terminal.columns = 44; terminal.rows = 14; terminal.resize?.(); paint();
    assert.ok(screen()[terminal.rows - 2].includes("[Collapse]"));
  } finally { controller.dispose(); tui.stop({ preserveScreen: true }); }
});
