'use strict';

const fs = require('node:fs');
const path = require('node:path');

function now() {
  return new Date().toISOString();
}

function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function initialState() {
  return {
    sessions: [],
    events: [],
    decisions: []
  };
}

class StateStore {
  constructor(filePath) {
    this.filePath = filePath;
  }

  read() {
    if (!fs.existsSync(this.filePath)) {
      return initialState();
    }

    return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
  }

  write(state) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, `${JSON.stringify(state, null, 2)}\n`);
    return state;
  }

  createSession(input) {
    const state = this.read();
    const session = {
      id: createId('session'),
      name: input.name,
      command: input.command,
      args: input.args || [],
      cwd: input.cwd,
      workspaceMode: input.workspaceMode || 'project',
      branch: input.branch || null,
      task: input.task || '',
      status: 'created',
      scope: { write: [], read: [], risky: [] },
      createdAt: now(),
      updatedAt: now()
    };

    state.sessions.push(session);
    this.write(state);
    return session;
  }

  updateSession(id, patch) {
    const state = this.read();
    const session = state.sessions.find(item => item.id === id);
    if (!session) {
      return null;
    }

    Object.assign(session, patch, { updatedAt: now() });
    this.write(state);
    return session;
  }

  addEvent(sessionId, type, payload) {
    const state = this.read();
    const event = {
      id: createId('event'),
      sessionId,
      type,
      payload,
      createdAt: now()
    };

    state.events.push(event);
    this.write(state);
    return event;
  }

  createDecision(type, sessionId, payload) {
    const state = this.read();
    const decision = {
      id: createId('decision'),
      type,
      sessionId,
      payload,
      status: 'pending',
      createdAt: now(),
      resolvedAt: null,
      resolution: null
    };

    state.decisions.push(decision);
    this.write(state);
    return decision;
  }

  resolveDecision(id, resolution) {
    const state = this.read();
    const decision = state.decisions.find(item => item.id === id);
    if (!decision) {
      return null;
    }

    decision.status = 'resolved';
    decision.resolvedAt = now();
    decision.resolution = resolution;
    this.write(state);
    return decision;
  }

  setScope(sessionId, scope) {
    return this.updateSession(sessionId, {
      scope: {
        write: scope.write || [],
        read: scope.read || [],
        risky: scope.risky || []
      }
    });
  }
}

module.exports = {
  StateStore
};
