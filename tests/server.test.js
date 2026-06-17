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
