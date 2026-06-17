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

test('parses AICTRL delegation request JSON blocks', () => {
  const text = [
    'AICTRL_DELEGATION_REQUEST:',
    '{ "toSession": "api", "requestedScope": ["src/api/session.js"] }',
    'AICTRL_END'
  ].join('\n');

  assert.deepEqual(parseProtocolBlocks(text), [{
    type: 'delegation_request',
    payload: { toSession: 'api', requestedScope: ['src/api/session.js'] }
  }]);
});

test('ignores invalid JSON blocks without throwing', () => {
  const text = 'AICTRL_SCOPE_PLAN:\n{ invalid\nAICTRL_END';
  assert.deepEqual(parseProtocolBlocks(text), []);
});
