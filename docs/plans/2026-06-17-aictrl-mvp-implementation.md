# Aictrl MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a local-first MVP that opens a project, starts a daemon, launches real CLI commands as agent sessions, streams output to a browser console, accepts user input, and detects boundary violations from git diffs.

**Architecture:** Use a small Node.js application with no runtime dependencies. Core behavior lives in testable modules under `src/`; `src/cli.js` starts the daemon; `src/server.js` serves JSON APIs, an SSE event stream, and a static browser console. Agent sessions are real child processes with stdin/stdout piping, not custom AI clients.

**Tech Stack:** Node.js 25, CommonJS modules, `node:test`, native `http`, `child_process`, `fs`, `path`, and git CLI.

---

### Task 1: Project Skeleton and Test Runner

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `README.md`
- Create: `src/index.js`
- Create: `tests/smoke.test.js`

**Step 1: Write the failing smoke test**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { version } = require('../src/index');

test('exports a version string', () => {
  assert.match(version, /^\d+\.\d+\.\d+$/);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/*.test.js`

Expected: FAIL because `../src/index` does not exist.

**Step 3: Write minimal implementation**

Create `package.json` with scripts:

```json
{
  "name": "aictrl",
  "version": "0.1.0",
  "private": true,
  "type": "commonjs",
  "bin": {
    "aictrl": "src/cli.js"
  },
  "scripts": {
    "test": "node --test tests/*.test.js",
    "start": "node src/cli.js open"
  }
}
```

Create `src/index.js`:

```js
'use strict';

module.exports = {
  version: '0.1.0'
};
```

Create `.gitignore`:

```text
node_modules/
.aictrl-runtime/
coverage/
*.log
```

Create `README.md` with MVP usage.

**Step 4: Run test to verify it passes**

Run: `node --test tests/*.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add package.json .gitignore README.md src/index.js tests/smoke.test.js
git commit -m "chore: scaffold aictrl project"
```

### Task 2: Glob Scope Matching

**Files:**
- Create: `src/scope.js`
- Create: `tests/scope.test.js`

**Step 1: Write failing tests**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { matchesAny, findOutOfScope } = require('../src/scope');

test('matches exact paths and double-star directory patterns', () => {
  assert.equal(matchesAny('src/auth/session.js', ['src/auth/**']), true);
  assert.equal(matchesAny('src/api/session.js', ['src/auth/**']), false);
  assert.equal(matchesAny('package.json', ['package.json']), true);
});

test('finds files outside approved scope', () => {
  const files = ['src/auth/session.js', 'src/api/session.js', 'tests/auth/session.test.js'];
  const allowed = ['src/auth/**', 'tests/auth/**'];

  assert.deepEqual(findOutOfScope(files, allowed), ['src/api/session.js']);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/scope.test.js`

Expected: FAIL because `src/scope.js` does not exist.

**Step 3: Write minimal implementation**

Implement:

```js
function normalizePath(filePath) { ... }
function patternToRegExp(pattern) { ... }
function matchesAny(filePath, patterns) { ... }
function findOutOfScope(files, allowedPatterns) { ... }
```

Support exact files, `*`, and `**`.

**Step 4: Run test to verify it passes**

Run: `node --test tests/scope.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/scope.js tests/scope.test.js
git commit -m "feat: add scope matching"
```

### Task 3: Protocol Block Parser

**Files:**
- Create: `src/protocol.js`
- Create: `tests/protocol.test.js`

**Step 1: Write failing tests**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseProtocolBlocks } = require('../src/protocol');

test('parses AICTRL scope plan JSON blocks', () => {
  const text = [
    'thinking...',
    'AICTRL_SCOPE_PLAN:',
    '{ "write": ["src/auth/**"], "read": ["src/api/**"], "risky": [] }',
    'AICTRL_END',
    'done'
  ].join('\n');

  assert.deepEqual(parseProtocolBlocks(text), [{
    type: 'scope_plan',
    payload: { write: ['src/auth/**'], read: ['src/api/**'], risky: [] }
  }]);
});

test('ignores invalid JSON blocks without throwing', () => {
  const text = 'AICTRL_SCOPE_PLAN:\n{ invalid\nAICTRL_END';
  assert.deepEqual(parseProtocolBlocks(text), []);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/protocol.test.js`

Expected: FAIL because `src/protocol.js` does not exist.

**Step 3: Write minimal implementation**

Support:

```text
AICTRL_SCOPE_PLAN:
{...}
AICTRL_END

AICTRL_DELEGATION_REQUEST:
{...}
AICTRL_END
```

Return normalized types `scope_plan` and `delegation_request`.

**Step 4: Run test to verify it passes**

Run: `node --test tests/protocol.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/protocol.js tests/protocol.test.js
git commit -m "feat: parse aictrl protocol blocks"
```

### Task 4: State Store

**Files:**
- Create: `src/state.js`
- Create: `tests/state.test.js`

**Step 1: Write failing tests**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { StateStore } = require('../src/state');

test('creates sessions and records events', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aictrl-state-'));
  const store = new StateStore(path.join(dir, 'state.json'));

  const session = store.createSession({ name: 'auth', command: 'node -v', cwd: dir, task: 'check node' });
  store.addEvent(session.id, 'terminal.output', { text: 'hello' });

  const state = store.read();
  assert.equal(state.sessions.length, 1);
  assert.equal(state.sessions[0].name, 'auth');
  assert.equal(state.events.length, 1);
});

test('creates boundary violation decisions', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aictrl-state-'));
  const store = new StateStore(path.join(dir, 'state.json'));
  const decision = store.createDecision('boundary_violation', 'auth', { files: ['package.json'] });

  assert.equal(decision.status, 'pending');
  assert.equal(store.read().decisions[0].type, 'boundary_violation');
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/state.test.js`

Expected: FAIL because `src/state.js` does not exist.

**Step 3: Write minimal implementation**

Implement a JSON-backed store with:

```js
read()
write(state)
createSession(input)
updateSession(id, patch)
addEvent(sessionId, type, payload)
createDecision(type, sessionId, payload)
resolveDecision(id, resolution)
setScope(sessionId, scope)
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/state.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/state.js tests/state.test.js
git commit -m "feat: add json state store"
```

### Task 5: Git Diff Watcher

**Files:**
- Create: `src/git.js`
- Create: `tests/git.test.js`

**Step 1: Write failing tests**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');
const { listChangedFiles } = require('../src/git');

function run(cmd, cwd) {
  childProcess.execFileSync(cmd[0], cmd.slice(1), { cwd, stdio: 'pipe' });
}

test('lists changed files in a git repository', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aictrl-git-'));
  run(['git', 'init'], dir);
  run(['git', 'config', 'user.name', 'test'], dir);
  run(['git', 'config', 'user.email', 'test@example.com'], dir);
  fs.mkdirSync(path.join(dir, 'src'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'src/app.js'), 'console.log(1);\n');
  run(['git', 'add', '.'], dir);
  run(['git', 'commit', '-m', 'init'], dir);

  fs.writeFileSync(path.join(dir, 'src/app.js'), 'console.log(2);\n');
  fs.writeFileSync(path.join(dir, 'README.md'), 'hello\n');

  assert.deepEqual(listChangedFiles(dir).sort(), ['README.md', 'src/app.js']);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/git.test.js`

Expected: FAIL because `src/git.js` does not exist.

**Step 3: Write minimal implementation**

Use `git status --porcelain=v1 -z` and parse changed paths.

**Step 4: Run test to verify it passes**

Run: `node --test tests/git.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/git.js tests/git.test.js
git commit -m "feat: list git changed files"
```

### Task 6: Boundary Checker

**Files:**
- Create: `src/boundary.js`
- Create: `tests/boundary.test.js`

**Step 1: Write failing tests**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { checkBoundary } = require('../src/boundary');

test('reports out-of-scope files as a violation', () => {
  const result = checkBoundary({
    changedFiles: ['src/auth/session.js', 'src/api/session.js'],
    allowedPatterns: ['src/auth/**']
  });

  assert.equal(result.ok, false);
  assert.deepEqual(result.outOfScope, ['src/api/session.js']);
});

test('passes when all files are in scope', () => {
  const result = checkBoundary({
    changedFiles: ['src/auth/session.js'],
    allowedPatterns: ['src/auth/**']
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.outOfScope, []);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/boundary.test.js`

Expected: FAIL because `src/boundary.js` does not exist.

**Step 3: Write minimal implementation**

Use `findOutOfScope` from `src/scope.js`.

**Step 4: Run test to verify it passes**

Run: `node --test tests/boundary.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/boundary.js tests/boundary.test.js
git commit -m "feat: add boundary checker"
```

### Task 7: Agent Process Manager

**Files:**
- Create: `src/session-runner.js`
- Create: `tests/session-runner.test.js`

**Step 1: Write failing tests**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { SessionRunner } = require('../src/session-runner');

test('starts a real command and streams output events', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aictrl-runner-'));
  const events = [];
  const runner = new SessionRunner({
    onEvent: event => events.push(event)
  });

  const session = runner.start({
    id: 's1',
    command: process.execPath,
    args: ['-e', 'console.log("hello from child")'],
    cwd: dir
  });

  await session.wait();

  assert.equal(events.some(event => event.type === 'terminal.output' && event.text.includes('hello from child')), true);
  assert.equal(events.some(event => event.type === 'session.exit' && event.code === 0), true);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/session-runner.test.js`

Expected: FAIL because `src/session-runner.js` does not exist.

**Step 3: Write minimal implementation**

Use `child_process.spawn(command, args, { cwd, shell: false })`, wire stdout/stderr, expose:

```js
start(input)
write(sessionId, text)
stop(sessionId)
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/session-runner.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/session-runner.js tests/session-runner.test.js
git commit -m "feat: run cli agent sessions"
```

### Task 8: Daemon HTTP API and SSE

**Files:**
- Create: `src/server.js`
- Create: `tests/server.test.js`

**Step 1: Write failing tests**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../src/server');

test('serves health and creates sessions', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aictrl-server-'));
  const app = await createServer({ projectDir: dir, statePath: path.join(dir, 'state.json'), port: 0 });
  await app.listen();

  const base = `http://127.0.0.1:${app.port}`;
  const health = await fetch(`${base}/api/health`).then(res => res.json());
  assert.equal(health.ok, true);

  const created = await fetch(`${base}/api/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'node', command: process.execPath, args: ['-v'], task: 'print version' })
  }).then(res => res.json());

  assert.equal(created.name, 'node');
  await app.close();
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/server.test.js`

Expected: FAIL because `src/server.js` does not exist.

**Step 3: Write minimal implementation**

Routes:

```text
GET  /api/health
GET  /api/state
POST /api/sessions
POST /api/sessions/:id/input
POST /api/sessions/:id/stop
POST /api/sessions/:id/scope
POST /api/check-boundaries
GET  /events
GET  /
```

**Step 4: Run test to verify it passes**

Run: `node --test tests/server.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/server.js tests/server.test.js
git commit -m "feat: add local daemon api"
```

### Task 9: CLI Open Command

**Files:**
- Create: `src/cli.js`
- Create: `tests/cli.test.js`
- Modify: `src/index.js`

**Step 1: Write failing tests**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseArgs, runtimePathForProject } = require('../src/cli');

test('parses open command with optional port', () => {
  assert.deepEqual(parseArgs(['open', '--port', '4555']), { command: 'open', port: 4555 });
});

test('builds deterministic runtime path for a project', () => {
  const result = runtimePathForProject('/tmp/example-project', '/tmp/home');
  assert.equal(result.startsWith('/tmp/home/projects/'), true);
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/cli.test.js`

Expected: FAIL because `src/cli.js` does not exist.

**Step 3: Write minimal implementation**

`aictrl open` starts the server for `process.cwd()`, prints:

```text
aictrl running at http://127.0.0.1:<port>
project: <cwd>
```

Do not auto-open a browser in MVP, because GUI opening needs platform-specific escalation. The user can paste the printed URL.

**Step 4: Run test to verify it passes**

Run: `node --test tests/cli.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/cli.js src/index.js tests/cli.test.js
git commit -m "feat: add open cli command"
```

### Task 10: Browser Console

**Files:**
- Create: `src/static/index.html`
- Create: `src/static/app.js`
- Create: `src/static/styles.css`
- Modify: `src/server.js`

**Step 1: Write failing test**

Add to `tests/server.test.js`:

```js
test('serves browser console html', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aictrl-server-'));
  const app = await createServer({ projectDir: dir, statePath: path.join(dir, 'state.json'), port: 0 });
  await app.listen();

  const html = await fetch(`http://127.0.0.1:${app.port}/`).then(res => res.text());
  assert.match(html, /AI CLI Orchestrator/);
  await app.close();
});
```

**Step 2: Run test to verify it fails**

Run: `node --test tests/server.test.js`

Expected: FAIL because static console is not served yet.

**Step 3: Write minimal implementation**

Create a utilitarian browser UI with:

```text
session list
new session form
live log pane
input box
decision queue
scope editor
changed files panel
boundary check button
```

Use plain HTML/CSS/JS and fetch/SSE.

**Step 4: Run test to verify it passes**

Run: `node --test tests/server.test.js`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/static/index.html src/static/app.js src/static/styles.css src/server.js tests/server.test.js
git commit -m "feat: add local browser console"
```

### Task 11: Integration Verification

**Files:**
- Modify: `README.md`

**Step 1: Run full tests**

Run: `npm test`

Expected: all tests pass.

**Step 2: Start local daemon**

Run: `node src/cli.js open --port 4317`

Expected output:

```text
aictrl running at http://127.0.0.1:4317
project: /home/qingwa/aictrl
```

**Step 3: Verify HTTP health**

Run: `curl -sS http://127.0.0.1:4317/api/health`

Expected JSON includes `"ok":true`.

**Step 4: Document manual usage**

Add README instructions for:

```text
npm test
node src/cli.js open --port 4317
creating a session with command node
checking boundaries
using codex or another CLI command
```

**Step 5: Commit**

```bash
git add README.md
git commit -m "docs: document mvp usage"
```
