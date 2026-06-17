'use strict';

function normalizePath(filePath) {
  return String(filePath || '').replace(/\\/g, '/').replace(/^\.\/+/, '');
}

function escapeRegExp(text) {
  return text.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

function patternToRegExp(pattern) {
  const normalized = normalizePath(pattern);
  let source = '';

  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    const next = normalized[index + 1];

    if (char === '*' && next === '*') {
      source += '.*';
      index += 1;
      continue;
    }

    if (char === '*') {
      source += '[^/]*';
      continue;
    }

    source += escapeRegExp(char);
  }

  return new RegExp(`^${source}$`);
}

function matchesAny(filePath, patterns) {
  const normalized = normalizePath(filePath);
  return (patterns || []).some(pattern => patternToRegExp(pattern).test(normalized));
}

function findOutOfScope(files, allowedPatterns) {
  return (files || [])
    .map(normalizePath)
    .filter(file => !matchesAny(file, allowedPatterns));
}

module.exports = {
  normalizePath,
  patternToRegExp,
  matchesAny,
  findOutOfScope
};
