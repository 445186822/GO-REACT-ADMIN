import { describe, expect, it } from 'vitest';
import type { TodoRow } from '../../api/collaboration';
import { countTodosByScope, todoScopeLabel } from './todoView';

function todo(overrides: Partial<TodoRow>): TodoRow {
  return {
    id: 1,
    source_module: 'approval',
    source_id: 1,
    title: '采购审批',
    biz_type: 'approval',
    applicant: '申请人',
    current_step: 0,
    current_step_name: '部门审批',
    assignee: '部门负责人',
    created_at: '2026-06-29 10:00:00',
    todo_status: 'pending',
    ...overrides,
  };
}

describe('todo view helpers', () => {
  it('labels pending and done scopes for enterprise todo tabs', () => {
    expect(todoScopeLabel('pending')).toBe('待办');
    expect(todoScopeLabel('done')).toBe('已办');
  });

  it('counts pending and done items separately', () => {
    expect(countTodosByScope([todo({ id: 1, todo_status: 'pending' }), todo({ id: 2, todo_status: 'done' })])).toEqual({
      pending: 1,
      done: 1,
    });
  });
});
