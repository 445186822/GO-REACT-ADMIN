import {
  CheckOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  TeamOutlined,
  WifiOutlined,
} from '@ant-design/icons';
import { ModalForm, ProColumns, ProFormDatePicker, ProFormSelect, ProFormText, ProFormTextArea, ProTable, type ActionType } from '@ant-design/pro-components';
import { Badge, Button, DatePicker, Progress, Space, Tag, Tooltip, message } from 'antd';
import { useEffect, useRef, useState } from 'react';
import {
  listAnnouncements,
  createAnnouncement,
  markAnnouncementRead,
  expireAnnouncement,
  unreadAnnouncementCount,
  getAnnouncementReadStatus,
  type AnnouncementCreateRequest,
  type AnnouncementRow,
  type ReadStatusResponse,
} from '../../../api/announcement';
import { AnnouncementDetailModal } from '../components/AnnouncementDetailModal';
import { ReadStatusModal } from '../components/ReadStatusModal';
import { useNotificationWebSocket } from '../../../hooks/useNotificationWebSocket';
import { operationColumnProps } from '../../../utils/tableColumns';

export function AnnouncementCenterPage() {
  const actionRef = useRef<ActionType>(null);
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<AnnouncementRow | null>(null);
  const [readStatusModal, setReadStatusModal] = useState<{ open: boolean; announcementId: number; title: string }>({
    open: false,
    announcementId: 0,
    title: '',
  });
  const [scope, setScope] = useState('all');
  const [category, setCategory] = useState('');

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
    setUnread(await unreadAnnouncementCount());
  }

  async function openAnnouncementDetail(row: AnnouncementRow) {
    setSelectedAnnouncement(row);
    if (!row.my_read_at) {
      await markAnnouncementRead(row.id);
      setSelectedAnnouncement({ ...row, my_read_at: '__just_read__' });
      await refreshUnread();
      actionRef.current?.reload();
    }
  }

  async function handleExpire(row: AnnouncementRow) {
    await expireAnnouncement(row.id);
    message.success('公告已过期');
    actionRef.current?.reload();
    await refreshUnread();
  }

  async function handleViewReadStatus(row: AnnouncementRow) {
    setReadStatusModal({ open: true, announcementId: row.id, title: row.title });
  }

  function renderReadProgress(row: AnnouncementRow) {
    const total = row.total_count ?? 0;
    const read = row.read_count ?? 0;
    const pct = total > 0 ? Math.round((read / total) * 100) : 0;
    return (
      <Space size={4}>
        <Progress
          type="line"
          percent={pct}
          size="small"
          style={{ width: 60, margin: 0 }}
          strokeColor={pct === 100 ? '#52c41a' : undefined}
        />
        <span style={{ fontSize: 12, color: '#667085', whiteSpace: 'nowrap' }}>
          {read}/{total}
        </span>
      </Space>
    );
  }

  function statusTag(status: string) {
    switch (status) {
      case 'published': return <Tag color="blue">已发布</Tag>;
      case 'draft': return <Tag>草稿</Tag>;
      case 'archived': return <Tag color="orange">已归档</Tag>;
      case 'expired': return <Tag color="default">已过期</Tag>;
      default: return <Tag>{status}</Tag>;
    }
  }

  function categoryTag(cat: string) {
    switch (cat) {
      case 'notice': return <Tag color="geekblue">通知</Tag>;
      case 'announcement': return <Tag color="purple">公告</Tag>;
      case 'reminder': return <Tag color="cyan">提醒</Tag>;
      default: return <Tag>{cat}</Tag>;
    }
  }

  const columns: ProColumns<AnnouncementRow>[] = [
    {
      title: '状态',
      width: 80,
      search: false,
      render: (_, row) => (
        <Badge status={row.my_read_at ? 'default' : 'processing'} text={row.my_read_at ? '已读' : '未读'} />
      ),
    },
    {
      title: '公告状态',
      width: 90,
      search: false,
      render: (_, row) => statusTag(row.status),
    },
    { title: '标题', dataIndex: 'title', ellipsis: true, width: 180 },
    {
      title: '类别',
      dataIndex: 'category',
      width: 80,
      render: (_, row) => categoryTag(row.category),
    },
    {
      title: '阅读情况',
      width: 140,
      search: false,
      render: (_, row) => renderReadProgress(row),
    },
    { title: '创建时间', dataIndex: 'created_at', valueType: 'dateTime', search: false, width: 170 },
    {
      title: '操作',
      ...operationColumnProps<AnnouncementRow>(160),
      render: (_, row) => (
        <Space size={0}>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => void openAnnouncementDetail(row)}>
            详情
          </Button>
          <Button type="link" size="small" icon={<TeamOutlined />} onClick={() => void handleViewReadStatus(row)}>
            已读列表
          </Button>
          {row.status !== 'expired' && (
            <Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => void handleExpire(row)}>
              过期
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space align="center" wrap className="page-status-strip notification-status-strip">
        <span>未读公告：{unread} 条</span>
        <Tooltip title={wsConnected ? '实时连接正常' : '实时连接已断开'}>
          <Tag color={wsConnected ? 'green' : 'red'}>
            <WifiOutlined /> 实时连接：{wsConnected ? '已连接' : '已断开'}
          </Tag>
        </Tooltip>
        <Button size="small" icon={<ReloadOutlined />} onClick={reconnect}>
          重连
        </Button>
      </Space>
      <ProTable<AnnouncementRow>
        actionRef={actionRef}
        rowKey="id"
        columns={columns}
        scroll={{ x: 'max-content' }}
        params={{ scope, category }}
        request={async (params) => {
          const page = await listAnnouncements({
            page: params.current,
            page_size: params.pageSize,
            scope: scope === 'all' ? undefined : scope,
            category: category || undefined,
          });
          return { data: page.items, total: page.total, success: true };
        }}
        pagination={{ defaultPageSize: 10 }}
        headerTitle={
          <Space>
            <Button
              type={scope === 'all' ? 'primary' : 'default'}
              size="small"
              onClick={() => setScope('all')}
            >
              全部
            </Button>
            <Button
              type={scope === 'expired' ? 'primary' : 'default'}
              size="small"
              onClick={() => setScope('expired')}
            >
              已过期
            </Button>
            <Button
              type={scope === 'mine' ? 'primary' : 'default'}
              size="small"
              onClick={() => setScope('mine')}
            >
              我发布的
            </Button>
          </Space>
        }
        toolBarRender={() => [
          <Button
            key="read-all"
            onClick={async () => {
              // Mark all visible announcements as read
              message.warning('请在公告详情中逐一标记已读');
            }}
          >
            全部已读
          </Button>,
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={() => setOpen(true)}>
            新建公告
          </Button>,
        ]}
      />
      <ModalForm
        title="新建公告"
        open={open}
        modalProps={{ destroyOnHidden: true, onCancel: () => setOpen(false), width: 640 }}
        initialValues={{ category: 'notice', priority: 'normal' }}
        onFinish={async (values) => {
          await createAnnouncement(values as unknown as AnnouncementCreateRequest);
          message.success('公告已发送');
          setOpen(false);
          actionRef.current?.reload();
          void refreshUnread();
          return true;
        }}
      >
        <ProFormText name="title" label="标题" rules={[{ required: true }]} />
        <ProFormSelect
          name="category"
          label="类别"
          options={[
            { label: '通知', value: 'notice' },
            { label: '公告', value: 'announcement' },
            { label: '提醒', value: 'reminder' },
          ]}
        />
        <ProFormSelect
          name="priority"
          label="优先级"
          options={[
            { label: '普通', value: 'normal' },
            { label: '紧急', value: 'urgent' },
          ]}
        />
        <ProFormTextArea name="content" label="内容" fieldProps={{ rows: 6 }} rules={[{ required: true }]} />
        <ProFormDatePicker name="expired_at" label="过期时间" placeholder="选填，永不过期留空" />
      </ModalForm>
      <AnnouncementDetailModal
        open={Boolean(selectedAnnouncement)}
        announcement={selectedAnnouncement}
        onClose={() => setSelectedAnnouncement(null)}
      />
      <ReadStatusModal
        open={readStatusModal.open}
        announcementId={readStatusModal.announcementId}
        title={readStatusModal.title}
        onClose={() => setReadStatusModal({ open: false, announcementId: 0, title: '' })}
      />
    </div>
  );
}
