const test = require('node:test');
const assert = require('node:assert/strict');
const { BoundaryWatcher } = require('../src/boundary-watcher');

test('reports boundary violations once per changed file set', () => {
  const violations = [];
  const watcher = new BoundaryWatcher({
    listChangedFiles: () => ['src/api/session.js'],
    onViolation: violation => violations.push(violation)
  });

  watcher.check({ sessionId: 's1', cwd: '/repo', allowedPatterns: ['src/auth/**'] });
  watcher.check({ sessionId: 's1', cwd: '/repo', allowedPatterns: ['src/auth/**'] });

  assert.equal(violations.length, 1);
  assert.deepEqual(violations[0].outOfScope, ['src/api/session.js']);
});

test('does not report when files are in scope', () => {
  const violations = [];
  const watcher = new BoundaryWatcher({
    listChangedFiles: () => ['src/auth/session.js'],
    onViolation: violation => violations.push(violation)
  });

  watcher.check({ sessionId: 's1', cwd: '/repo', allowedPatterns: ['src/auth/**'] });

  assert.equal(violations.length, 0);
});

test('can stop all active timers', () => {
  const watcher = new BoundaryWatcher({
    listChangedFiles: () => [],
    onViolation: () => {}
  });

  watcher.start({ sessionId: 's1', cwd: '/repo', allowedPatterns: ['src/**'] }, 1000);
  assert.equal(watcher.activeCount(), 1);
  watcher.stopAll();
  assert.equal(watcher.activeCount(), 0);
});
