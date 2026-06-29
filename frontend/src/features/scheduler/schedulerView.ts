import type { RunTaskResult, TaskRow } from '../../api/scheduler';

export const TASK_TYPES: Record<string, string> = {
  CUSTOM: '自定义脚本',
  DATA_SYNC: '数据同步',
  REPORT_GEN: '报表生成',
  NOTIFICATION: '通知发送',
  DATA_CLEANUP: '数据清理',
  AI_ANALYSIS: 'AI分析',
};

export const SCHEDULER_ACTION_LABELS = ['执行', '日志', '编辑', '删除'] as const;

export function getTaskTypeLabel(taskType: string) {
  return TASK_TYPES[taskType] || taskType;
}

export function mergeTaskAfterRun(task: TaskRow, result: RunTaskResult): TaskRow {
  return {
    ...task,
    last_run_at: result.last_run_at ?? task.last_run_at,
    next_run_at: result.next_run_at ?? task.next_run_at,
  };
}
