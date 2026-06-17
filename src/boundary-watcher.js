'use strict';

const { checkBoundary } = require('./boundary');

class BoundaryWatcher {
  constructor({ listChangedFiles, onViolation }) {
    this.listChangedFiles = listChangedFiles;
    this.onViolation = onViolation;
    this.timers = new Map();
    this.lastViolationKeys = new Map();
  }

  check({ sessionId, cwd, allowedPatterns }) {
    const changedFiles = this.listChangedFiles(cwd);
    const result = checkBoundary({ changedFiles, allowedPatterns });

    if (result.ok) {
      this.lastViolationKeys.delete(sessionId);
      return { ...result, changedFiles };
    }

    const key = result.outOfScope.slice().sort().join('\0');
    if (this.lastViolationKeys.get(sessionId) !== key) {
      this.lastViolationKeys.set(sessionId, key);
      this.onViolation({
        sessionId,
        cwd,
        changedFiles,
        outOfScope: result.outOfScope,
        allowedPatterns
      });
    }

    return { ...result, changedFiles };
  }

  start(session, intervalMs = 2000) {
    this.stop(session.sessionId);
    this.check(session);
    const timer = setInterval(() => this.check(session), intervalMs);
    this.timers.set(session.sessionId, timer);
  }

  stop(sessionId) {
    const timer = this.timers.get(sessionId);
    if (!timer) {
      return false;
    }

    clearInterval(timer);
    this.timers.delete(sessionId);
    this.lastViolationKeys.delete(sessionId);
    return true;
  }

  stopAll() {
    for (const sessionId of this.timers.keys()) {
      this.stop(sessionId);
    }
  }

  activeCount() {
    return this.timers.size;
  }
}

module.exports = {
  BoundaryWatcher
};
