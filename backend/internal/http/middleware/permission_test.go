package middleware

import "testing"

func TestPermissionForRequestMapsEnterpriseActions(t *testing.T) {
	tests := []struct {
		method string
		path   string
		want   string
	}{
		{"GET", "/api/v1/workflows", "workflow:view"},
		{"POST", "/api/v1/workflows", "workflow:update"},
		{"DELETE", "/api/v1/workflows/12", "workflow:delete"},
		{"POST", "/api/v1/workflows/12/run", "workflow:run"},
		{"POST", "/api/v1/approval/instances/8/action", "approval:action"},
		{"GET", "/api/v1/todos", "todo:view"},
		{"PUT", "/api/v1/settings/system.name", "settings:update"},
		{"GET", "/api/v1/kb/articles", "kb:view"},
		{"PUT", "/api/v1/users/12/reset-password", "user:update"},
		{"GET", "/api/v1/ai/history", "ai:chat"},
		{"DELETE", "/api/v1/recycle-bin", "recycle:purge"},
		{"POST", "/api/v1/queue-lab/kafka/topics", "queue:kafka"},
		{"DELETE", "/api/v1/queue-lab/kafka/topics", "queue:kafka"},
		{"GET", "/api/v1/queue-lab/kafka/topics", "queue:kafka"},
		{"POST", "/api/v1/queue-lab/kafka/messages", "queue:kafka"},
		{"POST", "/api/v1/queue-lab/kafka/consume", "queue:kafka"},
		{"POST", "/api/v1/queue-lab/rabbitmq/queues", "queue:rabbitmq"},
		{"DELETE", "/api/v1/queue-lab/rabbitmq/queues", "queue:rabbitmq"},
		{"GET", "/api/v1/queue-lab/rabbitmq/queues", "queue:rabbitmq"},
		{"GET", "/api/v1/queue-lab/rabbitmq/exchanges", "queue:rabbitmq"},
		{"POST", "/api/v1/queue-lab/rabbitmq/messages", "queue:rabbitmq"},
		{"POST", "/api/v1/queue-lab/rabbitmq/consume", "queue:rabbitmq"},
		{"GET", "/api/v1/queue-lab/iot/tcp/concepts", "queue:tcp"},
		{"POST", "/api/v1/queue-lab/iot/tcp/messages", "queue:tcp"},
		{"GET", "/api/v1/queue-lab/iot/udp/concepts", "queue:udp"},
		{"POST", "/api/v1/queue-lab/iot/udp/messages", "queue:udp"},
		{"GET", "/api/v1/queue-lab/iot/mqtt/concepts", "queue:mqtt"},
		{"POST", "/api/v1/queue-lab/iot/mqtt/messages", "queue:mqtt"},
	}

	for _, tt := range tests {
		if got := PermissionForRequest(tt.method, tt.path); got != tt.want {
			t.Fatalf("PermissionForRequest(%q, %q) = %q, want %q", tt.method, tt.path, got, tt.want)
		}
	}
}

func TestPermissionForRequestMarksPublicRoutes(t *testing.T) {
	tests := []struct {
		method string
		path   string
	}{
		{"GET", "/health"},
		{"GET", "/api/v1/health"},
		{"POST", "/api/v1/auth/login"},
		{"POST", "/api/v1/auth/refresh"},
		{"GET", "/api/v1/auth/captcha"},
		{"POST", "/api/v1/auth/captcha/verify"},
	}

	for _, tt := range tests {
		if got := PermissionForRequest(tt.method, tt.path); got != PermissionPublic {
			t.Fatalf("PermissionForRequest(%q, %q) = %q, want %q", tt.method, tt.path, got, PermissionPublic)
		}
	}
}

func TestPermissionForRequestDeniesUnknownRoutes(t *testing.T) {
	tests := []struct {
		method string
		path   string
	}{
		{"GET", "/api/v1/unknown"},
		{"GET", "/api/v1/approval/templates"},
		{"POST", "/api/v1/users/12"},
	}

	for _, tt := range tests {
		if got := PermissionForRequest(tt.method, tt.path); got != PermissionDeny {
			t.Fatalf("PermissionForRequest(%q, %q) = %q, want %q", tt.method, tt.path, got, PermissionDeny)
		}
	}
}
