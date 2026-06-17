const test = require('node:test');
const assert = require('node:assert/strict');
const { version } = require('../src/index');

test('exports a version string', () => {
  assert.match(version, /^\d+\.\d+\.\d+$/);
});
