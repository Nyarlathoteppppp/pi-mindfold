import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  AssistantMessageComponent, createAgentSession, DefaultResourceLoader, initTheme, SessionManager, SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { AssistantMessageEventStream } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import mindfold from "../index.js";

const clean = (lines) => lines.join("\n").replace(/\x1b\][^\x07]*(?:\x07|\x1b\\)/g, "").replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "");
const model = { id: "thinking-intent-local-test", name: "Local test", provider: "openai", api: "openai-completions", baseUrl: "http://127.0.0.1:1", reasoning: true, input: ["text"], contextWindow: 32768, maxTokens: 4096,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } };
const usage = { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
const response = (timestamp, content, stopReason = "toolUse") => ({ role: "assistant", timestamp, content, stopReason, api: model.api, provider: model.provider, model: model.id, usage });

test("real streamed SDK events update Thinking intent without extra inference and clear it before tools and final text", async () => {
  initTheme("dark", false);
  const directory = mkdtempSync(join(tmpdir(), "compact-thinking-stream-"));
  const settingsManager = SettingsManager.inMemory({ defaultTools: ["echo_status"], compaction: { enabled: false } });
  const resourceLoader = new DefaultResourceLoader({ cwd: directory, agentDir: directory, settingsManager,
    noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true,
    extensionFactories: [mindfold, (pi) => pi.registerTool({ name: "echo_status", label: "echo_status", description: "Echo fixture", parameters: Type.Object({ value: Type.String() }),
      async execute(_id, args) { return { content: [{ type: "text", text: args.value }], details: undefined }; } })],
  });
  await resourceLoader.reload();
  const { session } = await createAgentSession({ cwd: directory, agentDir: directory, settingsManager, resourceLoader, model, sessionManager: SessionManager.inMemory(directory) });
  const tui = { requestRender() {} };
  const theme = { fg: (_color, text) => text, italic: (text) => text };
  const errors = [], frames = [], inferencePrompts = [];
  let component, inferenceCalls = 0;
  try {
    await session.bindExtensions({ mode: "tui", uiContext: { theme, setWidget(_key, factory) { factory?.(tui, theme); } }, onError: (error) => errors.push(error) });
    await session.modelRuntime.setRuntimeApiKey("openai", "local-test-placeholder");
    session.agent.streamFunction = () => {
      inferenceCalls++;
      inferencePrompts.push(session.systemPrompt);
      const stream = new AssistantMessageEventStream();
      queueMicrotask(() => {
        if (inferenceCalls === 1) {
          const thinking = { type: "thinking", thinking: "PRIVATE_SDK_THINKING" };
          stream.push({ type: "start", partial: response(100, []) });
          stream.push({ type: "thinking_start", contentIndex: 0, partial: response(100, [{ type: "thinking", thinking: "" }]) });
          stream.push({ type: "thinking_delta", contentIndex: 0, delta: thinking.thinking, partial: response(100, [thinking]) });
          stream.push({ type: "text_start", contentIndex: 1, partial: response(100, [thinking, { type: "text", text: "" }]) });
          stream.push({ type: "text_delta", contentIndex: 1, delta: "活动意图：检查", partial: response(100, [thinking, { type: "text", text: "活动意图：检查" }]) });
          const status = { type: "text", text: "活动意图：检查流式状态\n" };
          stream.push({ type: "text_delta", contentIndex: 1, delta: "流式状态\n", partial: response(100, [thinking, status]) });
          stream.push({ type: "text_end", contentIndex: 1, content: status.text, partial: response(100, [thinking, status]) });
          const message = response(100, [thinking, status, { type: "toolCall", id: "status-tool", name: "echo_status", arguments: { value: "fixture", displaySummary: "验证工具阶段切换" } }]);
          stream.push({ type: "done", reason: "toolUse", message });
        } else {
          stream.push({ type: "start", partial: response(101, []) });
          stream.push({ type: "thinking_start", contentIndex: 0, partial: response(101, [{ type: "thinking", thinking: "FINAL_PRIVATE_THINKING" }]) });
          const final = response(101, [{ type: "thinking", thinking: "FINAL_PRIVATE_THINKING" }, { type: "text", text: "# 测试完成\n\n完整最终正文" }], "stop");
          stream.push({ type: "text_delta", contentIndex: 1, delta: "# 测试完成\n\n完整最终正文", partial: final });
          stream.push({ type: "done", reason: "stop", message: final });
        }
        stream.end();
      });
      return stream;
    };
    session.subscribe((event) => {
      if (event.type === "message_start" && event.message.role === "assistant") component = new AssistantMessageComponent(event.message);
      if ((event.type === "message_update" || event.type === "message_end") && event.message.role === "assistant") component.updateContent(event.message, event.type === "message_update");
      if (component && ["message_start", "message_update", "message_end", "tool_execution_start", "agent_settled"].includes(event.type)) {
        frames.push({ type: event.assistantMessageEvent?.type ?? event.type, timestamp: event.message?.timestamp, text: clean(component.render(80)) });
      }
    });
    await session.prompt("Inspect the fixture then answer");
    assert.equal(inferenceCalls, 2, "only the normal tool turn and final turn are allowed");
    assert.ok(frames.some((frame) => frame.type === "text_delta" && frame.text.trim() === "Thinking"));
    assert.ok(frames.some((frame) => frame.text.trim() === "Thinking — 检查流式状态"));
    assert.ok(frames.filter((frame) => frame.type === "tool_execution_start").every((frame) => !frame.text.includes("Thinking")));
    const next = frames.find((frame) => frame.timestamp === 101);
    assert.equal(next.text.trim(), "Thinking");
    assert.match(frames.at(-1).text, /完整最终正文/);
    assert.ok(frames.every((frame) => !frame.text.includes("PRIVATE")));
    assert.ok(inferencePrompts.every((prompt) => prompt.includes("活动意图：")));
    assert.deepEqual(errors, []);
  } finally {
    await session.extensionRunner.emit({ type: "session_shutdown", reason: "quit" });
    session.dispose();
  }
});
