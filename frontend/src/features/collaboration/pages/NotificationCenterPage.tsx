import { CheckOutlined, PlusOutlined } from '@ant-design/icons';
import { ModalForm, ProColumns, ProFormSelect, ProFormText, ProFormTextArea, ProTable, type ActionType } from '@ant-design/pro-components';
import { Badge, Button, Space, Typography, message } from 'antd';
import { useEffect, useRef, useState } from 'react';
import {
  createNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  unreadNotificationCount,
  type NotificationRow,
} from '../../../api/collaboration';
import { useAuthStore } from '../../../store/authStore';

export function NotificationCenterPage() {
  const actionRef = useRef<ActionType>(null);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const token = useAuthStore((state) => state.accessToken);

  useEffect(() => {
    void refreshUnread();
  }, []);

  useEffect(() => {
    if (!token) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/api/v1/notifications/ws?token=${encodeURIComponent(token)}`);
    ws.onmessage = (event) => {
      const payload = JSON.parse(event.data);
      if (payload.event === 'unread_count') setUnread(payload.count ?? 0);
      if (payload.event === 'notifications_changed') {
        void refreshUnread();
        actionRef.current?.reload();
      }
    };
    return () => ws.close();
  }, [token]);

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
      valueType: 'option',
      width: 100,
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
      <Space align="center">
        <Typography.Title level={3}>通知中心</Typography.Title>
        <Badge count={unread} overflowCount={99} />
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
