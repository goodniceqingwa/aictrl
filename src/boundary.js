'use strict';

const { findOutOfScope } = require('./scope');

function checkBoundary({ changedFiles, allowedPatterns }) {
  const outOfScope = findOutOfScope(changedFiles || [], allowedPatterns || []);

  return {
    ok: outOfScope.length === 0,
    outOfScope
  };
}

module.exports = {
  checkBoundary
};
