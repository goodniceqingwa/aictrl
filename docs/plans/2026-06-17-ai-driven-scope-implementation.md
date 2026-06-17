# AI Driven Scope Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make scope planning AI-driven by automatically sending each new CLI session a protocol prompt based on the user's task.

**Architecture:** Add a small `scope-prompt` module that builds the protocol instruction. Extend `POST /api/sessions` so after the real CLI process starts, the daemon writes this instruction to the session stdin. Keep manual scope editing as a fallback but change UI wording to "AI 申报范围 / 人工修正范围".

**Tech Stack:** Node.js 25, CommonJS, `node:test`, existing HTTP daemon and browser console.

---

### Task 1: Scope Planning Prompt

**Files:**
- Create: `src/scope-prompt.js`
- Create: `tests/scope-prompt.test.js`

**Steps:**
1. Write a failing test for `buildScopePlanningPrompt({ name, task })`.
2. Assert the prompt includes the task text, `AICTRL_SCOPE_PLAN`, `AICTRL_END`, and `AICTRL_DELEGATION_REQUEST`.
3. Implement the minimal prompt builder.
4. Run `node --test tests/scope-prompt.test.js`.
5. Commit.

### Task 2: Auto-Send Scope Prompt On Session Creation

**Files:**
- Modify: `src/server.js`
- Modify: `tests/server.test.js`

**Steps:**
1. Write a failing server test that creates a long-running shell session and asserts a `terminal.input` event contains `AICTRL_SCOPE_PLAN`.
2. Implement prompt injection after `runner.start(...)`.
3. Keep it best-effort: if the CLI already exited, do not fail session creation.
4. Run `node --test tests/server.test.js`.
5. Commit.

### Task 3: Verify AI Scope Plan Still Updates Session Scope

**Files:**
- Modify: `tests/server.test.js`

**Steps:**
1. Add a server test where a CLI prints `AICTRL_SCOPE_PLAN` and exits.
2. Assert `/api/state` shows the session scope was set from the AI output.
3. Run `node --test tests/server.test.js`.
4. Commit if code changes are needed; otherwise include test in prior commit.

### Task 4: UI Wording

**Files:**
- Modify: `src/static/index.html`
- Modify: `tests/server.test.js`

**Steps:**
1. Extend the browser HTML test to assert `AI 申报范围` and `人工修正范围`.
2. Change static labels accordingly.
3. Run `node --test tests/server.test.js`.
4. Commit.

### Task 5: Final Verification

**Steps:**
1. Run `node --test tests/*.test.js`.
2. Start daemon on a free local port.
3. Verify `/api/health` and `/` return correctly.
4. Merge back to `master`.
