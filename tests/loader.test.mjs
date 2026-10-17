import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createAgentSession, DefaultResourceLoader, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import { hostModule } from "./host-modules.mjs";
const { BUILTIN_SLASH_COMMANDS } = await hostModule("./core/slash-commands.js");

test("Pi's actual extension loader loads the packaged JavaScript and vendored TypeScript", async () => {
  const directory = mkdtempSync(join(tmpdir(), "compact-loader-"));
  const settingsManager = SettingsManager.inMemory();
  const resourceLoader = new DefaultResourceLoader({
    cwd: directory, agentDir: directory, settingsManager, noExtensions: true, noSkills: true,
    noPromptTemplates: true, noThemes: true,
    additionalExtensionPaths: [fileURLToPath(new URL("../index.js", import.meta.url))],
  });
  await resourceLoader.reload();
  assert.deepEqual(resourceLoader.getExtensions().errors, []);
  assert.equal(resourceLoader.getExtensions().extensions.length, 1);
  const { session } = await createAgentSession({
    cwd: directory, agentDir: directory, settingsManager, resourceLoader, sessionManager: SessionManager.inMemory(directory),
  });
  try {
    await session.bindExtensions({});
    const commands = session.extensionRunner.getRegisteredCommands();
    const builtins = new Set(BUILTIN_SLASH_COMMANDS.map((command) => command.name));
    assert.ok(commands.every((command) => !builtins.has(command.name)), "extension commands must not trigger builtin context compaction");
    assert.ok(commands.some((command) => command.name === "compact-thinking"));
    assert.ok(session.getAllTools().find((tool) => tool.name === "read").parameters.properties.displaySummary);
  } finally {
    await session.extensionRunner.emit({ type: "session_shutdown" });
    session.dispose();
  }
});
