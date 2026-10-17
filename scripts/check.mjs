import { readdirSync } from "node:fs";
import { resolve, extname } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

function check(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if ([".git", "node_modules", "artifacts"].includes(entry.name)) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) check(path);
    else if ([".js", ".mjs", ".ts"].includes(extname(path))) {
      const result = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });
      if (result.status !== 0) { process.stderr.write(result.stderr); process.exitCode = 1; }
    }
  }
}
check(fileURLToPath(new URL("..", import.meta.url)));
if (!process.exitCode) console.log("All JavaScript and vendored TypeScript syntax checks passed.");
