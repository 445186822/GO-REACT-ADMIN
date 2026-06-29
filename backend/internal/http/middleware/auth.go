package middleware

import (
	"net/http"
	"regexp"
	"strings"

	"enterprise-demo/backend/internal/auth"
	"enterprise-demo/backend/internal/http/response"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
)

const CurrentUserIDKey = "current_user_id"

func Auth(secret string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			header := c.Request().Header.Get(echo.HeaderAuthorization)
			if !strings.HasPrefix(header, "Bearer ") {
				return response.NewError(http.StatusUnauthorized, "AUTH_INVALID_TOKEN", "missing bearer token")
			}
			claims, err := auth.Parse(secret, strings.TrimPrefix(header, "Bearer "))
			if err != nil {
				return response.NewError(http.StatusUnauthorized, "AUTH_INVALID_TOKEN", "invalid token")
			}
			c.Set(CurrentUserIDKey, claims.UserID)
			return next(c)
		}
	}
}

func CurrentUserID(c echo.Context) int64 {
	userID, _ := c.Get(CurrentUserIDKey).(int64)
	return userID
}

func RequirePermission(db *pgxpool.Pool) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			permission := PermissionForRequest(c.Request().Method, c.Request().URL.Path)
			if permission == "" {
				return next(c)
			}
			userID := CurrentUserID(c)
			var allowed bool
			if err := db.QueryRow(c.Request().Context(), `
SELECT EXISTS (
  SELECT 1
  FROM sys_user_roles ur
  JOIN sys_role_menus rm ON rm.role_id = ur.role_id
  JOIN sys_menus m ON m.id = rm.menu_id
  WHERE ur.user_id = $1
    AND m.code = $2
    AND m.deleted_at IS NULL
)`, userID, permission).Scan(&allowed); err != nil {
				return err
			}
			if !allowed {
				return response.NewError(http.StatusForbidden, "PERMISSION_DENIED", "permission denied")
			}
			return next(c)
		}
	}
}

func PermissionForRequest(method string, rawPath string) string {
	path := strings.TrimPrefix(rawPath, "/api/v1")
	path = normalizeIDSegments(path)

	switch {
	case path == "/users":
		return permissionByMethod(method, "user:view", "user:create", "", "")
	case path == "/users/:id":
		return permissionByMethod(method, "", "", "user:update", "user:delete")
	case path == "/roles":
		return "role:view"
	case path == "/menus":
		return "menu:view"
	case path == "/departments":
		return "department:view"
	case path == "/customers":
		return permissionByMethod(method, "customer:view", "customer:create", "", "")
	case path == "/customers/export":
		return "customer:view"
	case path == "/customers/:id":
		return permissionByMethod(method, "", "", "customer:update", "customer:delete")
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
	case strings.HasPrefix(path, "/ai-assistant/messages"):
		return "ai:chat"
	case strings.HasPrefix(path, "/ai-assistant/chat"), strings.HasPrefix(path, "/ai/chat"):
		return "ai:send"
	default:
		return ""
	}
}

func normalizeIDSegments(path string) string {
	re := regexp.MustCompile(`/[0-9]+`)
	return re.ReplaceAllString(path, "/:id")
}

func permissionByMethod(method string, get string, post string, put string, del string) string {
	switch method {
	case http.MethodGet:
		return get
	case http.MethodPost:
		return post
	case http.MethodPut, http.MethodPatch:
		return put
	case http.MethodDelete:
		return del
	default:
		return ""
	}
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

func systemPagePermission(path string) string {
	switch {
	case strings.HasPrefix(path, "/dict"):
		return "datadict:view"
	case strings.HasPrefix(path, "/recycle-bin"):
		return "recycle:view"
	case strings.HasPrefix(path, "/scheduler"):
		return "scheduler:view"
	default:
		return "settings:view"
	}
}
