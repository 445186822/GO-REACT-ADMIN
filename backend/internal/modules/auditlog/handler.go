package auditlog

import (
	"net/http"
	"strconv"
	"time"

	"enterprise-demo/backend/internal/http/middleware"
	"enterprise-demo/backend/internal/http/response"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/labstack/echo/v4"
)

type Handler struct {
	db        *pgxpool.Pool
	jwtSecret string
}

func NewHandler(db *pgxpool.Pool, jwtSecret string) *Handler {
	return &Handler{db: db, jwtSecret: jwtSecret}
}

func (h *Handler) Register(g *echo.Group) {
	group := g.Group("/audit-logs", middleware.Auth(h.jwtSecret), middleware.RequirePermission(h.db))
	group.GET("", h.List)
	group.GET("/:id", h.Get)
}

type Row struct {
	ID           int64     `json:"id"`
	RequestID    string    `json:"request_id"`
	UserID       *int64    `json:"user_id"`
	Username     *string   `json:"username"`
	Action       string    `json:"action"`
	Resource     string    `json:"resource"`
	ResourceID   *string   `json:"resource_id"`
	Method       string    `json:"method"`
	Path         string    `json:"path"`
	IP           *string   `json:"ip"`
	UserAgent    *string   `json:"user_agent"`
	ResponseCode int       `json:"response_code"`
	Success      bool      `json:"success"`
	ErrorMessage *string   `json:"error_message"`
	CreatedAt    time.Time `json:"created_at"`
}

func (h *Handler) List(c echo.Context) error {
	page, pageSize := pagination(c)
	offset := (page - 1) * pageSize
	username := c.QueryParam("username")
	resource := c.QueryParam("resource")

	var total int64
	if err := h.db.QueryRow(c.Request().Context(), `
SELECT count(*)
FROM sys_audit_logs
WHERE ($1 = '' OR username ILIKE '%' || $1 || '%')
  AND ($2 = '' OR resource = $2)`, username, resource).Scan(&total); err != nil {
		return err
	}

	rows, err := h.db.Query(c.Request().Context(), `
SELECT id, request_id, user_id, username, action, resource, resource_id, method, path, ip, user_agent,
       response_code, success, error_message, created_at
FROM sys_audit_logs
WHERE ($1 = '' OR username ILIKE '%' || $1 || '%')
  AND ($2 = '' OR resource = $2)
ORDER BY created_at DESC
LIMIT $3 OFFSET $4`, username, resource, pageSize, offset)
	if err != nil {
		return err
	}
	defer rows.Close()

	items := make([]Row, 0)
	for rows.Next() {
		var item Row
		if err := rows.Scan(&item.ID, &item.RequestID, &item.UserID, &item.Username, &item.Action, &item.Resource, &item.ResourceID, &item.Method, &item.Path, &item.IP, &item.UserAgent, &item.ResponseCode, &item.Success, &item.ErrorMessage, &item.CreatedAt); err != nil {
			return err
		}
		items = append(items, item)
	}
	return response.OK(c, response.Page[Row]{Items: items, Page: page, PageSize: pageSize, Total: total})
}

func (h *Handler) Get(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "invalid id")
	}
	var item Row
	if err := h.db.QueryRow(c.Request().Context(), `
SELECT id, request_id, user_id, username, action, resource, resource_id, method, path, ip, user_agent,
       response_code, success, error_message, created_at
FROM sys_audit_logs
WHERE id = $1`, id).Scan(&item.ID, &item.RequestID, &item.UserID, &item.Username, &item.Action, &item.Resource, &item.ResourceID, &item.Method, &item.Path, &item.IP, &item.UserAgent, &item.ResponseCode, &item.Success, &item.ErrorMessage, &item.CreatedAt); err != nil {
		return response.NewError(http.StatusNotFound, "RESOURCE_NOT_FOUND", "audit log not found")
	}
	return response.OK(c, item)
}

func pagination(c echo.Context) (int64, int64) {
	page, _ := strconv.ParseInt(c.QueryParam("page"), 10, 64)
	pageSize, _ := strconv.ParseInt(c.QueryParam("page_size"), 10, 64)
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 10000 {
		pageSize = 20
	}
	return page, pageSize
}
