'use strict';

function buildScopePlanningPrompt({ name, task }) {
  return [
    `你是 ${name || 'agent'}。`,
    '你运行在 aictrl 管理的真实 CLI 会话中。',
    '在修改任何文件前，先根据任务和项目上下文申报你预计需要的范围。',
    '',
    `任务：${task || '未提供任务描述'}`,
    '',
    '请先输出下面格式的 JSON 协议块：',
    'AICTRL_SCOPE_PLAN:',
    '{',
    '  "write": ["预计需要修改的路径，例如 src/auth/**"],',
    '  "read": ["预计只需要读取的路径，例如 src/api/**"],',
    '  "risky": ["高风险路径，例如 package.json"],',
    '  "reasoning": ["简要说明为什么需要这些范围"]',
    '}',
    'AICTRL_END',
    '',
    '如果你发现需要其他会话负责的范围，不要直接修改，输出：',
    'AICTRL_DELEGATION_REQUEST:',
    '{',
    '  "toSession": "目标会话名称",',
    '  "requestedScope": ["需要对方修改的路径"],',
    '  "requestedChange": "需要对方完成的变更"',
    '}',
    'AICTRL_END',
    ''
  ].join('\n');
}

module.exports = {
  buildScopePlanningPrompt
};
