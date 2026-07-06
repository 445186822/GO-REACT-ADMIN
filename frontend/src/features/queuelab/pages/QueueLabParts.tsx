import { Alert, Button, Card, Col, List, Popconfirm, Row, Space, Table, Tag, Timeline, Typography } from 'antd';
import type { ConceptData, StepLog } from '../../../api/queueLab';
import { historyPageSize } from '../queueLabView';

export function ConceptPanel({ title, summary, concepts }: { title: string; summary: string; concepts: ConceptData }) {
  return (
    <Space direction="vertical" size={12} style={{ width: '100%' }}>
      <Alert type="info" showIcon message={title} description={summary} />
      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Card size="small" title="相同点">
            <List
              size="small"
              dataSource={concepts.shared}
              renderItem={(item) => <List.Item><Tag color="blue">共通</Tag>{item}</List.Item>}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card size="small" title="不同点">
            <List
              size="small"
              dataSource={concepts.differences}
              renderItem={(item) => <List.Item><Tag color="gold">差异</Tag>{item}</List.Item>}
            />
          </Card>
        </Col>
      </Row>
    </Space>
  );
}

export function OperationLogs({ logs }: { logs: StepLog[] }) {
  if (logs.length === 0) {
    return <Alert type="warning" showIcon message="暂无执行日志" description="点击上方操作按钮后，这里会按顺序显示后端真实执行步骤。" />;
  }
  return (
    <Timeline
      items={logs.map((item) => ({
        color: item.status === 'ERROR' ? 'red' : 'green',
        children: (
          <Space direction="vertical" size={2}>
            <Typography.Text strong>{item.step}. {item.detail}</Typography.Text>
            <Typography.Text type="secondary">{item.at}</Typography.Text>
          </Space>
        ),
      }))}
    />
  );
}

export type HistoryEntry = {
  id: string;
  action: string;
  detail: string;
  at: string;
};

export function OperationHistory({ entries, onClear }: { entries: HistoryEntry[]; onClear?: () => void }) {
  if (entries.length === 0) {
    return <Alert type="warning" showIcon message="暂无本页历史" description="操作后会记录动作、结果和时间；RabbitMQ 已 ack 的消息不会因为这里记录而回到 broker。" />;
  }
  return (
    <Space direction="vertical" size={8} style={{ width: '100%' }}>
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Typography.Text type="secondary">共 {entries.length} 条，仅保存在当前浏览器</Typography.Text>
        {onClear ? (
          <Popconfirm title="清空本页历史？" okText="清空" cancelText="取消" onConfirm={onClear}>
            <Button size="small">清空历史</Button>
          </Popconfirm>
        ) : null}
      </Space>
      <Table<HistoryEntry>
        size="small"
        rowKey="id"
        dataSource={entries}
        pagination={{ pageSize: historyPageSize, showSizeChanger: false }}
        columns={[
          { title: '操作', dataIndex: 'action', width: 120 },
          { title: '摘要', dataIndex: 'detail' },
          { title: '时间', dataIndex: 'at', width: 170 },
        ]}
      />
    </Space>
  );
}
