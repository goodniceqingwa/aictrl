# aictrl

Local-first orchestration for multiple AI CLI coding sessions.

`aictrl` does not replace Codex CLI, Claude Code, Gemini CLI, or other terminal AI clients. It starts and observes those real commands from a local daemon so a developer can supervise multiple sessions from one browser console.

## Run

```bash
npm test
node src/cli.js open --port 4317
```

Then open the printed `http://127.0.0.1:<port>` URL. The browser console is Chinese-first.

## What Works In This MVP

- Start a local daemon from any project directory.
- Serve a browser console from `127.0.0.1`.
- Create multiple sessions backed by real local commands.
- Stream command output into the console.
- Send input to a selected running command.
- Save per-session write/read/risky scope patterns.
- Check changed files against approved write scope.
- Create boundary violation decisions when files are out of scope.
- Use the Chinese browser console.
- Start sessions in the project directory, a custom directory, or an automatically created git worktree.
- Convert `AICTRL_DELEGATION_REQUEST` protocol blocks from CLI output into delegation decisions.
- Enable continuous boundary checking for a selected session.

## Example CLI Sessions

Use any installed terminal AI client as the command:

```text
Command: codex
Args:
Task: Work on auth refresh token flow
```

Or test with a simple shell command:

```text
Command: /bin/sh
Args: -lc "while read line; do echo got:$line; done"
Task: Echo input for testing
```

The orchestrator treats these as real terminal processes. It does not call an AI SDK and does not implement a custom AI chat client.

## Boundary Check

1. Select a session.
2. Set write scope, one pattern per line:

   ```text
   src/auth/**
   tests/auth/**
   ```

3. Run Boundary Check.

If changed files include anything outside the write scope, the daemon creates a `boundary_violation` decision.

## Workspace Modes

When creating a session, choose one workspace mode:

```text
当前项目目录
自动创建 Git worktree
自定义工作目录
```

`自动创建 Git worktree` requires the opened project to be a git repository. Worktrees are created under the runtime directory:

```text
~/.aictrl/projects/<project-id>/worktrees/<session-name>/
```

The session command runs with `cwd` set to that workspace.

## Delegation Protocol

An AI CLI can request work from another owner by printing a structured block:

```text
AICTRL_DELEGATION_REQUEST:
{"toSession":"api","requestedScope":["src/api/session.js"],"requestedChange":"Add refreshToken to the session response"}
AICTRL_END
```

The daemon records this as a pending `delegation_request` decision in the 决策队列.

## Continuous Boundary Check

After selecting a session and saving its write scope, click `开启持续边界检查`.

The daemon periodically checks changed files in that session workspace. If any changed file is outside the approved write scope, it creates one `boundary_violation` decision for that file set and avoids repeating the same decision until the violation changes.

## Current Limits

- Sessions use `child_process.spawn`, not a full PTY yet.
- Sessions do not yet use a full PTY, so some highly interactive CLIs may behave differently than in a native terminal.
- Delegation decisions are surfaced, but approving and routing them to another session is not automated yet.
- The browser is not opened automatically.
