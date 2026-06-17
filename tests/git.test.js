const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { listChangedFiles, parsePorcelainStatus } = require('../src/git');

test('parses changed files from porcelain status output', () => {
  const output = [
    ' M src/app.js',
    '?? README.md',
    'R  old.js',
    'new.js',
    ''
  ].join('\0');

  assert.deepEqual(parsePorcelainStatus(output), ['README.md', 'new.js', 'src/app.js']);
});

test('returns an empty list outside git repositories', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aictrl-not-git-'));

  assert.deepEqual(listChangedFiles(dir), []);
});
