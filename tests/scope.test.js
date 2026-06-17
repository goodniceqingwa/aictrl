const test = require('node:test');
const assert = require('node:assert/strict');
const { matchesAny, findOutOfScope } = require('../src/scope');

test('matches exact paths and double-star directory patterns', () => {
  assert.equal(matchesAny('src/auth/session.js', ['src/auth/**']), true);
  assert.equal(matchesAny('src/api/session.js', ['src/auth/**']), false);
  assert.equal(matchesAny('package.json', ['package.json']), true);
});

test('matches single-star path segments', () => {
  assert.equal(matchesAny('src/auth.js', ['src/*.js']), true);
  assert.equal(matchesAny('src/auth/session.js', ['src/*.js']), false);
});

test('finds files outside approved scope', () => {
  const files = ['src/auth/session.js', 'src/api/session.js', 'tests/auth/session.test.js'];
  const allowed = ['src/auth/**', 'tests/auth/**'];

  assert.deepEqual(findOutOfScope(files, allowed), ['src/api/session.js']);
});
