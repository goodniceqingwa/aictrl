# aictrl

本地优先的多 AI CLI 会话控制台。  
Local-first orchestration for multiple AI CLI coding sessions.

`aictrl` 不自研 AI 客户端，也不替代 Codex CLI、Claude Code、Gemini CLI 或其他终端 AI 工具。它启动并观察这些真实 CLI 进程，让你在一个本地浏览器控制台里同时监督多个 AI 会话、审批修改范围、检查边界并随时人工干预。

`aictrl` does not replace Codex CLI, Claude Code, Gemini CLI, or other terminal AI clients. It launches and observes those real CLI processes from a local daemon, so you can supervise multiple AI sessions, approve scopes, check boundaries, and intervene from one browser console.

- [中文](#中文)
- [English](#english)

## 中文

### 适合什么场景

当你在一个项目里想同时开多个 AI CLI 会话时，`aictrl` 可以作为本地控制台：

- 一个会话负责前端，一个会话负责后端，一个会话负责测试或文档。
- 每个会话仍然运行你已经安装的真实 CLI，例如 `codex`、`claude`、`gemini`。
- AI 根据任务主动申报自己要读写的范围。
- 用户在控制台里审批或拒绝 AI 申报的范围。
- 边界检查会发现某个会话是否改到了它不该改的文件。
- 用户可以看到每个会话在输出什么，也可以给选中的会话发送输入。

### 当前能力

- 从任意项目目录启动本地 daemon。
- 在 `127.0.0.1` 上提供中文浏览器控制台。
- 创建多个由真实本地命令驱动的会话。
- 流式显示 CLI 输出。
- 向选中的运行中 CLI 发送输入。
- 支持项目目录、自定义目录、自动 Git worktree 三种工作区模式。
- 新会话启动后自动发送范围申报提示。
- 解析 AI 输出中的 `AICTRL_SCOPE_PLAN`，生成“范围审批”决策。
- 用户批准后才把 AI 申报的范围写入会话。
- 保存每个会话的写入、读取、高风险路径范围。
- 检查 Git 变更文件是否超出批准的写入范围。
- 对越界文件生成 `boundary_violation` 决策。
- 解析 `AICTRL_DELEGATION_REQUEST`，生成转交请求决策。
- 对选中会话开启持续边界检查。
- 默认通过 `node-pty` 给 Codex、Claude、Gemini 这类交互式 CLI 分配真实终端。

### 安装

目前项目已经上传到 GitHub，可以直接通过 npm 从 GitHub 安装：

```bash
npm install -g github:goodniceqingwa/aictrl
```

安装完成后，在任意项目目录里运行：

```bash
aictrl
```

也可以指定端口：

```bash
aictrl --port 4321
```

如果你是本地开发这个仓库，也可以这样安装：

```bash
git clone https://github.com/goodniceqingwa/aictrl.git
cd aictrl
npm install -g .
```

### 快速开始

进入你要协作开发的项目目录：

```bash
cd /path/to/your/project
aictrl
```

终端会打印类似下面的地址：

```text
aictrl running at http://127.0.0.1:4321
project: /path/to/your/project
state: ~/.aictrl/projects/<project-id>/state.json
```

打开这个 `http://127.0.0.1:<port>` 地址，就能看到浏览器控制台。

### 创建 AI 会话

在控制台左侧创建会话时，填写你本机已经安装的 AI CLI 命令：

```text
名称: auth-agent
命令: codex
参数:
任务: 实现 refresh token 逻辑
工作区模式: 自动创建 Git worktree
```

也可以换成其他 CLI：

```text
命令: claude
```

```text
命令: gemini
```

测试时可以用普通 shell 命令：

```text
命令: /bin/sh
参数: -lc "while read line; do echo got:$line; done"
任务: Echo input for testing
```

`aictrl` 只把这些命令当作真实终端进程来管理。它不会调用 AI SDK，也不会实现自己的聊天模型。

### 工作区模式

创建会话时可以选择：

```text
当前项目目录
自动创建 Git worktree
自定义工作目录
```

推荐多个 AI 并行工作时使用“自动创建 Git worktree”。它会在运行时目录下为每个会话创建隔离工作区：

```text
~/.aictrl/projects/<project-id>/worktrees/<session-name>/
```

这个模式要求当前项目是 Git 仓库。会话命令会在对应 worktree 里运行。

### AI 申报范围与审批

新会话启动后，`aictrl` 会自动向 CLI 发送提示，要求 AI 先输出范围计划：

```text
AICTRL_SCOPE_PLAN:
{"write":["src/auth/**"],"read":["src/api/**"],"risky":["package.json"],"reasoning":["需要修改认证逻辑并读取 API 类型"]}
AICTRL_END
```

daemon 解析后不会立刻写入范围，而是在“决策队列”里创建“范围审批”。

- 点击“批准”：该范围成为会话的有效范围。
- 点击“拒绝”：范围不会生效。
- 你仍然可以在“AI 申报范围”区域手工修正范围。

### 边界检查

选择一个会话并确认写入范围后，可以运行边界检查。

写入范围示例：

```text
src/auth/**
tests/auth/**
```

如果 Git 变更中包含范围外文件，例如：

```text
src/api/session.js
```

daemon 会创建一个 `boundary_violation` 决策，提醒用户这个会话越界了。

### 持续边界检查

选择会话后，点击：

```text
开启持续边界检查
```

daemon 会定期检查该会话工作区里的 Git 变更。如果有文件超出批准的写入范围，会创建决策；同一组越界文件不会重复刷屏，直到越界集合发生变化。

### 转交协议

当一个 AI 发现某个修改应该交给另一个会话处理，可以输出：

```text
AICTRL_DELEGATION_REQUEST:
{"toSession":"api-agent","requestedScope":["src/api/session.js"],"requestedChange":"Add refreshToken to the session response"}
AICTRL_END
```

daemon 会把它记录为 `delegation_request`，显示在“决策队列”里。当前版本会展示和记录这个请求，后续可以继续做自动路由。

### 本地状态目录

`aictrl` 的运行状态不会写进你的项目目录，而是放在用户目录：

```text
~/.aictrl/projects/<project-id>/state.json
~/.aictrl/projects/<project-id>/worktrees/
```

### 开发

```bash
git clone https://github.com/goodniceqingwa/aictrl.git
cd aictrl
npm test
node src/cli.js open --port 4321
```

### 当前限制

- 浏览器不会自动打开，需要手动打开终端打印的本地 URL。
- 转交请求已经会进入决策队列，但还不会自动把任务路由给另一个会话。
- 当前没有认证层，默认只绑定 `127.0.0.1`，不要暴露到公网。
- 还没有发布到 npm registry；当前推荐从 GitHub 安装。

### 常见问题

如果启动 Codex、Claude、Gemini 等交互式 CLI 后很快显示“停止”，并看到：

```text
Error: stdin is not a terminal
```

说明当前安装没有成功加载 PTY 后端。请重新安装最新版本：

```bash
npm install -g github:goodniceqingwa/aictrl
```

如果仍然出现该错误，通常是 `node-pty` 原生模块没有安装或编译成功。先在安装环境中确认 `node-pty` 能被加载，再重新启动 `aictrl`。

## English

### What It Is For

`aictrl` is a local console for running multiple AI CLI coding sessions in the same project.

- One session can work on frontend code, another on backend code, another on tests or docs.
- Each session still runs a real CLI you already have installed, such as `codex`, `claude`, or `gemini`.
- The AI declares the file scope it expects to read or write.
- You approve or reject that scope in the browser console.
- Boundary checks detect when a session changes files outside its approved write scope.
- You can watch each session's output and send input to the selected session at any time.

### Current Features

- Start a local daemon from any project directory.
- Serve a Chinese-first browser console on `127.0.0.1`.
- Create multiple sessions backed by real local commands.
- Stream CLI output into the console.
- Send input to a selected running CLI.
- Use project directory, custom directory, or automatic Git worktree workspace modes.
- Send a scope-planning prompt when a new session starts.
- Parse `AICTRL_SCOPE_PLAN` blocks from AI output and create scope approval decisions.
- Apply AI-declared scope only after user approval.
- Save per-session write, read, and risky path scopes.
- Check Git changed files against approved write scope.
- Create `boundary_violation` decisions when files are out of scope.
- Parse `AICTRL_DELEGATION_REQUEST` blocks into delegation decisions.
- Enable continuous boundary checking for a selected session.
- Allocate a real terminal through `node-pty` for interactive CLIs such as Codex, Claude, and Gemini.

### Installation

Install directly from GitHub with npm:

```bash
npm install -g github:goodniceqingwa/aictrl
```

Then run it from any project:

```bash
aictrl
```

Or choose a port:

```bash
aictrl --port 4321
```

For local development:

```bash
git clone https://github.com/goodniceqingwa/aictrl.git
cd aictrl
npm install -g .
```

### Quick Start

Open the project you want to work on:

```bash
cd /path/to/your/project
aictrl
```

The command prints a local URL:

```text
aictrl running at http://127.0.0.1:4321
project: /path/to/your/project
state: ~/.aictrl/projects/<project-id>/state.json
```

Open the printed `http://127.0.0.1:<port>` URL in your browser.

### Creating AI Sessions

Use any AI CLI installed on your machine:

```text
Name: auth-agent
Command: codex
Args:
Task: Implement refresh token logic
Workspace mode: automatic Git worktree
```

Other examples:

```text
Command: claude
```

```text
Command: gemini
```

For testing, use a plain shell command:

```text
Command: /bin/sh
Args: -lc "while read line; do echo got:$line; done"
Task: Echo input for testing
```

`aictrl` treats these as terminal processes. It does not call an AI SDK and does not implement a custom chat client.

### Workspace Modes

When creating a session, choose one workspace mode:

```text
Current project directory
Automatically create Git worktree
Custom working directory
```

Automatic Git worktrees are recommended when multiple AI sessions work in parallel. Worktrees are created under:

```text
~/.aictrl/projects/<project-id>/worktrees/<session-name>/
```

This mode requires the opened project to be a Git repository. The session command runs with `cwd` set to that worktree.

### AI-Declared Scope And Approval

When a new session starts, `aictrl` asks the AI CLI to emit a scope plan:

```text
AICTRL_SCOPE_PLAN:
{"write":["src/auth/**"],"read":["src/api/**"],"risky":["package.json"],"reasoning":["Need to change auth logic and read API types"]}
AICTRL_END
```

The daemon parses this block but does not apply it immediately. It creates a `scope_approval` decision instead.

- Approve: the scope becomes active for that session.
- Reject: the scope is not applied.
- You can still manually adjust the scope in the browser console.

### Boundary Checking

After selecting a session and approving its write scope, run a boundary check.

Example write scope:

```text
src/auth/**
tests/auth/**
```

If changed files include something outside the scope:

```text
src/api/session.js
```

the daemon creates a `boundary_violation` decision.

### Continuous Boundary Checking

Select a session and click:

```text
开启持续边界检查
```

The daemon periodically checks changed files in that session workspace. If any changed file is outside the approved write scope, it creates a decision. The same violation set is not reported repeatedly unless it changes.

### Delegation Protocol

An AI CLI can request handoff to another session by printing:

```text
AICTRL_DELEGATION_REQUEST:
{"toSession":"api-agent","requestedScope":["src/api/session.js"],"requestedChange":"Add refreshToken to the session response"}
AICTRL_END
```

The daemon records this as a pending `delegation_request` in the decision queue. Automatic routing is not implemented yet.

### Local State

Runtime state is stored outside your project:

```text
~/.aictrl/projects/<project-id>/state.json
~/.aictrl/projects/<project-id>/worktrees/
```

### Development

```bash
git clone https://github.com/goodniceqingwa/aictrl.git
cd aictrl
npm test
node src/cli.js open --port 4321
```

### Current Limits

- The browser is not opened automatically. Open the printed local URL manually.
- Delegation requests are shown in the decision queue, but automatic routing is not implemented yet.
- There is no authentication layer. The server binds to `127.0.0.1`; do not expose it publicly.
- The package is not published to the npm registry yet. Installing from GitHub is the recommended path for now.

### Troubleshooting

If an interactive CLI such as Codex, Claude, or Gemini stops immediately and prints:

```text
Error: stdin is not a terminal
```

the installed package did not load the PTY backend. Reinstall the latest version:

```bash
npm install -g github:goodniceqingwa/aictrl
```

If the error remains, `node-pty` was likely not installed or compiled successfully in that environment. Confirm that `node-pty` can be loaded, then restart `aictrl`.
