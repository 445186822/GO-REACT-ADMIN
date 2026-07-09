package middleware

import (
	"context"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
)

func Audit(db *pgxpool.Pool) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			err := next(c)
			recordAudit(c, db, err)
			return err
		}
	}
}

func recordAudit(c echo.Context, db *pgxpool.Pool, handlerErr error) {
	req := c.Request()
	if req.Method == "GET" || req.Method == "OPTIONS" || !strings.HasPrefix(req.URL.Path, "/api/v1/") {
		return
	}

	auditCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	requestID, _ := c.Get(RequestIDKey).(string)
	userID := CurrentUserID(c)
	var username *string
	if value := CurrentUsername(c); value != "" {
		username = &value
	} else if userID > 0 {
		var value string
		if err := db.QueryRow(auditCtx, `SELECT username FROM sys_users WHERE id = $1`, userID).Scan(&value); err == nil {
			username = &value
		}
	}

	status := c.Response().Status
	if status == 0 {
		status = 500
	}

	resource, resourceID := auditResource(req.URL.Path)
	errorMessage := ""
	if handlerErr != nil {
		errorMessage = handlerErr.Error()
	}

	_, _ = db.Exec(auditCtx, `
INSERT INTO sys_audit_logs (
  request_id, user_id, username, action, resource, resource_id, method, path, ip, user_agent,
  response_code, success, error_message
) VALUES ($1, NULLIF($2, 0), $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NULLIF($13, ''))`,
		requestID,
		userID,
		username,
		req.Method+" "+resource,
		resource,
		resourceID,
		req.Method,
		req.URL.Path,
		c.RealIP(),
		req.UserAgent(),
		status,
		status >= 200 && status < 400 && handlerErr == nil,
		errorMessage,
	)
}

func auditResource(path string) (string, *string) {
	trimmed := strings.TrimPrefix(path, "/api/v1/")
	parts := strings.Split(strings.Trim(trimmed, "/"), "/")
	if len(parts) == 0 || parts[0] == "" {
		return "api", nil
	}
	resource := parts[0]
	if len(parts) > 1 {
		if _, err := strconv.ParseInt(parts[1], 10, 64); err == nil {
			return resource, &parts[1]
		}
	}
	return resource, nil
}
