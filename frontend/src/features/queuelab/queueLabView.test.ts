import { describe, expect, it } from 'vitest';
import {
  applyRabbitMQQueueState,
  historyPageSize,
  iotProtocolProfiles,
  kafkaConcepts,
  kafkaHistoryNote,
  kafkaReadOffsetModes,
  rabbitMQConcepts,
  rabbitMQHistoryNote,
  toQueueSelectOptions,
  toTopicSelectOptions,
} from './queueLabView';

describe('queue lab view concepts', () => {
  it('explains both shared queue behavior and product-specific differences', () => {
    expect(kafkaConcepts.shared).toContain('发送消息');
    expect(rabbitMQConcepts.shared).toContain('发送消息');
    expect(kafkaConcepts.differences.join(' ')).toContain('offset');
    expect(kafkaConcepts.differences.join(' ')).toContain('重复读取');
    expect(kafkaConcepts.differences.join(' ')).toContain('topic');
    expect(rabbitMQConcepts.differences.join(' ')).toContain('ack');
    expect(rabbitMQConcepts.differences.join(' ')).toContain('取走');
    expect(rabbitMQConcepts.differences.join(' ')).toContain('exchange');
  });
  it('explains history limitations explicitly', () => {
    expect(kafkaHistoryNote).toContain('offset');
    expect(rabbitMQHistoryNote).toContain('不保留');
  });
  it('allows Kafka reads from a custom offset', () => {
    expect(kafkaReadOffsetModes.map((item) => item.value)).toContain('custom');
  });
  it('applies RabbitMQ operation state to the queue list immediately', () => {
    const rows = applyRabbitMQQueueState(
      [{ name: 'demo.queue', vhost: '/', messages: 2, consumers: 0, durable: true }],
      { name: 'demo.queue', vhost: '/', messages: 3, consumers: 0, durable: true },
    );

    expect(rows[0].messages).toBe(3);
  });
  it('uses a compact page size for local operation history', () => {
    expect(historyPageSize).toBe(10);
  });
  it('describes TCP, UDP, and MQTT as IoT ingress protocols that bridge into brokers', () => {
    expect(Object.keys(iotProtocolProfiles)).toEqual(['tcp', 'udp', 'mqtt']);
    expect(iotProtocolProfiles.tcp.defaultTarget.type).toBe('kafka');
    expect(iotProtocolProfiles.udp.defaultTarget.type).toBe('kafka');
    expect(iotProtocolProfiles.mqtt.defaultTarget.type).toBe('rabbitmq');
    expect(iotProtocolProfiles.tcp.concepts.shared.join(' ')).toContain('IoT');
    expect(iotProtocolProfiles.udp.concepts.differences.join(' ')).toContain('UDP');
    expect(iotProtocolProfiles.mqtt.concepts.differences.join(' ')).toContain('主题');
  });
  it('builds dropdown options from non-internal Kafka topics and RabbitMQ queues', () => {
    expect(toTopicSelectOptions([
      { topic: '__consumer_offsets', partitions: 1, first_offset: 0, last_offset: 0, message_count: 0, leader: 'broker', internal: true },
      { topic: 'iot.tcp.telemetry', partitions: 1, first_offset: 0, last_offset: 1, message_count: 1, leader: 'broker', internal: false },
    ])).toEqual([{ label: 'iot.tcp.telemetry', value: 'iot.tcp.telemetry' }]);
    expect(toQueueSelectOptions([
      { name: 'iot.mqtt.events', vhost: '/', messages: 2, consumers: 0, durable: true },
    ])).toEqual([{ label: 'iot.mqtt.events', value: 'iot.mqtt.events' }]);
  });
});
