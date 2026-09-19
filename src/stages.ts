/** Each stage composes the previous one. Protections stay on from the beginning. */
export const STAGES = [
  { id: 1, name: 'Pi foundation / Pi 底座', tools: ['read', 'ls'] },
  { id: 2, name: 'Plan and execute / 计划与执行', tools: ['write', 'edit'] },
  { id: 3, name: 'Durable tasks / 可恢复任务', tools: ['task_list', 'task_add', 'task_update'] },
  { id: 4, name: 'Approval and paths / 审批与路径', tools: [] },
  { id: 5, name: 'Local MCP / 本地 MCP', tools: ['catalog_search'] },
  { id: 6, name: 'Read-only delegation / 只读子 Agent', tools: ['delegate_readonly'] },
  { id: 7, name: 'Verify and checkpoint / 验证与检查点', tools: ['verify_project', 'checkpoint_create', 'checkpoint_list', 'checkpoint_restore', 'bash'] },
  { id: 8, name: 'Context and isolation / 上下文与隔离', tools: [] },
  { id: 9, name: 'SDK assembly / SDK 装配', tools: [] },
] as const;
export function stageTools(stage: number): string[] {
  if (!Number.isInteger(stage) || stage < 1 || stage > 9) throw new Error('Stage must be an integer from 1 to 9');
  return STAGES.filter(s => s.id <= stage).flatMap(s => [...s.tools]);
}
