const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createServer } = require('../src/server');

test('serves health and creates sessions', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aictrl-server-'));
  const app = createServer({ projectDir: dir, statePath: path.join(dir, 'state.json'), port: 0 });
  await app.listen();

  const base = `http://127.0.0.1:${app.port}`;
  const health = await fetch(`${base}/api/health`).then(res => res.json());
  assert.equal(health.ok, true);

  const created = await fetch(`${base}/api/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'shell',
      command: '/bin/sh',
      args: ['-lc', 'printf done'],
      task: 'print done'
    })
  }).then(res => res.json());

  assert.equal(created.name, 'shell');
  assert.equal(created.status, 'running');

  await app.close();
});

test('creates sessions in custom workspaces', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aictrl-server-'));
  const customDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aictrl-custom-'));
  const app = createServer({ projectDir: dir, statePath: path.join(dir, 'state.json'), port: 0 });
  await app.listen();

  const base = `http://127.0.0.1:${app.port}`;

  try {
    const created = await fetch(`${base}/api/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'custom',
        command: '/bin/sh',
        args: ['-lc', 'printf done'],
        workspaceMode: 'custom',
        cwd: customDir
      })
    }).then(res => res.json());

    assert.equal(created.workspaceMode, 'custom');
    assert.equal(created.cwd, customDir);
  } finally {
    await app.close();
  }
});

test('creates sessions in git worktree workspaces through injected creator', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aictrl-server-'));
  const runtimeDir = path.join(dir, 'runtime');
  const createdWorktrees = [];
  const app = createServer({
    projectDir: dir,
    statePath: path.join(dir, 'state.json'),
    runtimeDir,
    port: 0,
    createWorktree: (projectDir, worktreePath, branchName) => {
      createdWorktrees.push({ projectDir, worktreePath, branchName });
      fs.mkdirSync(worktreePath, { recursive: true });
      return { ok: true };
    }
  });
  await app.listen();

  const base = `http://127.0.0.1:${app.port}`;

  try {
    const created = await fetch(`${base}/api/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'auth agent',
        command: '/bin/sh',
        args: ['-lc', 'printf done'],
        workspaceMode: 'worktree'
      })
    }).then(res => res.json());

    assert.equal(created.workspaceMode, 'worktree');
    assert.equal(created.cwd, path.join(runtimeDir, 'worktrees', 'auth-agent'));
    assert.deepEqual(createdWorktrees, [{
      projectDir: dir,
      worktreePath: path.join(runtimeDir, 'worktrees', 'auth-agent'),
      branchName: 'aictrl/auth-agent'
    }]);
  } finally {
    await app.close();
  }
});

test('sets scope and reports boundary decisions', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aictrl-server-'));
  const app = createServer({ projectDir: dir, statePath: path.join(dir, 'state.json'), port: 0 });
  await app.listen();

  const base = `http://127.0.0.1:${app.port}`;
  const created = await fetch(`${base}/api/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'auth',
      command: '/bin/sh',
      args: ['-lc', 'sleep 0.1'],
      task: 'work'
    })
  }).then(res => res.json());

  await fetch(`${base}/api/sessions/${created.id}/scope`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ write: ['src/auth/**'] })
  });

  const result = await fetch(`${base}/api/check-boundaries`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId: created.id, changedFiles: ['src/api/session.js'] })
  }).then(res => res.json());

  assert.equal(result.ok, false);
  assert.deepEqual(result.outOfScope, ['src/api/session.js']);
  assert.equal(result.decision.type, 'boundary_violation');

  await app.close();
});

test('creates delegation decisions from cli protocol output', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aictrl-server-'));
  const app = createServer({ projectDir: dir, statePath: path.join(dir, 'state.json'), port: 0 });
  await app.listen();

  const base = `http://127.0.0.1:${app.port}`;

  try {
    await fetch(`${base}/api/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'auth',
        command: '/bin/sh',
        args: [
          '-lc',
          'printf "AICTRL_DELEGATION_REQUEST:\\n{\\"toSession\\":\\"api\\",\\"requestedScope\\":[\\"src/api/session.js\\"]}\\nAICTRL_END\\n"'
        ],
        task: 'emit delegation'
      })
    });

    await new Promise(resolve => setTimeout(resolve, 80));

    const state = await fetch(`${base}/api/state`).then(res => res.json());
    const decision = state.decisions.find(item => item.type === 'delegation_request');
    assert.equal(decision.status, 'pending');
    assert.equal(decision.payload.toSession, 'api');
    assert.deepEqual(decision.payload.requestedScope, ['src/api/session.js']);
  } finally {
    await app.close();
  }
});

test('enables boundary watcher for a session', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aictrl-server-'));
  const app = createServer({
    projectDir: dir,
    statePath: path.join(dir, 'state.json'),
    port: 0,
    listChangedFiles: () => ['src/api/session.js']
  });
  await app.listen();

  const base = `http://127.0.0.1:${app.port}`;

  try {
    const created = await fetch(`${base}/api/sessions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'auth',
        command: '/bin/sh',
        args: ['-lc', 'sleep 0.1']
      })
    }).then(res => res.json());

    await fetch(`${base}/api/sessions/${created.id}/scope`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ write: ['src/auth/**'] })
    });

    const result = await fetch(`${base}/api/sessions/${created.id}/watch-boundary`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: true, intervalMs: 1000 })
    }).then(res => res.json());

    const state = await fetch(`${base}/api/state`).then(res => res.json());
    assert.equal(result.enabled, true);
    assert.equal(state.decisions.filter(item => item.type === 'boundary_violation').length, 1);

    const disabled = await fetch(`${base}/api/sessions/${created.id}/watch-boundary`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: false })
    }).then(res => res.json());
    assert.equal(disabled.enabled, false);
  } finally {
    await app.close();
  }
});

test('serves browser console html', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aictrl-server-'));
  const app = createServer({ projectDir: dir, statePath: path.join(dir, 'state.json'), port: 0 });
  await app.listen();

  try {
    const html = await fetch(`http://127.0.0.1:${app.port}/`).then(res => res.text());
    assert.match(html, /多 AI 终端控制台/);
    assert.match(html, /启动会话/);
    assert.match(html, /决策队列/);
    assert.match(html, /工作区模式/);
    assert.match(html, /自动创建 Git worktree/);
    assert.match(html, /持续边界检查/);
    assert.doesNotMatch(html, /Start Session/);
  } finally {
    await app.close();
  }
});
