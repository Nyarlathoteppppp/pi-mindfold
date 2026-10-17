import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  createAgentSession, createCodemodeExtension, createToolSearchExtension,
  DefaultResourceLoader, getAgentDir, SessionManager, SettingsManager,
} from "@earendil-works/pi-coding-agent";

// Read configured extensions, without model inference or connecting remote tools.
const packageUrl = new URL("../package.json", import.meta.resolve("@earendil-works/pi-coding-agent"));
const host = JSON.parse(readFileSync(packageUrl, "utf8"));
const tuiUrl = new URL("../package.json", import.meta.resolve("@earendil-works/pi-tui"));
const tui = JSON.parse(readFileSync(tuiUrl, "utf8"));
const settingsManager = SettingsManager.create(process.cwd(), getAgentDir());
const loader = new DefaultResourceLoader({
  cwd: process.cwd(), agentDir: getAgentDir(), settingsManager,
  noSkills: true, noPromptTemplates: true, noThemes: true,
  // SDK loaders do not install CLI builtins automatically.
  extensionFactories: [createCodemodeExtension(), createToolSearchExtension()],
});
await loader.reload();
const loaded = loader.getExtensions();
assert.deepEqual(loaded.errors, [], "configured extension loading failed");
const { session } = await createAgentSession({
  cwd: process.cwd(), agentDir: getAgentDir(), settingsManager, resourceLoader: loader,
  sessionManager: SessionManager.inMemory(process.cwd()),
});
try {
  const command = session.extensionRunner.getCommand("mindfold");
  assert.ok(command, "installed mindfold command missing");
  const alias = session.extensionRunner.getCommand("compact-thinking");
  assert.ok(alias, "installed compact-thinking alias command missing");
  assert.equal(session.extensionRunner.getCommand("compact"), undefined, "reserved builtin command collision");
  const tools = session.getAllTools();
  const ordinary = tools.filter((tool) => ["read", "edit", "write", "grep", "find", "ls", "nu", "nushell"].includes(tool.name));
  for (const tool of ordinary) {
    assert.ok(tool.parameters.properties?.displaySummary, `${tool.name} lacks intent field`);
  }
  const codemode = tools.find((tool) => tool.name === "codemode");
  assert.ok(codemode, "configured native codemode missing");
  if (host.version === "1.3.0") assert.equal(typeof codemode.reachesTools, "function");
  assert.equal(codemode.parameters.required.length, 1, "grammar input must retain one required field");
  console.log(JSON.stringify({
    hostVersion: host.version, hostPackage: fileURLToPath(packageUrl), tuiVersion: tui.version,
    extensionCount: loaded.extensions.length, extensionErrors: loaded.errors.length,
    command: command.invocationName, toolCount: tools.length,
    ordinaryToolsWithIntent: ordinary.map((tool) => tool.name),
    codemodeRequired: codemode.parameters.required,
    codemodeReachesTools: typeof codemode.reachesTools,
    externalModelCalls: 0,
  }, null, 2));
} finally {
  await session.extensionRunner.emit({ type: "session_shutdown", reason: "quit" });
  session.dispose();
}
