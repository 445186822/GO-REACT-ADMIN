import { ProColumns, ProTable } from '@ant-design/pro-components';
import { Tag, message } from 'antd';
import { listMenus, type MenuRow } from '../../../api/menus';
import { ExportButton } from '../../../components/ExportButton';
import { exportExcel } from '../../../utils/exportExcel';

export function MenuListPage() {
  const columns: ProColumns<MenuRow>[] = [
    { title: '名称', dataIndex: 'name' },
    { title: '权限编码', dataIndex: 'code', copyable: true },
    {
      title: '类型',
      dataIndex: 'type',
      render: (_, row) => <Tag color={typeColor(row.type)}>{typeText(row.type)}</Tag>,
    },
    { title: '路由', dataIndex: 'path', search: false },
    { title: '图标', dataIndex: 'icon', search: false },
    { title: '父级 ID', dataIndex: 'parent_id', search: false, width: 100 },
  ];

  async function exportMenus() {
    const rows = await listMenus();
    await exportExcel<MenuRow>(
      'menus.xlsx',
      'Menus',
      [
        { title: 'ID', dataIndex: 'id' },
        { title: '父级 ID', dataIndex: 'parent_id' },
        { title: '名称', dataIndex: 'name' },
        { title: '类型', dataIndex: 'type', render: (_, row) => typeText(row.type) },
        { title: '权限编码', dataIndex: 'code' },
        { title: '路由', dataIndex: 'path' },
        { title: '图标', dataIndex: 'icon' },
      ],
      rows,
    );
    message.success('菜单 Excel 已生成');
  }

  return (
    <div>
      <ProTable<MenuRow>
        rowKey="id"
        columns={columns}
        search={{ labelWidth: 80 }}
        request={async () => ({ data: await listMenus(), success: true })}
        pagination={{ defaultPageSize: 10, showSizeChanger: false }}
        toolBarRender={() => [
          <ExportButton key="export" onClick={exportMenus}>
            导出 Excel
          </ExportButton>,
        ]}
      />
    </div>
  );
}

function typeText(type: MenuRow['type']) {
  if (type === 'directory') return '目录';
  if (type === 'page') return '页面';
  return '按钮';
}

function typeColor(type: MenuRow['type']) {
  if (type === 'directory') return 'blue';
  if (type === 'page') return 'green';
  return 'purple';
}


