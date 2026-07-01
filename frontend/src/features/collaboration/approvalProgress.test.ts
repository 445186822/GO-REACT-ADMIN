import { describe, expect, it } from 'vitest';
import type { ApprovalNodeRow } from '../../api/collaboration';
import { buildApprovalProgressSteps } from './approvalProgress';

function approvalNode(overrides: Partial<ApprovalNodeRow>): ApprovalNodeRow {
  return {
    id: 1,
    node_key: 'dept_approval',
    node_name: '部门审批',
    node_type: 'approval',
    assignee: '部门负责人',
    step_index: 0,
    status: 'WAITING',
    ...overrides,
  };
}

describe('approval progress helpers', () => {
  it('uses instance node status instead of linear current_step for conditional branches', () => {
    const steps = buildApprovalProgressSteps([
      approvalNode({ id: 1, node_key: 'dept_approval', node_name: '部门审批', assignee: '部门负责人', status: 'WAITING', step_index: 0 }),
      approvalNode({ id: 2, node_key: 'manager_approval', node_name: '总经理审批', assignee: '总经理', status: 'RUNNING', step_index: 1 }),
    ]);

    expect(steps).toEqual([
      { title: '部门审批', description: '部门负责人 · 未开始', status: 'wait' },
      { title: '总经理审批', description: '总经理 · 待审批', status: 'process' },
    ]);
  });

  it('marks rejected approval nodes as error status', () => {
    const steps = buildApprovalProgressSteps([
      approvalNode({ status: 'REJECTED' }),
    ]);

    expect(steps[0]).toMatchObject({ description: '部门负责人 · 已驳回', status: 'error' });
  });
});
