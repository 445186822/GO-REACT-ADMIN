import { describe, expect, it } from 'vitest';
import { customerImportSummary } from './customerImportView';

describe('customer import view helpers', () => {
  it('summarizes successful and failed import counts', () => {
    expect(customerImportSummary({ total: 3, success: 2, failed: 1, errors: [{ row: 4, reason: '客户名称不能为空' }] }))
      .toBe('导入完成：成功 2 条，失败 1 条');
  });
});

