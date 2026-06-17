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

test('serves browser console html', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aictrl-server-'));
  const app = createServer({ projectDir: dir, statePath: path.join(dir, 'state.json'), port: 0 });
  await app.listen();

  try {
    const html = await fetch(`http://127.0.0.1:${app.port}/`).then(res => res.text());
    assert.match(html, /多 AI 终端控制台/);
    assert.match(html, /启动会话/);
    assert.match(html, /决策队列/);
    assert.doesNotMatch(html, /Start Session/);
  } finally {
    await app.close();
  }
});
