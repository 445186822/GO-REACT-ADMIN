import { describe, expect, it } from 'vitest';
import { buildApprovalActionPayload, requiresApprovalComment } from './approvalActions';

describe('approval action helpers', () => {
  it('keeps approve payload minimal', () => {
    expect(buildApprovalActionPayload('APPROVE', '  ok  ')).toEqual({ action: 'APPROVE' });
  });

  it('trims reject comments before submission', () => {
    expect(buildApprovalActionPayload('REJECT', '  缺少附件  ')).toEqual({
      action: 'REJECT',
      comment: '缺少附件',
    });
  });

  it('marks only reject as requiring a comment', () => {
    expect(requiresApprovalComment('APPROVE')).toBe(false);
    expect(requiresApprovalComment('REJECT')).toBe(true);
  });
});
