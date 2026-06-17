# 中文多 AI 终端控制台迭代设计

## 目标

本轮继续把 `aictrl` 从可运行 MVP 推进到更贴近真实使用的本地多 AI 终端控制台。重点不是重新做 AI 客户端，而是继续编排现有 CLI 客户端，例如 Codex、Claude、Gemini。

本轮必须完成：

1. Web 控制台全部中文化。
2. 新建 Agent Session 时支持选择隔离工作区策略。
3. 支持自动创建 session 专属 git worktree。
4. 支持持续边界检查开关。
5. 支持从 AI CLI 输出中识别 delegation request，并进入决策队列。

## 方案对比

推荐方案：在现有 Node 标准库架构上继续做增量扩展。

优点是变更小、测试直接、无需新增依赖。当前项目已经有 HTTP API、SSE、session runner、state store、boundary checker 和 browser console，本轮只需要补齐下一层控制逻辑。

不采用方案：

- 不引入 React/Vite 重写 UI。当前 UI 足够小，重写会浪费时间。
- 不直接接入 AI SDK。产品定位仍是 CLI 编排器。
- 不马上做完整 PTY。MVP 当前 `child_process.spawn` 已能验证编排闭环，PTY 可以下一轮做。

## 用户体验

启动方式不变：

```bash
cd your-project
aictrl open
```

浏览器控制台应显示中文：

```text
会话
启动会话
命令
参数
任务
实时终端
决策队列
边界检查
写入范围
读取范围
高风险范围
```

新建 session 时增加工作区模式：

```text
当前项目目录
自动创建 Git worktree
自定义工作目录
```

默认使用当前项目目录，降低首次使用门槛。用户选择 Git worktree 时，daemon 在运行态目录下创建：

```text
~/.aictrl/projects/<project-id>/worktrees/<session-name>/
```

session 的 `cwd` 指向该 worktree，再启动真实 CLI 命令。

## 数据流

创建会话：

```text
Web UI -> POST /api/sessions
  name, command, args, task, workspaceMode, cwd?

daemon
  -> resolve workspace
  -> create session state
  -> spawn command in session.cwd
  -> stream events over SSE
```

持续边界检查：

```text
Web UI -> POST /api/sessions/:id/watch-boundary
daemon
  -> interval listChangedFiles(session.cwd)
  -> checkBoundary(changedFiles, session.scope.write)
  -> if violation create decision once per file set
```

delegation request：

```text
CLI output
  -> parseProtocolBlocks(text)
  -> AICTRL_DELEGATION_REQUEST creates delegation_request decision
  -> Web UI shows it in 决策队列
```

## API 增量

新增或扩展：

```text
POST /api/sessions
  accepts workspaceMode: project | worktree | custom

POST /api/sessions/:id/watch-boundary
  body: { enabled: true | false, intervalMs?: number }

GET /api/workspaces/preview?name=<session-name>
  returns resolved worktree path preview
```

## 错误处理

- 如果选择 `worktree` 但当前目录不是 git 仓库，返回 400，提示需要 git 仓库。
- 如果 git worktree 创建失败，session 不启动，返回错误。
- 如果持续检查发现同一批越界文件，不重复刷 decision。
- 如果 AI 输出 invalid protocol JSON，记录事件但不打断进程。

## 测试策略

继续使用 `node:test`。

需要覆盖：

1. 中文 HTML 中不再出现主要英文 UI 文案。
2. workspace resolver 为 session 生成稳定 worktree 路径。
3. git worktree 命令参数构造正确，失败时返回清晰错误。
4. server 创建 session 时能使用自定义 cwd 和 worktree resolver。
5. delegation protocol 输出能创建 `delegation_request` decision。
6. boundary watcher 对越界文件创建 decision，且不会重复创建同一批 decision。

## 非目标

- 不做云端项目上传。
- 不做团队账号系统。
- 不做完整 PR/merge 流程。
- 不引入前端构建链。
- 不替代 Codex/Claude/Gemini CLI。
