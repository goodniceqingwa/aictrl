const test = require('node:test');
const assert = require('node:assert/strict');
const packageJson = require('../package.json');
const { version } = require('../src/index');

test('exports a version string', () => {
  assert.match(version, /^\d+\.\d+\.\d+$/);
});

test('declares node-pty so interactive cli sessions get a real terminal', () => {
  assert.equal(packageJson.dependencies?.['node-pty'], '^1.1.0');
});

test('declares xterm so browser can render pty ansi output', () => {
  assert.equal(packageJson.dependencies?.['@xterm/xterm'], '^6.0.0');
});
