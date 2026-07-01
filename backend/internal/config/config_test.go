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
