'use strict';

const MARKERS = new Map([
  ['AICTRL_SCOPE_PLAN:', 'scope_plan'],
  ['AICTRL_DELEGATION_REQUEST:', 'delegation_request']
]);

function parseProtocolBlocks(text) {
  const lines = String(text || '').split(/\r?\n/);
  const blocks = [];

  for (let index = 0; index < lines.length; index += 1) {
    const marker = lines[index].trim();
    const type = MARKERS.get(marker);

    if (!type) {
      continue;
    }

    const jsonLines = [];
    index += 1;

    while (index < lines.length && lines[index].trim() !== 'AICTRL_END') {
      jsonLines.push(lines[index]);
      index += 1;
    }

    try {
      blocks.push({
        type,
        payload: JSON.parse(jsonLines.join('\n'))
      });
    } catch (_error) {
      // Invalid model output should not break the daemon event loop.
    }
  }

  return blocks;
}

module.exports = {
  parseProtocolBlocks
};
