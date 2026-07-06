import { http } from '../request/http';

export type StepLog = {
  step: number;
  status: 'OK' | 'ERROR';
  detail: string;
  at: string;
};

export type ConceptData = {
  shared: string[];
  differences: string[];
};

export type OperationResponse<T> = {
  logs: StepLog[];
  result: T;
  concepts: ConceptData;
};

export type IoTProtocol = 'tcp' | 'udp' | 'mqtt';

export type BrokerTargetType = 'kafka' | 'rabbitmq';

export type KafkaMessageRow = {
  topic: string;
  partition: number;
  offset: number;
  key: string;
  value: string;
  time: string;
};

export type KafkaTopicRow = {
  topic: string;
  partitions: number;
  first_offset: number;
  last_offset: number;
  message_count: number;
  leader: string;
  internal: boolean;
};

export type RabbitMQMessageRow = {
  queue: string;
  delivery_tag: number;
  value: string;
  redelivered: boolean;
  time: string;
};

export type RabbitMQQueueRow = {
  name: string;
  vhost: string;
  messages: number;
  consumers: number;
  durable: boolean;
};

export type RabbitMQExchangeRow = {
  name: string;
  vhost: string;
  type: string;
  durable: boolean;
  auto_delete: boolean;
  internal: boolean;
};

export type IoTEnvelope = {
  protocol: IoTProtocol;
  device_id: string;
  payload: string;
  iot_role: string;
  target_type: BrokerTargetType;
  target: string;
  mqtt_topic?: string;
  qos?: number;
  received_at: string;
};

export async function getKafkaConcepts() {
  const res = await http.get<unknown, { data: ConceptData }>('/queue-lab/kafka/concepts');
  return res.data;
}

export async function listKafkaTopics() {
  const res = await http.get<unknown, { data: OperationResponse<{ topics: KafkaTopicRow[] }> }>('/queue-lab/kafka/topics');
  return res.data;
}

export async function createKafkaTopic(payload: { topic: string; partitions: number }) {
  const res = await http.post<unknown, { data: OperationResponse<{ topic: string; created: boolean; partitions: number }> }>('/queue-lab/kafka/topics', payload);
  return res.data;
}

export async function deleteKafkaTopic(topic: string) {
  const res = await http.delete<unknown, { data: OperationResponse<{ deleted: boolean; topic: string }> }>('/queue-lab/kafka/topics', { params: { topic } });
  return res.data;
}

export async function sendKafkaMessage(payload: { topic: string; key: string; value: string }) {
  const res = await http.post<unknown, { data: OperationResponse<{ sent: boolean; topic: string; key: string; value: string }> }>('/queue-lab/kafka/messages', payload);
  return res.data;
}

export async function consumeKafkaMessages(payload: { topic: string; offset: string; limit: number }) {
  const res = await http.post<unknown, { data: OperationResponse<{ messages: KafkaMessageRow[]; last_offset: number }> }>('/queue-lab/kafka/consume', payload);
  return res.data;
}

export async function getRabbitMQConcepts() {
  const res = await http.get<unknown, { data: ConceptData }>('/queue-lab/rabbitmq/concepts');
  return res.data;
}

export async function listRabbitMQQueues() {
  const res = await http.get<unknown, { data: OperationResponse<{ queues: RabbitMQQueueRow[] }> }>('/queue-lab/rabbitmq/queues');
  return res.data;
}

export async function listRabbitMQExchanges() {
  const res = await http.get<unknown, { data: OperationResponse<{ exchanges: RabbitMQExchangeRow[] }> }>('/queue-lab/rabbitmq/exchanges');
  return res.data;
}

export async function declareRabbitMQQueue(payload: { queue: string }) {
  const res = await http.post<unknown, { data: OperationResponse<{ queue: string; declared: boolean; messages: number; queue_state?: RabbitMQQueueRow | null }> }>('/queue-lab/rabbitmq/queues', payload);
  return res.data;
}

export async function deleteRabbitMQQueue(queue: string) {
  const res = await http.delete<unknown, { data: OperationResponse<{ deleted: boolean; queue: string; message_count: number }> }>('/queue-lab/rabbitmq/queues', { params: { queue } });
  return res.data;
}

export async function sendRabbitMQMessage(payload: { queue: string; value: string }) {
  const res = await http.post<unknown, { data: OperationResponse<{ sent: boolean; queue: string; value: string; queue_state?: RabbitMQQueueRow | null }> }>('/queue-lab/rabbitmq/messages', payload);
  return res.data;
}

export async function consumeRabbitMQMessage(payload: { queue: string; ack: boolean }) {
  const res = await http.post<unknown, { data: OperationResponse<{ message: RabbitMQMessageRow | null; queue_state?: RabbitMQQueueRow | null }> }>('/queue-lab/rabbitmq/consume', payload);
  return res.data;
}

export async function getIoTProtocolConcepts(protocol: IoTProtocol) {
  const res = await http.get<unknown, { data: ConceptData }>(`/queue-lab/iot/${protocol}/concepts`);
  return res.data;
}

export async function sendIoTProtocolMessage(protocol: IoTProtocol, payload: {
  device_id: string;
  payload: string;
  target_type: BrokerTargetType;
  target: string;
  mqtt_topic?: string;
  qos?: number;
}) {
  const res = await http.post<unknown, { data: OperationResponse<{ delivered: boolean; protocol: IoTProtocol; target_type: BrokerTargetType; target: string; envelope: IoTEnvelope; message: string }> }>(
    `/queue-lab/iot/${protocol}/messages`,
    payload,
  );
  return res.data;
}
