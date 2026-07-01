package collaboration

import "testing"

func TestNewHandlerStoresAIConfig(t *testing.T) {
	cfg := AIConfig{
		AssistantEndpoint: "https://assistant.example.test/chat",
		AssistantAPIKey:   "assistant-key",
		StreamBaseURL:     "https://stream.example.test",
		StreamAPIKey:      "stream-key",
		StreamModel:       "model-test",
	}

	handler := NewHandler(nil, "secret", "https://admin.example.test", cfg)

	if handler.ai.AssistantEndpoint != cfg.AssistantEndpoint {
		t.Fatalf("AssistantEndpoint = %q", handler.ai.AssistantEndpoint)
	}
	if handler.ai.AssistantAPIKey != cfg.AssistantAPIKey {
		t.Fatalf("AssistantAPIKey = %q", handler.ai.AssistantAPIKey)
	}
	if handler.ai.StreamBaseURL != cfg.StreamBaseURL {
		t.Fatalf("StreamBaseURL = %q", handler.ai.StreamBaseURL)
	}
	if handler.ai.StreamAPIKey != cfg.StreamAPIKey {
		t.Fatalf("StreamAPIKey = %q", handler.ai.StreamAPIKey)
	}
	if handler.ai.StreamModel != cfg.StreamModel {
		t.Fatalf("StreamModel = %q", handler.ai.StreamModel)
	}
}
