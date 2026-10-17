import assert from "node:assert/strict";
import { hostModule } from "./host-modules.mjs";

const host = await hostModule("./extensions/codemode/tool.js");

/** Exercise the actual host contract, including MCP readiness, on both versions. */
export function assertCodemodeMcpContract(tool) {
  assert.equal(tool.parameters, host.codemodeSchema, "codemode must retain the host schema object");
  if (typeof host.isCodemodeTool === "function") {
    assert.equal(host.isCodemodeTool(tool), true, "Pi 1.0 must still recognize native codemode");
    return;
  }
  assert.equal(typeof tool.reachesTools, "function", "modern Pi MCP requires codemode.reachesTools");
  assert.equal(tool.reachesTools({ code: 'const tools = await searchTools("docs"); text(tools);' }), "all");
  const reach = tool.reachesTools({ code: 'await tools.mcp__docs__search({ query: "fixture" });' });
  assert.ok(Array.isArray(reach));
  assert.ok(reach.includes("mcp__docs__search"), "MCP must be able to identify the server a script reaches");
}
