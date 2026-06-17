'use strict';

const childProcess = require('node:child_process');

function loadNodePty() {
  try {
    return require('node-pty');
  } catch (_error) {
    return null;
  }
}

function createTerminalProcess(input) {
  const ptyFactory = input.ptyFactory === undefined ? loadNodePty() : input.ptyFactory;

  if (ptyFactory?.spawn) {
    return createPtyProcess(input, ptyFactory);
  }

  return createChildProcess(input);
}

function createPtyProcess(input, ptyFactory) {
  const term = ptyFactory.spawn(input.command, input.args || [], {
    name: input.termName || 'xterm-256color',
    cols: input.cols || 120,
    rows: input.rows || 30,
    cwd: input.cwd,
    env: { ...process.env, ...(input.env || {}) }
  });
  const exitPromise = new Promise(resolve => {
    term.onExit?.(event => {
      resolve({
        code: event.exitCode ?? event.code ?? null,
        signal: event.signal ?? null
      });
    });
  });

  return {
    kind: 'pty',
    onData(callback) {
      term.onData(callback);
    },
    onExit(callback) {
      term.onExit?.(event => {
        callback({
          code: event.exitCode ?? event.code ?? null,
          signal: event.signal ?? null
        });
      });
    },
    write(text) {
      term.write(text);
      return true;
    },
    resize(cols, rows) {
      term.resize?.(cols, rows);
    },
    kill() {
      term.kill();
    },
    wait() {
      return exitPromise;
    }
  };
}

function createChildProcess(input) {
  const child = childProcess.spawn(input.command, input.args || [], {
    cwd: input.cwd,
    env: { ...process.env, ...(input.env || {}) },
    shell: false,
    stdio: ['pipe', 'pipe', 'pipe']
  });
  const dataCallbacks = new Set();
  const exitCallbacks = new Set();
  let stdinClosed = false;
  const exitPromise = new Promise(resolve => {
    child.once('exit', (code, signal) => {
      const event = { code, signal };
      for (const callback of exitCallbacks) {
        callback(event);
      }
      resolve(event);
    });
  });

  child.stdin.on?.('error', () => {
    stdinClosed = true;
  });

  child.stdin.on?.('close', () => {
    stdinClosed = true;
  });

  child.stdout.on('data', chunk => {
    const text = chunk.toString();
    for (const callback of dataCallbacks) {
      callback(text, 'stdout');
    }
  });

  child.stderr.on('data', chunk => {
    const text = chunk.toString();
    for (const callback of dataCallbacks) {
      callback(text, 'stderr');
    }
  });

  return {
    kind: 'child_process',
    onData(callback) {
      dataCallbacks.add(callback);
    },
    onExit(callback) {
      exitCallbacks.add(callback);
    },
    write(text) {
      if (stdinClosed || !child.stdin.writable) {
        return false;
      }
      try {
        child.stdin.write(text);
      } catch (error) {
        if (error.code === 'EPIPE' || error.code === 'ERR_STREAM_DESTROYED') {
          stdinClosed = true;
          return false;
        }
        throw error;
      }
      return true;
    },
    resize() {},
    kill() {
      child.kill('SIGTERM');
    },
    wait() {
      return exitPromise;
    }
  };
}

module.exports = {
  createTerminalProcess
};
