import { ApiOutlined, DatabaseOutlined, HistoryOutlined, InboxOutlined, ReloadOutlined, SendOutlined } from '@ant-design/icons';
import { Alert, App, AutoComplete, Button, Card, Col, Form, Input, Row, Space, Statistic, Switch, Table, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import {
  consumeRabbitMQMessage,
  declareRabbitMQQueue,
  getRabbitMQConcepts,
  listRabbitMQExchanges,
  listRabbitMQQueues,
  sendRabbitMQMessage,
  type ConceptData,
  type RabbitMQExchangeRow,
  type RabbitMQMessageRow,
  type RabbitMQQueueRow,
  type StepLog,
} from '../../../api/queueLab';
import { applyRabbitMQQueueState, mergeConcepts, rabbitMQConcepts, rabbitMQHistoryNote, toQueueSelectOptions } from '../queueLabView';
import { ConceptPanel, OperationHistory, OperationLogs, type HistoryEntry } from './QueueLabParts';

const historyKey = 'queue-lab:rabbitmq-history';

type RabbitMQForm = {
  queue: string;
  value: string;
  ack: boolean;
};

export function RabbitMQLabPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm<RabbitMQForm>();
  const [concepts, setConcepts] = useState<ConceptData>(rabbitMQConcepts);
  const [logs, setLogs] = useState<StepLog[]>([]);
  const [messages, setMessages] = useState<RabbitMQMessageRow[]>([]);
  const [queues, setQueues] = useState<RabbitMQQueueRow[]>([]);
  const [exchanges, setExchanges] = useState<RabbitMQExchangeRow[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory(historyKey));
  const [loading, setLoading] = useState('');

  useEffect(() => {
    getRabbitMQConcepts().then((data) => setConcepts(mergeConcepts(rabbitMQConcepts, data))).catch(() => setConcepts(rabbitMQConcepts));
    void refreshQueues(false, false, false);
    void refreshExchanges(false, false, false);
  }, []);

  function remember(action: string, detail: string) {
    setHistory((prev) => {
      const next = [{ id: `${Date.now()}-${Math.random()}`, action, detail, at: nowText() }, ...prev].slice(0, 20);
      saveHistory(historyKey, next);
      return next;
    });
  }

  function clearHistory() {
    saveHistory(historyKey, []);
    setHistory([]);
  }

  async function refreshQueues(showMessage = true, updateLogs = true, showLoading = true) {
    if (showLoading) {
      setLoading('queues');
    }
    try {
      const res = await listRabbitMQQueues();
      if (updateLogs) {
        setLogs(res.logs);
      }
      setQueues(res.result.queues || []);
      if (showMessage) {
        message.success(`读取到 ${res.result.queues?.length ?? 0} 个 queue`);
      }
    } finally {
      if (showLoading) {
        setLoading('');
      }
    }
  }

  async function refreshExchanges(showMessage = true, updateLogs = true, showLoading = true) {
    if (showLoading) {
      setLoading('exchanges');
    }
    try {
      const res = await listRabbitMQExchanges();
      if (updateLogs) {
        setLogs(res.logs);
      }
      setExchanges(res.result.exchanges || []);
      if (showMessage) {
        message.success(`读取到 ${res.result.exchanges?.length ?? 0} 个 exchange`);
      }
    } finally {
      if (showLoading) {
        setLoading('');
      }
    }
  }

  async function run(action: 'queue' | 'send' | 'consume') {
    setLoading(action);
    try {
      if (action === 'queue') {
        const values = await form.validateFields(['queue']);
        const res = await declareRabbitMQQueue({ queue: values.queue });
        setLogs(res.logs);
        setQueues((prev) => applyRabbitMQQueueState(prev, res.result.queue_state));
        remember('声明/确认 queue', `${values.queue}，当前堆积 ${res.result.messages ?? 0} 条`);
        message.success(res.result.declared ? '队列已就绪' : '队列声明未成功');
        await refreshExchanges(false, false, false);
      }
      if (action === 'send') {
        const values = await form.validateFields(['queue', 'value']);
        const res = await sendRabbitMQMessage({ queue: values.queue, value: values.value });
        setLogs(res.logs);
        setQueues((prev) => applyRabbitMQQueueState(prev, res.result.queue_state));
        remember('发送 RabbitMQ 消息', `${values.queue}，${res.result.sent ? '已进入队列' : '未成功'}`);
        message.success(res.result.sent ? '消息已发送' : '消息发送未成功');
      }
      if (action === 'consume') {
        const values = await form.validateFields(['queue', 'ack']);
        const res = await consumeRabbitMQMessage({ queue: values.queue, ack: values.ack });
        setLogs(res.logs);
        setQueues((prev) => applyRabbitMQQueueState(prev, res.result.queue_state));
        setMessages((prev) => (res.result.message ? [res.result.message, ...prev].slice(0, 20) : prev));
        remember('消费 RabbitMQ 消息', `${values.queue}，${res.result.message ? (values.ack ? 'ack 后移除' : '未 ack 已重回队列') : '队列为空'}`);
        message.success(res.result.message ? '已取到一条消息' : '队列为空');
      }
    } finally {
      setLoading('');
    }
  }

  const totalMessages = queues.reduce((sum, item) => sum + item.messages, 0);
  const totalConsumers = queues.reduce((sum, item) => sum + item.consumers, 0);

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={15}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <ConceptPanel title="RabbitMQ 体验" summary="RabbitMQ 像任务队列：消息经 exchange 路由到 queue，消费者取出并 ack 后，消息通常从队列里移除。" concepts={concepts} />
          <Alert type="warning" showIcon message="历史查询说明" description={rabbitMQHistoryNote} />
          <Card
            size="small"
            title={<Space><DatabaseOutlined />当前 Queue</Space>}
            extra={<Button icon={<ReloadOutlined />} loading={loading === 'queues'} onClick={() => void refreshQueues()}>刷新队列</Button>}
          >
            <Row gutter={16} style={{ marginBottom: 12 }}>
              <Col span={8}><Statistic title="Queue" value={queues.length} /></Col>
              <Col span={8}><Statistic title="堆积消息" value={totalMessages} /></Col>
              <Col span={8}><Statistic title="消费者" value={totalConsumers} /></Col>
            </Row>
            <Table<RabbitMQQueueRow>
              size="small"
              rowKey={(row) => `${row.vhost}:${row.name}`}
              dataSource={queues}
              pagination={{ pageSize: 6 }}
              columns={[
                { title: 'Queue', dataIndex: 'name' },
                { title: 'VHost', dataIndex: 'vhost', width: 90 },
                { title: 'Messages', dataIndex: 'messages', width: 100 },
                { title: 'Consumers', dataIndex: 'consumers', width: 110 },
                { title: 'Durable', dataIndex: 'durable', width: 90, render: (value) => value ? <Tag color="green">是</Tag> : <Tag>否</Tag> },
              ]}
            />
          </Card>
          <Card
            size="small"
            title={<Space><ApiOutlined />Exchange</Space>}
            extra={<Button icon={<ReloadOutlined />} loading={loading === 'exchanges'} onClick={() => void refreshExchanges()}>刷新 Exchange</Button>}
          >
            <Table<RabbitMQExchangeRow>
              size="small"
              rowKey={(row) => `${row.vhost}:${row.name || 'default'}`}
              dataSource={exchanges}
              pagination={{ pageSize: 6 }}
              columns={[
                { title: 'Exchange', dataIndex: 'name', render: (value) => value || <Tag color="blue">default exchange</Tag> },
                { title: 'Type', dataIndex: 'type', width: 100 },
                { title: 'VHost', dataIndex: 'vhost', width: 90 },
                { title: 'Durable', dataIndex: 'durable', width: 90, render: (value) => value ? <Tag color="green">是</Tag> : <Tag>否</Tag> },
                { title: 'Internal', dataIndex: 'internal', width: 90, render: (value) => value ? '是' : '否' },
              ]}
            />
          </Card>
          <Card size="small" title={<Space><InboxOutlined />消费结果</Space>}>
            <Table<RabbitMQMessageRow>
              size="small"
              rowKey={(row) => `${row.delivery_tag}:${row.time}`}
              dataSource={messages}
              pagination={false}
              columns={[
                { title: 'Delivery Tag', dataIndex: 'delivery_tag', width: 120 },
                { title: 'Message', dataIndex: 'value' },
                { title: 'Redelivered', dataIndex: 'redelivered', width: 110, render: (value) => (value ? '是' : '否') },
                { title: 'Time', dataIndex: 'time', width: 160 },
              ]}
            />
          </Card>
        </Space>
      </Col>

      <Col xs={24} xl={9}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card size="small" title={<Space><SendOutlined />操作体验</Space>}>
            <Form form={form} layout="vertical" initialValues={{ queue: 'demo.queue', value: 'hello rabbitmq', ack: true }}>
              <Form.Item name="queue" label="Queue" rules={[{ required: true, message: '请输入 queue' }]}>
                <AutoComplete options={toQueueSelectOptions(queues)} placeholder="选择已有 queue 或输入新 queue" filterOption />
              </Form.Item>
              <Button type="primary" icon={<DatabaseOutlined />} loading={loading === 'queue'} onClick={() => void run('queue')}>声明/确认 queue</Button>

              <Typography.Title level={5} style={{ marginTop: 18 }}>发送消息</Typography.Title>
              <Form.Item name="value" label="消息内容" rules={[{ required: true, message: '请输入消息内容' }]}>
                <Input />
              </Form.Item>
              <Button type="primary" icon={<SendOutlined />} loading={loading === 'send'} onClick={() => void run('send')}>发送消息</Button>

              <Typography.Title level={5} style={{ marginTop: 18 }}>消费消息</Typography.Title>
              <Form.Item name="ack" label="取出后 ack" valuePropName="checked">
                <Switch checkedChildren="ack移除" unCheckedChildren="不ack重回队列" />
              </Form.Item>
              <Button type="primary" icon={<InboxOutlined />} loading={loading === 'consume'} onClick={() => void run('consume')}>消费一条</Button>
            </Form>
          </Card>
          <Card size="small" title="顺序执行日志"><OperationLogs logs={logs} /></Card>
          <Card size="small" title={<Space><HistoryOutlined />本页历史</Space>}><OperationHistory entries={history} onClear={clearHistory} /></Card>
        </Space>
      </Col>
    </Row>
  );
}

function loadHistory(key: string): HistoryEntry[] {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]') as HistoryEntry[];
  } catch {
    return [];
  }
}

function saveHistory(key: string, entries: HistoryEntry[]) {
  localStorage.setItem(key, JSON.stringify(entries));
}

function nowText() {
  return new Date().toLocaleString();
}
