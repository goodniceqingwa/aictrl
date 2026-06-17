'use strict';

const path = require('node:path');

function slugSessionName(name) {
  const slug = String(name || 'agent')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');

  return slug || 'agent';
}

function buildWorktreeBranchName(sessionName) {
  return `aictrl/${slugSessionName(sessionName)}`;
}

function resolveSessionWorkspace({ mode, projectDir, runtimeDir, sessionName, cwd }) {
  const workspaceMode = mode || 'project';

  if (workspaceMode === 'custom') {
    return {
      mode: workspaceMode,
      cwd: path.resolve(cwd)
    };
  }

  if (workspaceMode === 'worktree') {
    const slug = slugSessionName(sessionName);
    return {
      mode: workspaceMode,
      cwd: path.join(runtimeDir, 'worktrees', slug),
      branch: buildWorktreeBranchName(sessionName)
    };
  }

  return {
    mode: 'project',
    cwd: projectDir
  };
}

module.exports = {
  slugSessionName,
  buildWorktreeBranchName,
  resolveSessionWorkspace
};
