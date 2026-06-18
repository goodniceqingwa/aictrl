'use strict';

const MARKERS = new Map([
  ['AICTRL_SCOPE_PLAN:', 'scope_plan'],
  ['AICTRL_DELEGATION_REQUEST:', 'delegation_request']
]);

const PLACEHOLDER_HINTS = [
  '预计需要修改的路径',
  '预计只需要读取的路径',
  '高风险路径',
  '简要说明为什么需要这些范围',
  '目标会话名称',
  '需要对方修改的路径',
  '需要对方完成的变更'
];

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
      const payload = JSON.parse(jsonLines.join('\n'));
      if (containsPlaceholderHint(payload)) {
        continue;
      }

      blocks.push({
        type,
        payload
      });
    } catch (_error) {
      // Invalid model output should not break the daemon event loop.
    }
  }

  return blocks;
}

function containsPlaceholderHint(value) {
  if (typeof value === 'string') {
    return PLACEHOLDER_HINTS.some(hint => value.includes(hint));
  }

  if (Array.isArray(value)) {
    return value.some(item => containsPlaceholderHint(item));
  }

  if (value && typeof value === 'object') {
    return Object.values(value).some(item => containsPlaceholderHint(item));
  }

  return false;
}

module.exports = {
  parseProtocolBlocks
};
