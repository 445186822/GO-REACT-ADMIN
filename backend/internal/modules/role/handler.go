package role

import (
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
	group := g.Group("/roles", middleware.Auth(h.jwtSecret), middleware.RequirePermission(h.db))
	group.GET("", h.List)
}

type Row struct {
	ID          int64   `json:"id"`
	Code        string  `json:"code"`
	Name        string  `json:"name"`
	Description *string `json:"description"`
	Status      string  `json:"status"`
}

func (h *Handler) List(c echo.Context) error {
	rows, err := h.db.Query(c.Request().Context(), `SELECT id, code, name, description, status FROM sys_roles WHERE deleted_at IS NULL ORDER BY id`)
	if err != nil {
		return err
	}
	defer rows.Close()
	items := make([]Row, 0)
	for rows.Next() {
		var item Row
		if err := rows.Scan(&item.ID, &item.Code, &item.Name, &item.Description, &item.Status); err != nil {
			return err
		}
		items = append(items, item)
	}
	return response.OK(c, items)
}
