import type { CustomerImportResult } from '../../api/customers';

export function customerImportSummary(result: CustomerImportResult) {
  return `导入完成：成功 ${result.success} 条，失败 ${result.failed} 条`;
}

export function customerImportFailureDetail(result: CustomerImportResult) {
  return result.errors.slice(0, 5).map((item) => `第 ${item.row} 行：${item.reason}`).join('\n');
}

