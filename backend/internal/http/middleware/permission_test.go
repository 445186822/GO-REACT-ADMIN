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
	}

	for _, tt := range tests {
		if got := PermissionForRequest(tt.method, tt.path); got != tt.want {
			t.Fatalf("PermissionForRequest(%q, %q) = %q, want %q", tt.method, tt.path, got, tt.want)
		}
	}
}

func TestPermissionForRequestAllowsUnmappedRoutes(t *testing.T) {
	if got := PermissionForRequest("GET", "/api/v1/health"); got != "" {
		t.Fatalf("PermissionForRequest returned %q, want empty permission", got)
	}
}

func TestPermissionForRequestDoesNotExposeApprovalTemplates(t *testing.T) {
	if got := PermissionForRequest("GET", "/api/v1/approval/templates"); got != "" {
		t.Fatalf("PermissionForRequest approval templates = %q, want empty permission", got)
	}
}
