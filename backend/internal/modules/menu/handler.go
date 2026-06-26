package menu

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
	group := g.Group("/menus", middleware.Auth(h.jwtSecret), middleware.RequirePermission(h.db))
	group.GET("", h.List)
}

type Row struct {
	ID       int64   `json:"id"`
	ParentID *int64  `json:"parent_id"`
	Type     string  `json:"type"`
	Code     string  `json:"code"`
	Name     string  `json:"name"`
	Path     *string `json:"path"`
	Icon     *string `json:"icon"`
}

func (h *Handler) List(c echo.Context) error {
	rows, err := h.db.Query(c.Request().Context(), `SELECT id, parent_id, type, code, name, path, icon FROM sys_menus WHERE deleted_at IS NULL ORDER BY sort_order, id`)
	if err != nil {
		return err
	}
	defer rows.Close()
	items := make([]Row, 0)
	for rows.Next() {
		var item Row
		if err := rows.Scan(&item.ID, &item.ParentID, &item.Type, &item.Code, &item.Name, &item.Path, &item.Icon); err != nil {
			return err
		}
		items = append(items, item)
	}
	return response.OK(c, items)
}
