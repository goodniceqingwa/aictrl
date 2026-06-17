const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { SessionRunner } = require('../src/session-runner');

test('starts a real command and streams output events', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aictrl-runner-'));
  const events = [];
  const runner = new SessionRunner({
    onEvent: event => events.push(event)
  });

  const session = runner.start({
    id: 's1',
    command: '/bin/sh',
    args: ['-lc', 'printf "hello from child\\n"'],
    cwd: dir
  });

  await session.wait();

  assert.equal(events.some(event => event.type === 'terminal.output' && event.text.includes('hello from child')), true);
  assert.equal(events.some(event => event.type === 'session.exit' && event.code === 0), true);
});

test('writes input to a running command', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aictrl-runner-'));
  const events = [];
  const runner = new SessionRunner({
    onEvent: event => events.push(event)
  });

  const session = runner.start({
    id: 's1',
    command: '/bin/sh',
    args: ['-lc', 'read line; printf "got:%s\\n" "$line"'],
    cwd: dir
  });

  runner.write('s1', 'ping\n');
  await session.wait();

  assert.equal(events.some(event => event.type === 'terminal.output' && event.text.includes('got:ping')), true);
});
