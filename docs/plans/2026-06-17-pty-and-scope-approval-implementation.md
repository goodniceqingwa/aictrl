# PTY And Scope Approval Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an optional PTY terminal backend and require user approval before AI-declared scopes become active session scopes.

**Architecture:** Introduce a normalized terminal backend module used by `SessionRunner`. Add decision resolution APIs and change scope plan protocol handling to create `scope_approval` decisions rather than directly mutating session scope. Update the Chinese UI decision queue with approve/reject controls.

**Tech Stack:** Node.js 25, CommonJS, `node:test`, optional `node-pty` when installed, existing daemon and static UI.

---

### Task 1: Terminal Backend Abstraction

**Files:**
- Create: `src/terminal-backend.js`
- Create: `tests/terminal-backend.test.js`
- Modify: `src/session-runner.js`
- Modify: `tests/session-runner.test.js`

**Steps:**
1. Write a failing test for a fake PTY factory that verifies `createTerminalProcess` calls `pty.spawn`.
2. Write a failing test that default backend can run `/bin/sh` and capture output.
3. Implement normalized terminal backend with optional `node-pty` loading.
4. Refactor `SessionRunner` to use injected/default terminal factory.
5. Run `node --test tests/terminal-backend.test.js tests/session-runner.test.js`.
6. Commit.

### Task 2: Scope Approval Decisions

**Files:**
- Modify: `src/server.js`
- Modify: `tests/server.test.js`

**Steps:**
1. Change existing AI scope plan test to expect a pending `scope_approval` decision and unchanged session scope.
2. Implement `handleProtocolOutput` so scope plans create decisions instead of calling `setScope`.
3. Add `POST /api/decisions/:id/resolve`.
4. Add tests for approve setting session scope and reject leaving it unchanged.
5. Run `node --test tests/server.test.js`.
6. Commit.

### Task 3: Chinese Decision UI Controls

**Files:**
- Modify: `src/static/app.js`
- Modify: `src/static/index.html`
- Modify: `tests/server.test.js`

**Steps:**
1. Add server HTML assertions for `批准` and `拒绝`.
2. Update decision type names with `scope_approval: 范围审批`.
3. Add approve/reject buttons to decision cards.
4. Buttons call `POST /api/decisions/:id/resolve`.
5. Run `node --test tests/server.test.js`.
6. Commit.

### Task 4: Final Verification

**Steps:**
1. Run `node --test tests/*.test.js`.
2. Start daemon on a free port.
3. Verify `/api/health` and `/` return Chinese UI.
4. Merge to `master`, rerun tests, remove worktree.
