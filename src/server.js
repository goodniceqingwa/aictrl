'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { StateStore } = require('./state');
const { SessionRunner } = require('./session-runner');
const { listChangedFiles } = require('./git');
const { checkBoundary } = require('./boundary');

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(body)
  });
  res.end(body);
}

function sendText(res, status, text, contentType = 'text/plain') {
  res.writeHead(status, {
    'content-type': contentType,
    'content-length': Buffer.byteLength(text)
  });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('error', reject);
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString();
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function staticContentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  return 'application/octet-stream';
}

function createEventHub() {
  const clients = new Set();

  function publish(event) {
    const payload = `data: ${JSON.stringify(event)}\n\n`;
    for (const client of clients) {
      client.write(payload);
    }
  }

  function subscribe(req, res) {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive'
    });
    res.write('\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
  }

  return { publish, subscribe };
}

function createServer({ projectDir, statePath, port = 0 }) {
  const store = new StateStore(statePath);
  const events = createEventHub();
  const runner = new SessionRunner({
    onEvent: event => {
      store.addEvent(event.sessionId || null, event.type, event);
      if (event.type === 'session.exit') {
        store.updateSession(event.sessionId, { status: 'exited' });
      }
      events.publish(event);
    }
  });

  const server = http.createServer(async (req, res) => {
    try {
      await handleRequest({ req, res, projectDir, store, runner, events });
    } catch (error) {
      sendJson(res, 500, { error: error.message });
    }
  });

  return {
    get port() {
      return server.address().port;
    },
    listen() {
      return new Promise(resolve => {
        server.listen(port, '127.0.0.1', resolve);
      });
    },
    close() {
      return new Promise(resolve => {
        server.close(resolve);
      });
    }
  };
}

async function handleRequest({ req, res, projectDir, store, runner, events }) {
  const url = new URL(req.url, 'http://127.0.0.1');
  const pathname = url.pathname;

  if (req.method === 'GET' && pathname === '/api/health') {
    sendJson(res, 200, { ok: true, projectDir });
    return;
  }

  if (req.method === 'GET' && pathname === '/api/state') {
    sendJson(res, 200, store.read());
    return;
  }

  if (req.method === 'GET' && pathname === '/events') {
    events.subscribe(req, res);
    return;
  }

  if (req.method === 'POST' && pathname === '/api/sessions') {
    const input = await readBody(req);
    const session = store.createSession({
      name: input.name,
      command: input.command,
      args: input.args || [],
      cwd: input.cwd || projectDir,
      task: input.task || ''
    });

    store.updateSession(session.id, { status: 'running' });
    runner.start({
      id: session.id,
      command: session.command,
      args: session.args,
      cwd: session.cwd
    });

    sendJson(res, 201, store.read().sessions.find(item => item.id === session.id));
    return;
  }

  const inputMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/input$/);
  if (req.method === 'POST' && inputMatch) {
    const body = await readBody(req);
    const ok = runner.write(inputMatch[1], body.text || '');
    sendJson(res, ok ? 200 : 404, { ok });
    return;
  }

  const stopMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/stop$/);
  if (req.method === 'POST' && stopMatch) {
    const ok = runner.stop(stopMatch[1]);
    sendJson(res, ok ? 200 : 404, { ok });
    return;
  }

  const scopeMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/scope$/);
  if (req.method === 'POST' && scopeMatch) {
    const body = await readBody(req);
    const session = store.setScope(scopeMatch[1], body);
    sendJson(res, session ? 200 : 404, session || { error: 'session not found' });
    return;
  }

  if (req.method === 'POST' && pathname === '/api/check-boundaries') {
    const body = await readBody(req);
    const state = store.read();
    const session = state.sessions.find(item => item.id === body.sessionId);

    if (!session) {
      sendJson(res, 404, { error: 'session not found' });
      return;
    }

    const changedFiles = body.changedFiles || listChangedFiles(session.cwd);
    const result = checkBoundary({
      changedFiles,
      allowedPatterns: session.scope.write
    });

    let decision = null;
    if (!result.ok) {
      decision = store.createDecision('boundary_violation', session.id, {
        files: result.outOfScope,
        allowedPatterns: session.scope.write
      });
      events.publish({ type: 'decision.created', sessionId: session.id, decision });
    }

    sendJson(res, 200, { ...result, changedFiles, decision });
    return;
  }

  if (req.method === 'GET') {
    const staticRoot = path.join(__dirname, 'static');
    const filePath = pathname === '/'
      ? path.join(staticRoot, 'index.html')
      : path.join(staticRoot, pathname);

    if (filePath.startsWith(staticRoot) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      sendText(res, 200, fs.readFileSync(filePath), staticContentType(filePath));
      return;
    }
  }

  sendJson(res, 404, { error: 'not found' });
}

module.exports = {
  createServer
};
