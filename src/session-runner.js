'use strict';

const childProcess = require('node:child_process');

class RunningSession {
  constructor(id, child) {
    this.id = id;
    this.child = child;
    this.done = new Promise(resolve => {
      child.once('exit', (code, signal) => resolve({ code, signal }));
    });
  }

  wait() {
    return this.done;
  }
}

class SessionRunner {
  constructor({ onEvent } = {}) {
    this.onEvent = onEvent || (() => {});
    this.sessions = new Map();
  }

  start({ id, command, args, cwd, env }) {
    const child = childProcess.spawn(command, args || [], {
      cwd,
      env: { ...process.env, ...(env || {}) },
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    const session = new RunningSession(id, child);

    this.sessions.set(id, session);
    this.emit({ sessionId: id, type: 'session.started', command, args: args || [] });

    child.stdout.on('data', chunk => {
      this.emit({ sessionId: id, type: 'terminal.output', stream: 'stdout', text: chunk.toString() });
    });

    child.stderr.on('data', chunk => {
      this.emit({ sessionId: id, type: 'terminal.output', stream: 'stderr', text: chunk.toString() });
    });

    child.once('exit', (code, signal) => {
      this.sessions.delete(id);
      this.emit({ sessionId: id, type: 'session.exit', code, signal });
    });

    child.once('error', error => {
      this.emit({ sessionId: id, type: 'session.error', message: error.message });
    });

    return session;
  }

  write(sessionId, text) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.child.stdin.writable) {
      return false;
    }

    session.child.stdin.write(text);
    this.emit({ sessionId, type: 'terminal.input', text });
    return true;
  }

  stop(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.child.kill('SIGTERM');
    return true;
  }

  emit(event) {
    this.onEvent(event);
  }
}

module.exports = {
  SessionRunner
};
