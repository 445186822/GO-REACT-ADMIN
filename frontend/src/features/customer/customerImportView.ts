import type { CustomerImportResult } from '../../api/customers';

export type CustomerImportTemplateRow = {
  name: string;
  level: string;
  phone: string;
  email: string;
  status: string;
  remark: string;
};

export const customerImportTemplateColumns = [
  { title: '客户名称', dataIndex: 'name', width: 180 },
  { title: '级别', dataIndex: 'level', width: 100 },
  { title: '手机', dataIndex: 'phone', width: 130 },
  { title: '邮箱', dataIndex: 'email', width: 180 },
  { title: '状态', dataIndex: 'status', width: 80 },
  { title: '备注', dataIndex: 'remark', width: 180 },
] as const;

export const customerImportTemplateRows: CustomerImportTemplateRow[] = [
  { name: '上海示例科技有限公司', level: '重点客户', phone: '13800138000', email: 'contact@example.com', status: '有效', remark: '模板示例：重点客户' },
  { name: '杭州未来制造有限公司', level: '普通客户', phone: '13900139000', email: 'sales@example.com', status: '有效', remark: '模板示例：普通客户' },
  { name: '深圳潜在合作方', level: '潜在客户', phone: '13700137000', email: 'lead@example.com', status: '停用', remark: '模板示例：潜在客户' },
];

export function customerImportSummary(result: CustomerImportResult) {
  return `导入完成：成功 ${result.success} 条，失败 ${result.failed} 条`;
}

export function customerImportFailureDetail(result: CustomerImportResult) {
  return result.errors.slice(0, 5).map((item) => (item.row > 0 ? `第 ${item.row} 行：${item.reason}` : `保存失败：${item.reason}`)).join('\n');
}
