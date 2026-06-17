const test = require('node:test');
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const { EventEmitter } = require('node:events');
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

test('child process backend returns false when stdin write hits EPIPE', () => {
  const originalSpawn = childProcess.spawn;
  childProcess.spawn = () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = {
      writable: true,
      write() {
        const error = new Error('write EPIPE');
        error.code = 'EPIPE';
        throw error;
      }
    };
    child.kill = () => {};
    return child;
  };

  try {
    const terminal = createTerminalProcess({
      command: 'short-lived',
      args: [],
      cwd: process.cwd(),
      ptyFactory: null
    });
    let result = null;

    assert.doesNotThrow(() => {
      result = terminal.write('hello\n');
    });
    assert.equal(result, false);
  } finally {
    childProcess.spawn = originalSpawn;
  }
});

test('child process backend returns false after stdin emits EPIPE', async () => {
  const originalSpawn = childProcess.spawn;
  childProcess.spawn = () => {
    const child = new EventEmitter();
    const stdin = new EventEmitter();
    stdin.writable = true;
    stdin.write = () => {
      const error = new Error('write EPIPE');
      error.code = 'EPIPE';
      process.nextTick(() => stdin.emit('error', error));
      return true;
    };
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stdin = stdin;
    child.kill = () => {};
    return child;
  };

  try {
    const terminal = createTerminalProcess({
      command: 'short-lived',
      args: [],
      cwd: process.cwd(),
      ptyFactory: null
    });

    assert.equal(terminal.write('hello\n'), true);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(terminal.write('again\n'), false);
  } finally {
    childProcess.spawn = originalSpawn;
  }
});
