# PTY 与范围审批设计

## 目标

本轮解决两个影响真实使用的问题：

1. AI CLI 应尽量运行在 PTY 中，而不是普通子进程管道中。
2. AI 输出 `AICTRL_SCOPE_PLAN` 后，范围不应直接生效，应先进入决策队列，用户批准后才成为该 session 的写入/读取/高风险范围。

## PTY 设计

`aictrl` 仍然不自研 AI 客户端。每个 session 仍然是一个真实 CLI 命令。

新增终端后端抽象：

```text
SessionRunner
  -> terminal backend
       -> node-pty backend when node-pty is installed
       -> child_process fallback otherwise
```

后端统一暴露：

```text
onData(callback)
onExit(callback)
write(text)
kill()
resize(cols, rows)
```

`node-pty` 作为可选依赖。当前环境不强制下载依赖；没有 `node-pty` 时继续使用现有 `child_process.spawn` 回退。

## Scope Approval 设计

AI 输出：

```text
AICTRL_SCOPE_PLAN:
{"write":["src/auth/**"],"read":["src/api/**"],"risky":["package.json"]}
AICTRL_END
```

daemon 不再立刻 `setScope`，而是创建：

```text
decision.type = scope_approval
decision.payload.scope = {...}
decision.status = pending
```

用户在决策队列中批准后：

```text
POST /api/decisions/:id/resolve
{ "action": "approve" }
```

daemon 才写入 session scope。拒绝时只标记 decision resolved，不改 scope。

## UI 设计

决策队列新增操作：

```text
批准
拒绝
```

对 `scope_approval` 显示中文类型：

```text
范围审批
```

## 非目标

- 本轮不要求实际安装 `node-pty`。
- 本轮不实现完整终端前端模拟器。
- 本轮不实现自动把 delegation 发给目标 session。
