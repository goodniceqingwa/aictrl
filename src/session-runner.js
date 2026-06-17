'use strict';

const { createTerminalProcess } = require('./terminal-backend');

class RunningSession {
  constructor(id, terminal) {
    this.id = id;
    this.terminal = terminal;
  }

  wait() {
    return this.terminal.wait();
  }
}

class SessionRunner {
  constructor({ onEvent, terminalFactory } = {}) {
    this.onEvent = onEvent || (() => {});
    this.terminalFactory = terminalFactory || createTerminalProcess;
    this.sessions = new Map();
  }

  start({ id, command, args, cwd, env, cols, rows }) {
    const terminal = this.terminalFactory({ id, command, args: args || [], cwd, env, cols, rows });
    const session = new RunningSession(id, terminal);

    this.sessions.set(id, session);
    this.emit({ sessionId: id, type: 'session.started', command, args: args || [], backend: terminal.kind });

    terminal.onData((text, stream = 'stdout') => {
      this.emit({ sessionId: id, type: 'terminal.output', stream, text });
    });

    terminal.onExit(({ code, signal }) => {
      this.sessions.delete(id);
      this.emit({ sessionId: id, type: 'session.exit', code, signal });
    });

    return session;
  }

  write(sessionId, text) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    const ok = session.terminal.write(text);
    if (ok) {
      this.emit({ sessionId, type: 'terminal.input', text });
    }
    return ok;
  }

  stop(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }

    session.terminal.kill();
    return true;
  }

  emit(event) {
    this.onEvent(event);
  }
}

module.exports = {
  SessionRunner
};
