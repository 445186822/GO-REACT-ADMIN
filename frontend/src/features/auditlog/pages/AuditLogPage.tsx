import { ProColumns, ProTable } from '@ant-design/pro-components';
import { Tag, Typography, message } from 'antd';
import { listAuditLogs, type AuditLogRow } from '../../../api/auditLogs';
import { ExportButton } from '../../../components/ExportButton';
import { exportExcel } from '../../../utils/exportExcel';

export function AuditLogPage() {
  const columns: ProColumns<AuditLogRow>[] = [
    { title: '时间', dataIndex: 'created_at', valueType: 'dateTime', search: false, width: 180 },
    { title: '用户', dataIndex: 'username' },
    { title: '方法', dataIndex: 'method', search: false, width: 90, render: (_, row) => <Tag>{row.method}</Tag> },
    { title: '资源', dataIndex: 'resource' },
    { title: '路径', dataIndex: 'path', search: false, ellipsis: true },
    { title: 'Request ID', dataIndex: 'request_id', copyable: true, search: false, ellipsis: true },
    {
      title: '结果',
      dataIndex: 'success',
      search: false,
      width: 110,
      render: (_, row) => <Tag color={row.success ? 'green' : 'red'}>{row.response_code}</Tag>,
    },
    { title: 'IP', dataIndex: 'ip', search: false, width: 140 },
  ];

  async function exportAuditLogs() {
    const data = await listAuditLogs({ page: 1, page_size: 10000 });
    await exportExcel<AuditLogRow>(
      'audit_logs.xlsx',
      'Audit Logs',
      [
        { title: 'ID', dataIndex: 'id' },
        { title: '时间', dataIndex: 'created_at' },
        { title: '用户', dataIndex: 'username' },
        { title: '方法', dataIndex: 'method' },
        { title: '资源', dataIndex: 'resource' },
        { title: '路径', dataIndex: 'path' },
        { title: 'Request ID', dataIndex: 'request_id' },
        { title: '响应码', dataIndex: 'response_code' },
        { title: '成功', dataIndex: 'success' },
        { title: 'IP', dataIndex: 'ip' },
        { title: '错误', dataIndex: 'error_message' },
      ],
      data.items,
    );
    message.success('审计日志 Excel 已生成');
  }

  return (
    <div>
      <Typography.Title level={3}>操作日志</Typography.Title>
      <ProTable<AuditLogRow>
        rowKey="id"
        columns={columns}
        search={{ labelWidth: 80 }}
        request={async (params) => {
          const data = await listAuditLogs({
            username: params.username as string | undefined,
            resource: params.resource as string | undefined,
            page: params.current,
            page_size: params.pageSize,
          });
          return { data: data.items, total: data.total, success: true };
        }}
        pagination={{ defaultPageSize: 10, showSizeChanger: false }}
        toolBarRender={() => [
          <ExportButton key="export" onClick={exportAuditLogs}>
            导出 Excel
          </ExportButton>,
        ]}
      />
    </div>
  );
}


