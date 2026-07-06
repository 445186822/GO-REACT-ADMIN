import { DatabaseOutlined, HistoryOutlined, InboxOutlined, ReloadOutlined, SendOutlined } from '@ant-design/icons';
import { Alert, App, AutoComplete, Button, Card, Col, Form, Input, InputNumber, Row, Segmented, Space, Statistic, Table, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import {
  consumeKafkaMessages,
  createKafkaTopic,
  getKafkaConcepts,
  listKafkaTopics,
  sendKafkaMessage,
  type ConceptData,
  type KafkaMessageRow,
  type KafkaTopicRow,
  type StepLog,
} from '../../../api/queueLab';
import { kafkaConcepts, kafkaHistoryNote, kafkaReadOffsetModes, mergeConcepts, toTopicSelectOptions } from '../queueLabView';
import { ConceptPanel, OperationHistory, OperationLogs, type HistoryEntry } from './QueueLabParts';

const historyKey = 'queue-lab:kafka-history';

type KafkaForm = {
  topic: string;
  partitions: number;
  key: string;
  value: string;
  offsetMode: 'latest' | 'earliest' | 'custom';
  customOffset: number;
  limit: number;
};

export function KafkaLabPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm<KafkaForm>();
  const [concepts, setConcepts] = useState<ConceptData>(kafkaConcepts);
  const [logs, setLogs] = useState<StepLog[]>([]);
  const [messages, setMessages] = useState<KafkaMessageRow[]>([]);
  const [topics, setTopics] = useState<KafkaTopicRow[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory(historyKey));
  const [loading, setLoading] = useState('');
  const offsetMode = Form.useWatch('offsetMode', form);

  useEffect(() => {
    getKafkaConcepts().then((data) => setConcepts(mergeConcepts(kafkaConcepts, data))).catch(() => setConcepts(kafkaConcepts));
    void refreshTopics(false, false, false);
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

  async function refreshTopics(showMessage = true, updateLogs = true, showLoading = true) {
    if (showLoading) {
      setLoading('topics');
    }
    try {
      const res = await listKafkaTopics();
      if (updateLogs) {
        setLogs(res.logs);
      }
      setTopics(res.result.topics || []);
      if (showMessage) {
        message.success(`读取到 ${res.result.topics?.length ?? 0} 个 topic`);
      }
    } finally {
      if (showLoading) {
        setLoading('');
      }
    }
  }

  async function run(action: 'topic' | 'send' | 'consume') {
    setLoading(action);
    try {
      if (action === 'topic') {
        const values = await form.validateFields(['topic', 'partitions']);
        const res = await createKafkaTopic({ topic: values.topic, partitions: values.partitions || 1 });
        setLogs(res.logs);
        remember('创建/确认 topic', `${values.topic}，分区 ${values.partitions || 1}，${res.result.created ? '新建成功' : '已存在可用'}`);
        message.success(res.result.created ? 'topic 已创建' : 'topic 已可用');
        await refreshTopics(false, false, false);
      }
      if (action === 'send') {
        const values = await form.validateFields(['topic', 'key', 'value']);
        const res = await sendKafkaMessage({ topic: values.topic, key: values.key || '', value: values.value });
        setLogs(res.logs);
        remember('发送 Kafka 消息', `${values.topic} / key=${values.key || '-'} / ${res.result.sent ? '已写入' : '未成功'}`);
        message.success(res.result.sent ? '消息已发送' : '消息发送未成功');
        await refreshTopics(false, false, false);
      }
      if (action === 'consume') {
        const values = await form.validateFields(['topic', 'offsetMode', 'customOffset', 'limit']);
        const offset = values.offsetMode === 'custom' ? String(values.customOffset ?? 0) : values.offsetMode || 'latest';
        const res = await consumeKafkaMessages({ topic: values.topic, offset, limit: values.limit || 5 });
        setLogs(res.logs);
        setMessages(res.result.messages || []);
        remember('读取 Kafka 消息', `${values.topic} 从 ${offset} 读取 ${res.result.messages?.length ?? 0} 条`);
        message.success(`读取到 ${res.result.messages?.length ?? 0} 条消息`);
        await refreshTopics(false, false, false);
      }
    } finally {
      setLoading('');
    }
  }

  const userTopicCount = topics.filter((item) => !item.internal).length;
  const totalMessages = topics.reduce((sum, item) => sum + Math.max(item.message_count, 0), 0);

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={15}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <ConceptPanel title="Kafka 体验" summary="Kafka 像可回放的事件日志：消息进入 topic 后按 partition/offset 保留，消费不会把消息取走。" concepts={concepts} />
          <Alert type="success" showIcon message="历史查询说明" description={kafkaHistoryNote} />
          <Card
            size="small"
            title={<Space><DatabaseOutlined />当前 Topic</Space>}
            extra={<Button icon={<ReloadOutlined />} loading={loading === 'topics'} onClick={() => void refreshTopics()}>刷新</Button>}
          >
            <Row gutter={16} style={{ marginBottom: 12 }}>
              <Col span={12}><Statistic title="业务 Topic" value={userTopicCount} /></Col>
              <Col span={12}><Statistic title="估算消息数" value={totalMessages} /></Col>
            </Row>
            <Table<KafkaTopicRow>
              size="small"
              rowKey={(row) => row.topic}
              dataSource={topics}
              pagination={{ pageSize: 8 }}
              columns={[
                { title: 'Topic', dataIndex: 'topic', render: (value, row) => <Space><Typography.Text>{value}</Typography.Text>{row.internal ? <Tag>内部</Tag> : null}</Space> },
                { title: 'Partitions', dataIndex: 'partitions', width: 100 },
                { title: 'Offset 范围', width: 160, render: (_, row) => row.first_offset >= 0 ? `${row.first_offset} - ${row.last_offset}` : '-' },
                { title: '消息数', dataIndex: 'message_count', width: 90 },
                { title: 'Leader', dataIndex: 'leader', width: 150 },
              ]}
            />
          </Card>
          <Card size="small" title={<Space><InboxOutlined />读取结果</Space>}>
            <Table<KafkaMessageRow>
              size="small"
              rowKey={(row) => `${row.partition}:${row.offset}`}
              dataSource={messages}
              pagination={false}
              columns={[
                { title: 'Partition', dataIndex: 'partition', width: 90 },
                { title: 'Offset', dataIndex: 'offset', width: 90 },
                { title: 'Key', dataIndex: 'key', width: 130 },
                { title: 'Value', dataIndex: 'value' },
                { title: 'Time', dataIndex: 'time', width: 170 },
              ]}
            />
          </Card>
        </Space>
      </Col>

      <Col xs={24} xl={9}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card size="small" title={<Space><SendOutlined />操作体验</Space>}>
            <Form
              form={form}
              layout="vertical"
              initialValues={{ topic: 'demo.events', partitions: 1, key: 'user-1', value: 'hello kafka', offsetMode: 'latest', customOffset: 0, limit: 5 }}
            >
              <Row gutter={12}>
                <Col span={16}>
                  <Form.Item name="topic" label="Topic" rules={[{ required: true, message: '请输入 topic' }]}>
                    <AutoComplete options={toTopicSelectOptions(topics)} placeholder="选择已有 topic 或输入新 topic" filterOption />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="partitions" label="分区数">
                    <InputNumber min={1} max={12} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Button type="primary" icon={<DatabaseOutlined />} loading={loading === 'topic'} onClick={() => void run('topic')}>创建/确认 topic</Button>

              <Typography.Title level={5} style={{ marginTop: 18 }}>发送消息</Typography.Title>
              <Form.Item name="key" label="Key">
                <Input />
              </Form.Item>
              <Form.Item name="value" label="消息内容" rules={[{ required: true, message: '请输入消息内容' }]}>
                <Input />
              </Form.Item>
              <Button type="primary" icon={<SendOutlined />} loading={loading === 'send'} onClick={() => void run('send')}>发送消息</Button>

              <Typography.Title level={5} style={{ marginTop: 18 }}>读取消息</Typography.Title>
              <Row gutter={12}>
                <Col span={24}>
                  <Form.Item name="offsetMode" label="读取位置">
                    <Segmented block options={[...kafkaReadOffsetModes]} />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={12}>
                {offsetMode === 'custom' ? (
                  <Col span={14}>
                    <Form.Item name="customOffset" label="开始 offset" rules={[{ required: true, message: '请输入开始 offset' }]}>
                      <InputNumber min={0} precision={0} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                ) : null}
                <Col span={offsetMode === 'custom' ? 10 : 24}>
                  <Form.Item name="limit" label="条数">
                    <InputNumber min={1} max={100} style={{ width: '100%' }} />
                  </Form.Item>
                </Col>
              </Row>
              <Button type="primary" icon={<InboxOutlined />} loading={loading === 'consume'} onClick={() => void run('consume')}>按 offset 读取</Button>
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
