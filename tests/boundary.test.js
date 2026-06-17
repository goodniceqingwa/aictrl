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
