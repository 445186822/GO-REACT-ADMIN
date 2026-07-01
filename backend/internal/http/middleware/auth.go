package middleware

import (
	"net/http"
	"strings"

	"enterprise-demo/backend/internal/auth"
	"enterprise-demo/backend/internal/http/response"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
)

const (
	CurrentUserIDKey  = "current_user_id"
	ActiveRoleCodeKey = "active_role_code"
	ActiveRoleHeader  = "X-Active-Role"
	PermissionPublic  = "__public__"
	PermissionDeny    = "__deny__"
)

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
			c.Set(ActiveRoleCodeKey, strings.TrimSpace(c.Request().Header.Get(ActiveRoleHeader)))
			return next(c)
		}
	}
}

func CurrentUserID(c echo.Context) int64 {
	userID, _ := c.Get(CurrentUserIDKey).(int64)
	return userID
}

func ActiveRoleCode(c echo.Context) string {
	roleCode, _ := c.Get(ActiveRoleCodeKey).(string)
	return strings.TrimSpace(roleCode)
}

func RequirePermission(db *pgxpool.Pool) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			permission := PermissionForRequest(c.Request().Method, c.Request().URL.Path)
			if permission == PermissionPublic {
				return next(c)
			}
			if permission == PermissionDeny || permission == "" {
				return response.NewError(http.StatusForbidden, "PERMISSION_DENIED", "permission denied")
			}
			userID := CurrentUserID(c)
			activeRole := ActiveRoleCode(c)
			var allowed bool
			if err := db.QueryRow(c.Request().Context(), `
SELECT EXISTS (
  SELECT 1
  FROM sys_user_roles ur
  JOIN sys_roles r ON r.id = ur.role_id
  JOIN sys_role_menus rm ON rm.role_id = ur.role_id
  JOIN sys_menus m ON m.id = rm.menu_id
  WHERE ur.user_id = $1
    AND m.code = $2
    AND ($3 = '' OR lower(r.code) = lower($3) OR lower(r.name) = lower($3))
    AND r.deleted_at IS NULL
    AND r.status = 'ACTIVE'
    AND m.deleted_at IS NULL
)`, userID, permission, activeRole).Scan(&allowed); err != nil {
				return err
			}
			if !allowed {
				return response.NewError(http.StatusForbidden, "PERMISSION_DENIED", "permission denied")
			}
			return next(c)
		}
	}
}
