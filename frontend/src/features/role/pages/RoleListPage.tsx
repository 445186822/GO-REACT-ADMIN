import { ProColumns, ProTable } from '@ant-design/pro-components';
import { Tag, message } from 'antd';
import { listRoles, type RoleRow } from '../../../api/roles';
import { ExportButton } from '../../../components/ExportButton';
import { exportExcel } from '../../../utils/exportExcel';

export function RoleListPage() {
  const columns: ProColumns<RoleRow>[] = [
    { title: '角色编码', dataIndex: 'code', copyable: true },
    { title: '角色名称', dataIndex: 'name' },
    { title: '说明', dataIndex: 'description', search: false },
    {
      title: '状态',
      dataIndex: 'status',
      render: (_, row) => <Tag color={row.status === 'ACTIVE' ? 'green' : 'default'}>{row.status === 'ACTIVE' ? '启用' : '禁用'}</Tag>,
    },
  ];

  async function exportRoles() {
    const rows = await listRoles();
    await exportExcel<RoleRow>(
      'roles.xlsx',
      'Roles',
      [
        { title: 'ID', dataIndex: 'id' },
        { title: '角色编码', dataIndex: 'code' },
        { title: '角色名称', dataIndex: 'name' },
        { title: '说明', dataIndex: 'description' },
        { title: '状态', dataIndex: 'status' },
      ],
      rows,
    );
    message.success('角色 Excel 已生成');
  }

  return (
    <div>
      <ProTable<RoleRow>
        rowKey="id"
        columns={columns}
        search={false}
        request={async () => ({ data: await listRoles(), success: true })}
        pagination={false}
        toolBarRender={() => [
          <ExportButton key="export" onClick={exportRoles}>
            导出 Excel
          </ExportButton>,
        ]}
      />
    </div>
  );
}


