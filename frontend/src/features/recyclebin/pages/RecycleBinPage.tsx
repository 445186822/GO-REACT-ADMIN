import { DeleteOutlined, RollbackOutlined, ClearOutlined } from '@ant-design/icons';
import { ProColumns, ProTable, type ActionType } from '@ant-design/pro-components';
import { App, Button, Space, Tag, Typography, message } from 'antd';
import { useRef } from 'react';
import {
  listRecycled,
  purgeAllRecycled,
  purgeRecycled,
  restoreRecycled,
  type RecycledRow,
} from '../../../api/recycleBin';
import { Permission } from '../../../components/Permission';

const { Text } = Typography;

const TABLE_LABELS: Record<string, string> = {
  sys_users: '用户',
  sys_roles: '角色',
  biz_customers: '客户',
  sys_files: '文件',
  sys_dict_types: '字典类型',
  sys_dict_items: '字典项',
  sys_notifications: '通知',
  sys_approvals: '审批',
  sys_workflows: '工作流',
  sys_message_templates: '消息模板',
};

function tableLabel(table: string): string {
  return TABLE_LABELS[table] || table;
}

export function RecycleBinPage() {
  const { modal } = App.useApp();
  const actionRef = useRef<ActionType>(null);

  const columns: ProColumns<RecycledRow>[] = [
    {
      title: '来源表',
      dataIndex: 'source_table',
      width: 130,
      valueType: 'select',
      valueEnum: Object.fromEntries(
        Object.entries(TABLE_LABELS).map(([k, v]) => [k, { text: v }]),
      ),
      render: (_, row) => <Tag>{tableLabel(row.source_table)}</Tag>,
    },
    { title: '记录ID', dataIndex: 'source_id', width: 90 },
    { title: '摘要', dataIndex: 'summary', ellipsis: true },
    {
      title: '删除人',
      dataIndex: 'deleted_by',
      width: 110,
      render: (_, row) => <Text>{row.deleted_by || '系统'}</Text>,
    },
    {
      title: '删除时间',
      dataIndex: 'deleted_at',
      width: 170,
      valueType: 'dateTime',
      sorter: true,
    },
    {
      title: '操作',
      valueType: 'option',
      width: 160,
      render: (_, row) => (
        <Space>
          <Permission code="settings:update">
            <Button type="link" size="small" icon={<RollbackOutlined />} onClick={() => handleRestore(row)}>
              恢复
            </Button>
          </Permission>
          <Permission code="settings:update">
            <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={() => confirmPurge(row)}>
              彻底删除
            </Button>
          </Permission>
        </Space>
      ),
    },
  ];

  async function handleRestore(row: RecycledRow) {
    try {
      await restoreRecycled(row.id);
      message.success(`已恢复 ${tableLabel(row.source_table)} 记录`);
      actionRef.current?.reload();
    } catch {
      message.error('恢复失败，原记录可能已不存在');
    }
  }

  function confirmPurge(row: RecycledRow) {
    modal.confirm({
      title: '确定彻底删除？',
      content: `此操作不可逆，将永久删除「${row.summary}」。`,
      okButtonProps: { danger: true },
      onOk: async () => {
        await purgeRecycled(row.id);
        message.success('已永久删除');
        actionRef.current?.reload();
      },
    });
  }

  function confirmClearAll() {
    modal.confirm({
      title: '确定清空回收站？',
      content: '此操作不可逆，将永久删除回收站中的所有记录。',
      okButtonProps: { danger: true },
      onOk: async () => {
        await purgeAllRecycled();
        message.success('回收站已清空');
        actionRef.current?.reload();
      },
    });
  }

  return (
    <div style={{ padding: '0 0 24px' }}>
      <ProTable<RecycledRow>
        actionRef={actionRef}
        columns={columns}
        request={async (params) => {
          const res = await listRecycled({
            source_table: params.source_table,
            keyword: params.keyword,
            page: params.current,
            page_size: params.pageSize,
          });
          return { data: res.items, total: res.total, success: true };
        }}
        rowKey="id"
        search={{ labelWidth: 'auto' }}
        headerTitle="回收站"
        toolBarRender={() => [
          <Permission code="settings:update" key="clear">
            <Button icon={<ClearOutlined />} danger onClick={confirmClearAll}>
              清空回收站
            </Button>
          </Permission>,
        ]}
        pagination={{ defaultPageSize: 20 }}
      />
    </div>
  );
}
