import type { BrokerTargetType, ConceptData, IoTProtocol, KafkaTopicRow, RabbitMQQueueRow } from '../../api/queueLab';

export const kafkaConcepts: ConceptData = {
  shared: ['发送消息', '消费者读取消息', '适合异步解耦', '生产者和消费者可以不直接互相调用'],
  differences: ['写入 topic，topic 再分成 partition', '每条消息有 offset，按 offset 保留', '消费后不会删除，可用 offset 重复读取', '适合事件流、日志、行为轨迹和回放'],
};

export const rabbitMQConcepts: ConceptData = {
  shared: ['发送消息', '消费者读取消息', '适合异步解耦', '生产者和消费者可以不直接互相调用'],
  differences: ['消息先到 exchange，再路由到 queue；本体验使用 default exchange', '消费者处理后 ack', 'ack 后消息会被取走', '适合任务分发、工作队列和即时处理'],
};

export const kafkaHistoryNote = 'Kafka 的历史由 broker 按 topic/partition/offset 保留；本页读取接口直接按 offset 读取 broker，不是读取页面日志。';

export const rabbitMQHistoryNote = 'RabbitMQ 的队列消息被消费者 ack 后通常不保留历史；本页历史记录的是你的体验操作和消费结果。';

export const rabbitMQQueueListNote = '队列总数表示 RabbitMQ broker 当前可见的 queue 数量，包含 demo.queue 以及 TCP/UDP/MQTT 页面自动声明的 iot.* 队列；堆积消息是这些队列当前未 ack 的消息总和。';

export const kafkaTopicListNote = '业务 Topic 表示 Kafka broker 当前可见的非内部 topic 数量；IoT 页面写入 Kafka 时会自动确认或创建 iot.* topic。';

export const historyPageSize = 10;

export const kafkaReadOffsetModes = [
  { label: '最近', value: 'latest' },
  { label: '从头', value: 'earliest' },
  { label: '指定 offset', value: 'custom' },
] as const;

export type IoTProtocolProfile = {
  protocol: IoTProtocol;
  title: string;
  menuName: string;
  summary: string;
  devicePlaceholder: string;
  payloadPlaceholder: string;
  defaultTarget: { type: BrokerTargetType; name: string };
  defaultPayload: string;
  concepts: ConceptData;
};

export const iotProtocolProfiles: Record<IoTProtocol, IoTProtocolProfile> = {
  tcp: {
    protocol: 'tcp',
    title: 'TCP IoT 体验',
    menuName: 'TCP体验',
    summary: 'TCP 在物联网里常用于设备和网关保持长连接，适合可靠、顺序的遥测帧；本页把 TCP 入站数据桥接到 Kafka 或 RabbitMQ。',
    devicePlaceholder: 'meter-001',
    payloadPlaceholder: 'voltage=220,current=12.4',
    defaultTarget: { type: 'kafka', name: 'iot.tcp.telemetry' },
    defaultPayload: 'voltage=220,current=12.4',
    concepts: {
      shared: ['IoT 设备上报遥测数据', '协议网关接入设备消息', '最终桥接到 Kafka 或 RabbitMQ 供业务消费'],
      differences: ['TCP 面向连接，适合设备长连接', '适合电表、充电桩、工业控制器这类需要可靠顺序的上报', '业务侧可以在 Kafka/RabbitMQ 里消费网关转换后的消息'],
    },
  },
  udp: {
    protocol: 'udp',
    title: 'UDP IoT 体验',
    menuName: 'UDP体验',
    summary: 'UDP 在物联网里适合高频、轻量、低延迟的数据报，例如心跳、定位点和环境传感器；本页把 UDP 数据报桥接到 Kafka 或 RabbitMQ。',
    devicePlaceholder: 'tracker-018',
    payloadPlaceholder: 'lat=31.2304,lng=121.4737,battery=82',
    defaultTarget: { type: 'kafka', name: 'iot.udp.telemetry' },
    defaultPayload: 'lat=31.2304,lng=121.4737,battery=82',
    concepts: {
      shared: ['IoT 设备上报遥测数据', '协议网关接入设备消息', '最终桥接到 Kafka 或 RabbitMQ 供业务消费'],
      differences: ['UDP 无连接，单个数据报开销低', '适合可容忍少量丢包的高频心跳、定位和传感器读数', '后端 broker 负责削峰、异步处理和后续消费'],
    },
  },
  mqtt: {
    protocol: 'mqtt',
    title: 'MQTT IoT 体验',
    menuName: 'MQTT体验',
    summary: 'MQTT 是物联网常见发布/订阅协议，设备按主题发布状态；本页把 MQTT topic 消息桥接到 Kafka 或 RabbitMQ。',
    devicePlaceholder: 'sensor-007',
    payloadPlaceholder: '{"temperature":26.5,"humidity":61}',
    defaultTarget: { type: 'rabbitmq', name: 'iot.mqtt.events' },
    defaultPayload: '{"temperature":26.5,"humidity":61}',
    concepts: {
      shared: ['IoT 设备上报遥测数据', '协议网关接入设备消息', '最终桥接到 Kafka 或 RabbitMQ 供业务消费'],
      differences: ['MQTT 使用发布/订阅和主题', '适合弱网、低功耗设备，能表达 QoS 语义', '平台常把 MQTT 主题消息转入 Kafka/RabbitMQ，供业务服务消费'],
    },
  },
};

export function applyRabbitMQQueueState(rows: RabbitMQQueueRow[], state?: RabbitMQQueueRow | null): RabbitMQQueueRow[] {
  if (!state) {
    return rows;
  }
  const index = rows.findIndex((row) => row.name === state.name && row.vhost === state.vhost);
  if (index === -1) {
    return [state, ...rows];
  }
  return rows.map((row, rowIndex) => (rowIndex === index ? { ...row, ...state } : row));
}

export function removeKafkaTopicState(rows: KafkaTopicRow[], topic: string): KafkaTopicRow[] {
  return rows.filter((row) => row.topic !== topic);
}

export function removeRabbitMQQueueState(rows: RabbitMQQueueRow[], queue: string): RabbitMQQueueRow[] {
  return rows.filter((row) => row.name !== queue);
}

export function targetNameForProtocol(protocol: IoTProtocol, targetType: BrokerTargetType) {
  return targetType === 'kafka' ? `iot.${protocol}.telemetry` : `iot.${protocol}.events`;
}

export function mergeConcepts(fallback: ConceptData, remote?: ConceptData): ConceptData {
  if (!remote || remote.shared.length === 0 || remote.differences.length === 0) {
    return fallback;
  }
  return remote;
}

export function toTopicSelectOptions(rows: KafkaTopicRow[]) {
  return rows
    .filter((row) => !row.internal)
    .map((row) => ({ label: row.topic, value: row.topic }));
}

export function toQueueSelectOptions(rows: RabbitMQQueueRow[]) {
  return rows.map((row) => ({ label: row.name, value: row.name }));
}
