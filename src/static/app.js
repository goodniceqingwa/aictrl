'use strict';

let state = { sessions: [], events: [], decisions: [] };
let selectedSessionId = null;

const elements = {
  projectPath: document.querySelector('#project-path'),
  sessionForm: document.querySelector('#session-form'),
  sessionList: document.querySelector('#session-list'),
  selectedTitle: document.querySelector('#selected-title'),
  terminalOutput: document.querySelector('#terminal-output'),
  inputForm: document.querySelector('#input-form'),
  stopButton: document.querySelector('#stop-button'),
  decisionList: document.querySelector('#decision-list'),
  scopeForm: document.querySelector('#scope-form'),
  boundaryForm: document.querySelector('#boundary-form'),
  boundaryResult: document.querySelector('#boundary-result'),
  refreshButton: document.querySelector('#refresh-button')
};

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json();
}

function linesFromTextarea(value) {
  return value
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
}

function splitArgs(value) {
  return value
    .match(/(?:[^\s"]+|"[^"]*")+/g)
    ?.map(item => item.replace(/^"|"$/g, '')) || [];
}

async function loadState() {
  const health = await request('/api/health');
  state = await request('/api/state');
  elements.projectPath.textContent = health.projectDir;

  if (!selectedSessionId && state.sessions.length > 0) {
    selectedSessionId = state.sessions[0].id;
  }

  render();
}

function selectedSession() {
  return state.sessions.find(session => session.id === selectedSessionId) || null;
}

function render() {
  renderSessions();
  renderTerminal();
  renderDecisions();
  renderScope();
}

function renderSessions() {
  elements.sessionList.innerHTML = '';

  for (const session of state.sessions) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = `session-item${session.id === selectedSessionId ? ' active' : ''}`;
    item.innerHTML = `
      <strong>${escapeHtml(session.name)}</strong>
      <div class="meta">${escapeHtml(session.status)} · ${escapeHtml(session.command)} ${escapeHtml((session.args || []).join(' '))}</div>
      <div class="meta">${escapeHtml(session.task || '')}</div>
    `;
    item.addEventListener('click', () => {
      selectedSessionId = session.id;
      render();
    });
    elements.sessionList.appendChild(item);
  }
}

function renderTerminal() {
  const session = selectedSession();
  elements.selectedTitle.textContent = session ? session.name : 'No Session Selected';

  if (!session) {
    elements.terminalOutput.textContent = '';
    return;
  }

  const text = state.events
    .filter(event => event.sessionId === session.id && event.type.startsWith('terminal.'))
    .map(event => {
      const payload = event.payload || {};
      if (event.type === 'terminal.input') {
        return `> ${payload.text || ''}`;
      }
      return payload.text || '';
    })
    .join('');

  elements.terminalOutput.textContent = text;
  elements.terminalOutput.scrollTop = elements.terminalOutput.scrollHeight;
}

function renderDecisions() {
  const pending = state.decisions.filter(decision => decision.status === 'pending');
  elements.decisionList.innerHTML = '';

  if (pending.length === 0) {
    elements.decisionList.innerHTML = '<div class="meta">No pending decisions</div>';
    return;
  }

  for (const decision of pending) {
    const item = document.createElement('div');
    item.className = 'decision-item';
    item.innerHTML = `
      <strong class="danger">${escapeHtml(decision.type)}</strong>
      <div class="meta">${escapeHtml(decision.sessionId)}</div>
      <pre>${escapeHtml(JSON.stringify(decision.payload, null, 2))}</pre>
    `;
    elements.decisionList.appendChild(item);
  }
}

function renderScope() {
  const session = selectedSession();
  if (!session) {
    return;
  }

  elements.scopeForm.elements.write.value = (session.scope?.write || []).join('\n');
  elements.scopeForm.elements.read.value = (session.scope?.read || []).join('\n');
  elements.scopeForm.elements.risky.value = (session.scope?.risky || []).join('\n');
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

elements.sessionForm.addEventListener('submit', async event => {
  event.preventDefault();
  const form = new FormData(elements.sessionForm);
  const created = await request('/api/sessions', {
    method: 'POST',
    body: JSON.stringify({
      name: form.get('name'),
      command: form.get('command'),
      args: splitArgs(form.get('args') || ''),
      task: form.get('task') || ''
    })
  });

  selectedSessionId = created.id;
  await loadState();
});

elements.inputForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!selectedSessionId) return;

  const text = elements.inputForm.elements.text.value;
  await request(`/api/sessions/${selectedSessionId}/input`, {
    method: 'POST',
    body: JSON.stringify({ text: `${text}\n` })
  });
  elements.inputForm.reset();
  await loadState();
});

elements.stopButton.addEventListener('click', async () => {
  if (!selectedSessionId) return;

  await request(`/api/sessions/${selectedSessionId}/stop`, { method: 'POST', body: '{}' });
  await loadState();
});

elements.scopeForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!selectedSessionId) return;

  await request(`/api/sessions/${selectedSessionId}/scope`, {
    method: 'POST',
    body: JSON.stringify({
      write: linesFromTextarea(elements.scopeForm.elements.write.value),
      read: linesFromTextarea(elements.scopeForm.elements.read.value),
      risky: linesFromTextarea(elements.scopeForm.elements.risky.value)
    })
  });
  await loadState();
});

elements.boundaryForm.addEventListener('submit', async event => {
  event.preventDefault();
  if (!selectedSessionId) return;

  const changedFiles = linesFromTextarea(elements.boundaryForm.elements.changedFiles.value);
  const result = await request('/api/check-boundaries', {
    method: 'POST',
    body: JSON.stringify({
      sessionId: selectedSessionId,
      changedFiles: changedFiles.length ? changedFiles : undefined
    })
  });

  elements.boundaryResult.textContent = JSON.stringify(result, null, 2);
  await loadState();
});

elements.refreshButton.addEventListener('click', loadState);

const eventSource = new EventSource('/events');
eventSource.onmessage = () => {
  loadState().catch(error => {
    elements.projectPath.textContent = error.message;
  });
};

loadState().catch(error => {
  elements.projectPath.textContent = error.message;
});
