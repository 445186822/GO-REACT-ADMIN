package queuelab

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestIoTEnvelopeCarriesProtocolAndBrokerTarget(t *testing.T) {
	req := IoTMessageRequest{
		DeviceID:   "meter-001",
		Payload:    "temperature=26.5",
		TargetType: "kafka",
		Target:     "iot.telemetry",
	}

	envelope, body, err := buildIoTEnvelope("tcp", req)
	if err != nil {
		t.Fatalf("buildIoTEnvelope returned error: %v", err)
	}

	if envelope.Protocol != "tcp" {
		t.Fatalf("Protocol = %q, want tcp", envelope.Protocol)
	}
	if envelope.DeviceID != "meter-001" {
		t.Fatalf("DeviceID = %q, want meter-001", envelope.DeviceID)
	}
	if envelope.TargetType != "kafka" || envelope.Target != "iot.telemetry" {
		t.Fatalf("target = %s/%s, want kafka/iot.telemetry", envelope.TargetType, envelope.Target)
	}
	if !strings.Contains(envelope.IoTRole, "长连接") {
		t.Fatalf("IoTRole = %q, want TCP IoT role", envelope.IoTRole)
	}

	var decoded IoTEnvelope
	if err := json.Unmarshal([]byte(body), &decoded); err != nil {
		t.Fatalf("message body is not JSON: %v", err)
	}
	if decoded.Payload != "temperature=26.5" || decoded.TargetType != "kafka" {
		t.Fatalf("decoded envelope = %+v, want original payload and target type", decoded)
	}
}

func TestBuildIoTEnvelopeRejectsInvalidProtocolAndTarget(t *testing.T) {
	_, _, err := buildIoTEnvelope("coap", IoTMessageRequest{DeviceID: "d1", Payload: "on", TargetType: "kafka", Target: "iot.telemetry"})
	if err == nil {
		t.Fatal("buildIoTEnvelope accepted an unsupported protocol")
	}

	_, _, err = buildIoTEnvelope("mqtt", IoTMessageRequest{DeviceID: "d1", Payload: "on", TargetType: "redis", Target: "iot.events"})
	if err == nil {
		t.Fatal("buildIoTEnvelope accepted an unsupported target type")
	}
}

func TestKafkaTopicConfigDefaultsForAutomaticConfirmation(t *testing.T) {
	config := kafkaTopicConfig("iot.tcp.telemetry", 0)
	if config.Topic != "iot.tcp.telemetry" {
		t.Fatalf("Topic = %q, want iot.tcp.telemetry", config.Topic)
	}
	if config.NumPartitions != 1 {
		t.Fatalf("NumPartitions = %d, want 1", config.NumPartitions)
	}
	if config.ReplicationFactor != 1 {
		t.Fatalf("ReplicationFactor = %d, want 1", config.ReplicationFactor)
	}
}
