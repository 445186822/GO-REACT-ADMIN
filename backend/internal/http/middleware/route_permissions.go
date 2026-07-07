package middleware

import (
	"net/http"
	"regexp"
	"strings"
)

func PermissionForRequest(method string, rawPath string) string {
	path := normalizeRequestPath(rawPath)
	path = normalizeIDSegments(path)

	switch {
	case isPublicRoute(method, path):
		return PermissionPublic
	case path == "/users":
		return permissionByMethod(method, "user:view", "user:create", "", "")
	case path == "/users/:id/reset-password":
		return permissionByMethod(method, "", "", "user:update", "")
	case path == "/users/:id":
		return permissionByMethod(method, "", "", "user:update", "user:delete")
	case path == "/roles":
		return permissionByMethod(method, "role:view", "role:create", "role:update", "")
	case path == "/roles/:id":
		return permissionByMethod(method, "role:view", "", "role:update", "role:delete")
	case strings.HasPrefix(path, "/roles/") && strings.HasSuffix(path, "/menus"):
		return permissionByMethod(method, "role:view", "role:update", "role:update", "role:update")
	case path == "/menus":
		return permissionByMethod(method, "menu:view", "menu:create", "", "")
	case path == "/menus/:id":
		return permissionByMethod(method, "menu:view", "", "menu:update", "menu:delete")
	case path == "/departments":
		return "department:view"
	case path == "/customers":
		return permissionByMethod(method, "customer:view", "customer:create", "", "")
	case path == "/customers/export":
		return "customer:view"
	case path == "/customers/import-template":
		return "customer:create"
	case path == "/customers/import":
		return "customer:create"
	case path == "/customers/:id":
		return permissionByMethod(method, "", "", "customer:update", "customer:delete")
	case path == "/complex-forms":
		return permissionByMethod(method, "complex-form:view", "complex-form:create", "", "")
	case path == "/complex-forms/:id":
		return permissionByMethod(method, "", "", "complex-form:update", "complex-form:delete")
	case path == "/files":
		return "file:view"
	case path == "/files/upload":
		return "file:upload"
	case path == "/files/:id":
		return permissionByMethod(method, "", "", "", "file:delete")
	case path == "/files/:id/download":
		return "file:view"
	case path == "/audit-logs" || path == "/audit-logs/:id":
		return "audit:view"
	case strings.HasPrefix(path, "/settings"):
		if method == http.MethodGet {
			return "settings:view"
		}
		return "settings:update"
	case strings.HasPrefix(path, "/dashboard"):
		if method == http.MethodGet {
			return "dashboard"
		}
		return "settings:update"
	case strings.HasPrefix(path, "/dict"):
		return dictPermission(path, method)
	case strings.HasPrefix(path, "/recycle-bin"):
		return recyclePermission(path, method)
	case strings.HasPrefix(path, "/scheduler"):
		return schedulerPermission(path, method)
	case strings.HasPrefix(path, "/monitor"):
		return "monitor:view"
	case strings.HasPrefix(path, "/queue-lab/kafka"):
		return "queue:kafka"
	case strings.HasPrefix(path, "/queue-lab/rabbitmq"):
		return "queue:rabbitmq"
	case strings.HasPrefix(path, "/queue-lab/iot/tcp"):
		return "queue:tcp"
	case strings.HasPrefix(path, "/queue-lab/iot/udp"):
		return "queue:udp"
	case strings.HasPrefix(path, "/queue-lab/iot/mqtt"):
		return "queue:mqtt"
	case strings.HasPrefix(path, "/kb"):
		if method == http.MethodGet {
			return "kb:view"
		}
		return "kb:update"
	case path == "/todos":
		return "todo:view"
	case strings.HasPrefix(path, "/notifications"):
		if method == http.MethodPost {
			return "notification:create"
		}
		return "notification:view"
	case strings.HasPrefix(path, "/message-templates"):
		return permissionByMethod(method, "message-template:view", "message-template:create", "message-template:update", "message-template:delete")
	case path == "/approval/instances":
		return permissionByMethod(method, "approval:view", "approval:submit", "", "")
	case strings.HasPrefix(path, "/approval/instances/:id/action"):
		return "approval:action"
	case strings.HasPrefix(path, "/approval/instances"):
		return "approval:view"
	case path == "/workflows":
		return permissionByMethod(method, "workflow:view", "workflow:update", "workflow:update", "workflow:delete")
	case path == "/workflows/:id/run":
		return "workflow:run"
	case strings.HasPrefix(path, "/workflows"):
		return permissionByMethod(method, "workflow:view", "", "workflow:update", "workflow:delete")
	case strings.HasPrefix(path, "/ai-assistant/messages"), strings.HasPrefix(path, "/ai/history"):
		return "ai:chat"
	case strings.HasPrefix(path, "/ai-assistant/chat"), strings.HasPrefix(path, "/ai/chat"):
		return "ai:send"
	case strings.HasPrefix(path, "/chat"):
		return "chat:view"
	default:
		return PermissionDeny
	}
}

func normalizeRequestPath(rawPath string) string {
	path := strings.TrimPrefix(rawPath, "/api/v1")
	if path == "" {
		return "/"
	}
	if len(path) > 1 {
		path = strings.TrimSuffix(path, "/")
	}
	return path
}

func isPublicRoute(method string, path string) bool {
	switch path {
	case "/health":
		return method == http.MethodGet
	case "/auth/captcha":
		return method == http.MethodGet
	case "/auth/captcha/verify", "/auth/login", "/auth/refresh":
		return method == http.MethodPost
	default:
		return false
	}
}

func normalizeIDSegments(path string) string {
	re := regexp.MustCompile(`/[0-9]+`)
	return re.ReplaceAllString(path, "/:id")
}

func permissionByMethod(method string, get string, post string, put string, del string) string {
	var permission string
	switch method {
	case http.MethodGet:
		permission = get
	case http.MethodPost:
		permission = post
	case http.MethodPut, http.MethodPatch:
		permission = put
	case http.MethodDelete:
		permission = del
	default:
		return PermissionDeny
	}
	if permission == "" {
		return PermissionDeny
	}
	return permission
}

func dictPermission(path string, method string) string {
	if method == http.MethodGet {
		return "datadict:view"
	}
	switch method {
	case http.MethodPost:
		return "datadict:create"
	case http.MethodPut, http.MethodPatch:
		return "datadict:update"
	case http.MethodDelete:
		return "datadict:delete"
	default:
		return "settings:update"
	}
}

func recyclePermission(path string, method string) string {
	if method == http.MethodGet {
		return "recycle:view"
	}
	switch {
	case method == http.MethodDelete:
		return "recycle:purge"
	case strings.HasSuffix(path, "/restore"):
		return "recycle:restore"
	case strings.Contains(path, "/purge-all"):
		return "recycle:purge"
	case strings.Contains(path, "/purge"):
		return "recycle:purge"
	default:
		return "recycle:view"
	}
}

func schedulerPermission(path string, method string) string {
	if method == http.MethodGet {
		return "scheduler:view"
	}
	switch {
	case strings.HasSuffix(path, "/toggle"):
		return "scheduler:toggle"
	case strings.HasSuffix(path, "/run"):
		return "scheduler:run"
	default:
		return permissionByMethod(method, "scheduler:view", "scheduler:create", "scheduler:update", "scheduler:delete")
	}
}
