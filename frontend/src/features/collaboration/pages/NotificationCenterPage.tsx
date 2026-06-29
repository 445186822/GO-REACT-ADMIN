import { CheckOutlined, PlusOutlined, WifiOutlined } from '@ant-design/icons';
import { ModalForm, ProColumns, ProFormSelect, ProFormText, ProFormTextArea, ProTable, type ActionType } from '@ant-design/pro-components';
import { Badge, Button, Space, Tag, Tooltip } from 'antd';
import { message } from '../../../utils/message';
import { useEffect, useRef, useState } from 'react';
import {
  createNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  unreadNotificationCount,
  type NotificationRow,
} from '../../../api/collaboration';
import { useNotificationWebSocket } from '../../../hooks/useNotificationWebSocket';
import { operationColumnProps } from '../../../utils/tableColumns';

export function NotificationCenterPage() {
  const actionRef = useRef<ActionType>(null);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const { connected: wsConnected, onMessage } = useNotificationWebSocket();

  useEffect(() => {
    void refreshUnread();
  }, []);

  useEffect(() => {
    onMessage((data) => {
      if (data.event === 'unread_count') setUnread(data.count ?? 0);
      if (data.event === 'notifications_changed') {
        void refreshUnread();
        actionRef.current?.reload();
      }
    });
  }, [onMessage]);

  async function refreshUnread() {
    setUnread(await unreadNotificationCount());
  }

  const columns: ProColumns<NotificationRow>[] = [
    {
      title: '状态',
      width: 80,
      search: false,
      render: (_, row) => <Badge status={row.read_at ? 'default' : 'processing'} text={row.read_at ? '已读' : '未读'} />,
    },
    { title: '标题', dataIndex: 'title', ellipsis: true },
    { title: '类型', dataIndex: 'notif_type', width: 120 },
    { title: '来源', dataIndex: 'source_module', width: 120 },
    { title: '内容', dataIndex: 'content', search: false, ellipsis: true },
    { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime', search: false, width: 180 },
    {
      title: '操作',
      ...operationColumnProps<NotificationRow>(120),
      render: (_, row) =>
        row.read_at ? null : (
          <Button
            type="link"
            size="small"
            icon={<CheckOutlined />}
            onClick={async () => {
              await markNotificationRead(row.id);
              message.success('已标记为已读');
              await refreshUnread();
              actionRef.current?.reload();
            }}
          >
            已读
          </Button>
        ),
    },
  ];

  return (
    <div>
      <Space align="center" className="page-status-strip">
        <span>未读</span>
        <Badge count={unread} overflowCount={99} />
        <Tooltip title={wsConnected ? '实时连接正常' : '实时连接已断开'}>
          <Tag color={wsConnected ? 'green' : 'red'} style={{ marginLeft: 8 }}>
            <WifiOutlined /> {wsConnected ? '已连接' : '未连接'}
          </Tag>
        </Tooltip>
      </Space>
      <ProTable<NotificationRow>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        request={async (params) => {
          const page = await listNotifications({ page: params.current, page_size: params.pageSize });
          return { data: page.items, total: page.total, success: true };
        }}
        pagination={{ defaultPageSize: 10 }}
        scroll={{ x: 'max-content' }}
        toolBarRender={() => [
          <Button
            key="read-all"
            onClick={async () => {
              await markAllNotificationsRead();
              message.success('全部已读');
              await refreshUnread();
              actionRef.current?.reload();
            }}
          >
            全部已读
          </Button>,
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
            新建通知
          </Button>,
        ]}
      />
      <ModalForm
        title="新建通知"
        open={open}
        modalProps={{ destroyOnHidden: true, onCancel: () => setOpen(false) }}
        initialValues={{ notif_type: 'system', source_module: 'system' }}
        onFinish={async (values) => {
          await createNotification(values);
          message.success('通知已发送');
          setOpen(false);
          actionRef.current?.reload();
          return true;
        }}
      >
        <ProFormText name="title" label="标题" rules={[{ required: true }]} />
        <ProFormSelect
          name="notif_type"
          label="类型"
          options={[
            { label: '系统', value: 'system' },
            { label: '业务', value: 'business' },
            { label: '审批', value: 'approval' },
          ]}
        />
        <ProFormText name="source_module" label="来源模块" rules={[{ required: true }]} />
        <ProFormTextArea name="content" label="内容" fieldProps={{ rows: 4 }} rules={[{ required: true }]} />
      </ModalForm>
    </div>
  );
}
