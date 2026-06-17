'use strict';

const childProcess = require('node:child_process');

function listChangedFiles(cwd) {
  let output;

  try {
    output = childProcess.execFileSync('git', ['status', '--porcelain=v1', '-z'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
  } catch (_error) {
    return [];
  }

  return parsePorcelainStatus(output);
}

function parsePorcelainStatus(output) {
  const entries = String(output || '').split('\0').filter(Boolean);
  const files = [];

  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const status = entry.slice(0, 2);
    const filePath = entry.slice(3);

    if (status.includes('R') || status.includes('C')) {
      const nextPath = entries[index + 1];
      if (nextPath) {
        files.push(nextPath);
        index += 1;
      }
      continue;
    }

    if (filePath) {
      files.push(filePath);
    }
  }

  return [...new Set(files)].sort();
}

module.exports = {
  listChangedFiles,
  parsePorcelainStatus
};
