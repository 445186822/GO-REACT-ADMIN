import { BellOutlined, ClockCircleOutlined, ReadOutlined } from '@ant-design/icons';
import { Button, Descriptions, Modal, Space, Tag, Typography } from 'antd';
import type { NotificationRow } from '../../../api/collaboration';
import { notificationReadText, notificationReadTimeText, notificationTypeText } from '../notificationDetail';

type NotificationDetailModalProps = {
  open: boolean;
  notification: NotificationRow | null;
  onClose: () => void;
  onOpenCenter?: () => void;
};

export function NotificationDetailModal({ open, notification, onClose, onOpenCenter }: NotificationDetailModalProps) {
  return (
    <Modal
      title={
        <Space>
          <BellOutlined />
          消息详情
        </Space>
      }
      open={open}
      width={680}
      onCancel={onClose}
      footer={
        <Space>
          {onOpenCenter ? <Button onClick={onOpenCenter}>查看全部</Button> : null}
          <Button type="primary" onClick={onClose}>关闭</Button>
        </Space>
      }
      destroyOnHidden
    >
      {notification ? (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <div className="notification-detail-header">
            <div className="notification-detail-title-block">
              <Typography.Title level={5} className="notification-detail-title">
                {notification.title}
              </Typography.Title>
              <Typography.Text type="secondary">
                {notification.source_module || 'system'} · {notification.created_at}
              </Typography.Text>
            </div>
            <Tag color={notification.read_at ? 'default' : 'blue'}>{notificationReadText(notification)}</Tag>
          </div>

          <Descriptions size="small" column={2} bordered>
            <Descriptions.Item label="类型">{notificationTypeText(notification.notif_type)}</Descriptions.Item>
            <Descriptions.Item label="来源">{notification.source_module || '-'}</Descriptions.Item>
            <Descriptions.Item label={<Space size={4}><ClockCircleOutlined />创建时间</Space>}>
              {notification.created_at}
            </Descriptions.Item>
            <Descriptions.Item label={<Space size={4}><ReadOutlined />阅读时间</Space>}>
              {notificationReadTimeText(notification.read_at)}
            </Descriptions.Item>
          </Descriptions>

          <section className="notification-detail-content">
            <Typography.Text strong>消息内容</Typography.Text>
            <Typography.Paragraph className="notification-detail-body">
              {notification.content}
            </Typography.Paragraph>
          </section>
        </Space>
      ) : null}
    </Modal>
  );
}
