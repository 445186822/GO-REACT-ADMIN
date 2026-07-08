import { ProColumns } from '@ant-design/pro-components';
import { Tag } from 'antd';
import { listDepartments, type DepartmentRow } from '../../../api/departments';
import { ExportButton } from '../../../components/ExportButton';
import { ResponsiveProTable } from '../../../components/ResponsiveProTable';
import { message } from '../../../utils/message';
import { exportExcel } from '../../../utils/exportExcel';

export function DepartmentListPage() {
  const columns: ProColumns<DepartmentRow>[] = [
    { title: '部门编码', dataIndex: 'code', copyable: true },
    { title: '部门名称', dataIndex: 'name' },
    { title: '父级 ID', dataIndex: 'parent_id', search: false },
    {
      title: '状态',
      dataIndex: 'status',
      render: (_, row) => <Tag color={row.status === 'ACTIVE' ? 'green' : 'default'}>{row.status === 'ACTIVE' ? '启用' : '禁用'}</Tag>,
    },
  ];

  async function exportDepartments() {
    const rows = await listDepartments();
    await exportExcel<DepartmentRow>(
      'departments.xlsx', 'Departments',
      [
        { title: 'ID', dataIndex: 'id' },
        { title: '父级 ID', dataIndex: 'parent_id' },
        { title: '部门编码', dataIndex: 'code' },
        { title: '部门名称', dataIndex: 'name' },
        { title: '状态', dataIndex: 'status' },
      ],
      rows,
    );
    message.success('部门 Excel 已生成');
  }

  return (
    <div>
      <ResponsiveProTable<DepartmentRow>
        rowKey="id"
        columns={columns}
        search={false}
        request={async () => ({ data: await listDepartments(), total: 0, success: true })}
        pagination={false}
        toolBarRender={() => [
          <ExportButton key="export" onClick={exportDepartments}>导出 Excel</ExportButton>,
        ]}
      />
    </div>
  );
}
