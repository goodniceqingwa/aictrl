'use strict';

let state = { sessions: [], events: [], decisions: [] };
let selectedSessionId = null;
let browserTerminal = null;
let renderedTerminalSessionId = null;
let renderedTerminalEventCount = 0;

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
  refreshButton: document.querySelector('#refresh-button'),
  watchButton: document.querySelector('#watch-button')
};

const decisionTypeNames = {
  boundary_violation: '边界越界',
  delegation_request: '转交请求',
  scope_approval: '范围审批'
};

function initBrowserTerminal() {
  if (!window.Terminal) {
    return null;
  }

  const terminal = new Terminal({
    cols: 120,
    rows: 30,
    convertEol: true,
    cursorBlink: true,
    fontFamily: '"JetBrains Mono", "SFMono-Regular", "Cascadia Code", "Consolas", monospace',
    fontSize: 13,
    lineHeight: 1.2,
    theme: {
      background: '#010806',
      foreground: '#b9ffe8',
      cursor: '#00ff9c',
      selectionBackground: '#0a3f36',
      black: '#020407',
      red: '#ff3864',
      green: '#00ff9c',
      yellow: '#ffd166',
      blue: '#00e5ff',
      magenta: '#b45cff',
      cyan: '#00e5ff',
      white: '#d8fff4',
      brightBlack: '#42615c',
      brightRed: '#ff6b8a',
      brightGreen: '#6dffc4',
      brightYellow: '#ffe39a',
      brightBlue: '#64f0ff',
      brightMagenta: '#d4a0ff',
      brightCyan: '#97f7ff',
      brightWhite: '#f2fffb'
    }
  });

  terminal.open(elements.terminalOutput);
  terminal.onData(data => {
    if (!selectedSessionId) return;
    request(`/api/sessions/${selectedSessionId}/input`, {
      method: 'POST',
      body: JSON.stringify({ text: data })
    }).catch(error => {
      elements.projectPath.textContent = error.message;
    });
  });
  elements.terminalOutput.classList.add('xterm-mounted');
  return terminal;
}

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
  elements.selectedTitle.textContent = session ? session.name : '未选择会话';

  if (!session) {
    if (browserTerminal) {
      browserTerminal.reset();
    } else {
      elements.terminalOutput.textContent = '';
    }
    renderedTerminalSessionId = null;
    renderedTerminalEventCount = 0;
    return;
  }

  const terminalEvents = state.events
    .filter(event => event.sessionId === session.id && event.type === 'terminal.output');

  if (browserTerminal) {
    if (renderedTerminalSessionId !== session.id || renderedTerminalEventCount > terminalEvents.length) {
      browserTerminal.reset();
      renderedTerminalSessionId = session.id;
      renderedTerminalEventCount = 0;
    }

    for (const event of terminalEvents.slice(renderedTerminalEventCount)) {
      browserTerminal.write(event.payload?.text || '');
    }

    renderedTerminalEventCount = terminalEvents.length;
    return;
  }

  const text = terminalEvents
    .map(event => event.payload?.text || '')
    .join('');
  elements.terminalOutput.textContent = text;
  elements.terminalOutput.scrollTop = elements.terminalOutput.scrollHeight;
}

function renderDecisions() {
  const pending = state.decisions.filter(decision => decision.status === 'pending');
  elements.decisionList.innerHTML = '';

  if (pending.length === 0) {
    elements.decisionList.innerHTML = '<div class="meta">暂无待处理决策</div>';
    return;
  }

  for (const decision of pending) {
    const item = document.createElement('div');
    item.className = 'decision-item';
    item.innerHTML = `
      <strong class="danger">${escapeHtml(decisionTypeNames[decision.type] || decision.type)}</strong>
      <div class="meta">${escapeHtml(decision.sessionId)}</div>
      <pre>${escapeHtml(JSON.stringify(decision.payload, null, 2))}</pre>
    `;
    item.appendChild(renderDecisionActions(decision));
    elements.decisionList.appendChild(item);
  }
}

function renderDecisionActions(decision) {
  const actions = document.createElement('div');
  actions.className = 'decision-actions';

  if (decision.type === 'scope_approval') {
    actions.appendChild(decisionButton('批准', decision.id, 'approve'));
    actions.appendChild(decisionButton('拒绝', decision.id, 'reject', 'secondary'));
    return actions;
  }

  actions.appendChild(decisionButton('确认处理', decision.id, 'resolve', 'secondary'));
  return actions;
}

function decisionButton(label, decisionId, action, variant = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  if (variant) {
    button.className = variant;
  }
  button.addEventListener('click', async () => {
    await request(`/api/decisions/${decisionId}/resolve`, {
      method: 'POST',
      body: JSON.stringify({ action })
    });
    await loadState();
  });
  return button;
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
      task: form.get('task') || '',
      workspaceMode: form.get('workspaceMode') || 'project',
      cwd: form.get('cwd') || undefined
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

elements.watchButton.addEventListener('click', async () => {
  if (!selectedSessionId) return;

  const result = await request(`/api/sessions/${selectedSessionId}/watch-boundary`, {
    method: 'POST',
    body: JSON.stringify({ enabled: true, intervalMs: 2000 })
  });
  elements.boundaryResult.textContent = JSON.stringify(result, null, 2);
  await loadState();
});

const eventSource = new EventSource('/events');
eventSource.onmessage = () => {
  loadState().catch(error => {
    elements.projectPath.textContent = error.message;
  });
};

browserTerminal = initBrowserTerminal();

loadState().catch(error => {
  elements.projectPath.textContent = error.message;
});
