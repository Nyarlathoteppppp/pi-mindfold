import { getDisplaySummary, hasDisplaySummaryParameter, normalizeDisplaySummary, withDisplaySummary } from "../vendor/pi-tool-explain/display-summary.js";

const labels = {
  read: "读取文件", edit: "更新文件", write: "写入文件", grep: "搜索文件内容", find: "查找匹配文件", ls: "列出目录内容",
  bash: "执行命令", powershell: "执行 PowerShell 命令", nu: "执行 Nushell 命令", nushell: "执行 Nushell 命令",
  codemode: "执行批量工具脚本", web_search: "搜索网页资料", google_search: "检索最新资料", fetch_content: "读取网页内容",
  get_search_content: "读取检索结果", source_check: "核查资料来源", mcp: "调用外部工具", todo: "更新任务进度",
};
export function fallbackIntent(name) { return labels[name] ?? `运行 ${name}`; }

/** Reuse upstream schema, sanitization, preparation and execute wrappers. */
export class IntentDecorator {
  originals = new Map();
  skipped = new Set();

  decorate(tool) {
    if (!tool || this.originals.has(tool) || typeof tool.execute !== "function") return tool;
    // Grammar tools can only have one required string input. Pi's MCP extension
    // also identifies codemode by its exact schema object, so preserve both.
    if (tool.constrainedSampling?.type === "grammar") {
      if (tool.name === "codemode") {
        const before = new Map([["promptGuidelines", Object.getOwnPropertyDescriptor(tool, "promptGuidelines")]]);
        tool.promptGuidelines = [...(tool.promptGuidelines ?? []),
          'Start every codemode script with "// 意图：简短中文目的" (after an optional // @options: line). Describe why the script is needed in Simplified Chinese; never include secrets. Nested tools whose schema defines displaySummary must still include it.'];
        this.originals.set(tool, { before, after: new Map([["promptGuidelines", tool.promptGuidelines]]) });
      } else this.skipped.add(tool.name);
      return tool;
    }
    // A pre-existing field belongs to that tool; never silently strip its semantics.
    if (hasDisplaySummaryParameter(tool.parameters)) { this.skipped.add(tool.name); return tool; }
    if (!tool.parameters || (tool.parameters.type && tool.parameters.type !== "object") || tool.parameters.anyOf || tool.parameters.oneOf || tool.parameters.allOf) {
      this.skipped.add(tool.name);
      return tool;
    }
    const wrapped = withDisplaySummary(tool, {
      language: "zh-CN", required: true, maxLength: 96,
      fallback: () => fallbackIntent(tool.name),
    });
    const keys = ["parameters", "promptGuidelines", "prepareArguments", "execute", "renderCall"];
    const before = new Map(keys.map((key) => [key, Object.getOwnPropertyDescriptor(tool, key)]));
    for (const key of keys) if (key in wrapped) tool[key] = wrapped[key];
    this.originals.set(tool, { before, after: new Map(keys.map((key) => [key, tool[key]])) });
    return tool;
  }

  restore() {
    for (const [tool, { before, after }] of this.originals) {
      for (const [key, descriptor] of before) {
        if (tool[key] !== after.get(key)) continue;
        if (descriptor) Object.defineProperty(tool, key, descriptor);
        else delete tool[key];
      }
    }
    this.originals.clear();
    this.skipped.clear();
  }
}

export function intentFor(args, name) {
  const summary = getDisplaySummary(args);
  if (summary) return summary;
  if (name === "codemode" && typeof args?.code === "string") {
    // Only accept the leading intent comment, never an arbitrary string inside code.
    const match = /^\s*(?:\/\/\s*@options:[^\r\n]*\r?\n)?\s*\/\/\s*意图[：:]\s*([^\r\n]+)/u.exec(args.code);
    const intent = normalizeDisplaySummary(match?.[1]);
    if (intent) return intent;
  }
  return fallbackIntent(name);
}
