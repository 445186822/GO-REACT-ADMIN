package settings

import (
	"net/http"
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
	group := g.Group("/settings", middleware.Auth(h.jwtSecret))
	group.GET("", h.List)
	group.PUT("/:key", h.Upsert)
}

type Row struct {
	ID           int64     `json:"id"`
	GroupKey     string    `json:"group_key"`
	SettingKey   string    `json:"setting_key"`
	SettingValue string    `json:"setting_value"`
	ValueType    string    `json:"value_type"`
	Description  *string   `json:"description"`
	IsEncrypted  bool      `json:"is_encrypted"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type UpsertRequest struct {
	GroupKey     string  `json:"group_key"`
	SettingValue string  `json:"setting_value"`
	ValueType    string  `json:"value_type"`
	Description  *string `json:"description"`
	IsEncrypted  bool    `json:"is_encrypted"`
}

func (h *Handler) List(c echo.Context) error {
	groupKey := c.QueryParam("group_key")
	rows, err := h.db.Query(c.Request().Context(), `
SELECT id, group_key, setting_key, setting_value, value_type, description, is_encrypted, updated_at
FROM sys_settings
WHERE ($1 = '' OR group_key = $1)
ORDER BY group_key, setting_key`, groupKey)
	if err != nil {
		return err
	}
	defer rows.Close()

	items := make([]Row, 0)
	for rows.Next() {
		var item Row
		if err := rows.Scan(&item.ID, &item.GroupKey, &item.SettingKey, &item.SettingValue, &item.ValueType, &item.Description, &item.IsEncrypted, &item.UpdatedAt); err != nil {
			return err
		}
		items = append(items, item)
	}
	return response.OK(c, items)
}

func (h *Handler) Upsert(c echo.Context) error {
	key := c.Param("key")
	if key == "" {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "setting key is required")
	}
	var req UpsertRequest
	if err := c.Bind(&req); err != nil {
		return err
	}
	if req.GroupKey == "" {
		req.GroupKey = "system"
	}
	if req.ValueType == "" {
		req.ValueType = "string"
	}
	var id int64
	if err := h.db.QueryRow(c.Request().Context(), `
INSERT INTO sys_settings (group_key, setting_key, setting_value, value_type, description, is_encrypted)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (setting_key) DO UPDATE SET
  group_key = EXCLUDED.group_key,
  setting_value = EXCLUDED.setting_value,
  value_type = EXCLUDED.value_type,
  description = EXCLUDED.description,
  is_encrypted = EXCLUDED.is_encrypted,
  updated_at = now()
RETURNING id`, req.GroupKey, key, req.SettingValue, req.ValueType, req.Description, req.IsEncrypted).Scan(&id); err != nil {
		return err
	}
	return response.OK(c, map[string]int64{"id": id})
}
