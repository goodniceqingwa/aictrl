const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { StateStore } = require('../src/state');

test('creates sessions and records events', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aictrl-state-'));
  const store = new StateStore(path.join(dir, 'state.json'));

  const session = store.createSession({
    name: 'auth',
    command: 'node',
    args: ['-v'],
    cwd: dir,
    task: 'check node'
  });
  store.addEvent(session.id, 'terminal.output', { text: 'hello' });

  const state = store.read();
  assert.equal(state.sessions.length, 1);
  assert.equal(state.sessions[0].name, 'auth');
  assert.deepEqual(state.sessions[0].args, ['-v']);
  assert.equal(state.events.length, 1);
});

test('creates and resolves boundary violation decisions', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aictrl-state-'));
  const store = new StateStore(path.join(dir, 'state.json'));
  const decision = store.createDecision('boundary_violation', 'auth', { files: ['package.json'] });

  assert.equal(decision.status, 'pending');
  assert.equal(store.read().decisions[0].type, 'boundary_violation');

  const resolved = store.resolveDecision(decision.id, { action: 'reject' });
  assert.equal(resolved.status, 'resolved');
  assert.deepEqual(resolved.resolution, { action: 'reject' });
});

test('sets session scope', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aictrl-state-'));
  const store = new StateStore(path.join(dir, 'state.json'));
  const session = store.createSession({ name: 'auth', command: 'node', cwd: dir, task: 'work' });

  store.setScope(session.id, { write: ['src/auth/**'], read: ['src/api/**'] });

  assert.deepEqual(store.read().sessions[0].scope.write, ['src/auth/**']);
});
