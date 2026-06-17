# Chinese Cockpit Iteration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Localize the browser console to Chinese and add the next core orchestration controls: workspace resolution, optional git worktree sessions, delegation decisions from CLI protocol output, and continuous boundary watching.

**Architecture:** Keep the current dependency-free Node.js architecture. Add small testable modules for workspace resolution and boundary watching, extend the existing server routes, and update the static browser console in place. Agent sessions remain real CLI processes managed by `child_process.spawn`.

**Tech Stack:** Node.js 25, CommonJS, `node:test`, native `http`, `child_process`, `fs`, `path`, and git CLI.

---

### Task 1: Chinese Browser Console

**Files:**
- Modify: `src/static/index.html`
- Modify: `src/static/app.js`
- Modify: `tests/server.test.js`

**Step 1: Write failing test**

Add a server test that fetches `/` and asserts the main UI labels are Chinese:

```js
assert.match(html, /多 AI 终端控制台/);
assert.match(html, /启动会话/);
assert.match(html, /决策队列/);
assert.doesNotMatch(html, /Start Session/);
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/server.test.js`

Expected: FAIL because the current page still contains English text.

**Step 3: Localize HTML and JS-rendered strings**

Translate static UI labels and dynamic empty states:

```text
AI CLI Orchestrator -> 多 AI 终端控制台
Connecting... -> 正在连接...
Refresh -> 刷新
Sessions -> 会话
Start Session -> 启动会话
Command -> 命令
Args -> 参数
Task -> 任务
No Session Selected -> 未选择会话
Stop -> 停止
Send -> 发送
Decisions -> 决策队列
No pending decisions -> 暂无待处理决策
Scope -> 范围
Write patterns -> 写入范围
Read patterns -> 读取范围
Risky patterns -> 高风险范围
Boundary Check -> 边界检查
Check Boundaries -> 检查边界
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/server.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/static/index.html src/static/app.js tests/server.test.js
git commit -m "feat: localize browser console to chinese"
```

### Task 2: Workspace Resolver

**Files:**
- Create: `src/workspace.js`
- Create: `tests/workspace.test.js`

**Step 1: Write failing tests**

```js
const { resolveSessionWorkspace, buildWorktreeBranchName } = require('../src/workspace');

test('uses project directory by default', () => {
  assert.equal(resolveSessionWorkspace({
    mode: 'project',
    projectDir: '/repo',
    runtimeDir: '/runtime',
    sessionName: 'auth'
  }).cwd, '/repo');
});

test('builds stable runtime worktree path', () => {
  const result = resolveSessionWorkspace({
    mode: 'worktree',
    projectDir: '/repo',
    runtimeDir: '/runtime',
    sessionName: 'auth agent'
  });

  assert.equal(result.cwd, '/runtime/worktrees/auth-agent');
  assert.equal(result.branch, 'aictrl/auth-agent');
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/workspace.test.js`

Expected: FAIL because `src/workspace.js` does not exist.

**Step 3: Implement minimal resolver**

Support modes:

```text
project -> projectDir
custom -> provided cwd
worktree -> runtimeDir/worktrees/<slug>
```

Expose:

```js
slugSessionName(name)
buildWorktreeBranchName(name)
resolveSessionWorkspace(input)
```

**Step 4: Run tests**

Run: `node --test tests/workspace.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/workspace.js tests/workspace.test.js
git commit -m "feat: resolve session workspaces"
```

### Task 3: Git Worktree Creation

**Files:**
- Modify: `src/git.js`
- Modify: `tests/git.test.js`

**Step 1: Write failing tests**

Add tests for command planning rather than live `git worktree add`, because nested git creation can be sandbox-sensitive:

```js
const { buildWorktreeAddArgs } = require('../src/git');

test('builds git worktree add arguments', () => {
  assert.deepEqual(
    buildWorktreeAddArgs('/runtime/worktrees/auth', 'aictrl/auth'),
    ['worktree', 'add', '/runtime/worktrees/auth', '-b', 'aictrl/auth']
  );
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/git.test.js`

Expected: FAIL because `buildWorktreeAddArgs` is not exported.

**Step 3: Implement worktree helpers**

Add:

```js
function isGitRepository(cwd)
function buildWorktreeAddArgs(worktreePath, branchName)
function createGitWorktree(projectDir, worktreePath, branchName)
```

`createGitWorktree` should:

1. Return `{ ok: true, skipped: true }` when `worktreePath` already exists.
2. Return `{ ok: false, error }` when `projectDir` is not a git repo.
3. Use `git worktree add <path> -b <branch>` for creation.

**Step 4: Run tests**

Run: `node --test tests/git.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/git.js tests/git.test.js
git commit -m "feat: add git worktree helpers"
```

### Task 4: Workspace-Aware Session Creation API

**Files:**
- Modify: `src/server.js`
- Modify: `src/cli.js`
- Modify: `tests/server.test.js`

**Step 1: Write failing tests**

Extend session creation tests to pass `workspaceMode: 'custom'` and assert returned `cwd` uses the custom directory.

Add a worktree resolver test through server by injecting a fake worktree creator:

```js
const app = createServer({
  projectDir: dir,
  statePath,
  runtimeDir,
  port: 0,
  createWorktree: () => ({ ok: true })
});
```

Create session with `workspaceMode: 'worktree'`, assert `cwd` contains `/worktrees/<session>`.

**Step 2: Run tests to verify failure**

Run: `node --test tests/server.test.js`

Expected: FAIL because server ignores `workspaceMode`.

**Step 3: Implement server support**

Change `createServer` to accept `runtimeDir` and optional `createWorktree`.

During `POST /api/sessions`:

1. Resolve workspace.
2. If mode is `worktree`, call create worktree before creating session.
3. Store `workspaceMode` and `cwd`.
4. Start runner in resolved `cwd`.

**Step 4: Run tests**

Run: `node --test tests/server.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/server.js src/cli.js tests/server.test.js
git commit -m "feat: create sessions in selected workspaces"
```

### Task 5: Delegation Decisions From CLI Output

**Files:**
- Modify: `src/server.js`
- Modify: `tests/server.test.js`

**Step 1: Write failing test**

Create a session with command:

```bash
/bin/sh -lc 'printf "AICTRL_DELEGATION_REQUEST:\n{\"toSession\":\"api\",\"requestedScope\":[\"src/api/session.js\"]}\nAICTRL_END\n"'
```

After exit, fetch `/api/state` and assert there is a pending `delegation_request` decision.

**Step 2: Run server tests to verify failure**

Run: `node --test tests/server.test.js`

Expected: FAIL because terminal output is recorded but protocol blocks are not converted into decisions.

**Step 3: Implement protocol handling in runner event path**

In server runner `onEvent`:

1. For `terminal.output`, call `parseProtocolBlocks(event.text)`.
2. For `delegation_request`, create decision.
3. For `scope_plan`, set session scope only if explicit `write/read/risky` arrays exist.
4. Publish `decision.created` or `scope.plan_created`.

**Step 4: Run tests**

Run: `node --test tests/server.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/server.js tests/server.test.js
git commit -m "feat: create decisions from cli protocol output"
```

### Task 6: Boundary Watcher

**Files:**
- Create: `src/boundary-watcher.js`
- Create: `tests/boundary-watcher.test.js`
- Modify: `src/server.js`
- Modify: `tests/server.test.js`

**Step 1: Write failing unit tests**

Test the watcher without timers first:

```js
const watcher = new BoundaryWatcher({
  listChangedFiles: () => ['src/api/session.js'],
  onViolation: violation => violations.push(violation)
});

watcher.check({ sessionId: 's1', cwd: '/repo', allowedPatterns: ['src/auth/**'] });
watcher.check({ sessionId: 's1', cwd: '/repo', allowedPatterns: ['src/auth/**'] });

assert.equal(violations.length, 1);
```

**Step 2: Run unit test to verify failure**

Run: `node --test tests/boundary-watcher.test.js`

Expected: FAIL because module does not exist.

**Step 3: Implement watcher**

Expose:

```js
class BoundaryWatcher {
  check(session)
  start(session, intervalMs)
  stop(sessionId)
  stopAll()
}
```

Deduplicate by `sessionId + sorted outOfScope files`.

**Step 4: Wire server route**

Add:

```text
POST /api/sessions/:id/watch-boundary
```

Body:

```json
{ "enabled": true, "intervalMs": 2000 }
```

When enabled, run watcher against the selected session and publish decisions.

**Step 5: Run tests**

Run:

```bash
node --test tests/boundary-watcher.test.js
node --test tests/server.test.js
```

Expected: PASS.

**Step 6: Commit**

```bash
git add src/boundary-watcher.js tests/boundary-watcher.test.js src/server.js tests/server.test.js
git commit -m "feat: add continuous boundary watcher"
```

### Task 7: Chinese UI Controls For New Features

**Files:**
- Modify: `src/static/index.html`
- Modify: `src/static/app.js`
- Modify: `src/static/styles.css`
- Modify: `tests/server.test.js`

**Step 1: Write failing test**

Extend browser console HTML test:

```js
assert.match(html, /工作区模式/);
assert.match(html, /自动创建 Git worktree/);
assert.match(html, /持续边界检查/);
```

**Step 2: Run server test to verify failure**

Run: `node --test tests/server.test.js`

Expected: FAIL because new controls are absent.

**Step 3: Add UI controls**

Add:

```text
工作区模式 select:
  当前项目目录
  自动创建 Git worktree
  自定义工作目录

自定义工作目录 input
持续边界检查 button/toggle
决策队列 shows translated decision type names
```

Update session POST body:

```js
workspaceMode
cwd
```

Add watch-boundary button:

```js
POST /api/sessions/:id/watch-boundary
```

**Step 4: Run tests**

Run: `node --test tests/server.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/static/index.html src/static/app.js src/static/styles.css tests/server.test.js
git commit -m "feat: add chinese workspace and watcher controls"
```

### Task 8: Final Verification And Docs

**Files:**
- Modify: `README.md`

**Step 1: Run full tests**

Run: `node --test tests/*.test.js`

Expected: all tests pass.

**Step 2: Run local daemon**

Run: `node src/cli.js open --port 4317`

Expected output includes:

```text
aictrl running at http://127.0.0.1:4317
```

**Step 3: Verify HTTP**

Run:

```bash
curl -sS http://127.0.0.1:4317/api/health
curl -sS http://127.0.0.1:4317/
```

Expected:

```text
health ok
HTML contains 多 AI 终端控制台
```

**Step 4: Update README**

Document:

```text
Chinese console
workspace modes
worktree requirement
delegation protocol block
continuous boundary watcher
```

**Step 5: Commit**

```bash
git add README.md
git commit -m "docs: document chinese cockpit iteration"
```
