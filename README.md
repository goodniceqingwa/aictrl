# aictrl

Local-first orchestration for multiple AI CLI coding sessions.

`aictrl` does not replace Codex CLI, Claude Code, Gemini CLI, or other terminal AI clients. It starts and observes those real commands from a local daemon so a developer can supervise multiple sessions from one browser console.

## Run

```bash
npm test
node src/cli.js open --port 4317
```

Then open the printed `http://127.0.0.1:<port>` URL.

## What Works In This MVP

- Start a local daemon from any project directory.
- Serve a browser console from `127.0.0.1`.
- Create multiple sessions backed by real local commands.
- Stream command output into the console.
- Send input to a selected running command.
- Save per-session write/read/risky scope patterns.
- Check changed files against approved write scope.
- Create boundary violation decisions when files are out of scope.

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

## Current Limits

- Sessions use `child_process.spawn`, not a full PTY yet.
- Worktree creation is not automated yet.
- Delegation requests can be parsed by protocol helpers but are not fully wired into the UI.
- Boundary checks are manual in the console; continuous polling can be added next.
- The browser is not opened automatically.
