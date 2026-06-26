export type ApprovalAction = 'APPROVE' | 'REJECT';

export function buildApprovalActionPayload(action: ApprovalAction, comment = '') {
  if (action === 'APPROVE') {
    return { action };
  }
  const trimmedComment = comment.trim();
  return trimmedComment ? { action, comment: trimmedComment } : { action };
}

export function requiresApprovalComment(action: ApprovalAction) {
  return action === 'REJECT';
}

export function approvalActionLabel(action: ApprovalAction) {
  return action === 'APPROVE' ? '通过' : '驳回';
}
