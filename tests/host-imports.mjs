import { registerHooks } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// Tests must use the actual host's classes, never a second installed Pi copy.
const agentDirectory = process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi/agent");
const currentVersionFile = join(agentDirectory, "install/current-version");
const currentVersion = existsSync(currentVersionFile) ? readFileSync(currentVersionFile, "utf8").trim() : undefined;
if (!process.env.COMPACT_PI_ROOT && (!currentVersion || !/^[0-9A-Za-z._+-]+$/.test(currentVersion) || [".", ".."].includes(currentVersion))) {
  throw new Error("Set COMPACT_PI_ROOT to the installed Pi package directory; no valid managed active version was found.");
}
const hostRoot = process.env.COMPACT_PI_ROOT ?? join(agentDirectory, "install/releases", currentVersion, "node_modules/@earendil-works/pi-coding-agent");
if (!existsSync(join(hostRoot, "package.json"))) throw new Error("Set COMPACT_PI_ROOT to the installed Pi package directory.");
const hostURL = pathToFileURL(join(hostRoot, "dist/index.js")).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@earendil-works/") || specifier === "typebox") {
      return nextResolve(specifier, { ...context, parentURL: hostURL });
    }
    return nextResolve(specifier, context);
  },
});
