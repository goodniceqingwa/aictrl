# AI 驱动范围申报设计

## 背景

当前控制台让用户在 UI 中手动填写写入范围、读取范围和高风险范围。这不符合产品目标。正确逻辑应该是：用户创建任务，AI 根据任务和项目上下文先判断需要涉及哪些范围，然后用结构化协议申报范围。

## 设计

创建会话后，daemon 自动向真实 CLI 发送一段协议提示。提示要求 AI 在修改文件前先输出：

```text
AICTRL_SCOPE_PLAN:
{
  "write": ["src/auth/**"],
  "read": ["src/api/**"],
  "risky": ["package.json"],
  "reasoning": ["..."]
}
AICTRL_END
```

daemon 已经能解析 `AICTRL_SCOPE_PLAN` 并写入 session scope。本轮补齐的是自动发送该协议提示，而不是依赖用户手动告诉 AI。

## UI 语义

范围区域改为“AI 申报范围”。用户仍可人工修正，但不再作为主流程。按钮文案从“保存范围”改为“人工修正范围”。

## 非目标

- 不做复杂审批流。
- 不删除人工修正能力。
- 不要求 AI SDK 集成，仍然通过真实 CLI stdin/stdout 工作。
