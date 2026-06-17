const test = require('node:test');
const assert = require('node:assert/strict');
const { buildWorktreeBranchName, resolveSessionWorkspace, slugSessionName } = require('../src/workspace');

test('slugifies session names for workspace paths', () => {
  assert.equal(slugSessionName('auth agent'), 'auth-agent');
  assert.equal(slugSessionName('中文 agent'), 'agent');
});

test('uses project directory by default', () => {
  assert.equal(resolveSessionWorkspace({
    mode: 'project',
    projectDir: '/repo',
    runtimeDir: '/runtime',
    sessionName: 'auth'
  }).cwd, '/repo');
});

test('uses custom cwd when requested', () => {
  assert.equal(resolveSessionWorkspace({
    mode: 'custom',
    projectDir: '/repo',
    runtimeDir: '/runtime',
    sessionName: 'auth',
    cwd: '/tmp/custom'
  }).cwd, '/tmp/custom');
});

test('builds stable runtime worktree path and branch', () => {
  const result = resolveSessionWorkspace({
    mode: 'worktree',
    projectDir: '/repo',
    runtimeDir: '/runtime',
    sessionName: 'auth agent'
  });

  assert.equal(result.cwd, '/runtime/worktrees/auth-agent');
  assert.equal(result.branch, 'aictrl/auth-agent');
});

test('builds worktree branch names', () => {
  assert.equal(buildWorktreeBranchName('ui agent'), 'aictrl/ui-agent');
});
