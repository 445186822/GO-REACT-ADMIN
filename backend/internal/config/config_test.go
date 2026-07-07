package config

import "testing"

func TestLoadReadsAIConfiguration(t *testing.T) {
	t.Setenv("AI_ASSISTANT_ENDPOINT", "https://assistant.example.test/chat")
	t.Setenv("AI_ASSISTANT_API_KEY", "assistant-key")
	t.Setenv("AI_STREAM_BASE_URL", "https://stream.example.test")
	t.Setenv("AI_STREAM_API_KEY", "stream-key")
	t.Setenv("AI_STREAM_MODEL", "model-test")

	cfg := Load()

	if cfg.AIAssistantEndpoint != "https://assistant.example.test/chat" {
		t.Fatalf("AIAssistantEndpoint = %q", cfg.AIAssistantEndpoint)
	}
	if cfg.AIAssistantAPIKey != "assistant-key" {
		t.Fatalf("AIAssistantAPIKey = %q", cfg.AIAssistantAPIKey)
	}
	if cfg.AIStreamBaseURL != "https://stream.example.test" {
		t.Fatalf("AIStreamBaseURL = %q", cfg.AIStreamBaseURL)
	}
	if cfg.AIStreamAPIKey != "stream-key" {
		t.Fatalf("AIStreamAPIKey = %q", cfg.AIStreamAPIKey)
	}
	if cfg.AIStreamModel != "model-test" {
		t.Fatalf("AIStreamModel = %q", cfg.AIStreamModel)
	}
}

func TestLoadReadsQueueLabConfiguration(t *testing.T) {
	t.Setenv("KAFKA_BROKERS", "kafka-a:9092,kafka-b:9092")
	t.Setenv("RABBITMQ_URL", "amqp://demo:secret@rabbitmq:5672/")
	t.Setenv("RABBITMQ_MANAGEMENT_URL", "http://rabbitmq:15672")
	t.Setenv("RABBITMQ_MANAGEMENT_USER", "demo")
	t.Setenv("RABBITMQ_MANAGEMENT_PASS", "secret")

	cfg := Load()

	if cfg.KafkaBrokers != "kafka-a:9092,kafka-b:9092" {
		t.Fatalf("KafkaBrokers = %q", cfg.KafkaBrokers)
	}
	if cfg.RabbitMQURL != "amqp://demo:secret@rabbitmq:5672/" {
		t.Fatalf("RabbitMQURL = %q", cfg.RabbitMQURL)
	}
	if cfg.RabbitMQManagementURL != "http://rabbitmq:15672" {
		t.Fatalf("RabbitMQManagementURL = %q", cfg.RabbitMQManagementURL)
	}
	if cfg.RabbitMQManagementUser != "demo" {
		t.Fatalf("RabbitMQManagementUser = %q", cfg.RabbitMQManagementUser)
	}
	if cfg.RabbitMQManagementPass != "secret" {
		t.Fatalf("RabbitMQManagementPass = %q", cfg.RabbitMQManagementPass)
	}
}

func TestLoadReadsRuntimeStartupFlags(t *testing.T) {
	t.Setenv("AUTO_MIGRATE", "false")
	t.Setenv("AUTO_SEED", "0")
	t.Setenv("SCHEDULER_ENABLED", "no")

	cfg := Load()

	if cfg.AutoMigrate {
		t.Fatal("AutoMigrate = true, want false")
	}
	if cfg.AutoSeed {
		t.Fatal("AutoSeed = true, want false")
	}
	if cfg.SchedulerEnabled {
		t.Fatal("SchedulerEnabled = true, want false")
	}
}

func TestConfigAllowedOriginsSplitsConfiguredList(t *testing.T) {
	cfg := Config{AllowedOrigin: " http://127.0.0.1:15173, http://localhost:15173 "}

	got := cfg.AllowedOrigins()

	if len(got) != 2 || got[0] != "http://127.0.0.1:15173" || got[1] != "http://localhost:15173" {
		t.Fatalf("AllowedOrigins() = %#v, want trimmed origins", got)
	}
}

func TestLoadEnablesRuntimeStartupFlagsByDefault(t *testing.T) {
	cfg := Load()

	if !cfg.AutoMigrate {
		t.Fatal("AutoMigrate = false, want true")
	}
	if !cfg.AutoSeed {
		t.Fatal("AutoSeed = false, want true")
	}
	if !cfg.SchedulerEnabled {
		t.Fatal("SchedulerEnabled = false, want true")
	}
}
