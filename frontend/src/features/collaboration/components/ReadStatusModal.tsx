import { CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, TeamOutlined } from '@ant-design/icons';
import { Avatar, Button, Modal, Progress, Space, Tabs, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { getAnnouncementReadStatus, type ReadStatusResponse } from '../../../api/announcement';

type ReadStatusModalProps = {
  open: boolean;
  announcementId: number;
  title: string;
  onClose: () => void;
};

export function ReadStatusModal({ open, announcementId, title, onClose }: ReadStatusModalProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<ReadStatusResponse | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && announcementId > 0) {
      setLoading(true);
      setStatus(null);
      setError('');
      getAnnouncementReadStatus(announcementId)
        .then(setStatus)
        .catch(() => setError('阅读情况加载失败，请稍后重试'))
        .finally(() => setLoading(false));
    }
  }, [open, announcementId]);

  const readPct = status && status.total > 0 ? Math.round((status.read_count / status.total) * 100) : 0;

  return (
    <Modal
      title={
        <Space>
          <TeamOutlined />
          阅读情况：{title}
        </Space>
      }
      open={open}
      width="min(520px, calc(100vw - 32px))"
      onCancel={onClose}
      footer={<Button type="primary" onClick={onClose}>关闭</Button>}
      destroyOnHidden
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#667085' }}>加载中...</div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#f04438' }}>{error}</div>
      ) : status ? (
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          {/* Progress summary */}
          <div
            style={{
              padding: '16px 20px',
              background: '#f8fafc',
              border: '1px solid #eef2f6',
              borderRadius: 8,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Typography.Text strong>阅读进度</Typography.Text>
              <Tag color={readPct === 100 ? 'green' : 'blue'}>
                {status.read_count} / {status.total}
              </Tag>
            </div>
            <Progress
              percent={readPct}
              strokeColor={readPct === 100 ? '#52c41a' : '#1677ff'}
              style={{ margin: 0 }}
            />
          </div>

          {/* Tab: readers / unreaders */}
          <Tabs
            items={[
              {
                key: 'read',
                label: (
                  <span>
                    <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 6 }} />
                    已读 ({status.readers.length})
                  </span>
                ),
                children: (
                  <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                    {status.readers.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 20, color: '#667085' }}>暂无</div>
                    ) : (
                      status.readers.map((r) => (
                        <div
                          key={r.user_id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 4px',
                            borderBottom: '1px solid #f0f0f0',
                          }}
                        >
                          <Avatar size={28} icon={<TeamOutlined />} />
                          <span style={{ flex: 1, fontWeight: 500 }}>{r.display_name}</span>
                          <Space size={4}>
                            <ClockCircleOutlined style={{ fontSize: 12, color: '#667085' }} />
                            <span style={{ fontSize: 12, color: '#667085' }}>{r.read_at}</span>
                          </Space>
                          <CheckCircleOutlined style={{ color: '#52c41a' }} />
                        </div>
                      ))
                    )}
                  </div>
                ),
              },
              {
                key: 'unread',
                label: (
                  <span>
                    <CloseCircleOutlined style={{ color: '#f04438', marginRight: 6 }} />
                    未读 ({status.unreaders.length})
                  </span>
                ),
                children: (
                  <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                    {status.unreaders.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 20, color: '#667085' }}>全部已读</div>
                    ) : (
                      status.unreaders.map((r) => (
                        <div
                          key={r.user_id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 4px',
                            borderBottom: '1px solid #f0f0f0',
                          }}
                        >
                          <Avatar size={28} icon={<TeamOutlined />} />
                          <span style={{ flex: 1, fontWeight: 500 }}>{r.display_name}</span>
                          <Tag color="red" style={{ margin: 0 }}>未读</Tag>
                        </div>
                      ))
                    )}
                  </div>
                ),
              },
            ]}
          />
        </Space>
      ) : null}
    </Modal>
  );
}
