import type { ApprovalNodeRow } from '../../api/collaboration';

export type ApprovalProgressStep = {
  title: string;
  description: string;
  status: 'finish' | 'process' | 'wait' | 'error';
};

const NODE_STATUS_VIEW: Record<string, { label: string; status: ApprovalProgressStep['status'] }> = {
  WAITING: { label: '未开始', status: 'wait' },
  RUNNING: { label: '待审批', status: 'process' },
  APPROVED: { label: '已通过', status: 'finish' },
  REJECTED: { label: '已驳回', status: 'error' },
};

export function buildApprovalProgressSteps(nodes: ApprovalNodeRow[]): ApprovalProgressStep[] {
  return nodes
    .filter((node) => node.node_type === 'approval')
    .map((node) => {
      const view = NODE_STATUS_VIEW[node.status] ?? NODE_STATUS_VIEW.WAITING;
      return {
        title: node.node_name,
        description: [node.assignee, view.label].filter(Boolean).join(' · '),
        status: view.status,
      };
    });
}
