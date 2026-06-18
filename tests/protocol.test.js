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

test('ignores echoed prompt template protocol blocks', () => {
  const text = [
    'AICTRL_SCOPE_PLAN:',
    '{',
    '  "write": ["预计需要修改的路径，例如 src/auth/**"],',
    '  "read": ["预计只需要读取的路径，例如 src/api/**"],',
    '  "risky": ["高风险路径，例如 package.json"],',
    '  "reasoning": ["简要说明为什么需要这些范围"]',
    '}',
    'AICTRL_END',
    'AICTRL_DELEGATION_REQUEST:',
    '{',
    '  "toSession": "目标会话名称",',
    '  "requestedScope": ["需要对方修改的路径"],',
    '  "requestedChange": "需要对方完成的变更"',
    '}',
    'AICTRL_END'
  ].join('\n');

  assert.deepEqual(parseProtocolBlocks(text), []);
});
