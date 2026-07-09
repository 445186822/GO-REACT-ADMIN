import { BellOutlined, ClockCircleOutlined, ReadOutlined } from '@ant-design/icons';
import { Button, Descriptions, Modal, Space, Tag, Typography } from 'antd';
import type { AnnouncementRow } from '../../../api/announcement';

type AnnouncementDetailModalProps = {
  open: boolean;
  announcement: AnnouncementRow | null;
  onClose: () => void;
};

export function AnnouncementDetailModal({ open, announcement, onClose }: AnnouncementDetailModalProps) {
  const readTimeText = (myReadAt?: string | null) => {
    if (!myReadAt) return '未读';
    if (myReadAt === '__just_read__') return '刚刚标记已读';
    return myReadAt;
  };

  const statusText = (status: string) => {
    switch (status) {
      case 'published': return '已发布';
      case 'draft': return '草稿';
      case 'archived': return '已归档';
      case 'expired': return '已过期';
      default: return status;
    }
  };

  const categoryText = (cat: string) => {
    switch (cat) {
      case 'notice': return '通知';
      case 'announcement': return '公告';
      case 'reminder': return '提醒';
      default: return cat;
    }
  };

  const priorityTag = (p: string) => {
    switch (p) {
      case 'urgent': return <Tag color="red">紧急</Tag>;
      default: return <Tag color="blue">普通</Tag>;
    }
  };

  return (
    <Modal
      title={
        <Space>
          <BellOutlined />
          公告详情
        </Space>
      }
      open={open}
      width="min(680px, calc(100vw - 32px))"
      onCancel={onClose}
      footer={
        <Button type="primary" onClick={onClose}>
          关闭
        </Button>
      }
      destroyOnHidden
    >
      {announcement ? (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div className="notification-detail-header">
            <div className="notification-detail-title-block">
              <Typography.Title level={5} className="notification-detail-title">
                {announcement.title}
              </Typography.Title>
              <Typography.Text type="secondary">
                {categoryText(announcement.category)} · {announcement.created_at}
              </Typography.Text>
            </div>
            <Space>
              {priorityTag(announcement.priority)}
              <Tag color={announcement.my_read_at ? 'default' : 'blue'}>
                {announcement.my_read_at ? '已读' : '未读'}
              </Tag>
            </Space>
          </div>

          <Descriptions size="small" column={{ xs: 1, sm: 1, md: 2 }} bordered className="notification-detail-descriptions">
            <Descriptions.Item label="类别">{categoryText(announcement.category)}</Descriptions.Item>
            <Descriptions.Item label="状态">{statusText(announcement.status)}</Descriptions.Item>
            <Descriptions.Item label={<Space size={4}><ClockCircleOutlined />创建时间</Space>}>
              {announcement.created_at}
            </Descriptions.Item>
            <Descriptions.Item label={<Space size={4}><ReadOutlined />阅读状态</Space>}>
              {readTimeText(announcement.my_read_at)}
            </Descriptions.Item>
            {announcement.expired_at && (
              <Descriptions.Item label="过期时间">{announcement.expired_at}</Descriptions.Item>
            )}
            <Descriptions.Item label="阅读进度">
              {announcement.read_count ?? 0} / {announcement.total_count ?? 0}
            </Descriptions.Item>
          </Descriptions>

          <section className="notification-detail-content">
            <Typography.Text strong>公告内容</Typography.Text>
            <Typography.Paragraph className="notification-detail-body">
              {announcement.content}
            </Typography.Paragraph>
          </section>
        </Space>
      ) : null}
    </Modal>
  );
}
