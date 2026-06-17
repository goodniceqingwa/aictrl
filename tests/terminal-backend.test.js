const test = require('node:test');
const assert = require('node:assert/strict');
const { createTerminalProcess } = require('../src/terminal-backend');

test('uses pty factory when provided', () => {
  const calls = [];
  const terminal = createTerminalProcess({
    id: 's1',
    command: 'codex',
    args: ['--help'],
    cwd: '/repo',
    env: { A: '1' },
    cols: 100,
    rows: 40,
    ptyFactory: {
      spawn(command, args, options) {
        calls.push({ command, args, options });
        return {
          onData() {},
          onExit() {},
          write() {},
          kill() {},
          resize() {}
        };
      }
    }
  });

  assert.equal(terminal.kind, 'pty');
  assert.equal(calls[0].command, 'codex');
  assert.deepEqual(calls[0].args, ['--help']);
  assert.equal(calls[0].options.cwd, '/repo');
  assert.equal(calls[0].options.cols, 100);
  assert.equal(calls[0].options.rows, 40);
});

test('default backend can run a shell command and capture output', async () => {
  const terminal = createTerminalProcess({
    id: 's1',
    command: '/bin/sh',
    args: ['-lc', 'printf backend-ok'],
    cwd: process.cwd()
  });
  let output = '';
  let exitCode = null;

  terminal.onData(data => {
    output += data;
  });
  terminal.onExit(event => {
    exitCode = event.code;
  });

  await terminal.wait();

  assert.equal(output, 'backend-ok');
  assert.equal(exitCode, 0);
});
