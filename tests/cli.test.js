const test = require('node:test');
const assert = require('node:assert/strict');
const { parseArgs, runtimePathForProject } = require('../src/cli');

test('parses open command with optional port', () => {
  assert.deepEqual(parseArgs(['open', '--port', '4555']), { command: 'open', port: 4555 });
});

test('defaults to open command and ephemeral port', () => {
  assert.deepEqual(parseArgs([]), { command: 'open', port: 0 });
});

test('builds deterministic runtime path for a project', () => {
  const result = runtimePathForProject('/tmp/example-project', '/tmp/home');

  assert.equal(result.startsWith('/tmp/home/projects/'), true);
  assert.match(result, /example-project-/);
});
