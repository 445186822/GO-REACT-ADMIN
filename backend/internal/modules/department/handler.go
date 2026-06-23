package department

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
	group := g.Group("/departments", middleware.Auth(h.jwtSecret))
	group.GET("", h.List)
}

type Row struct {
	ID       int64  `json:"id"`
	ParentID *int64 `json:"parent_id"`
	Code     string `json:"code"`
	Name     string `json:"name"`
	Status   string `json:"status"`
}

func (h *Handler) List(c echo.Context) error {
	rows, err := h.db.Query(c.Request().Context(), `SELECT id, parent_id, code, name, status FROM sys_departments WHERE deleted_at IS NULL ORDER BY sort_order, id`)
	if err != nil {
		return err
	}
	defer rows.Close()
	items := make([]Row, 0)
	for rows.Next() {
		var item Row
		if err := rows.Scan(&item.ID, &item.ParentID, &item.Code, &item.Name, &item.Status); err != nil {
			return err
		}
		items = append(items, item)
	}
	return response.OK(c, items)
}
