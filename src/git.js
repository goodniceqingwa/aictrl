'use strict';

const childProcess = require('node:child_process');
const fs = require('node:fs');

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

function isGitRepository(cwd) {
  try {
    childProcess.execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    return true;
  } catch (_error) {
    return false;
  }
}

function buildWorktreeAddArgs(worktreePath, branchName) {
  return ['worktree', 'add', worktreePath, '-b', branchName];
}

function createGitWorktree(projectDir, worktreePath, branchName) {
  if (fs.existsSync(worktreePath)) {
    return { ok: true, skipped: true, cwd: worktreePath, branch: branchName };
  }

  if (!isGitRepository(projectDir)) {
    return { ok: false, error: `${projectDir} is not a git repository` };
  }

  try {
    childProcess.execFileSync('git', buildWorktreeAddArgs(worktreePath, branchName), {
      cwd: projectDir,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    return { ok: true, skipped: false, cwd: worktreePath, branch: branchName };
  } catch (error) {
    return {
      ok: false,
      error: error.stderr?.toString() || error.message
    };
  }
}

module.exports = {
  listChangedFiles,
  parsePorcelainStatus,
  isGitRepository,
  buildWorktreeAddArgs,
  createGitWorktree
};
