const test = require('node:test');
const assert = require('node:assert/strict');
const { buildScopePlanningPrompt } = require('../src/scope-prompt');

test('builds a scope planning prompt from the session task', () => {
  const prompt = buildScopePlanningPrompt({
    name: 'auth-agent',
    task: '实现 refresh token'
  });

  assert.match(prompt, /auth-agent/);
  assert.match(prompt, /实现 refresh token/);
  assert.match(prompt, /AICTRL_SCOPE_PLAN/);
  assert.match(prompt, /AICTRL_DELEGATION_REQUEST/);
  assert.match(prompt, /AICTRL_END/);
});
