# AI CLI Orchestrator Design

## Product Positioning

`aictrl` is a local multi-agent terminal orchestrator for developers. It does not replace Codex CLI, Claude Code, Gemini CLI, or other AI coding clients. It starts and supervises those existing CLI clients in isolated local workspaces, then gives the user one browser console to observe, interrupt, approve, and coordinate them.

The product is intentionally local-first. A user opens it inside an existing project:

```bash
cd /path/to/project
aictrl open
```

The project is not uploaded. The local daemon reads the repository, starts agent terminal sessions, streams their output to `localhost`, watches their diffs, and enforces boundaries.

## Core Architecture

```text
Project directory
  |
  | aictrl open
  v
Local daemon
  - HTTP API
  - Server-sent event stream
  - terminal process manager
  - session manager
  - scope and ownership manager
  - decision queue
  - git diff watcher
  - verifier
  |
  v
Browser console on localhost
```

Each agent session is a real terminal process:

```text
Agent Session
  - name
  - task
  - command, for example codex or claude
  - workspace path
  - status
  - planned scope
  - owned scope
  - live terminal output
  - current diff summary
  - pending decisions
```

The daemon treats AI clients as terminal programs. It does not require SDK integration. A terminal adapter only needs to spawn a command, write to stdin, stream stdout/stderr, and stop or resume the process.

## Project Opening Model

The first workflow is:

```bash
cd your-project
aictrl open
```

The command:

1. Loads `.aictrl.yaml` if present.
2. Creates or opens local runtime state under `~/.aictrl/projects/<project-id>/`.
3. Starts a local daemon bound to `127.0.0.1`.
4. Serves the browser console from the daemon.
5. Prints the console URL.

The browser console never requires project upload. It talks only to the local daemon.

## Workspace Model

The recommended isolation model is one git worktree per agent:

```text
your-project/
~/.aictrl/projects/<project-id>/worktrees/
  auth-agent/
  ui-agent/
  api-agent/
```

For the first MVP, workspace creation can be staged. The daemon should support a workspace path per session and run commands there. Full automated `git worktree add` can be added after the session/diff/decision loop is working.

## Scope and Ownership

Agents must begin with a scope plan before editing. This is injected into the CLI session as protocol text:

```text
Before modifying files, output an AICTRL_SCOPE_PLAN JSON block describing read, write, and risky paths.
```

The daemon can parse structured protocol blocks when the CLI emits them. It also independently checks actual file changes using git.

Scope types:

```yaml
read:
  - src/api/**
write:
  - src/auth/**
risky:
  - package.json
forbidden:
  - .env
```

Ownership is the approved write scope for one session at a time. If another session needs the same owned path, it should produce a delegation request instead of editing directly.

## Delegation

Delegation is the mechanism for cross-boundary work:

```json
{
  "fromSession": "auth",
  "toSession": "api",
  "blocking": true,
  "requestedScope": ["src/api/session.ts"],
  "requestedChange": "Add refreshToken to the session response",
  "acceptanceCriteria": ["Existing session tests still pass"]
}
```

The first product should support three policy modes:

```text
manual      - user decides every delegation
assisted    - daemon recommends a target, user approves
autonomous  - low-risk delegation can be sent automatically
```

The MVP defaults to `assisted`.

## Boundary Enforcement

The daemon does not trust model self-reporting. It continuously compares actual changed files against approved ownership:

```text
actual changed files subset of owned write scope?
```

If not, the daemon creates a boundary violation decision:

```text
Approve expansion
Delegate to current owner
Reject and revert
Ask agent why
```

The MVP should detect and surface the decision. Hard pausing, file-level revert, and automatic delegation can be added incrementally.

## Browser Console

The console is a local control surface with four main regions:

```text
Top bar: project, mode, daemon status
Left: agent session list
Center: selected session live terminal stream and input
Right: decision queue
Bottom: inspector for scope, files, diff, tests, timeline
```

Important interactions:

```text
Start session
Send text to selected CLI
Stop session
Approve or reject a scope plan
View decisions
View current diff summary
Observe session logs in real time
```

The UI should stay utilitarian. It is a developer cockpit, not a landing page or team workflow board.

## Data Model

The MVP can store state in a JSON file to avoid external dependencies:

```text
~/.aictrl/projects/<project-id>/state.json
```

Core entities:

```text
Project
Session
ScopePlan
Ownership
Decision
Event
FileChange
```

SQLite can replace JSON once concurrent writes, search, and long-running history matter.

## MVP Success Criteria

The first version is complete when:

1. `aictrl open` starts a local daemon from any project directory.
2. The daemon serves a browser console on `127.0.0.1`.
3. The user can create multiple sessions backed by real local commands.
4. The user can see each session's live output.
5. The user can send input to a selected session.
6. The daemon records session events.
7. The daemon can detect changed files with git.
8. The daemon can compare changed files against approved scope patterns.
9. Boundary violations appear in the decision queue.
10. The implementation has tests for core scope matching, state handling, protocol parsing, and session lifecycle behavior.

## Non-Goals for MVP

```text
No cloud sync
No project upload
No custom AI chat client
No AI SDK integration requirement
No team account model
No complex kanban workflow
No automatic merging until the local observation and boundary loop works
```
