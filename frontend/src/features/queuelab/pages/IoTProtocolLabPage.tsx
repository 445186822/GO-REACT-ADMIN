import { ApiOutlined, CloudUploadOutlined, HistoryOutlined, InboxOutlined, SendOutlined } from '@ant-design/icons';
import { Alert, App, Button, Card, Col, Form, Input, InputNumber, Row, Segmented, Space, Table, Tag, Typography } from 'antd';
import { useEffect, useState } from 'react';
import {
  getIoTProtocolConcepts,
  sendIoTProtocolMessage,
  type BrokerTargetType,
  type ConceptData,
  type IoTEnvelope,
  type IoTProtocol,
  type StepLog,
} from '../../../api/queueLab';
import { iotProtocolProfiles, mergeConcepts } from '../queueLabView';
import { ConceptPanel, OperationHistory, OperationLogs, type HistoryEntry } from './QueueLabParts';

type IoTProtocolForm = {
  device_id: string;
  payload: string;
  target_type: BrokerTargetType;
  target: string;
  mqtt_topic: string;
  qos: number;
};

export function TCPLabPage() {
  return <IoTProtocolLab protocol="tcp" />;
}

export function UDPLabPage() {
  return <IoTProtocolLab protocol="udp" />;
}

export function MQTTLabPage() {
  return <IoTProtocolLab protocol="mqtt" />;
}

function IoTProtocolLab({ protocol }: { protocol: IoTProtocol }) {
  const { message } = App.useApp();
  const profile = iotProtocolProfiles[protocol];
  const [form] = Form.useForm<IoTProtocolForm>();
  const [concepts, setConcepts] = useState<ConceptData>(profile.concepts);
  const [logs, setLogs] = useState<StepLog[]>([]);
  const [envelopes, setEnvelopes] = useState<IoTEnvelope[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>(() => loadHistory(historyKey(protocol)));
  const [loading, setLoading] = useState(false);
  const targetType = Form.useWatch('target_type', form);

  useEffect(() => {
    getIoTProtocolConcepts(protocol).then((data) => setConcepts(mergeConcepts(profile.concepts, data))).catch(() => setConcepts(profile.concepts));
  }, [profile.concepts, protocol]);

  function remember(action: string, detail: string) {
    setHistory((prev) => {
      const next = [{ id: `${Date.now()}-${Math.random()}`, action, detail, at: nowText() }, ...prev].slice(0, 20);
      saveHistory(historyKey(protocol), next);
      return next;
    });
  }

  function clearHistory() {
    saveHistory(historyKey(protocol), []);
    setHistory([]);
  }

  async function submit() {
    setLoading(true);
    try {
      const values = await form.validateFields();
      const res = await sendIoTProtocolMessage(protocol, {
        device_id: values.device_id,
        payload: values.payload,
        target_type: values.target_type,
        target: values.target,
        mqtt_topic: values.mqtt_topic,
        qos: values.qos,
      });
      setLogs(res.logs);
      setConcepts(mergeConcepts(profile.concepts, res.concepts));
      setEnvelopes((prev) => [res.result.envelope, ...prev].slice(0, 20));
      remember('设备上报', `${values.device_id} -> ${values.target_type === 'kafka' ? 'Kafka topic' : 'RabbitMQ queue'} ${values.target}`);
      message.success(res.result.delivered ? '消息已桥接到 broker' : '消息未投递成功，请看执行日志');
    } finally {
      setLoading(false);
    }
  }

  function applyTargetType(value: BrokerTargetType) {
    form.setFieldValue('target_type', value);
    const currentTarget = form.getFieldValue('target');
    if (!currentTarget || currentTarget === profile.defaultTarget.name || currentTarget.startsWith(`iot.${protocol}.`)) {
      form.setFieldValue('target', value === 'kafka' ? `iot.${protocol}.telemetry` : `iot.${protocol}.events`);
    }
  }

  const targetName = targetType === 'rabbitmq' ? 'RabbitMQ Queue' : 'Kafka Topic';

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} xl={15}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <ConceptPanel title={profile.title} summary={profile.summary} concepts={concepts} />
          <Alert
            type="success"
            showIcon
            message="消费路径"
            description={`设备消息先进入 ${protocol.toUpperCase()} 协议网关，再被封装成 JSON 投递到 ${targetName}。投递成功后，可到 Kafka体验或 RabbitMQ体验菜单消费。`}
          />
          <Card size="small" title={<Space><InboxOutlined />最近上报事件</Space>}>
            <Table<IoTEnvelope>
              size="small"
              rowKey={(row) => `${row.protocol}:${row.device_id}:${row.received_at}`}
              dataSource={envelopes}
              pagination={{ pageSize: 6, showSizeChanger: false }}
              columns={[
                { title: 'Protocol', dataIndex: 'protocol', width: 90, render: (value) => <Tag color="blue">{String(value).toUpperCase()}</Tag> },
                { title: 'Device', dataIndex: 'device_id', width: 130 },
                { title: 'Broker', width: 150, render: (_, row) => `${row.target_type}/${row.target}` },
                { title: 'Payload', dataIndex: 'payload' },
                { title: 'Time', dataIndex: 'received_at', width: 170 },
              ]}
            />
          </Card>
          <Card size="small" title={<Space><ApiOutlined />消息体 JSON</Space>}>
            <Typography.Paragraph copyable style={{ whiteSpace: 'pre-wrap', marginBottom: 0 }}>
              {envelopes[0] ? JSON.stringify(envelopes[0], null, 2) : '上报一次设备消息后，这里会展示实际写入 Kafka/RabbitMQ 的 JSON。'}
            </Typography.Paragraph>
          </Card>
        </Space>
      </Col>

      <Col xs={24} xl={9}>
        <Space direction="vertical" size={16} style={{ width: '100%' }}>
          <Card size="small" title={<Space><CloudUploadOutlined />模拟设备上报</Space>}>
            <Form
              form={form}
              layout="vertical"
              initialValues={{
                device_id: profile.devicePlaceholder,
                payload: profile.defaultPayload,
                target_type: profile.defaultTarget.type,
                target: profile.defaultTarget.name,
                mqtt_topic: `devices/${profile.devicePlaceholder}/telemetry`,
                qos: protocol === 'mqtt' ? 1 : 0,
              }}
            >
              <Form.Item name="device_id" label="设备 ID" rules={[{ required: true, message: '请输入设备 ID' }]}>
                <Input placeholder={profile.devicePlaceholder} />
              </Form.Item>
              {protocol === 'mqtt' ? (
                <Row gutter={12}>
                  <Col span={16}>
                    <Form.Item name="mqtt_topic" label="MQTT Topic">
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item name="qos" label="QoS">
                      <InputNumber min={0} max={2} precision={0} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
              ) : null}
              <Form.Item name="payload" label="设备载荷" rules={[{ required: true, message: '请输入设备载荷' }]}>
                <Input.TextArea rows={4} placeholder={profile.payloadPlaceholder} />
              </Form.Item>
              <Form.Item name="target_type" label="投递目标">
                <Segmented
                  block
                  options={[
                    { label: 'Kafka', value: 'kafka' },
                    { label: 'RabbitMQ', value: 'rabbitmq' },
                  ]}
                  onChange={(value) => applyTargetType(value as BrokerTargetType)}
                />
              </Form.Item>
              <Form.Item name="target" label={targetName} rules={[{ required: true, message: `请输入 ${targetName}` }]}>
                <Input />
              </Form.Item>
              <Button type="primary" icon={<SendOutlined />} loading={loading} onClick={() => void submit()}>上报并桥接</Button>
            </Form>
          </Card>
          <Card size="small" title="顺序执行日志"><OperationLogs logs={logs} /></Card>
          <Card size="small" title={<Space><HistoryOutlined />本页历史</Space>}><OperationHistory entries={history} onClear={clearHistory} /></Card>
        </Space>
      </Col>
    </Row>
  );
}

function historyKey(protocol: IoTProtocol) {
  return `queue-lab:iot-${protocol}-history`;
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
