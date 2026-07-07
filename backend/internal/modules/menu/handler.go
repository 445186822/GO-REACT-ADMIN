package menu

import (
	"net/http"
	"strconv"
	"strings"

	"enterprise-demo/backend/internal/http/middleware"
	"enterprise-demo/backend/internal/http/response"
	"enterprise-demo/backend/internal/util"

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
	group.POST("", h.Create)
	group.PUT("/:id", h.Update)
	group.DELETE("/:id", h.Delete)
}

type Row struct {
	ID        int64   `json:"id"`
	ParentID  *int64  `json:"parent_id"`
	Type      string  `json:"type"`
	Code      string  `json:"code"`
	Name      string  `json:"name"`
	Path      *string `json:"path"`
	Component *string `json:"component"`
	Icon      *string `json:"icon"`
	SortOrder int     `json:"sort_order"`
}

type Form struct {
	ParentID  *int64  `json:"parent_id"`
	Type      string  `json:"type"`
	Code      string  `json:"code"`
	Name      string  `json:"name"`
	Path      *string `json:"path"`
	Component *string `json:"component"`
	Icon      *string `json:"icon"`
	SortOrder int     `json:"sort_order"`
}

func (h *Handler) List(c echo.Context) error {
	rows, err := h.db.Query(c.Request().Context(), `SELECT id, parent_id, type, code, name, path, component, icon, sort_order FROM sys_menus WHERE deleted_at IS NULL ORDER BY sort_order, id`)
	if err != nil {
		return err
	}
	defer rows.Close()
	items := make([]Row, 0)
	for rows.Next() {
		var item Row
		if err := rows.Scan(&item.ID, &item.ParentID, &item.Type, &item.Code, &item.Name, &item.Path, &item.Component, &item.Icon, &item.SortOrder); err != nil {
			return err
		}
		items = append(items, item)
	}
	return response.OK(c, items)
}

func (h *Handler) Create(c echo.Context) error {
	var form Form
	if err := c.Bind(&form); err != nil {
		return err
	}
	if err := normalizeMenuForm(&form); err != nil {
		return err
	}
	if err := h.ensureParentExists(c, form.ParentID, 0); err != nil {
		return err
	}

	var id int64
	err := h.db.QueryRow(c.Request().Context(), `
INSERT INTO sys_menus (parent_id, type, code, name, path, component, icon, sort_order)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING id`, form.ParentID, form.Type, form.Code, form.Name, form.Path, form.Component, form.Icon, form.SortOrder).Scan(&id)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			return response.NewError(http.StatusConflict, "RESOURCE_CONFLICT", "menu code already exists")
		}
		return err
	}
	return response.Created(c, map[string]int64{"id": id})
}

func (h *Handler) Update(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "invalid id")
	}
	var form Form
	if err := c.Bind(&form); err != nil {
		return err
	}
	if err := normalizeMenuForm(&form); err != nil {
		return err
	}
	if err := h.ensureParentExists(c, form.ParentID, id); err != nil {
		return err
	}

	tag, err := h.db.Exec(c.Request().Context(), `
UPDATE sys_menus
SET parent_id = $2, type = $3, code = $4, name = $5, path = $6, component = $7, icon = $8, sort_order = $9, updated_at = now()
WHERE id = $1 AND deleted_at IS NULL`,
		id, form.ParentID, form.Type, form.Code, form.Name, form.Path, form.Component, form.Icon, form.SortOrder)
	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			return response.NewError(http.StatusConflict, "RESOURCE_CONFLICT", "menu code already exists")
		}
		return err
	}
	if tag.RowsAffected() == 0 {
		return response.NewError(http.StatusNotFound, "RESOURCE_NOT_FOUND", "menu not found")
	}
	return response.OK(c, map[string]bool{"updated": true})
}

func (h *Handler) Delete(c echo.Context) error {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "invalid id")
	}
	var children int
	if err := h.db.QueryRow(c.Request().Context(), `SELECT count(*) FROM sys_menus WHERE parent_id = $1 AND deleted_at IS NULL`, id).Scan(&children); err != nil {
		return err
	}
	if children > 0 {
		return response.NewError(http.StatusConflict, "RESOURCE_CONFLICT", "menu has child items")
	}
	tag, err := h.db.Exec(c.Request().Context(), `UPDATE sys_menus SET deleted_at = now(), updated_at = now() WHERE id = $1 AND deleted_at IS NULL`, id)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return response.NewError(http.StatusNotFound, "RESOURCE_NOT_FOUND", "menu not found")
	}
	return response.OK(c, map[string]bool{"deleted": true})
}

func normalizeMenuForm(form *Form) error {
	form.Type = strings.ToLower(strings.TrimSpace(form.Type))
	form.Code = strings.TrimSpace(form.Code)
	form.Name = strings.TrimSpace(form.Name)
	form.Path = util.TrimStringPtr(form.Path)
	form.Component = util.TrimStringPtr(form.Component)
	form.Icon = util.TrimStringPtr(form.Icon)
	if form.Type == "" {
		form.Type = "page"
	}
	if form.Type != "directory" && form.Type != "page" && form.Type != "button" {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "type must be directory, page, or button")
	}
	if form.Code == "" {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "code is required")
	}
	if form.Name == "" {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "name is required")
	}
	return nil
}

func (h *Handler) ensureParentExists(c echo.Context, parentID *int64, selfID int64) error {
	if parentID == nil {
		return nil
	}
	if *parentID == selfID {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "parent cannot be itself")
	}
	var parentType string
	if err := h.db.QueryRow(c.Request().Context(), `SELECT COALESCE((SELECT type FROM sys_menus WHERE id = $1 AND deleted_at IS NULL), '')`, *parentID).Scan(&parentType); err != nil {
		return err
	}
	if parentType == "" {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "parent menu not found")
	}
	if parentType == "button" {
		return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "button menu cannot be parent")
	}
	if selfID > 0 {
		var isDescendant bool
		if err := h.db.QueryRow(c.Request().Context(), `
WITH RECURSIVE descendants AS (
  SELECT id FROM sys_menus WHERE parent_id = $1 AND deleted_at IS NULL
  UNION ALL
  SELECT m.id FROM sys_menus m
  JOIN descendants d ON m.parent_id = d.id
  WHERE m.deleted_at IS NULL
)
SELECT EXISTS (SELECT 1 FROM descendants WHERE id = $2)`, selfID, *parentID).Scan(&isDescendant); err != nil {
			return err
		}
		if isDescendant {
			return response.NewError(http.StatusBadRequest, "VALIDATION_ERROR", "parent cannot be a descendant")
		}
	}
	return nil
}
