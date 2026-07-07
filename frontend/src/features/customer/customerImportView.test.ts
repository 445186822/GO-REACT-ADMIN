import { describe, expect, it } from 'vitest';
import { customerImportSummary, customerImportTemplateRows } from './customerImportView';

describe('customer import view helpers', () => {
  it('summarizes successful and failed import counts', () => {
    expect(customerImportSummary({ total: 3, success: 2, failed: 1, errors: [{ row: 4, reason: '客户名称不能为空' }] }))
      .toBe('导入完成：成功 2 条，失败 1 条');
  });

  it('provides sample rows for the customer import template', () => {
    expect(customerImportTemplateRows.length).toBeGreaterThanOrEqual(3);
    expect(customerImportTemplateRows[0].name).toBeTruthy();
    expect(customerImportTemplateRows.map((row) => row.level)).toContain('重点客户');
    expect(customerImportTemplateRows.map((row) => row.status)).toContain('停用');
  });
});
