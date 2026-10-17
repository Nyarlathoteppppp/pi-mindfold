# Pi Compact Thinking

为 [Pi Coding Agent](https://github.com/earendil-works/pi) 提供紧凑活动视图与简体中文意图显示。

折叠时只显示当前思考或最新开始的工具。展开后查看当前对话收到的可见思考、工具调用及结果，Markdown 正文完整保留。

**当前版本：0.2.0 · MIT · 已验证 Pi 1.0.0 / 1.3.0**

## 显示效果

刚进入思考、尚未收到公开活动说明时：

```text
Thinking
```

模型提供公开活动说明后：

```text
Thinking — 检查重载后历史工具的恢复逻辑
```

工具开始执行后，切换为原生工具预览及中文意图：

```text
read src/index.ts
  ↳ 检查入口文件如何注册工具
```

按钮固定在输入栏上方。折叠时显示 `[Collapse]`，展开时显示 `[Expanded]`：

```text
[Collapse]  ‹ 2/2 ›  Ctrl+Alt+T
> 输入消息
```

以上为文本示意，工具预览的实际样式由 Pi 和对应工具的 renderer 决定。

## 功能

- 默认折叠，只保留当前活动。并行工具按实际开始顺序选择最新项，旧工具的迟到结果不会抢回显示位置。
- 思考时先显示 `Thinking`，收到模型的公开状态行后补成 `Thinking — 意图`。
- 展开当前对话的可见思考、工具历史与意图，支持 codemode 嵌套工具。
- 保留完整 Markdown 正文；切换时保持输入焦点并处理滚动定位。
- 支持重载和恢复会话；保存新调用的启动顺序与嵌套结果。
- 不增加模型请求，不需要第二个模型或额外 API Key。提示说明、公开状态行和工具意图仍消耗少量 token。

“一次对话”指一次用户请求至最终完成，包括中间的多次工具循环。steering 和自动恢复继续使用当前记录。新请求默认折叠；完成后移除思考标签，存在工具调用时保留最后一个工具。

## 安装

从 GitHub 下载或克隆本仓库后，在仓库目录执行：

```text
pi install .
```

在 Pi 中执行 `/reload`，或重启 Pi。也可以指定本地绝对路径：

```text
pi install C:/path/to/pi-compact-thinking
```

Pi 提供运行时依赖，本插件不需要单独安装 `pi-tool-explain`。

若同时升级了 Pi 宿主，需要退出并重新启动 Pi；`/reload` 只重载扩展，不能替换运行中的宿主版本。

## 操作

| 操作 | 效果 |
|---|---|
| 点击 `[Collapse]` / `[Expanded]` | 切换选中对话的显示状态 |
| `Ctrl+Alt+T` | 切换选中对话的显示状态 |
| 点击 `‹` / `›` | 选择上一次或下一次对话 |
| `/compact-thinking` 或 `/compact-thinking toggle` | 切换显示状态 |
| `/compact-thinking expand` | 展开选中对话 |
| `/compact-thinking collapse` | 折叠选中对话 |
| `/compact-thinking prev` / `/compact-thinking next` | 选择历史对话 |
| `/compact-thinking status` | 查看对话数量、意图接入数量和保留原参数约定的工具 |

鼠标操作需要 Pi fullscreen 模式；普通终端模式可以使用快捷键和命令。

Pi 内置的 `/compact` 用于压缩模型上下文。本插件使用独立的 `/compact-thinking` 命令。

## 思考阶段的公开意图

插件会通过结构化系统提示，请模型在提供工作进度说明时，将下面的简体中文状态行放在公开正文开头：

```text
活动意图：检查重载后历史工具的恢复逻辑
```

在状态行接收完整后，折叠视图将其显示为：

```text
Thinking — 检查重载后历史工具的恢复逻辑
```

具体规则：

1. 尚无意图或状态行仍在流式生成时，显示 `Thinking`。换行或文本块结束后才采用该意图。
2. 只读取显式的公开 `活动意图：...` 状态行，不从思考原文提取或猜测意图，也不把普通回答、引用和代码示例当作状态。
3. 新的助手消息或新的 `thinking_start` 阶段清除旧意图；同一阶段的后续思考增量保留已收到的意图。
4. 工具启动后切换为工具块及其 `displaySummary`。正式正文开始后退出思考标签，保留完整回答。
5. 折叠态在当前思考标签中显示状态，避免重复显示活动行；展开后保留原始公开状态行与实际收到的可见思考。原始消息不被改写。

**不同模型无法保证在思考开始的第一时间提供公开意图。** 如果供应商先输出思考、后输出公开文本，意图会在公开状态到达后更新；没有有效状态行时保持 `Thinking`。该功能不请求或提取模型未公开的内部推理。

单行意图会清理终端控制字符，最长保留 96 个字符，并按窗口宽度显示。

## 工具阶段的中文意图

内置工具和使用普通对象参数 schema 的自定义工具会接入意图机制，例如：

- `read`、`bash`、`powershell`、`edit`、`write`、`grep`、`find`、`ls`。
- `nushell` / `nu`、搜索、网页读取、任务管理及动态注册的 MCP 工具。

模型在正常工具调用中填写 `displaySummary`：

```json
{
  "path": "src/index.ts",
  "displaySummary": "检查入口文件如何注册工具"
}
```

插件执行前剥离新增字段，原工具及其参数准备函数只收到业务参数。模型没有提供有效意图时使用中文兜底文案。

codemode 保留 Pi 的原生 grammar 采样与工具声明，通过脚本开头的中文注释提供顶层意图。脚本内部工具继续各自填写 `displaySummary`：

```js
// 意图：批量检查入口与配置文件
const results = await Promise.allSettled([
  tools.read({ path: "src/index.ts", displaySummary: "检查入口工具注册" }),
  tools.read({ path: "package.json", displaySummary: "确认插件依赖配置" })
]);
for (const result of results) text(result);
```

若脚本有 `// @options:` 行，意图注释放在它后面。

已经自行定义 `displaySummary` 的工具、组合参数 schema 和其他 grammar 工具保留原有约定。`/compact-thinking status` 会列出这些例外。

## 历史与数据保存

折叠只改变显示，不删除对话消息。展开只能恢复 API 实际返回的可见思考与工具结果；工具本身已截断的内容无法恢复，自定义 renderer 自己施加的显示限制仍然有效。

插件通过不进入模型上下文的自定义 session 条目保存：

- `compact-thinking.tool-start`：工具真实开始顺序。
- `compact-thinking.nested`：嵌套工具的显示结果，仅含 `content` 与 `details`，避免重复保存 `structuredContent` 和用量信息。

单条嵌套数据超过 64 KB 时，完整数据保存到会话目录下的 `.compact-thinking/` 旁文件，session 保存路径与 SHA-256 校验值。不会按工具数量截断历史。备份或搬迁会话时需同时保留旁文件目录；文件缺失或损坏时显示提示，目录不可写时退回完整内联保存。

旧会话仍可读取，但此前没有保存的嵌套输出和精确并行启动顺序无法补回。上下文压缩后，导航只统计仍然可见的对话。

## 兼容性与验证

| 环境 | 自动化回归 |
|---|---|
| Pi 1.0.0 | 64 项通过 |
| Pi 1.3.0 | 64 项通过 |

验证包含真实 SDK 流式事件、正常工具循环、grammar 采样、动态工具注册、重载与历史恢复，以及原生 fullscreen 的鼠标、滚动定位、中文输入焦点和窗口缩放。

测试使用脚本化模型回复与内存终端传输，没有调用外部模型服务。尚未对每个模型或实际终端组合进行人工验收。

本插件面向标准 CLI 单活动会话。它使用有清理机制的 Pi 内部接口适配；升级 Pi 后应重新运行测试。同进程并行运行多个 SDK `AgentSession` 的补丁隔离尚未支持，也不建议同时启用其他接管同一思考或工具组件的展示插件。

详细记录见 [COMPATIBILITY.md](./COMPATIBILITY.md) 与 [VERIFICATION.md](./VERIFICATION.md)。

## 开发

需要 Node.js 22.19 或更新版本，以及本机安装的 Pi。

```text
npm test
npm run check
npm pack --dry-run
```

测试默认读取 `~/.pi/agent/install/current-version`，使用当前 managed 安装版本；通过 `COMPACT_PI_ROOT` 可指定其他已安装的 Pi 宿主包目录。测试不会安装第二份 Pi。

检查当前配置的扩展加载与工具注册：

```text
node --import ./tests/host-imports.mjs ./scripts/compat-smoke.mjs
```

`npm run check` 检查 JavaScript 和 vendored TypeScript 语法；打包检查使用 `npm pack --dry-run`。

## 卸载

```text
pi remove C:/path/to/pi-compact-thinking
```

随后执行 `/reload` 或重启 Pi。卸载不自动删除已有会话的历史显示数据。

## 致谢与许可证

本项目复用了 [Nyarlathoteppppp/pi-tool-explain](https://github.com/Nyarlathoteppppp/pi-tool-explain) 的意图模块与视口定位模块，原始源码和许可证保留在 `vendor/pi-tool-explain/`。

上游项目同时包含 MasuRii 的 `pi-tool-display` 与 Mert Deveci 的 `pi-tool-display-summary` 贡献。固定版本及完整署名见 [THIRD_PARTY.md](./THIRD_PARTY.md)。

本项目采用 [MIT License](./LICENSE)。
