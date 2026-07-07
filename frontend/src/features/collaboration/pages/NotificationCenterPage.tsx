import { EyeOutlined, PlusOutlined, ReloadOutlined, WifiOutlined } from '@ant-design/icons';
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
import { NotificationDetailModal } from '../components/NotificationDetailModal';
import { notificationNeedsRead, notificationReadPlaceholder } from '../notificationDetail';
import { useNotificationWebSocket } from '../../../hooks/useNotificationWebSocket';
import { operationColumnProps } from '../../../utils/tableColumns';

export function NotificationCenterPage() {
  const actionRef = useRef<ActionType>(null);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [selectedNotification, setSelectedNotification] = useState<NotificationRow | null>(null);

  const { connected: wsConnected, onMessage, reconnect } = useNotificationWebSocket();

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

  async function openNotificationDetail(row: NotificationRow) {
    setSelectedNotification(row);
    if (notificationNeedsRead(row)) {
      await markNotificationRead(row.id);
      setSelectedNotification({ ...row, read_at: notificationReadPlaceholder() });
      await refreshUnread();
      actionRef.current?.reload();
    }
  }

  const columns: ProColumns<NotificationRow>[] = [
    {
      title: '状态',
      width: 80,
      search: false,
      render: (_, row) => <Badge status={row.read_at ? 'default' : 'processing'} text={row.read_at ? '已读' : '未读'} />,
    },
    { title: '标题', dataIndex: 'title', ellipsis: true, width: 200 },
    { title: '类型', dataIndex: 'notif_type', width: 120 },
    { title: '来源', dataIndex: 'source_module', width: 120 },
    { title: '内容', dataIndex: 'content', search: false, ellipsis: true, width: 220 },
    { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime', search: false, width: 180 },
    {
      title: '操作',
      ...operationColumnProps<NotificationRow>(120),
      render: (_, row) => (
        <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => void openNotificationDetail(row)}>
          详情
        </Button>
      ),
    },
  ];

  return (
    <div>
      <Space align="center" wrap className="page-status-strip notification-status-strip">
        <span>未读消息：{unread} 条</span>
        <Tooltip title={wsConnected ? '实时连接正常' : '实时连接已断开'}>
          <Tag color={wsConnected ? 'green' : 'red'}>
            <WifiOutlined /> 实时连接：{wsConnected ? '已连接' : '已断开'}
          </Tag>
        </Tooltip>
        <Button size="small" icon={<ReloadOutlined />} onClick={reconnect}>
          重连
        </Button>
      </Space>
      <ProTable<NotificationRow>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        scroll={{ x: 'max-content' }}
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
      <NotificationDetailModal
        open={Boolean(selectedNotification)}
        notification={selectedNotification}
        onClose={() => setSelectedNotification(null)}
      />
    </div>
  );
}
