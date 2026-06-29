import { describe, expect, it } from 'vitest';
import type { RunTaskResult, TaskRow } from '../../api/scheduler';
import { SCHEDULER_ACTION_LABELS, getTaskTypeLabel, mergeTaskAfterRun } from './schedulerView';

const baseTask: TaskRow = {
  id: 1,
  name: '日报生成',
  cron_expr: '0 9 * * *',
  task_type: 'REPORT_GEN',
  config: null,
  enabled: true,
  last_run_at: null,
  next_run_at: '2026-06-30 09:00:00',
  remark: null,
  created_at: '2026-06-29 09:00:00',
};

describe('scheduler view helpers', () => {
  it('keeps operation buttons text labels visible', () => {
    expect(SCHEDULER_ACTION_LABELS).toEqual(['执行', '日志', '编辑', '删除']);
  });

  it('uses enterprise task type labels and falls back to raw values', () => {
    expect(getTaskTypeLabel('REPORT_GEN')).toBe('报表生成');
    expect(getTaskTypeLabel('UNKNOWN')).toBe('UNKNOWN');
  });

  it('merges manual run timestamps into the current task row', () => {
    const result: RunTaskResult = {
      execution_id: 12,
      status: 'SUCCESS',
      output: '执行完成',
      last_run_at: '2026-06-29 10:30:00',
      next_run_at: '2026-06-30 09:00:00',
    };

    expect(mergeTaskAfterRun(baseTask, result)).toMatchObject({
      id: 1,
      last_run_at: '2026-06-29 10:30:00',
      next_run_at: '2026-06-30 09:00:00',
    });
  });
});
